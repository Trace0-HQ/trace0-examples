import { Request, Response } from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.USERS_TABLE_NAME!;

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
