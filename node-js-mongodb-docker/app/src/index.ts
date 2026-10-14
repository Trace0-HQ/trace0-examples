import express from 'express';
import { storeUser } from './handlers/storeUser';
import { loadUser } from './handlers/loadUser';
import { updateUser } from './handlers/updateUser';
import { deleteUser } from './handlers/deleteUser';
import { waitForMongo } from './mongodb';
import logger from './logger.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json());

app.post('/users', storeUser);
app.get('/users/:userId', loadUser);
app.put('/users/:userId', updateUser);
app.delete('/users/:userId', deleteUser);

async function main() {
  await waitForMongo();
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`)
  });
}

main().catch(async (err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
