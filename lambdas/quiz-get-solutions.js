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
    IndexName: 'QuizIdGSI',
    KeyConditionExpression: 'QuizId = :quizid and begins_with (SK, :sk)',
    ExpressionAttributeValues: {
      ':quizid': event.pathParameters.quizId,
      ':sk': 'SOLUTION#'
    },
    ProjectionExpression: ['UserId', 'Solutions', 'Score', 'Created', 'Modified']
  }

  let statusCode
  let body
  try {
    const response = await documentClient.query(params1).promise()
    if (response.Count === 0) {
      body = ''
      statusCode = '404'
    } else if (user.UserId !== response.Items[0].UserId) {
      body = {
        Message: 'This operation is only available to the quiz owner.'
      }
      statusCode = '400'
    } else if (!response.Items[0].Published) {
      body = {
        Message: 'This operation is not available until the quiz is published.'
      }
      statusCode = '400'
    } else {
      body = await documentClient.query(params2).promise()
      statusCode = '200'
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
