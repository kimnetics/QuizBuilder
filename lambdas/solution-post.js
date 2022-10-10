const AWS = require('aws-sdk')
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-1' })

const internals = {}

// TODO: Connect to actual user service.
internals.getUserAsync = async function (incomingUserId) {
  let user
  switch (incomingUserId) {
    case '1':
      user = {
        UserId: 'curiouscat',
        Name: 'Curious Cat',
        Email: 'test1@kimnetics.com'
      }
      break
    case '2':
      user = {
        UserId: 'dashingdog',
        Name: 'Dashing Dog',
        Email: 'test2@kimnetics.com'
      }
      break
    default:
      user = {
        UserId: 'artfulantelope',
        Name: 'Artful Antelope',
        Email: 'test3@kimnetics.com'
      }
  }

  return user
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
  // TODO: Validate incoming data.
  // Solutions

  const incomingUserId = event.headers.UserId
  const user = await internals.getUserAsync(incomingUserId)
  const currentDateTime = new Date().toISOString()
  const eventBody = JSON.parse(event.body)
  const params1 = {
    TableName: 'QuizBuilder',
    IndexName: 'QuizIdGSI',
    KeyConditionExpression: 'QuizId = :quizid and SK = :sk',
    FilterExpression: 'Deleted = :deleted',
    ExpressionAttributeNames: {
      '#name': 'Name'
    },
    ExpressionAttributeValues: {
      ':quizid': event.pathParameters.quizId,
      ':sk': `QUIZ#${event.pathParameters.quizId}`,
      ':deleted': false
    },
    ProjectionExpression: ['UserId', 'QuizId', '#name', 'Published', 'Questions', 'Created', 'Modified']
  }
  const params2 = {
    TableName: 'QuizBuilder',
    KeyConditionExpression: 'PK = :pk and SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `USER#${user.UserId}`,
      ':sk': `SOLUTION#${event.pathParameters.quizId}`
    },
    ProjectionExpression: ['QuizId', 'Solutions', 'Score', 'Created', 'Modified']
  }

  let questions
  let solutions
  let score
  let statusCode
  let body
  try {
    let response = await documentClient.query(params1).promise()
    if (response.Count === 0) {
      body = ''
      statusCode = '404'
    } else if (user.UserId === response.Items[0].UserId) {
      body = {
        Message: 'Cannot submit solution to your own quiz.'
      }
      statusCode = '400'
    } else if (!response.Items[0].Published) {
      body = {
        Message: 'Cannot submit solution to an unpublished quiz.'
      }
      statusCode = '400'
    } else {
      questions = response.Items[0].Questions
      response = await documentClient.query(params2).promise()
      if (response.Count > 0) {
        body = {
          Message: 'Cannot submit more than one solution to a quiz.'
        }
        statusCode = '400'
      } else {
        solutions = eventBody.Solutions
        const response = {}
        score = internals.scoreSolutions(questions, solutions, response)
        if ('Message' in response) {
          body = {
            Message: response.Message
          }
          statusCode = '400'
        } else {
          const params3 = {
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
          await documentClient.put(params3).promise()
          body = {
            Solutions: solutions,
            Score: score
          }
          statusCode = '201'
        }
      }
    }
  } catch (err) {
    statusCode = err.statusCode
    body = err
  }

  const headers = {
    'Content-Type': 'application/json'
  }
  return {
    statusCode,
    headers,
    body: JSON.stringify(body)
  }
}

this.handler(
  {
    headers: {
      UserId: 1
    },
    pathParameters: {
      quizId: "AAAAAA"
    },
    body: "{\"Solutions\":[{\"QuestionId\":\"1\",\"Answer\":[\"No\"]},{\"QuestionId\":\"2\",\"Answer\":[\"Kelvin\",\"Fahrenheit\",\"Celsius\"]}]}"
  }
).then()
