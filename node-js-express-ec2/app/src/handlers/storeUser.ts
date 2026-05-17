import { Request, Response } from 'express';
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

export async function storeUser(req: Request, res: Response): Promise<void> {
  const { name, email } = req.body as Partial<StoreUserBody>;

  if (!name || !email) {
    res.status(400).json({ error: 'name and email are required' });
    return;
  }

  const userId = generateUserId();
  const user: User = { userId, name, email, createdAt: new Date().toISOString() };

  console.log(`Storing user with id: ${userId}.`);

  try {
    await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: user }));
  } catch (err) {
    const error = err as Error;
    console.error('Failed to store user', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  console.log(`User stored successfully with id: ${userId}`);
  res.status(201).json(user);
}
