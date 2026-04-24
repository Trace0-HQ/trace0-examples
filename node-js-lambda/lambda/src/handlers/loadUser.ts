import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE_NAME = process.env.USERS_TABLE_NAME!;

export async function loadUser(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.pathParameters?.userId;
  if (!userId) {
    return json(400, { error: 'userId path parameter is required' });
  }

  console.log(`Loading user with id: ${userId}`);

  let result;
  try {
    result = await dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
  } catch (err) {
    const error = err as Error;
    console.error('Failed to load user', { error: error.message, stack: error.stack });
    return json(500, { error: 'Internal server error' });
  }

  if (!result.Item) {
    console.error(`User not found with id: ${userId}.`);
    return json(404, { error: 'User not found' });
  }

  console.log(`User loaded successfully with id: ${userId}.`);
  return json(200, result.Item);
}

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
