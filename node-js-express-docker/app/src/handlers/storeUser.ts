import { Request, Response } from 'express';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo, TABLE_NAME } from '../dynamodb';
import logger from '../logger.js';

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

  logger.info(`Storing user with id: ${userId}.`);

  try {
    if (email === 'trigger-error@example.com') {
      throw new Error(`Invalid email address: ${email}.`);
    }

    await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: user }));
  } catch (err) {
    const error = err as Error;
    logger.error({ err: error }, 'Failed to store user');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  logger.info(`User stored successfully with id: ${userId}`);
  res.status(201).json(user);
}
