import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE_NAME = process.env.USERS_TABLE_NAME!;

interface StoreUserBody {
  name: string;
  email: string;
}

export interface User {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
}

function generateUserId(): string {
  return `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function storeUser(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return json(400, { error: 'Request body is required' });
  }

  let body: StoreUserBody;
  try {
    body = JSON.parse(event.body);
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { name, email } = body;
  if (!name || !email) {
    return json(400, { error: 'name and email are required' });
  }

  const userId = generateUserId();
  const user: User = {
    userId,
    name,
    email,
    createdAt: new Date().toISOString(),
  };

  console.log(`Storing user with id: ${userId}.`);

  try {
    await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: user }));
  } catch (err) {
    const error = err as Error;
    console.error('Failed to store user', { error: error.message, stack: error.stack });
    return json(500, { error: 'Internal server error' });
  }

  console.log(`User stored successfully with id: ${userId}`);
  return json(201, user);
}

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
