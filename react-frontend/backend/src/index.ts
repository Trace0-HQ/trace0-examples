import express from 'express';
import logger from './logger.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '4000', 10);

app.get('/api/hello', (req, res) => {
  logger.info('Handling request from the frontend');
  res.json({
    message: 'Hello from the backend!',
  });
});

app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
