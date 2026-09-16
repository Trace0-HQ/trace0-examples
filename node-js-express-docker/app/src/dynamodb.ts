import { CreateTableCommand, DynamoDBClient, ResourceInUseException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import logger from './logger.js';

export const TABLE_NAME = process.env.USERS_TABLE_NAME ?? 'users';

// DynamoDB Local doesn't validate credentials, but the SDK still needs a
// credentials provider to resolve successfully before it'll make requests —
// these dummy values satisfy that without needing real AWS credentials.
const client = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT,
  region: process.env.AWS_REGION ?? 'local',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

export const dynamo = DynamoDBDocumentClient.from(client);

// DynamoDB Local starts empty on every container run (it's in-memory — see
// docker-compose.yml), so the table needs to be (re-)created on startup.
//
// docker-compose's `depends_on` only waits for the dynamodb-local *container*
// to start, not for its JVM to finish booting and actually start listening on
// 8000 — so the first connection attempt here can easily lose that race and
// get ECONNREFUSED. Retrying with a short delay instead of failing immediately
// covers that startup window.
export async function ensureTableExists(retries = 20, delayMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await client.send(
        new CreateTableCommand({
          TableName: TABLE_NAME,
          AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
          KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
          BillingMode: 'PAY_PER_REQUEST',
        })
      );
      logger.info(`Created table ${TABLE_NAME}`);
      return;
    } catch (err) {
      if (err instanceof ResourceInUseException) {
        return;
      }
      if (attempt === retries) {
        throw err;
      }
      logger.info(`DynamoDB Local not ready yet (attempt ${attempt}/${retries}), retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
