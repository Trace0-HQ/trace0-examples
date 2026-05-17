import express from 'express';
import { storeUser } from './handlers/storeUser';
import { loadUser } from './handlers/loadUser';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json());

app.post('/users', storeUser);
app.get('/users/:userId', loadUser);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
