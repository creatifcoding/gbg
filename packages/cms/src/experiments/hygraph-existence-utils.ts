import { Client as UrqlClient } from 'urql';
import { Client as MgmtClient, type BatchMigrationCreateModelInput, type BatchMigrationCreateSimpleFieldInput } from '@hygraph/management-sdk';

/**
 * Client types required for ensure utilities
 */
export type EnsureClients = {
  urqlClient: UrqlClient;
  mgmtClient: MgmtClient;
};

/**
 * Build a GraphQL query to probe for model existence
 * Uses Hygraph's auto-generated single-entry query (e.g., `post`)
 */
const buildModelProbeQuery = (apiId: string): string => `
  query TestModelExists {
    ${apiId}(where: { id: "fake-id" }) {
      id
    }
  }
`;

/**
 * Build a GraphQL query to probe for field existence
 * Uses Hygraph's auto-generated plural query (e.g., `posts`)
 */
const buildFieldProbeQuery = (pluralApiId: string, fieldApiId: string): string => `
  query TestFieldExists {
    ${pluralApiId}(first: 1) {
      id
      ${fieldApiId}
    }
  }
`;

/**
 * Check if a model exists using GraphQL introspection via urql
 * 
 * This is a read-only check that queries the Content API to see if the
 * auto-generated query for the model exists in the schema.
 * 
 * @param client - urql client configured for Hygraph Content API
 * @param apiId - The model API ID to check (e.g., "blob", "post")
 * @returns true if the model exists in the schema, false otherwise
 */
export async function modelExists(
  client: UrqlClient,
  apiId: string,
): Promise<boolean> {
  const query = buildModelProbeQuery(apiId);

  try {
    const result = await client.query(query, {}).toPromise();

    if (result.error) {
      const msg = result.error.message || '';
      // Hygraph/GraphQL validation error indicates model doesn't exist
      if (msg.includes(`Cannot query field "${apiId}" on type "Query"`)) {
        return false;
      }
      // Any other error: treat as "unknown", but don't claim model exists
      return false;
    }

    // If we got here, the schema accepted the field => model exists
    return true;
  } catch (error) {
    console.error(`Error checking model existence for ${apiId}:`, error);
    return false;
  }
}

/**
 * Check if a field exists within a model using GraphQL introspection via urql
 * 
 * This is a read-only check that queries the Content API to see if the
 * field can be selected from the model's plural query.
 * 
 * @param client - urql client configured for Hygraph Content API
 * @param pluralApiId - The model's plural API ID (e.g., "blobs", "posts")
 * @param fieldApiId - The field API ID to check (e.g., "canExist", "title")
 * @returns true if the field exists in the schema, false otherwise
 */
export async function fieldExists(
  client: UrqlClient,
  pluralApiId: string,
  fieldApiId: string,
): Promise<boolean> {
  const query = buildFieldProbeQuery(pluralApiId, fieldApiId);

  try {
    const result = await client.query(query, {}).toPromise();

    if (result.error) {
      const msg = result.error.message || '';
      // GraphQL validation error indicates field doesn't exist
      if (msg.includes(`Cannot query field "${fieldApiId}"`)) {
        return false;
      }
      // Unknown error (network, auth, etc.) => conservative false
      return false;
    }

    // Schema accepted the field selection => field exists
    return true;
  } catch (error) {
    console.error(`Error checking field existence for ${pluralApiId}.${fieldApiId}:`, error);
    return false;
  }
}

/**
 * Ensure a model exists, creating it if it doesn't
 * 
 * Checks model existence via urql (read-only Content API query),
 * then creates the model via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Model parameters + required clients
 * @returns Object indicating whether the model was created
 */
export async function ensureModel<
  TModelParams extends BatchMigrationCreateModelInput,
  TClients extends EnsureClients,
>(
  params: TModelParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...modelParams } = params;

  // Check existence via urql
  const exists = await modelExists(urqlClient, modelParams.apiId);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createModel(modelParams);
  return { created: true };
}

/**
 * Ensure a simple field exists, creating it if it doesn't
 * 
 * Checks field existence via urql (read-only Content API query),
 * then creates the field via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Field parameters + required clients + parentPluralApiId
 * @returns Object indicating whether the field was created
 */
export async function ensureSimpleField<
  TFieldParams extends BatchMigrationCreateSimpleFieldInput,
  TClients extends EnsureClients,
>(
  params: TFieldParams & TClients & { parentPluralApiId: string },
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, parentPluralApiId, ...fieldParams } = params;

  // Check existence via urql
  const exists = await fieldExists(urqlClient, parentPluralApiId, fieldParams.apiId);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createSimpleField(fieldParams);
  return { created: true };
}

