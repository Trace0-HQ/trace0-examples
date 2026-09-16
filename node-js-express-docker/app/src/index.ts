import express from 'express';
import { storeUser } from './handlers/storeUser';
import { loadUser } from './handlers/loadUser';
import { ensureTableExists } from './dynamodb';
import logger from './logger.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json());

app.post('/users', storeUser);
app.get('/users/:userId', loadUser);

async function main() {
  await ensureTableExists();
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`)
  });
}

main().catch(async (err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
