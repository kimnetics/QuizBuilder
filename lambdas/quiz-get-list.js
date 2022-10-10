const AWS = require('aws-sdk')
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-1' })

const internals = {}

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

  const params = {
    TableName: 'QuizBuilder',
    KeyConditionExpression: 'PK = :pk and begins_with (SK, :sk)',
    FilterExpression: 'Deleted = :deleted',
    ExpressionAttributeNames: {
      '#name': 'Name'
    },
    ExpressionAttributeValues: {
      ':pk': `USER#${user.UserId}`,
      ':sk': 'QUIZ#',
      ':deleted': false
    },
    ProjectionExpression: ['QuizId', '#name', 'Published', 'Created', 'Modified']
  }

  let statusCode
  let body
  try {
    body = await documentClient.query(params).promise()
    statusCode = '200'
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
