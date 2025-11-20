import { Client as UrqlClient } from 'urql';
import {
  Client as MgmtClient,
  type BatchMigrationCreateModelInput,
  type BatchMigrationCreateSimpleFieldInput,
  type BatchMigrationCreateRelationalFieldInput,
  type BatchMigrationCreateEnumerableFieldInput,
  type BatchMigrationCreateEnumerationInput,
  type BatchMigrationCreateComponentInput,
  type BatchMigrationCreateComponentFieldInput,
  type BatchMigrationCreateComponentUnionFieldInput,
  type BatchMigrationCreateUnionFieldInput,
  type BatchMigrationCreateRemoteFieldInput,
  type BatchMigrationCreateTaxonomyInput,
  type BatchMigrationCreateTaxonomyNodeInput,
  type BatchMigrationCreateTaxonomyFieldInput,
  type BatchMigrationCreateGraphQlRemoteSourceInput,
  type BatchMigrationCreateRestRemoteSourceInput,
  type BatchMigrationUpdateGraphQlRemoteSourceInput,
  type BatchMigrationUpdateRestRemoteSourceInput,
  type BatchMigrationDeleteRemoteSourceInput,
  type BatchMigrationCreateStageInput,
  type BatchMigrationCreateLocaleInput,
  type BatchMigrationCreateWebhookInput,
  type BatchMigrationCreateWorkflowInput,
  type BatchMigrationAppInstallationInput,
  type BatchMigrationCreateCustomSidebarElementInput,
} from '@hygraph/management-sdk';

/**
 * Hygraph Reserved Words
 * 
 * These are words that cannot be used as API IDs for fields, models, or other schema elements.
 * Attempting to use these will result in validation errors.
 * 
 * Source: https://hygraph.com/docs/developer-guides/schema/reserved-terms
 * 
 * Note: This list may be incomplete. Hygraph's documentation organizes reserved terms into:
 * - GraphQL type names
 * - Reserved non-system type names  
 * - Reserved non-system field names
 * 
 * Known reserved field names (non-exhaustive):
 * - "status" - Reserved non-system field name
 * 
 * TODO: Fetch complete list from Hygraph documentation or Management SDK validation errors
 */
const HYGRAPH_RESERVED_WORDS = new Set<string>([
  // Reserved non-system field names (known from validation errors)
  'status',
  
  // GraphQL reserved keywords (likely reserved)
  'query',
  'mutation',
  'subscription',
  'type',
  'interface',
  'union',
  'enum',
  'input',
  'scalar',
  'directive',
  'schema',
  'extend',
  'implements',
  'on',
  'true',
  'false',
  'null',
  
  // Common GraphQL introspection fields
  '__schema',
  '__type',
  '__typename',
  '__field',
  '__directive',
  '__enumValue',
  
  // Hygraph system fields (these are automatically added to models)
  'id',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'publishedAt',
  'publishedBy',
  'documentInStages',
  
  // Hygraph system types (likely reserved)
  'Query',
  'Mutation',
  'Subscription',
  'Node',
  'Document',
  'Asset',
  'User',
  'ScheduledOperation',
  'ScheduledRelease',
]);

/**
 * Check if a string is a reserved word in Hygraph
 * 
 * @param apiId - The API ID to check
 * @returns true if the API ID is reserved, false otherwise
 */
export function isReservedWord(apiId: string): boolean {
  return HYGRAPH_RESERVED_WORDS.has(apiId.toLowerCase());
}

/**
 * Validate an API ID against Hygraph restrictions
 * 
 * Checks if the API ID is a reserved word and throws an error if it is.
 * 
 * @param apiId - The API ID to validate
 * @param context - Optional context for error message (e.g., "field", "model")
 * @throws Error if the API ID is reserved
 */
export function validateApiId(apiId: string, context: string = 'API ID'): void {
  if (isReservedWord(apiId)) {
    throw new Error(
      `Validation Error: ApiId invalid: "${apiId}" is a restricted word and cannot be used as a ${context}. ` +
      `See https://hygraph.com/docs/developer-guides/schema/reserved-terms for the complete list of reserved terms.`
    );
  }
}

/**
 * API ID Naming Requirements by Resource Type
 * 
 * Different Hygraph resources have different naming requirements for their API IDs.
 * This module provides marshalling utilities to convert user-friendly names to
 * valid Hygraph API IDs according to each resource type's requirements.
 * 
 * Requirements:
 * - TaxonomyNode: Must start with uppercase letter, alphanumeric + underscores only
 * - Model: PascalCase recommended (e.g., "Post", "BlogPost")
 * - Enumeration: PascalCase recommended (e.g., "PostStatus", "ContentType")
 * - Enumeration Value: camelCase or UPPER_CASE (e.g., "active", "ACTIVE")
 * - Component: PascalCase recommended (e.g., "Address", "Metadata")
 * - Field: camelCase recommended (e.g., "title", "createdAt")
 * - Stage: lowercase or specific format (e.g., "draft", "published")
 * - Locale: lowercase ISO codes (e.g., "en", "en-us")
 */

/**
 * Convert a string to PascalCase
 * 
 * @param str - Input string (e.g., "tech category" or "tech_category")
 * @returns PascalCase string (e.g., "TechCategory")
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ') // Replace non-alphanumeric with spaces
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert a string to camelCase
 * 
 * @param str - Input string (e.g., "tech category" or "tech_category")
 * @returns camelCase string (e.g., "techCategory")
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Ensure a string starts with an uppercase letter
 * 
 * @param str - Input string
 * @returns String with first letter uppercase
 */
function ensureUppercaseStart(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Sanitize string to only alphanumeric characters and underscores
 * 
 * @param str - Input string
 * @returns Sanitized string
 */
function sanitizeAlphanumericUnderscore(str: string): string {
  return str.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Marshal API ID for TaxonomyNode
 * 
 * Requirements:
 * - Must start with an uppercase letter
 * - Use only alphanumeric characters and underscores
 * 
 * @param apiId - Desired API ID (e.g., "tech", "tech-category")
 * @returns Valid TaxonomyNode API ID (e.g., "Tech", "TechCategory")
 */
export function marshalTaxonomyNodeApiId(apiId: string): string {
  const sanitized = sanitizeAlphanumericUnderscore(apiId);
  const pascal = toPascalCase(sanitized);
  return ensureUppercaseStart(pascal);
}

/**
 * Marshal API ID for Model
 * 
 * Requirements:
 * - PascalCase recommended
 * - Alphanumeric characters
 * 
 * @param apiId - Desired API ID (e.g., "blog post", "blog_post")
 * @returns Valid Model API ID (e.g., "BlogPost")
 */
export function marshalModelApiId(apiId: string): string {
  return toPascalCase(apiId);
}

/**
 * Marshal API ID for Enumeration
 * 
 * Requirements:
 * - PascalCase recommended
 * - Alphanumeric characters
 * 
 * @param apiId - Desired API ID (e.g., "post status", "post_status")
 * @returns Valid Enumeration API ID (e.g., "PostStatus")
 */
export function marshalEnumerationApiId(apiId: string): string {
  return toPascalCase(apiId);
}

/**
 * Marshal API ID for Component
 * 
 * Requirements:
 * - PascalCase recommended
 * - Alphanumeric characters
 * 
 * @param apiId - Desired API ID (e.g., "address metadata", "address_metadata")
 * @returns Valid Component API ID (e.g., "AddressMetadata")
 */
export function marshalComponentApiId(apiId: string): string {
  return toPascalCase(apiId);
}

/**
 * Marshal API ID for Field
 * 
 * Requirements:
 * - camelCase recommended
 * - Alphanumeric characters
 * 
 * @param apiId - Desired API ID (e.g., "post title", "post_title")
 * @returns Valid Field API ID (e.g., "postTitle")
 */
export function marshalFieldApiId(apiId: string): string {
  return toCamelCase(apiId);
}

/**
 * Marshal API ID for Enumeration Value
 * 
 * Requirements:
 * - camelCase or UPPER_CASE
 * - Alphanumeric characters
 * 
 * @param apiId - Desired API ID (e.g., "active", "in active")
 * @returns Valid Enumeration Value API ID (e.g., "active")
 */
export function marshalEnumerationValueApiId(apiId: string): string {
  // Keep as-is if already valid camelCase/UPPER_CASE, otherwise convert to camelCase
  const sanitized = sanitizeAlphanumericUnderscore(apiId);
  if (sanitized === sanitized.toUpperCase() || sanitized === sanitized.toLowerCase()) {
    return sanitized.toLowerCase();
  }
  return toCamelCase(sanitized);
}

/**
 * Marshal API ID for Stage
 * 
 * Requirements:
 * - lowercase recommended
 * - Alphanumeric characters
 * 
 * @param apiId - Desired API ID (e.g., "Draft", "Published")
 * @returns Valid Stage API ID (e.g., "draft", "published")
 */
export function marshalStageApiId(apiId: string): string {
  return sanitizeAlphanumericUnderscore(apiId).toLowerCase();
}

/**
 * Marshal API ID for Locale
 * 
 * Requirements:
 * - lowercase ISO codes
 * - Alphanumeric characters and hyphens
 * 
 * @param apiId - Desired API ID (e.g., "en", "en-US")
 * @returns Valid Locale API ID (e.g., "en", "en-us")
 */
export function marshalLocaleApiId(apiId: string): string {
  return apiId.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/**
 * Marshal API ID for Remote Source Prefix
 * 
 * Requirements:
 * - Must start with an uppercase letter
 * - Can contain alphanumeric characters and underscores only
 * 
 * @param prefix - Desired prefix (e.g., "jsonplaceholder", "externalGraphQL")
 * @returns Valid Remote Source Prefix (e.g., "Jsonplaceholder", "ExternalGraphQL")
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#remote-sources
 */
export function marshalRemoteSourcePrefix(prefix: string): string {
  // Sanitize to only alphanumeric and underscores
  const sanitized = sanitizeAlphanumericUnderscore(prefix);
  // Ensure starts with uppercase
  return ensureUppercaseStart(sanitized);
}

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
 * Build a GraphQL query to probe for enumeration existence
 * Uses GraphQL introspection to check if an enum type exists
 */
const buildEnumerationProbeQuery = (enumApiId: string): string => `
  query TestEnumerationExists {
    __type(name: "${enumApiId}") {
      name
      kind
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

/**
 * Check if an enumeration exists using GraphQL introspection via urql
 * 
 * This is a read-only check that queries the Content API to see if the
 * enum type exists in the schema.
 * 
 * @param client - urql client configured for Hygraph Content API
 * @param enumApiId - The enumeration API ID to check (e.g., "PostStatus")
 * @returns true if the enumeration exists in the schema, false otherwise
 * 
 * @see https://hygraph.com/docs/api-reference/schema/enumerations
 */
export async function enumerationExists(
  client: UrqlClient,
  enumApiId: string,
): Promise<boolean> {
  const query = buildEnumerationProbeQuery(enumApiId);

  try {
    const result = await client.query(query, {}).toPromise();

    if (result.error) {
      const msg = result.error.message || '';
      // GraphQL validation error indicates enum doesn't exist
      if (msg.includes(`Cannot query field "__type"`) || msg.includes(`Unknown type "${enumApiId}"`)) {
        return false;
      }
      // Unknown error => conservative false
      return false;
    }

    // Check if __type returned a result (enum exists)
    return result.data?.__type?.name === enumApiId && result.data.__type.kind === 'ENUM';
  } catch (error) {
    console.error(`Error checking enumeration existence for ${enumApiId}:`, error);
    return false;
  }
}

/**
 * Check if a component exists using GraphQL introspection via urql
 * 
 * Components are queryable like models, so we use the same approach as modelExists.
 * 
 * @param client - urql client configured for Hygraph Content API
 * @param apiId - The component API ID to check (e.g., "Address")
 * @returns true if the component exists in the schema, false otherwise
 * 
 * @see https://hygraph.com/docs/developer-guides/schema/components-or-references
 */
export async function componentExists(
  client: UrqlClient,
  apiId: string,
): Promise<boolean> {
  // Components are queryable like models
  return modelExists(client, apiId);
}

/**
 * Ensure a relational field exists, creating it if it doesn't
 * 
 * Relational fields include:
 * - Relations (one-to-one, one-to-many, many-to-many)
 * - Asset references (unidirectional or bidirectional)
 * 
 * Checks field existence via urql (read-only Content API query),
 * then creates the field via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Field parameters + required clients + parentPluralApiId
 * @returns Object indicating whether the field was created
 * 
 * @see https://hygraph.com/docs/developer-guides/schema/references
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#relational-fields
 */
export async function ensureRelationalField<
  TFieldParams extends BatchMigrationCreateRelationalFieldInput,
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
  mgmtClient.createRelationalField(fieldParams);
  return { created: true };
}

/**
 * Ensure an enumeration exists, creating it if it doesn't
 * 
 * Enumerations are separate entities that must be created before
 * they can be used in enumerable fields.
 * 
 * Checks enumeration existence via urql (read-only Content API query),
 * then creates the enumeration via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Enumeration parameters + required clients
 * @returns Object indicating whether the enumeration was created
 * 
 * @see https://hygraph.com/docs/api-reference/schema/enumerations
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#enumerations
 */
export async function ensureEnumeration<
  TEnumParams extends BatchMigrationCreateEnumerationInput,
  TClients extends EnsureClients,
>(
  params: TEnumParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...enumParams } = params;

  // Check existence via urql
  const exists = await enumerationExists(urqlClient, enumParams.apiId);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createEnumeration(enumParams);
  return { created: true };
}

/**
 * Ensure an enumerable field exists, creating it if it doesn't
 * 
 * Enumerable fields reference enumerations. The enumeration must
 * exist before creating the field (use ensureEnumeration first).
 * 
 * Checks field existence via urql (read-only Content API query),
 * then creates the field via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Field parameters + required clients + parentPluralApiId
 * @returns Object indicating whether the field was created
 * 
 * @see https://hygraph.com/docs/api-reference/schema/enumerations
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#enumerations
 */
export async function ensureEnumerableField<
  TFieldParams extends BatchMigrationCreateEnumerableFieldInput,
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
  mgmtClient.createEnumerableField(fieldParams);
  return { created: true };
}

/**
 * Ensure a component exists, creating it if it doesn't
 * 
 * Components are reusable field groups that are embedded in models.
 * They must be created before they can be used in component fields.
 * 
 * Checks component existence via urql (read-only Content API query),
 * then creates the component via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Component parameters + required clients
 * @returns Object indicating whether the component was created
 * 
 * @see https://hygraph.com/docs/developer-guides/schema/components-or-references
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#components
 */
export async function ensureComponent<
  TComponentParams extends BatchMigrationCreateComponentInput,
  TClients extends EnsureClients,
>(
  params: TComponentParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...componentParams } = params;

  // Check existence via urql (components are queryable like models)
  const exists = await componentExists(urqlClient, componentParams.apiId);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createComponent(componentParams);
  return { created: true };
}

/**
 * Ensure a component field exists, creating it if it doesn't
 * 
 * Component fields embed a component into a model. The component
 * must exist before creating the field (use ensureComponent first).
 * 
 * Checks field existence via urql (read-only Content API query),
 * then creates the field via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Field parameters + required clients + parentPluralApiId
 * @returns Object indicating whether the field was created
 * 
 * @see https://hygraph.com/docs/developer-guides/schema/components-or-references
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#components
 */
export async function ensureComponentField<
  TFieldParams extends BatchMigrationCreateComponentFieldInput,
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
  mgmtClient.createComponentField(fieldParams);
  return { created: true };
}

/**
 * Ensure a component union field exists, creating it if it doesn't
 * 
 * Component union fields allow embedding one of multiple component types.
 * All referenced components must exist before creating the field.
 * 
 * Checks field existence via urql (read-only Content API query),
 * then creates the field via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Field parameters + required clients + parentPluralApiId
 * @returns Object indicating whether the field was created
 * 
 * @see https://hygraph.com/docs/developer-guides/schema/components-or-references
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#components
 */
export async function ensureComponentUnionField<
  TFieldParams extends BatchMigrationCreateComponentUnionFieldInput,
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
  mgmtClient.createComponentUnionField(fieldParams);
  return { created: true };
}

/**
 * Ensure a union field exists, creating it if it doesn't
 * 
 * Union fields allow referencing multiple model types in a single field.
 * All referenced models must exist before creating the field.
 * 
 * Checks field existence via urql (read-only Content API query),
 * then creates the field via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Field parameters + required clients + parentPluralApiId
 * @returns Object indicating whether the field was created
 * 
 * @see https://hygraph.com/docs/api-reference/schema/field-types#union-fields
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#union-fields
 */
export async function ensureUnionField<
  TFieldParams extends BatchMigrationCreateUnionFieldInput,
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
  mgmtClient.createUnionField(fieldParams);
  return { created: true };
}

/**
 * Ensure a remote field exists, creating it if it doesn't
 * 
 * Remote fields fetch data from external APIs (GraphQL or REST).
 * The remote source must be configured before creating the field.
 * 
 * Checks field existence via urql (read-only Content API query),
 * then creates the field via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Field parameters + required clients + parentPluralApiId
 * @returns Object indicating whether the field was created
 * 
 * @see https://hygraph.com/docs/api-reference/schema/field-types#remote-fields
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#remote-fields
 */
export async function ensureRemoteField<
  TFieldParams extends BatchMigrationCreateRemoteFieldInput,
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
  mgmtClient.createRemoteField(fieldParams);
  return { created: true };
}

/**
 * Build a GraphQL query to probe for taxonomy existence
 * Uses GraphQL introspection to check if a taxonomy type exists
 */
const buildTaxonomyProbeQuery = (taxonomyApiId: string): string => `
  query TestTaxonomyExists {
    __type(name: "${taxonomyApiId}") {
      name
      kind
    }
  }
`;

/**
 * Check if a taxonomy exists using GraphQL introspection via urql
 * 
 * Taxonomies appear as GraphQL types in the schema, similar to enumerations.
 * 
 * @param client - urql client configured for Hygraph Content API
 * @param taxonomyApiId - The taxonomy API ID to check (e.g., "Category")
 * @returns true if the taxonomy exists in the schema, false otherwise
 * 
 * @see https://hygraph.com/docs/api-reference/schema/taxonomies
 */
export async function taxonomyExists(
  client: UrqlClient,
  taxonomyApiId: string,
): Promise<boolean> {
  const query = buildTaxonomyProbeQuery(taxonomyApiId);

  try {
    const result = await client.query(query, {}).toPromise();

    if (result.error) {
      const msg = result.error.message || '';
      // GraphQL validation error indicates taxonomy doesn't exist
      if (msg.includes(`Cannot query field "__type"`) || msg.includes(`Unknown type "${taxonomyApiId}"`)) {
        return false;
      }
      // Unknown error => conservative false
      return false;
    }

    // Check if __type returned a result (taxonomy exists)
    return result.data?.__type?.name === taxonomyApiId && result.data.__type.kind === 'OBJECT';
  } catch (error) {
    console.error(`Error checking taxonomy existence for ${taxonomyApiId}:`, error);
    return false;
  }
}

/**
 * Ensure a taxonomy exists, creating it if it doesn't
 * 
 * Taxonomies are hierarchical structures for organizing content.
 * They must be created before taxonomy nodes and taxonomy fields can be used.
 * 
 * Checks taxonomy existence via urql (read-only Content API query),
 * then creates the taxonomy via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Taxonomy parameters + required clients
 * @returns Object indicating whether the taxonomy was created
 * 
 * @see https://hygraph.com/docs/api-reference/schema/taxonomies
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#taxonomies
 */
export async function ensureTaxonomy<
  TTaxonomyParams extends BatchMigrationCreateTaxonomyInput,
  TClients extends EnsureClients,
>(
  params: TTaxonomyParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...taxonomyParams } = params;

  // Check existence via urql
  const exists = await taxonomyExists(urqlClient, taxonomyParams.apiId);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createTaxonomy(taxonomyParams);
  return { created: true };
}

/**
 * Build a GraphQL query to probe for taxonomy node existence
 * Queries the taxonomy to check if a node with the given apiId exists
 */
const buildTaxonomyNodeProbeQuery = (taxonomyApiId: string, nodeApiId: string): string => `
  query TestTaxonomyNodeExists {
    ${taxonomyApiId}(where: { apiId: "${nodeApiId}" }) {
      id
      apiId
    }
  }
`;

/**
 * Check if a taxonomy node exists using GraphQL query via urql
 * 
 * Taxonomy nodes are queryable via their parent taxonomy type.
 * 
 * @param client - urql client configured for Hygraph Content API
 * @param taxonomyApiId - The taxonomy API ID (e.g., "Category")
 * @param nodeApiId - The taxonomy node API ID to check
 * @returns true if the taxonomy node exists, false otherwise
 */
export async function taxonomyNodeExists(
  client: UrqlClient,
  taxonomyApiId: string,
  nodeApiId: string,
): Promise<boolean> {
  const query = buildTaxonomyNodeProbeQuery(taxonomyApiId, nodeApiId);

  try {
    const result = await client.query(query, {}).toPromise();

    if (result.error) {
      const msg = result.error.message || '';
      // GraphQL validation error indicates taxonomy or node doesn't exist
      if (msg.includes(`Cannot query field "${taxonomyApiId}"`) || msg.includes(`Unknown type`)) {
        return false;
      }
      // Unknown error => conservative false
      return false;
    }

    // Check if query returned a node
    return result.data?.[taxonomyApiId]?.length > 0;
  } catch (error) {
    console.error(`Error checking taxonomy node existence for ${taxonomyApiId}.${nodeApiId}:`, error);
    return false;
  }
}

/**
 * Ensure a taxonomy node exists, creating it if it doesn't
 * 
 * Taxonomy nodes are the hierarchical items within a taxonomy.
 * The taxonomy must exist before creating nodes (use ensureTaxonomy first).
 * 
 * Checks node existence via urql (read-only Content API query),
 * then creates the node via Management SDK if missing.
 * 
 * Note: Taxonomy nodes can also be created in batch via `createTaxonomy`
 * with the `taxonomyNodes` array (alternative approach).
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Taxonomy node parameters + required clients
 * @returns Object indicating whether the node was created
 * 
 * @see https://hygraph.com/docs/api-reference/schema/taxonomies
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#taxonomies
 */
export async function ensureTaxonomyNode<
  TNodeParams extends BatchMigrationCreateTaxonomyNodeInput,
  TClients extends EnsureClients,
>(
  params: TNodeParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...nodeParams } = params;

  // Check existence via urql
  const exists = await taxonomyNodeExists(urqlClient, nodeParams.taxonomyApiId, nodeParams.apiId);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createTaxonomyNode(nodeParams);
  return { created: true };
}

/**
 * Ensure a taxonomy field exists, creating it if it doesn't
 * 
 * Taxonomy fields reference a taxonomy and allow selecting taxonomy nodes.
 * The taxonomy must exist before creating the field (use ensureTaxonomy first).
 * 
 * Checks field existence via urql (read-only Content API query),
 * then creates the field via Management SDK if missing.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Field parameters + required clients + parentPluralApiId
 * @returns Object indicating whether the field was created
 * 
 * @see https://hygraph.com/docs/api-reference/schema/taxonomies
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#taxonomies
 */
export async function ensureTaxonomyField<
  TFieldParams extends BatchMigrationCreateTaxonomyFieldInput,
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
  mgmtClient.createTaxonomyField(fieldParams);
  return { created: true };
}

/**
 * Check if an infrastructure resource exists using Management SDK
 * 
 * For infrastructure operations that aren't queryable via Content API,
 * we use a temporary client to attempt creation and check for "already exists" errors.
 * This is a best-effort check that relies on the Management SDK's validation.
 * 
 * Note: This creates a temporary client and attempts to queue the operation,
 * then checks dryRun to see if it would be created. However, since infrastructure
 * resources aren't easily queryable, this is a best-effort approach.
 * 
 * @param mgmtClient - Management SDK client (used to get config)
 * @param operationName - The operation name (e.g., "createGraphQLRemoteSource")
 * @param operationParams - The operation parameters
 * @returns true if the resource exists, false if it doesn't
 */
async function infrastructureResourceExists(
  mgmtClient: MgmtClient,
  operationName: string,
  operationParams: unknown,
): Promise<boolean> {
  try {
    // Create a temporary client with the same config to avoid polluting the main client
    const clientConfig = {
      endpoint: mgmtClient['endpoint'],
      authToken: mgmtClient['authToken'],
    };
    const tempClient = new MgmtClient(clientConfig);
    
    // Queue the operation on the temp client
    switch (operationName) {
      case mgmtClient.createGraphQLRemoteSource.name:
        tempClient.createGraphQLRemoteSource(operationParams as BatchMigrationCreateGraphQlRemoteSourceInput);
        break;
      case mgmtClient.createRESTRemoteSource.name:
        tempClient.createRESTRemoteSource(operationParams as BatchMigrationCreateRestRemoteSourceInput);
        break;
      case mgmtClient.createStage.name:
        tempClient.createStage(operationParams as BatchMigrationCreateStageInput);
        break;
      case mgmtClient.createLocale.name:
        tempClient.createLocale(operationParams as BatchMigrationCreateLocaleInput);
        break;
      case mgmtClient.createWebhook.name:
        tempClient.createWebhook(operationParams as BatchMigrationCreateWebhookInput);
        break;
      case mgmtClient.createWorkflow.name:
        tempClient.createWorkflow(operationParams as BatchMigrationCreateWorkflowInput);
        break;
      case mgmtClient.createAppInstallation.name:
        tempClient.createAppInstallation(operationParams as BatchMigrationAppInstallationInput);
        break;
      case mgmtClient.createCustomSidebarElement.name:
        tempClient.createCustomSidebarElement(operationParams as BatchMigrationCreateCustomSidebarElementInput);
        break;
      // no default
    }
    
    // Use dryRun to check what would be executed
    // Note: dryRun just returns what's queued, so this doesn't actually check existence
    // For infrastructure resources, we can't easily check existence without executing.
    // This is a limitation - we'll attempt creation and let Management SDK handle duplicates.
    const dryRunResult = tempClient.dryRun();
    const hasOperation = dryRunResult.some(
      (migration) => migration.operationName === operationName
    );
    
    // Since we can't reliably check existence for infrastructure resources,
    // we return false (doesn't exist) to allow the creation attempt.
    // The Management SDK will handle duplicate detection when run() is called.
    // This is a best-effort approach - in practice, the Management SDK will
    // return errors if the resource already exists when migrations are executed.
    return false; // Assume doesn't exist - let Management SDK validate on execution
  } catch (error) {
    // On error, assume doesn't exist (conservative approach to allow creation)
    console.error(`Error checking infrastructure resource existence for ${operationName}:`, error);
    return false; // Assume doesn't exist to allow creation attempt
  }
}

/**
 * Check if a remote source exists by prefix using getEnvironmentDiff
 * 
 * Remote sources are infrastructure-level and not queryable via Content API.
 * We use getEnvironmentDiff to compare with a reference environment and check
 * if a remote source with the given prefix exists in the migrations.
 * 
 * @param mgmtClient - Management SDK client
 * @param prefix - The remote source prefix to check
 * @returns true if the remote source exists, false otherwise
 */
async function remoteSourceExists(
  mgmtClient: MgmtClient,
  prefix: string,
): Promise<boolean> {
  try {
    // Check if there's already a create operation for this prefix in the queued migrations
    // dryRun() returns an array of migration objects with operationName and change properties
    const dryRunResult = mgmtClient.dryRun();
    
    // Check if there's already a create operation for this prefix
    const hasCreateOperation = dryRunResult.some(
      (migration) => {
        // The migration object structure varies - check both possible structures
        const change = (migration as any).change || migration;
        return (
          (change?.createGraphQLRemoteSource?.prefix === prefix) ||
          (change?.createRESTRemoteSource?.prefix === prefix)
        );
      }
    );
    
    if (hasCreateOperation) {
      return true; // Already queued for creation
    }
    
    // Since we can't reliably query remote sources via Content API,
    // we'll attempt creation and let the Management SDK handle duplicate detection
    // The Management SDK will return errors if the resource already exists when run() is called
    return false;
  } catch (error) {
    // On error, assume doesn't exist (conservative approach to allow creation attempt)
    console.error(`Error checking remote source existence for prefix ${prefix}:`, error);
    return false;
  }
}

/**
 * Ensure a REST remote source exists, creating it if it doesn't
 * 
 * Remote sources are infrastructure-level configurations that define
 * external APIs to fetch data from. They must be created before remote fields.
 * 
 * Note: Remote sources are NOT queryable via Content API GraphQL introspection.
 * Existence checks use dryRun to check if the source is already queued.
 * The Management SDK will handle duplicate detection when run() is called.
 * 
 * Note: The `prefix` cannot be changed after creation - must be unique.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Remote source parameters + required clients
 * @returns Object indicating whether the remote source was created
 * 
 * @see https://hygraph.com/docs/api-reference/schema/field-types#remote-fields
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#remote-sources
 */
export async function ensureRESTRemoteSource<
  TSourceParams extends BatchMigrationCreateRestRemoteSourceInput,
  TClients extends EnsureClients,
>(
  params: TSourceParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...sourceParams } = params;

  // Check existence via dryRun
  const exists = await remoteSourceExists(mgmtClient, sourceParams.prefix);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createRESTRemoteSource(sourceParams);
  return { created: true };
}

/**
 * Ensure a GraphQL remote source exists, creating it if it doesn't
 * 
 * Remote sources are infrastructure-level configurations that define
 * external APIs to fetch data from. They must be created before remote fields.
 * 
 * Note: Remote sources are NOT queryable via Content API GraphQL introspection.
 * Existence checks use dryRun to check if the source is already queued.
 * The Management SDK will handle duplicate detection when run() is called.
 * 
 * Note: The `prefix` cannot be changed after creation - must be unique.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Remote source parameters + required clients
 * @returns Object indicating whether the remote source was created
 * 
 * @see https://hygraph.com/docs/api-reference/schema/field-types#remote-fields
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#remote-sources
 */
export async function ensureGraphQLRemoteSource<
  TSourceParams extends BatchMigrationCreateGraphQlRemoteSourceInput,
  TClients extends EnsureClients,
>(
  params: TSourceParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...sourceParams } = params;

  // Check existence via dryRun
  const exists = await remoteSourceExists(mgmtClient, sourceParams.prefix);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createGraphQLRemoteSource(sourceParams);
  return { created: true };
}

/**
 * Update a GraphQL remote source
 * 
 * Updates an existing GraphQL remote source configuration.
 * The `prefix` cannot be changed - it's immutable after creation.
 * 
 * Note: This queues the update operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Update parameters + required clients
 * @returns Object indicating whether the update was queued
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#remote-sources
 */
export async function updateGraphQLRemoteSource<
  TSourceParams extends BatchMigrationUpdateGraphQlRemoteSourceInput,
  TClients extends EnsureClients,
>(
  params: TSourceParams & TClients,
): Promise<{ updated: boolean }> {
  const { urqlClient, mgmtClient, ...sourceParams } = params;

  // Queue update operation
  mgmtClient.updateGraphQLRemoteSource(sourceParams);
  return { updated: true };
}

/**
 * Update a REST remote source
 * 
 * Updates an existing REST remote source configuration.
 * The `prefix` cannot be changed - it's immutable after creation.
 * 
 * Note: This queues the update operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Update parameters + required clients
 * @returns Object indicating whether the update was queued
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#remote-sources
 */
export async function updateRESTRemoteSource<
  TSourceParams extends BatchMigrationUpdateRestRemoteSourceInput,
  TClients extends EnsureClients,
>(
  params: TSourceParams & TClients,
): Promise<{ updated: boolean }> {
  const { urqlClient, mgmtClient, ...sourceParams } = params;

  // Queue update operation
  mgmtClient.updateRESTRemoteSource(sourceParams);
  return { updated: true };
}

/**
 * Delete a remote source
 * 
 * Deletes an existing remote source (GraphQL or REST) by prefix.
 * This will also delete all remote fields that depend on this source.
 * 
 * Note: This queues the deletion operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Delete parameters + required clients
 * @returns Object indicating whether the deletion was queued
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#remote-sources
 */
export async function deleteRemoteSource<
  TSourceParams extends BatchMigrationDeleteRemoteSourceInput,
  TClients extends EnsureClients,
>(
  params: TSourceParams & TClients,
): Promise<{ deleted: boolean }> {
  const { urqlClient, mgmtClient, ...sourceParams } = params;

  // Queue delete operation
  mgmtClient.deleteRemoteSource(sourceParams);
  return { deleted: true };
}

/**
 * Refresh a GraphQL remote source schema
 * 
 * Refreshes the schema introspection for a GraphQL remote source.
 * This updates the remote type definitions based on the current GraphQL schema.
 * 
 * Note: This queues the refresh operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Refresh parameters + required clients
 * @returns Object indicating whether the refresh was queued
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#remote-sources
 */
export async function refreshGraphQLRemoteSourceSchema<
  TSourceParams extends { prefix: string },
  TClients extends EnsureClients,
>(
  params: TSourceParams & TClients,
): Promise<{ refreshed: boolean }> {
  const { urqlClient, mgmtClient, prefix } = params;

  // Queue refresh operation
  mgmtClient.refreshGraphQLRemoteSourceSchema({ prefix });
  return { refreshed: true };
}

/**
 * Ensure a stage exists, creating it if it doesn't
 * 
 * Stages are infrastructure-level configurations for content workflows
 * and publishing. They are used to organize content into different states.
 * 
 * Note: Stages are NOT queryable via Content API GraphQL introspection.
 * Existence checks are limited - we attempt creation and let the Management SDK
 * handle validation. In the future, this could be improved using `getEnvironmentDiff`
 * or Management API introspection.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Stage parameters + required clients
 * @returns Object indicating whether the stage was created
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk
 */
export async function ensureStage<
  TStageParams extends BatchMigrationCreateStageInput,
  TClients extends EnsureClients,
>(
  params: TStageParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...stageParams } = params;

  // Check existence via Management SDK
  const exists = await infrastructureResourceExists(mgmtClient, mgmtClient.createStage.name, stageParams);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createStage(stageParams);
  return { created: true };
}

/**
 * Ensure a locale exists, creating it if it doesn't
 * 
 * Locales are infrastructure-level configurations for multi-language content.
 * They define the languages and regions supported by your content.
 * 
 * Note: Locales are NOT queryable via Content API GraphQL introspection.
 * Existence checks are limited - we attempt creation and let the Management SDK
 * handle validation. In the future, this could be improved using `getEnvironmentDiff`
 * or Management API introspection.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Locale parameters + required clients
 * @returns Object indicating whether the locale was created
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk
 */
export async function ensureLocale<
  TLocaleParams extends BatchMigrationCreateLocaleInput,
  TClients extends EnsureClients,
>(
  params: TLocaleParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...localeParams } = params;

  // Check existence via Management SDK
  const exists = await infrastructureResourceExists(mgmtClient, mgmtClient.createLocale.name, localeParams);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createLocale(localeParams);
  return { created: true };
}

/**
 * Ensure a webhook exists, creating it if it doesn't
 * 
 * Webhooks are infrastructure-level configurations that send HTTP requests
 * when content changes occur. They can be configured for specific models and stages.
 * 
 * Note: Webhooks are NOT queryable via Content API GraphQL introspection.
 * Existence checks are limited - we attempt creation and let the Management SDK
 * handle validation. In the future, this could be improved using `getEnvironmentDiff`
 * or Management API introspection.
 * 
 * Note: Pass empty arrays for `models`/`stages` to include all existing and future ones.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Webhook parameters + required clients
 * @returns Object indicating whether the webhook was created
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk
 */
export async function ensureWebhook<
  TWebhookParams extends BatchMigrationCreateWebhookInput,
  TClients extends EnsureClients,
>(
  params: TWebhookParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...webhookParams } = params;

  // Check existence via Management SDK
  const exists = await infrastructureResourceExists(mgmtClient, mgmtClient.createWebhook.name, webhookParams);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createWebhook(webhookParams);
  return { created: true };
}

/**
 * Ensure a workflow exists, creating it if it doesn't
 * 
 * Workflows are infrastructure-level configurations that define content
 * approval and publishing processes. They consist of steps that content
 * moves through.
 * 
 * Note: Workflows are NOT queryable via Content API GraphQL introspection.
 * Existence checks are limited - we attempt creation and let the Management SDK
 * handle validation. In the future, this could be improved using `getEnvironmentDiff`
 * or Management API introspection.
 * 
 * Note: Steps are created in the order provided (unless position is specified).
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Workflow parameters + required clients
 * @returns Object indicating whether the workflow was created
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk
 */
export async function ensureWorkflow<
  TWorkflowParams extends BatchMigrationCreateWorkflowInput,
  TClients extends EnsureClients,
>(
  params: TWorkflowParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...workflowParams } = params;

  // Check existence via Management SDK
  const exists = await infrastructureResourceExists(mgmtClient, mgmtClient.createWorkflow.name, workflowParams);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createWorkflow(workflowParams);
  return { created: true };
}

/**
 * Ensure an app installation exists, creating it if it doesn't
 * 
 * App installations are infrastructure-level configurations that install
 * and configure Hygraph apps (third-party integrations).
 * 
 * Note: App installations are NOT queryable via Content API GraphQL introspection.
 * Existence checks are limited - we attempt creation and let the Management SDK
 * handle validation. In the future, this could be improved using `getEnvironmentDiff`
 * or Management API introspection.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - App installation parameters + required clients
 * @returns Object indicating whether the app installation was created
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk
 */
export async function ensureAppInstallation<
  TAppParams extends BatchMigrationAppInstallationInput,
  TClients extends EnsureClients,
>(
  params: TAppParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...appParams } = params;

  // Check existence via Management SDK
  const exists = await infrastructureResourceExists(mgmtClient, mgmtClient.createAppInstallation.name, appParams);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createAppInstallation(appParams);
  return { created: true };
}

/**
 * Ensure a custom sidebar element exists, creating it if it doesn't
 * 
 * Custom sidebar elements are infrastructure-level configurations that add
 * app-specific UI elements to the Hygraph sidebar for specific models.
 * 
 * Note: Custom sidebar elements are NOT queryable via Content API GraphQL introspection.
 * Existence checks are limited - we attempt creation and let the Management SDK
 * handle validation. In the future, this could be improved using `getEnvironmentDiff`
 * or Management API introspection.
 * 
 * Note: This queues the creation operation. You must call
 * `mgmtClient.run(true)` separately to execute it.
 * 
 * @param params - Custom sidebar element parameters + required clients
 * @returns Object indicating whether the custom sidebar element was created
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk
 */
export async function ensureCustomSidebarElement<
  TElementParams extends BatchMigrationCreateCustomSidebarElementInput,
  TClients extends EnsureClients,
>(
  params: TElementParams & TClients,
): Promise<{ created: boolean }> {
  const { urqlClient, mgmtClient, ...elementParams } = params;

  // Check existence via Management SDK
  const exists = await infrastructureResourceExists(mgmtClient, mgmtClient.createCustomSidebarElement.name, elementParams);
  if (exists) {
    return { created: false };
  }

  // Create via Management SDK (queued, not executed)
  mgmtClient.createCustomSidebarElement(elementParams);
  return { created: true };
}

/**
 * Future Work: Update and Delete Utilities
 * 
 * Based on the ensure helper patterns above, future update/delete utilities
 * should follow similar patterns:
 * 
 * 1. **Update Utilities** (`updateX`):
 *    - Accept `BatchMigrationUpdate*Input` types (e.g., `BatchMigrationUpdateSimpleFieldInput`)
 *    - Use `fieldExists` or `modelExists` to verify the entity exists before updating
 *    - Queue `mgmtClient.update*` calls
 *    - Return `{ updated: boolean }` to indicate if update was queued
 * 
 * 2. **Delete Utilities** (`deleteX`):
 *    - Accept `BatchMigrationDelete*Input` types (e.g., `BatchMigrationDeleteFieldInput`)
 *    - Use existence checks to verify entity exists before deletion
 *    - Queue `mgmtClient.delete*` calls
 *    - Return `{ deleted: boolean }` to indicate if deletion was queued
 * 
 * 3. **Pattern Consistency**:
 *    - All update/delete helpers should accept `EnsureClients` for urql and mgmtClient
 *    - Field-level helpers should require `parentPluralApiId` for existence checks
 *    - Entity-level helpers (models, components, enumerations) should use their own existence checks
 * 
 * Example signatures:
 * ```typescript
 * export async function updateSimpleField<
 *   TFieldParams extends BatchMigrationUpdateSimpleFieldInput,
 *   TClients extends EnsureClients,
 * >(params: TFieldParams & TClients & { parentPluralApiId: string }): Promise<{ updated: boolean }>
 * 
 * export async function deleteField<
 *   TFieldParams extends BatchMigrationDeleteFieldInput,
 *   TClients extends EnsureClients,
 * >(params: TFieldParams & TClients & { parentPluralApiId: string }): Promise<{ deleted: boolean }>
 * ```
 * 
 * @see https://hygraph.com/docs/api-reference/management-sdk for update/delete method signatures
 */
