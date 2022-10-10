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

internals.divideByBase = function (digits, base, number) {
  if (number < base) {
    digits.push(number)
  } else {
    digits.push(number % base)
    internals.divideByBase(digits, base, Math.floor(number / base))
  }
}

internals.getQuizId = function () {
  const number = Math.floor(Math.random() * 308915776) // Max 6 digit base 26 number
  const digits = []
  internals.divideByBase(digits, 26, number)
  for (const i in digits) {
    digits[i] = digits[i] + 65
  }
  return String.fromCharCode(...digits)
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

  const quizId = internals.getQuizId()
  const currentDateTime = new Date().toISOString()

  let statusCode
  let body
  try {
    const params = {
      TableName: 'QuizBuilder',
      Item: {
        PK: `USER#${user.UserId}`,
        SK: `QUIZ#${quizId}`,
        UserId: user.UserId,
        QuizId: quizId,
        Name: eventBody.Name,
        Published: false,
        Deleted: false,
        Questions: eventBody.Questions,
        Created: currentDateTime,
        Modified: currentDateTime
      }
    }
    await documentClient.put(params).promise()
    statusCode = '201'
    body = {
      QuizId: quizId
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
