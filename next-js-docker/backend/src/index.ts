import '@trace0/otel-logger'; // must be first
import { flush } from '@trace0/otel-logger';
import express from 'express';
import { storeUser } from './handlers/storeUser';
import { listUsers } from './handlers/listUsers';
import { ensureTableExists } from './dynamodb';

const app = express();
const PORT = parseInt(process.env.PORT ?? '4000', 10);

app.use(express.json());

app.post('/users', storeUser);
app.get('/users', listUsers);

async function main() {
  await ensureTableExists();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

main().catch(async (err) => {
  console.error('Failed to start server', err);
  await flush();
  process.exit(1);
});

process.once('SIGTERM', async () => { await flush(); process.exit(0); });
process.once('SIGINT', async () => { await flush(); process.exit(0); });
