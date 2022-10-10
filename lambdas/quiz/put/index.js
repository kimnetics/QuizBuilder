const AWS = require('aws-sdk')
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-1' })

const Ajv = require('ajv')
const ajv = new Ajv()

const internals = {}

internals.optionsSchema = {
  type: 'object',
  properties: {
    OptionId: {
      type: 'string',
      minLength: 1
    },
    Rank: { type: 'integer' },
    Text: {
      type: 'string',
      minLength: 1
    }
  },
  required: ['OptionId', 'Rank', 'Text']
}

internals.questionsSchema = {
  type: 'object',
  properties: {
    QuestionId: {
      type: 'string',
      minLength: 1
    },
    Rank: { type: 'integer' },
    Text: {
      type: 'string',
      minLength: 1
    },
    Options: {
      type: 'array',
      items: internals.optionsSchema,
      minItems: 1,
      maxItems: 5
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
  required: ['QuestionId', 'Rank', 'Text', 'Options', 'Answer']
}

internals.quizSchema = {
  type: 'object',
  properties: {
    Name: {
      type: 'string',
      minLength: 1
    },
    Questions: {
      type: 'array',
      items: internals.questionsSchema,
      minItems: 1,
      maxItems: 10
    }
  },
  required: ['Name', 'Questions'],
  additionalProperties: false
}

internals.validate = ajv.compile(internals.quizSchema)

internals.validateData = function (data) {
  let message = ''

  const valid = internals.validate(data)
  if (valid) {
    // Verify question ids are unique.
    const questionsSet = new Set(data.Questions.map(item => item.QuestionId))
    if (questionsSet.size !== data.Questions.length) {
      message = 'Question ids must be unique.'
    }
    for (const question of data.Questions) {
      // Verify option ids are unique.
      const optionsSet = new Set(question.Options.map(item => item.OptionId))
      if (optionsSet.size !== question.Options.length) {
        message = 'Option ids must be unique.'
      }
      // Verify answer matches available options.
      for (const answer of question.Answer) {
        if (!optionsSet.has(answer)) {
          message = 'Answer must only contain available options.'
        }
      }
    }
  } else {
    message = `${internals.validate.errors[0].instancePath} ${internals.validate.errors[0].message}.`.trim()
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

exports.handler = async function (event) {
  const headers = {
    'Content-Type': 'application/json'
  }

  const eventBody = JSON.parse(event.body)
  const validationMessage = internals.validateData(eventBody)
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
      ProjectionExpression: ['UserId', 'Published']
    }
    const response = await documentClient.query(params).promise()
    if (response.Count === 0) {
      statusCode = '404'
      body = ''
    } else if (user.UserId !== response.Items[0].UserId) {
      statusCode = '400'
      body = {
        Message: 'This operation is only available to the quiz owner.'
      }
    } else if (response.Items[0].Published) {
      statusCode = '400'
      body = {
        Message: 'This operation is not available once the quiz is published.'
      }
    } else {
      params = {
        TableName: 'QuizBuilder',
        Key: {
          PK: `USER#${user.UserId}`,
          SK: `QUIZ#${event.pathParameters.quizId}`
        },
        UpdateExpression: 'set #name = :name, Questions = :questions, Modified = :modified',
        ExpressionAttributeNames: {
          '#name': 'Name'
        },
        ExpressionAttributeValues: {
          ':name': eventBody.Name,
          ':questions': eventBody.Questions,
          ':modified': currentDateTime
        }
      }
      await documentClient.update(params).promise()
      statusCode = '200'
      body = ''
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
