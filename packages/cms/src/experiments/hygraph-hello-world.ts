import { Client, SimpleFieldType, type BatchMigrationCreateModelInput, type BatchMigrationCreateSimpleFieldInput } from '@hygraph/management-sdk';
import 'dotenv/config';
import { hygraphContentClient } from './hygraph-urql-client';
import { ensureModel, ensureSimpleField } from './hygraph-existence-utils';

/**
 * Hygraph Hello World - Ensure Model and Field Example
 * 
 * This script demonstrates using urql to check for model/field existence
 * and the Management SDK to create them if missing.
 * 
 * Required environment variables:
 * - HYGRAPH_MGMT_TOKEN: Management API auth token
 * - HYGRAPH_MGMT_ENDPOINT: Management API endpoint
 * - HYGRAPH_CONTENT_ENDPOINT: Content API endpoint for existence checks
 * - HYGRAPH_CONTENT_TOKEN: Optional Content API auth token
 */

const authToken = process.env['HYGRAPH_MGMT_TOKEN'];
const endpoint = process.env['HYGRAPH_MGMT_ENDPOINT'];

if (!authToken || !endpoint) {
  throw new Error('HYGRAPH_MGMT_TOKEN and HYGRAPH_MGMT_ENDPOINT must be set');
}

const mgmtClient = new Client({
  authToken: authToken,
  endpoint: endpoint,
});

const apiId = 'Yada';
const apiIdPlural = 'Yadas';
const displayName = 'Yadas';
const description = 'A collection of Yadas.';

const run = async () => {
  // Ensure model exists (check + create if missing)
  const modelParams: BatchMigrationCreateModelInput = {
    apiId: apiId,
    apiIdPlural: apiIdPlural,
    displayName: displayName,
    description: description,
  };

  const modelResult = await ensureModel({
    ...modelParams,
    urqlClient: hygraphContentClient,
    mgmtClient: mgmtClient,
  });
  console.log(`Model ${apiId} ${modelResult.created ? 'does not exist, creating' : 'already exists, skipping creation'}`);

  // Ensure field exists (check + create if missing)
  const fieldParams: BatchMigrationCreateSimpleFieldInput = {
    parentApiId: apiId,
    apiId: 'canExist',
    type: SimpleFieldType.Boolean,
    displayName: 'Can Exist?',
  };

  const fieldResult = await ensureSimpleField({
    ...fieldParams,
    parentPluralApiId: apiIdPlural, // needed for existence check
    urqlClient: hygraphContentClient,
    mgmtClient: mgmtClient,
  });
  console.log(`Field canExist ${fieldResult.created ? 'does not exist, creating' : 'already exists, skipping creation'}`);

  // Execute all queued operations
  const result = await mgmtClient.run(true);

  if (result.errors) {
    throw new Error(result.errors);
  }

  console.log('Migrations executed successfully:', result);
  return result;
};

run()
  .then((result) => {
    console.log('Done!');
  })
  .catch((error) => {
    console.error('Migration run failed:', error);
    process.exit(1);
  });
