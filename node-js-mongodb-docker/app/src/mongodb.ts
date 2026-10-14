import { Collection, MongoClient } from 'mongodb';
import logger from './logger.js';

export interface UserDocument {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
}

const client = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://localhost:27017');

export const users: Collection<UserDocument> = client.db('app').collection<UserDocument>('users');

// docker-compose's `depends_on` only waits for the mongodb *container* to start, not for
// the MongoDB server inside it to finish booting and start accepting connections — so the
// first connection attempt here can easily lose that race and get ECONNREFUSED. Retrying
// with a short delay instead of failing immediately covers that startup window.
export async function waitForMongo(retries = 20, delayMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await client.connect();
      await client.db('app').command({ ping: 1 });
      logger.info('Connected to MongoDB');
      return;
    } catch (err) {
      if (attempt === retries) {
        throw err;
      }
      logger.info(`MongoDB not ready yet (attempt ${attempt}/${retries}), retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
