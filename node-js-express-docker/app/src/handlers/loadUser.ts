import { Request, Response } from 'express';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo, TABLE_NAME } from '../dynamodb';

export async function loadUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  console.log(`Loading user with id: ${userId}`);

  let result;
  try {
    result = await dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
  } catch (err) {
    const error = err as Error;
    console.error('Failed to load user', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  if (!result.Item) {
    console.error(`User not found with id: ${userId}.`);
    res.status(404).json({ error: 'User not found' });
    return;
  }

  console.log(`User loaded successfully with id: ${userId}.`);
  res.status(200).json(result.Item);
}
