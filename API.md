# Quiz Builder API

### Security
**QuizBuilderCognitoAuthorizer**

|apiKey|*API Key*|
|---|---|
|Name|Authorization|
|In|header|
|x-amazon-apigateway-authtype|cognito_user_pools|

### /quiz

#### GET
##### Description:

Get the list of quizzes for the user.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

#### POST
##### Description:

Create a quiz.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

### /quiz/{quizId}

#### GET
##### Description:

Get a quiz.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| quizId | path |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

#### PUT
##### Description:

Update the title and questions for a quiz.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| quizId | path |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

#### DELETE
##### Description:

Delete a quiz.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| quizId | path |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

### /quiz/{quizId}/admin/delete

#### POST
##### Description:

Administrator Only - Delete a quiz.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| quizId | path |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

### /quiz/{quizId}/admin/reset

#### POST
##### Description:

Administrator Only - Set quiz published and deleted to false.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| quizId | path |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

### /quiz/{quizId}/publish

#### POST
##### Description:

Publish a quiz.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| quizId | path |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

### /quiz/{quizId}/solutions

#### GET
##### Description:

Get all solutions for a quiz.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| quizId | path |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

### /register

#### POST
##### Description:

Register the user with the Quiz Builder system.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

### /solution

#### GET
##### Description:

Get the list of solutions for the user.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

### /solution/{quizId}

#### POST
##### Description:

Submit a solution for a quiz.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| quizId | path |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

### /solution/{quizId}/admin/delete

#### POST
##### Description:

Administrator Only - Delete all solutions for a quiz.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| quizId | path |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | 200 response | [Empty](#Empty) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| QuizBuilderCognitoAuthorizer | email |

### Models


#### Empty

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| Empty | object |  |  |