import { Request, Response } from 'express';
import { users } from '../mongodb';
import logger from '../logger.js';

interface UpdateUserBody {
  name: string;
  email: string;
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { name, email } = req.body as Partial<UpdateUserBody>;

  if (!name || !email) {
    res.status(400).json({ error: 'name and email are required' });
    return;
  }

  logger.info(`Updating user with id: ${userId}`);

  let user;
  try {
    user = await users.findOneAndUpdate(
      { userId },
      { $set: { name, email, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );
  } catch (err) {
    const error = err as Error;
    logger.error({ err: error }, 'Failed to update user');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  if (!user) {
    logger.error(`User not found with id: ${userId}.`);
    res.status(404).json({ error: 'User not found' });
    return;
  }

  logger.info(`User updated successfully with id: ${userId}.`);
  res.status(200).json(user);
}
