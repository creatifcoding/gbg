import { Client, SimpleFieldType } from '@hygraph/management-sdk';
import 'dotenv/config';

const authToken = process.env['HYGRAPH_TOKEN'];
const endpoint = process.env['HYGRAPH_ENDPOINT'];

if (!authToken || !endpoint) {
  throw new Error('HYGRAPH_TOKEN and HYGRAPH_ENDPOINT must be set');
}

const client = new Client({
  authToken: authToken,
  endpoint: endpoint,
});

const apiId = 'Blob';
const apiIdPlural = 'Blobs';
const displayName = 'Blob';
const description = 'A blob of data.';

const createModel = () => {
  client.createModel({
    apiId: apiId,
    apiIdPlural: apiIdPlural,
    displayName: displayName,
    description: description,
  });
};

const addFields = () => {
  client.createSimpleField({
    apiId: 'canExist',
    parentApiId: apiId,
    type: SimpleFieldType.Boolean,
    displayName: 'Can Exist?',
  });
};

const runMigrations = async () => {
  const result = await client.run(true);

  if (result.errors) {
    throw new Error(result.errors);
  }

  return result;
};

createModel();
addFields();
runMigrations()
  .then((result) => {
    console.log(`Migrations run: ${result}`);
  })
  .catch((error) => {
    console.error(`Migration run failed: ${error}`);
  });
