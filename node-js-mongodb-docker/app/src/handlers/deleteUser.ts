import { Request, Response } from 'express';
import { users } from '../mongodb';
import logger from '../logger.js';

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  logger.info(`Deleting user with id: ${userId}`);

  let result;
  try {
    result = await users.deleteOne({ userId });
  } catch (err) {
    const error = err as Error;
    logger.error({ err: error }, 'Failed to delete user');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  if (result.deletedCount === 0) {
    logger.error(`User not found with id: ${userId}.`);
    res.status(404).json({ error: 'User not found' });
    return;
  }

  logger.info(`User deleted successfully with id: ${userId}.`);
  res.status(204).send();
}
