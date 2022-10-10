const AWS = require('aws-sdk')
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-1' })

const Ajv = require('ajv')
const ajv = new Ajv()

const internals = {}

internals.answersSchema = {
  type: 'object',
  properties: {
    QuestionId: {
      type: 'string',
      minLength: 1
    },
    Answer: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1
      },
      minItems: 1,
      maxItems: 5,
      uniqueItems: true
    }
  },
  required: ['QuestionId', 'Answer']
}

internals.solutionSchema = {
  type: 'object',
  properties: {
    Solutions: {
      type: 'array',
      items: internals.answersSchema,
      minItems: 1,
      maxItems: 10
    }
  },
  required: ['Solutions'],
  additionalProperties: false
}

internals.validate = ajv.compile(internals.solutionSchema)

internals.validateData = function (data) {
  let message = ''

  const valid = internals.validate(data)
  if (valid) {
    // More validation to be done after reading quiz later.
  } else {
    message = `${internals.validate.errors[0].instancePath} ${internals.validate.errors[0].message}.`.trim()
  }

  return message
}

internals.validateData2 = function (questions, solutions) {
  let message = ''

  for (const solution of solutions) {
    let questionIdFound = false
    for (const question of questions) {
      if (question.QuestionId === solution.QuestionId) {
        // Verify answer matches available options.
        const optionsSet = new Set(question.Options.map(item => item.OptionId))
        for (const answer of solution.Answer) {
          if (!optionsSet.has(answer)) {
            message = 'Answer must only contain available options.'
            break
          }
        }
        questionIdFound = true
        break
      }
    }
    // Verify question id is valid.
    if (!questionIdFound) {
      message = 'Question ids must be valid.'
    }
  }

  return message
}

internals.getUser = async function (userId, response) {
  try {
    const params = {
      TableName: 'QuizBuilder',
      KeyConditionExpression: 'PK = :pk and SK = :sk',
      ExpressionAttributeNames: {
        '#name': 'Name'
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': `USER#${userId}`
      },
      ProjectionExpression: ['UserId', '#name', 'Email']
    }
    const response = await documentClient.query(params).promise()
    if (response.Count === 0) {
      return null
    } else {
      return response.Items[0]
    }
  } catch (err) {
    response.StatusCode = err.statusCode
    response.Error = err
    return null
  }
}

internals.scoreSolutions = function (questions, solutions, response) {
  let score = 0
  let totalScore = 0.0
  for (const question of questions) {
    // Find answer for question.
    for (const index in solutions) {
      const solution = solutions[index]
      if (solution.QuestionId === question.QuestionId) {
        // Is this a single answer question?
        if (question.Answer.length === 1) {
          // Was question skipped?
          if (solution.Answer.length === 0) {
            // Skip question.
            score = 0
          // Was a single answer given?
          } else if (solution.Answer.length === 1) {
            if (question.Answer[0] === solution.Answer[0]) {
              score = 1
            } else {
              score = -1
            }
          // Were multiple answers given?
          } else {
            response.Message = 'Multiple answers given to single answer question.'
            score = 0
            totalScore = 0.0
            break
          }
        } else {
          // Was question skipped?
          if (solution.Answer.length === 0) {
            // Skip question.
            score = 0
          } else {
            score = 0
            const rightWeight = 1.0 / question.Answer.length
            const wrongWeight = 1.0 / (question.Options.length - question.Answer.length)
            // Score each answer.
            for (const solutionAnswer of solution.Answer) {
              // Is answer correct?
              let correct = false
              for (const questionAnswer of question.Answer) {
                if (solutionAnswer === questionAnswer) {
                  correct = true
                  break
                }
              }
              if (correct) {
                score = score + rightWeight
              } else {
                score = score - wrongWeight
              }
            }
          }
        }
        solutions[index].Score = score
        totalScore = totalScore + score
        break
      }
    }
    if ('Message' in response) {
      break
    }
  }

  if (totalScore < 0) {
    totalScore = 0
  }
  return Math.floor((totalScore / questions.length) * 100)
}

exports.handler = async function (event) {
  const headers = {
    'Content-Type': 'application/json'
  }

  const eventBody = JSON.parse(event.body)
  let validationMessage = internals.validateData(eventBody)
  if (validationMessage !== '') {
    return {
      statusCode: '400',
      headers,
      body: JSON.stringify({
        Message: validationMessage
      })
    }
  }

  const incomingUserId = event.requestContext.authorizer.claims.username
  const response = {}
  const user = await internals.getUser(incomingUserId, response)
  if ('Error' in response) {
    return {
      statusCode: response.StatusCode,
      headers,
      body: JSON.stringify(response.Error)
    }
  }
  if (user === null) {
    return {
      statusCode: '400',
      headers,
      body: JSON.stringify({
        Message: 'User has not yet registered.'
      })
    }
  }

  const currentDateTime = new Date().toISOString()

  let statusCode
  let body
  try {
    let params = {
      TableName: 'QuizBuilder',
      IndexName: 'QuizIdGSI',
      KeyConditionExpression: 'QuizId = :quizid and SK = :sk',
      FilterExpression: 'Deleted = :deleted',
      ExpressionAttributeValues: {
        ':quizid': event.pathParameters.quizId,
        ':sk': `QUIZ#${event.pathParameters.quizId}`,
        ':deleted': false
      },
      ProjectionExpression: ['UserId', 'Published', 'Questions']
    }
    let response = await documentClient.query(params).promise()
    if (response.Count === 0) {
      return {
        statusCode: '404',
        headers,
        body: ''
      }
    }

    const questions = response.Items[0].Questions
    const solutions = eventBody.Solutions
    validationMessage = internals.validateData2(questions, solutions)
    if (validationMessage !== '') {
      return {
        statusCode: '400',
        headers,
        body: JSON.stringify({
          Message: validationMessage
        })
      }
    }

    if (user.UserId === response.Items[0].UserId) {
      statusCode = '400'
      body = {
        Message: 'Cannot submit solution to your own quiz.'
      }
    } else if (!response.Items[0].Published) {
      statusCode = '400'
      body = {
        Message: 'This operation is not available until the quiz is published.'
      }
    } else {
      params = {
        TableName: 'QuizBuilder',
        KeyConditionExpression: 'PK = :pk and SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `USER#${user.UserId}`,
          ':sk': `SOLUTION#${event.pathParameters.quizId}`
        },
        ProjectionExpression: ['QuizId']
      }
      response = await documentClient.query(params).promise()
      if (response.Count > 0) {
        statusCode = '400'
        body = {
          Message: 'Cannot submit more than one solution to a quiz.'
        }
      } else {
        const response = {}
        const score = internals.scoreSolutions(questions, solutions, response)
        if ('Message' in response) {
          statusCode = '400'
          body = {
            Message: response.Message
          }
        } else {
          params = {
            TableName: 'QuizBuilder',
            Item: {
              PK: `USER#${user.UserId}`,
              SK: `SOLUTION#${event.pathParameters.quizId}`,
              UserId: user.UserId,
              QuizId: event.pathParameters.quizId,
              Solutions: solutions,
              Score: score,
              Created: currentDateTime,
              Modified: currentDateTime
            }
          }
          await documentClient.put(params).promise()
          statusCode = '201'
          body = {
            Solutions: solutions,
            Score: score
          }
        }
      }
    }
  } catch (err) {
    statusCode = err.statusCode
    body = err
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(body)
  }
}
