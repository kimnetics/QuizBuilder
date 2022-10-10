const AWS = require('aws-sdk')
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-1' })

exports.handler = async function (event, context) {
  const headers = {
    'Content-Type': 'application/json'
  }

  const params1 = {
    TableName: 'QuizBuilder',
    IndexName: 'QuizIdGSI',
    KeyConditionExpression: 'QuizId = :quizid and begins_with (SK, :sk)',
    ExpressionAttributeValues: {
      ':quizid': event.pathParameters.quizId,
      ':sk': 'SOLUTION#'
    },
    ProjectionExpression: ['PK', 'SK', 'UserId', 'QuizId', 'Solutions', 'Score', 'Created', 'Modified']
  }

  let statusCode
  let body
  try {
    const response = await documentClient.query(params1).promise()
    if (response.Count === 0) {
      body = ''
      statusCode = '404'
    } else {
      for (const solution of response.Items) {
        const params2 = {
          TableName: 'QuizBuilder',
          Key: {
            PK: solution.PK,
            SK: solution.SK
          }
        }
        await documentClient.delete(params2).promise()
      }
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
