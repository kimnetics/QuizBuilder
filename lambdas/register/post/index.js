const AWS = require('aws-sdk')
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-1' })

const Ajv = require('ajv')
const ajv = new Ajv()

const internals = {}

internals.registerSchema = {
  type: 'object',
  properties: {
    UserId: {
      type: 'string',
      minLength: 1
    },
    Name: {
      type: 'string',
      minLength: 1
    },
    Email: {
      type: 'string',
      minLength: 1
    }
  },
  required: ['UserId', 'Name', 'Email'],
  additionalProperties: false
}

internals.validate = ajv.compile(internals.registerSchema)

internals.validateData = function (data) {
  let message = ''

  const valid = internals.validate(data)
  if (!valid) {
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

  let statusCode
  let body

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
  if (user) {
    return {
      statusCode: '400',
      headers,
      body: JSON.stringify({
        Message: 'User has already been registered.'
      })
    }
  }

  const currentDateTime = new Date().toISOString()

  try {
    const params = {
      TableName: 'QuizBuilder',
      Item: {
        PK: `USER#${incomingUserId}`,
        SK: `USER#${incomingUserId}`,
        UserId: eventBody.UserId,
        Name: eventBody.Name,
        Email: eventBody.Email,
        Created: currentDateTime,
        Modified: currentDateTime
      }
    }
    await documentClient.put(params).promise()
    statusCode = '201'
    body = {
      UserId: eventBody.UserId
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
