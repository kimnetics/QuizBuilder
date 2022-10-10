const synthetics = require('Synthetics')
const log = require('SyntheticsLogger')
const syntheticsConfiguration = synthetics.getConfiguration()

const internals = {}

internals.responseBody = {}

internals.callEndPoint = async function (name, method, path, token, body) {
  const callbackHandler = async function (res) {
    return new Promise((resolve, reject) => {
      if (res.statusCode < 200 || res.statusCode > 299) {
        throw res.statusCode + ' ' + res.statusMessage
      }

      let responseBody = ''
      res.on('data', (d) => {
        responseBody += d
      })

      res.on('end', () => {
        internals.responseBody = JSON.parse(responseBody)
        resolve()
      })
    })
  }

  const requestOptions = {
    hostname: '2iv8ek7ms1.execute-api.us-west-1.amazonaws.com',
    method,
    path,
    port: '443',
    protocol: 'https:',
    headers: {
      Authorization: token,
      'User-Agent': synthetics.getCanaryUserAgentString()
    },
    body
  }

  const stepConfig = {
    includeRequestHeaders: true,
    includeResponseHeaders: true,
    includeRequestBody: true,
    includeResponseBody: true,
    continueOnHttpStepFailure: false
  }

  await synthetics.executeHttpStep(name, requestOptions, callbackHandler, stepConfig)
}

internals.postSolution = async function (name, method, path, token, body, expectedQuestionScore, expectedQuizScore) {
  await internals.callEndPoint(name, method, path, token, body)
  if ((internals.responseBody.Solutions[0].Score - expectedQuestionScore) > 0.001) {
    throw `Incorrect question score returned. Expected ${expectedQuestionScore}. Received ${internals.responseBody.Solutions[0].Score}.`
  }
  if (internals.responseBody.Score !== expectedQuizScore) {
    throw `Incorrect quiz score returned. Expected ${expectedQuizScore}. Received ${internals.responseBody.Score}.`
  }
}

internals.apiCanary = async function () {
  syntheticsConfiguration.setConfig({
    restrictedHeaders: ['Authorization'], // Value of these headers will be redacted from logs and reports
    restrictedUrlParameters: [] // Values of these url parameters will be redacted from logs and reports
  })

  const user1Token = process.env.USER_1_TOKEN
  const user2Token = process.env.USER_2_TOKEN

  let body

  // Create a yes/no quiz.
  body = JSON.stringify({
    Name: 'Science Quiz',
    Questions: [
      {
        QuestionId: '1',
        Rank: 1,
        Text: 'Is the moon a star?',
        Options: [
          {
            OptionId: 'Yes',
            Rank: 1,
            Text: 'Yes'
          },
          {
            OptionId: 'No',
            Rank: 2,
            Text: 'No'
          }
        ],
        Answer: [
          'No'
        ]
      }
    ]
  })
  await internals.callEndPoint('Create a yes/no quiz.', 'POST', '/test/quiz', user1Token, body)
  const quizId = internals.responseBody.QuizId

  // Publish the quiz.
  await internals.callEndPoint('Publish the quiz.', 'POST', `/test/quiz/${quizId}/publish`, user1Token, '')

  // Submit correct solution for the yes/no quiz.
  body = JSON.stringify({
    Solutions: [
      {
        QuestionId: '1',
        Answer: [
          'No'
        ]
      }
    ]
  })
  await internals.postSolution('Submit correct solution for the yes/no quiz.', 'POST', `/test/solution/${quizId}`, user2Token, body, 1.0, 100)

  // Delete the solution.
  await internals.callEndPoint('Delete the solution.', 'POST', `/test/solution/${quizId}/admin/delete`, user2Token, '')

  // Submit incorrect solution for the yes/no quiz.
  body = JSON.stringify({
    Solutions: [
      {
        QuestionId: '1',
        Answer: [
          'Yes'
        ]
      }
    ]
  })
  await internals.postSolution('Submit incorrect solution for the yes/no quiz.', 'POST', `/test/solution/${quizId}`, user2Token, body, 0.0, 0)

  // Delete the solution.
  await internals.callEndPoint('Delete the solution.', 'POST', `/test/solution/${quizId}/admin/delete`, user2Token, '')

  // Reset the quiz.
  await internals.callEndPoint('Reset the quiz.', 'POST', `/test/quiz/${quizId}/admin/reset`, user2Token, '')

  // Change the quiz to multiple answer.
  body = JSON.stringify({
    Name: 'Science Quiz',
    Questions: [
      {
        QuestionId: '2',
        Rank: 2,
        Text: 'Temperature can be measured in which of the following?',
        Options: [
          {
            OptionId: 'Kelvin',
            Rank: 1,
            Text: 'Kelvin'
          },
          {
            OptionId: 'Fahrenheit',
            Rank: 2,
            Text: 'Fahrenheit'
          },
          {
            OptionId: 'Gram',
            Rank: 3,
            Text: 'Gram'
          },
          {
            OptionId: 'Celsius',
            Rank: 4,
            Text: 'Celsius'
          },
          {
            OptionId: 'Liter',
            Rank: 5,
            Text: 'Liter'
          }
        ],
        Answer: [
          'Kelvin',
          'Fahrenheit',
          'Celsius'
        ]
      }
    ]
  })
  await internals.callEndPoint('Change the quiz to multiple answer.', 'PUT', `/test/quiz/${quizId}`, user1Token, body)

  // Publish the quiz.
  await internals.callEndPoint('Publish the quiz.', 'POST', `/test/quiz/${quizId}/publish`, user1Token, '')

  // Submit 2/3 correct solution for the multiple answer quiz.
  body = JSON.stringify({
    Solutions: [
      {
        QuestionId: '2',
        Answer: [
          'Kelvin',
          'Fahrenheit'
        ]
      }
    ]
  })
  await internals.postSolution('Submit 2/3 correct solution for the multiple answer quiz.', 'POST', `/test/solution/${quizId}`, user2Token, body, 0.666, 66)

  // Delete the solution.
  await internals.callEndPoint('Delete the solution.', 'POST', `/test/solution/${quizId}/admin/delete`, user2Token, '')

  // Submit 3/3 correct solution for the multiple answer quiz.
  body = JSON.stringify({
    Solutions: [
      {
        QuestionId: '2',
        Answer: [
          'Kelvin',
          'Fahrenheit',
          'Celsius'
        ]
      }
    ]
  })
  await internals.postSolution('Submit 3/3 correct solution for the multiple answer quiz.', 'POST', `/test/solution/${quizId}`, user2Token, body, 1.0, 100)

  // Delete the solution.
  await internals.callEndPoint('Delete the solution.', 'POST', `/test/solution/${quizId}/admin/delete`, user2Token, '')

  // Submit 2/3 correct 1/2 incorrect solution for the multiple answer quiz.
  body = JSON.stringify({
    Solutions: [
      {
        QuestionId: '2',
        Answer: [
          'Kelvin',
          'Fahrenheit',
          'Gram'
        ]
      }
    ]
  })
  await internals.postSolution('Submit 2/3 correct 1/2 incorrect solution for the multiple answer quiz.', 'POST', `/test/solution/${quizId}`, user2Token, body, 0.166, 16)

  // Delete the solution.
  await internals.callEndPoint('Delete the solution.', 'POST', `/test/solution/${quizId}/admin/delete`, user2Token, '')

  // Submit 3/3 correct 2/2 incorrect solution for the multiple answer quiz.
  body = JSON.stringify({
    Solutions: [
      {
        QuestionId: '2',
        Answer: [
          'Kelvin',
          'Fahrenheit',
          'Gram',
          'Celsius',
          'Liter'
        ]
      }
    ]
  })
  await internals.postSolution('Submit 3/3 correct 2/2 incorrect solution for the multiple answer quiz.', 'POST', `/test/solution/${quizId}`, user2Token, body, 0.0, 0)

  // Delete the solution.
  await internals.callEndPoint('Delete the solution.', 'POST', `/test/solution/${quizId}/admin/delete`, user2Token, '')

  // Submit 2/2 incorrect solution for the multiple answer quiz.
  body = JSON.stringify({
    Solutions: [
      {
        QuestionId: '2',
        Answer: [
          'Gram',
          'Liter'
        ]
      }
    ]
  })
  await internals.postSolution('Submit 2/2 incorrect solution for the multiple answer quiz.', 'POST', `/test/solution/${quizId}`, user2Token, body, -1.0, 0)

  // Delete the solution.
  await internals.callEndPoint('Delete the solution.', 'POST', `/test/solution/${quizId}/admin/delete`, user2Token, '')

  // Delete the quiz.
  await internals.callEndPoint('Delete the quiz.', 'POST', `/test/quiz/${quizId}/admin/delete`, user1Token, '')
}

exports.handler = async () => {
  return await internals.apiCanary()
}
