import { Request, Response } from 'express';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo, TABLE_NAME } from '../dynamodb';
import logger from '../logger.js';

export async function loadUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  logger.info(`Loading user with id: ${userId}`);

  let result;
  try {
    result = await dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
  } catch (err) {
    const error = err as Error;
    logger.error({ err: error }, 'Failed to load user');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  if (!result.Item) {
    logger.error(`User not found with id: ${userId}.`);
    res.status(404).json({ error: 'User not found' });
    return;
  }

  logger.info(`User loaded successfully with id: ${userId}.`);
  res.status(200).json(result.Item);
}
