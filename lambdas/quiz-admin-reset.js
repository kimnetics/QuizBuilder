const AWS = require('aws-sdk')
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-1' })

exports.handler = async function (event) {
  const headers = {
    'Content-Type': 'application/json'
  }

  const currentDateTime = new Date().toISOString()
  const params1 = {
    TableName: 'QuizBuilder',
    IndexName: 'QuizIdGSI',
    KeyConditionExpression: 'QuizId = :quizid and SK = :sk',
    ExpressionAttributeNames: {
      '#name': 'Name'
    },
    ExpressionAttributeValues: {
      ':quizid': event.pathParameters.quizId,
      ':sk': `QUIZ#${event.pathParameters.quizId}`
    },
    ProjectionExpression: ['UserId', 'QuizId', '#name', 'Published', 'Questions', 'Created', 'Modified']
  }

  let statusCode
  let body
  try {
    const response = await documentClient.query(params1).promise()
    if (response.Count === 0) {
      body = ''
      statusCode = '404'
    } else {
      const params2 = {
        TableName: 'QuizBuilder',
        Key: {
          PK: `USER#${response.Items[0].UserId}`,
          SK: `QUIZ#${event.pathParameters.quizId}`
        },
        UpdateExpression: 'set Published = :published, Deleted = :deleted, Modified = :modified',
        ExpressionAttributeValues: {
          ':published': false,
          ':deleted': false,
          ':modified': currentDateTime
        }
      }
      await documentClient.update(params2).promise()
      body = ''
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
