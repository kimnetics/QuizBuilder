# Quiz Builder

A quiz system done in a serverless style using AWS.

## Description

This system provides a REST API that allows quiz creators to create, configure and monitor quizzes. The API also allows users to take the created quizzes.

Amazon Cognito was used for authentication.

The API is described [here](API.md). The API was implemented with Amazon API Gateway.

The API connects to AWS Lambdas to provide business logic.

Amazon DynamoDB was used for the data store. A NoSQL Workbench file is provided in the repo which describes the schema.

Amazon CloudWatch Synthetics was used to create a canary to test the API endpoints.
