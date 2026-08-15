import { Request, Response } from 'express';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo, TABLE_NAME } from '../dynamodb';
import type { User } from './storeUser';

export async function listUsers(_req: Request, res: Response): Promise<void> {
  console.log('Loading all users');

  let result;
  try {
    result = await dynamo.send(new ScanCommand({ TableName: TABLE_NAME }));
  } catch (err) {
    const error = err as Error;
    console.error('Failed to load users', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  const users = (result.Items ?? []) as User[];
  users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  console.log(`Loaded ${users.length} user(s)`);
  res.status(200).json(users);
}
