import {
  Client,
  SimpleFieldType,
  RelationalFieldType,
  RemoteFieldType,
  RemoteFieldApiMethod,
  ColorPalette,
  GraphQlRemoteSourceIntrospectionMethod,
  RemoteSourceKind,
  WebhookTriggerType,
  type BatchMigrationCreateModelInput,
  type BatchMigrationCreateSimpleFieldInput,
  type BatchMigrationCreateRelationalFieldInput,
  type BatchMigrationCreateEnumerationInput,
  type BatchMigrationCreateEnumerableFieldInput,
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
} from '@hygraph/management-sdk';
import 'dotenv/config';
import { hygraphContentClient } from './hygraph-urql-client';
import {
  ensureModel,
  ensureSimpleField,
  ensureRelationalField,
  ensureEnumeration,
  ensureEnumerableField,
  ensureComponent,
  ensureComponentField,
  ensureComponentUnionField,
  ensureUnionField,
  ensureRemoteField,
  ensureTaxonomy,
  ensureTaxonomyNode,
  ensureTaxonomyField,
  ensureGraphQLRemoteSource,
  ensureRESTRemoteSource,
  updateGraphQLRemoteSource,
  updateRESTRemoteSource,
  deleteRemoteSource,
  refreshGraphQLRemoteSourceSchema,
  ensureStage,
  ensureLocale,
  ensureWebhook,
  validateApiId,
  marshalTaxonomyNodeApiId,
  marshalModelApiId,
  marshalEnumerationApiId,
  marshalComponentApiId,
  marshalFieldApiId,
  marshalRemoteSourcePrefix,
  marshalEnumerationValueApiId,
  marshalStageApiId,
  marshalLocaleApiId,
} from './hygraph-existence-utils';

/**
 * Hygraph Hello World - Comprehensive Ensure Utilities Example
 * 
 * This script demonstrates using urql to check for schema element existence
 * and the Management SDK to create them if missing.
 * 
 * Required environment variables:
 * - HYGRAPH_MGMT_TOKEN: Management API auth token
 * - HYGRAPH_MGMT_ENDPOINT: Management API endpoint
 * - HYGRAPH_CONTENT_ENDPOINT: Content API endpoint for existence checks
 * - HYGRAPH_CONTENT_TOKEN: Optional Content API auth token
 */

// ============================================================================
// Logging Utilities
// ============================================================================

interface OperationResult {
  operation: string;
  resource: string;
  created: boolean;
  duration: number;
  error?: string;
}

const operations: OperationResult[] = [];
const startTime = Date.now();

function logOperation(operation: string, resource: string, created: boolean, duration: number, error?: string) {
  const result: OperationResult = { operation, resource, created, duration, error };
  operations.push(result);
  
  const timestamp = new Date().toISOString();
  const status = created ? '✅ QUEUED (does not exist)' : '⏭️  SKIPPED (already exists)';
  const errorMsg = error ? ` ❌ ERROR: ${error}` : '';
  const durationMsg = `(${duration.toFixed(2)}ms)`;
  
  console.log(`[${timestamp}] ${status} ${operation}: ${resource} ${durationMsg}${errorMsg}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

function logSummary() {
  const totalDuration = Date.now() - startTime;
  const created = operations.filter(op => op.created).length;
  const skipped = operations.filter(op => !op.created && !op.error).length;
  const errors = operations.filter(op => op.error).length;
  
  console.log('\n' + '='.repeat(80));
  console.log('  SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Operations: ${operations.length}`);
  console.log(`  ✅ Queued for migration: ${created}`);
  console.log(`  ⏭️  Skipped (already exists): ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
  console.log('='.repeat(80));
  
  if (errors > 0) {
    console.log('\n❌ ERRORS:');
    operations.filter(op => op.error).forEach(op => {
      console.log(`  - ${op.operation}: ${op.resource}`);
      console.log(`    ${op.error}`);
    });
  }
}

// ============================================================================
// Configuration
// ============================================================================

const authToken = process.env['HYGRAPH_MGMT_TOKEN'];
const endpoint = process.env['HYGRAPH_MGMT_ENDPOINT'];

if (!authToken || !endpoint) {
  throw new Error('HYGRAPH_MGMT_TOKEN and HYGRAPH_MGMT_ENDPOINT must be set');
}

const mgmtClient = new Client({
  authToken: authToken,
  endpoint: endpoint,
});

// BINARY SEARCH: Use timestamp to ensure unique names
const timestamp = Date.now();
const apiId = `FooTest${timestamp}`;
const apiIdPlural = `FooTest${timestamp}s`;
const displayName = `Foo Test ${timestamp}`;
const description = `A collection of Foo Test ${timestamp}.`;

const run = async () => {
  logSection('HYGRAPH HELLO WORLD - COMPREHENSIVE ENSURE UTILITIES DEMO');
  
  console.log(`\n📋 Configuration:`);
  console.log(`  Model API ID: ${apiId}`);
  console.log(`  Model Plural API ID: ${apiIdPlural}`);
  console.log(`  Management Endpoint: ${endpoint}`);
  console.log(`  Content Endpoint: ${process.env['HYGRAPH_CONTENT_ENDPOINT'] || 'NOT SET'}`);
  
  // ============================================================================
  // Schema Operations
  // ============================================================================
  logSection('SCHEMA OPERATIONS');
  
  try {
    // Ensure model exists (check + create if missing)
    const modelStart = Date.now();
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
    logOperation('ensureModel', apiId, modelResult.created, Date.now() - modelStart);

    // Ensure simple field exists
    const fieldStart = Date.now();
    const fieldParams: BatchMigrationCreateSimpleFieldInput = {
      parentApiId: apiId,
      apiId: 'canExist',
      type: SimpleFieldType.Boolean,
      displayName: 'Can Exist?',
    };

    const fieldResult = await ensureSimpleField({
      ...fieldParams,
      parentPluralApiId: apiIdPlural,
      urqlClient: hygraphContentClient,
      mgmtClient: mgmtClient,
    });
    logOperation('ensureSimpleField', `${apiId}.canExist`, fieldResult.created, Date.now() - fieldStart);

    // ============================================================================
    // All SimpleFieldType Variants (many field types are covered opaquely)
    // ============================================================================
    console.log('\n📝 Demonstrating all SimpleFieldType variants:');
    
    const simpleFieldTypes = [
      { type: SimpleFieldType.String, apiId: 'textField', displayName: 'Text Field' },
      { type: SimpleFieldType.Int, apiId: 'numberField', displayName: 'Number Field' },
      { type: SimpleFieldType.Float, apiId: 'decimalField', displayName: 'Decimal Field' },
      { type: SimpleFieldType.Boolean, apiId: 'flagField', displayName: 'Flag Field' },
      { type: SimpleFieldType.Date, apiId: 'dateField', displayName: 'Date Field' },
      { type: SimpleFieldType.Datetime, apiId: 'datetimeField', displayName: 'DateTime Field' },
      { type: SimpleFieldType.Json, apiId: 'jsonField', displayName: 'JSON Field' },
      { type: SimpleFieldType.Color, apiId: 'colorField', displayName: 'Color Field' },
      { type: SimpleFieldType.Location, apiId: 'locationField', displayName: 'Location Field' },
      { type: SimpleFieldType.Richtext, apiId: 'richTextField', displayName: 'Rich Text Field' },
    ];

    for (const fieldDef of simpleFieldTypes) {
      try {
        const fieldStart = Date.now();
        const fieldParams: BatchMigrationCreateSimpleFieldInput = {
          parentApiId: apiId,
          apiId: fieldDef.apiId,
          type: fieldDef.type,
          displayName: fieldDef.displayName,
        };

        const fieldResult = await ensureSimpleField({
          ...fieldParams,
          parentPluralApiId: apiIdPlural,
          urqlClient: hygraphContentClient,
          mgmtClient: mgmtClient,
        });
        logOperation('ensureSimpleField', `${apiId}.${fieldDef.apiId} (${fieldDef.type})`, fieldResult.created, Date.now() - fieldStart);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logOperation('ensureSimpleField', `${apiId}.${fieldDef.apiId}`, false, 0, errorMsg);
      }
    }

    // ============================================================================
    // Relational Field Types (Relation and Asset)
    // ============================================================================
    console.log('\n🔗 Demonstrating RelationalFieldType variants:');
    
    // Create a second model for relation example
    const relatedModelApiId = `BarTest${timestamp}`;
    const relatedModelApiIdPlural = `BarTest${timestamp}s`;
    try {
      const relatedModelStart = Date.now();
      const relatedModelParams: BatchMigrationCreateModelInput = {
        apiId: relatedModelApiId,
        apiIdPlural: relatedModelApiIdPlural,
        displayName: `Bar Test ${timestamp}`,
        description: `A Bar model for relation examples ${timestamp}`,
      };

      const relatedModelResult = await ensureModel({
        ...relatedModelParams,
        urqlClient: hygraphContentClient,
        mgmtClient: mgmtClient,
      });
      logOperation('ensureModel', relatedModelApiId, relatedModelResult.created, Date.now() - relatedModelStart);

      // Relation field (one-to-many)
      const relationFieldStart = Date.now();
      const relationFieldParams: BatchMigrationCreateRelationalFieldInput = {
        parentApiId: apiId,
        apiId: 'bars',
        displayName: 'Bars',
        type: RelationalFieldType.Relation,
        reverseField: {
          modelApiId: relatedModelApiId,
          apiId: 'foo',
          displayName: 'Foo',
        },
        isList: true,
      };

      const relationFieldResult = await ensureRelationalField({
        ...relationFieldParams,
        parentPluralApiId: apiIdPlural,
        urqlClient: hygraphContentClient,
        mgmtClient: mgmtClient,
      });
      logOperation('ensureRelationalField', `${apiId}.bars (OneToMany)`, relationFieldResult.created, Date.now() - relationFieldStart);

      // Asset field (unidirectional - assets don't need reverse field)
      const assetFieldStart = Date.now();
      const assetFieldParams: BatchMigrationCreateRelationalFieldInput = {
        parentApiId: apiId,
        apiId: 'coverImage',
        displayName: 'Cover Image',
        type: RelationalFieldType.Asset,
        reverseField: {
          modelApiId: 'Asset', // System model for assets
          apiId: 'relatedFromAsset', // Changed from 'relatedFrom' to avoid conflict with union field reverse field
          displayName: 'Related From Asset',
          isUnidirectional: true,
        },
      };

      const assetFieldResult = await ensureRelationalField({
        ...assetFieldParams,
        parentPluralApiId: apiIdPlural,
        urqlClient: hygraphContentClient,
        mgmtClient: mgmtClient,
      });
      logOperation('ensureRelationalField', `${apiId}.coverImage (Asset)`, assetFieldResult.created, Date.now() - assetFieldStart);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logOperation('Relational Fields', 'BATCH', false, 0, errorMsg);
    }

    // Ensure enumeration and enumerable field
    const enumStart = Date.now();
    const enumApiId = `YadaStatus${timestamp}`;
    const enumParams: BatchMigrationCreateEnumerationInput = {
      apiId: enumApiId,
      displayName: `Yada Status ${timestamp}`,
      values: [
        { apiId: 'active', displayName: 'Active' },
        { apiId: 'inactive', displayName: 'Inactive' },
      ],
    };

    const enumResult = await ensureEnumeration({
      ...enumParams,
      urqlClient: hygraphContentClient,
      mgmtClient: mgmtClient,
    });
    logOperation('ensureEnumeration', enumApiId, enumResult.created, Date.now() - enumStart);

    const enumerableFieldStart = Date.now();
    const enumerableFieldParams: BatchMigrationCreateEnumerableFieldInput = {
      parentApiId: apiId,
      apiId: 'yadaStatus', // Changed from 'status' - 'status' is a reserved word in Hygraph
      displayName: 'Status',
      enumerationApiId: enumApiId, // Use timestamped enum API ID
      isRequired: false,
    };

    const enumerableFieldResult = await ensureEnumerableField({
      ...enumerableFieldParams,
      parentPluralApiId: apiIdPlural,
      urqlClient: hygraphContentClient,
      mgmtClient: mgmtClient,
    });
    logOperation('ensureEnumerableField', `${apiId}.yadaStatus`, enumerableFieldResult.created, Date.now() - enumerableFieldStart);

    // Ensure component and component field
    const componentStart = Date.now();
    const componentApiId = `YadaMetadata${timestamp}`;
    const componentApiIdPlural = `YadaMetadatas${timestamp}`;
    const componentParams: BatchMigrationCreateComponentInput = {
      apiId: componentApiId,
      apiIdPlural: componentApiIdPlural,
      displayName: `Yada Metadata ${timestamp}`,
    };

    const componentResult = await ensureComponent({
      ...componentParams,
      urqlClient: hygraphContentClient,
      mgmtClient: mgmtClient,
    });
    logOperation('ensureComponent', componentApiId, componentResult.created, Date.now() - componentStart);

    // Add a simple field to the component using ensureSimpleField (not direct create)
    // NOTE: Components must exist before adding fields to them, but batch migrations handle ordering
    const componentNotesFieldStart = Date.now();
    const componentNotesFieldParams: BatchMigrationCreateSimpleFieldInput = {
      parentApiId: componentApiId, // Use timestamped component API ID
      apiId: 'notes',
      type: SimpleFieldType.String,
      displayName: 'Notes',
    };

    const componentNotesFieldResult = await ensureSimpleField({
      ...componentNotesFieldParams,
      parentPluralApiId: componentApiIdPlural, // Use timestamped component plural API ID
      urqlClient: hygraphContentClient,
      mgmtClient: mgmtClient,
    });
    logOperation('ensureSimpleField', `${componentApiId}.notes`, componentNotesFieldResult.created, Date.now() - componentNotesFieldStart);

    const componentFieldStart = Date.now();
    const componentFieldParams: BatchMigrationCreateComponentFieldInput = {
      parentApiId: apiId,
      apiId: 'metadata',
      displayName: 'Metadata',
      componentApiId: componentApiId, // Use timestamped component API ID
    };

    const componentFieldResult = await ensureComponentField({
      ...componentFieldParams,
      parentPluralApiId: apiIdPlural,
      urqlClient: hygraphContentClient,
      mgmtClient: mgmtClient,
    });
    logOperation('ensureComponentField', `${apiId}.metadata`, componentFieldResult.created, Date.now() - componentFieldStart);

    // ============================================================================
    // Component Union Field (requires components to exist first)
    // ============================================================================
    console.log('\n🧩 Demonstrating ComponentUnionField:');
    
    // Create a second component for union
    // NOTE: Components must exist before creating fields that reference them
    try {
      const component2Start = Date.now();
      const component2ApiId = `YadaExtra${timestamp}`;
      const component2ApiIdPlural = `YadaExtras${timestamp}`;
      const component2Params: BatchMigrationCreateComponentInput = {
        apiId: component2ApiId,
        apiIdPlural: component2ApiIdPlural,
        displayName: `Yada Extra ${timestamp}`,
      };

      const component2Result = await ensureComponent({
        ...component2Params,
        urqlClient: hygraphContentClient,
        mgmtClient: mgmtClient,
      });
      logOperation('ensureComponent', component2ApiId, component2Result.created, Date.now() - component2Start);

      // Component union field (can embed either YadaMetadata or YadaExtra)
      // Both components should now be ensured (either exist or queued for creation)
      const componentUnionFieldStart = Date.now();
      const componentUnionFieldParams: BatchMigrationCreateComponentUnionFieldInput = {
        parentApiId: apiId,
        apiId: 'extraData',
        displayName: 'Extra Data',
        componentApiIds: [componentApiId, component2ApiId], // Use timestamped component API IDs
      };

      const componentUnionFieldResult = await ensureComponentUnionField({
        ...componentUnionFieldParams,
        parentPluralApiId: apiIdPlural,
        urqlClient: hygraphContentClient,
        mgmtClient: mgmtClient,
      });
      logOperation('ensureComponentUnionField', `${apiId}.extraData`, componentUnionFieldResult.created, Date.now() - componentUnionFieldStart);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logOperation('ComponentUnionField', 'BATCH', false, 0, errorMsg);
    }

    // ============================================================================
    // Union Field
    // ============================================================================
    console.log('\n🔀 Demonstrating UnionField:');
    
    try {
      // Union field (can reference either Foo or Bar model)
      const unionFieldStart = Date.now();
      const unionFieldParams: BatchMigrationCreateUnionFieldInput = {
        parentApiId: apiId,
        apiId: 'relatedItem',
        displayName: 'Related Item',
        reverseField: {
          modelApiIds: [apiId, relatedModelApiId],
          apiId: 'relatedFromUnion', // Changed from 'relatedFrom' to avoid conflict with Asset field reverse field
          displayName: 'Related From Union',
        },
      };

      const unionFieldResult = await ensureUnionField({
        ...unionFieldParams,
        parentPluralApiId: apiIdPlural,
        urqlClient: hygraphContentClient,
        mgmtClient: mgmtClient,
      });
      logOperation('ensureUnionField', `${apiId}.relatedItem`, unionFieldResult.created, Date.now() - unionFieldStart);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logOperation('UnionField', 'BATCH', false, 0, errorMsg);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logOperation('Schema Operations', 'BATCH', false, 0, errorMsg);
    throw error;
  }

  // ============================================================================
  // Taxonomy Operations
  // ============================================================================
  logSection('TAXONOMY OPERATIONS');

  try {
    // Ensure taxonomy
    const taxonomyStart = Date.now();
    const taxonomyApiId = `Category${timestamp}`;
    const taxonomyParams: BatchMigrationCreateTaxonomyInput = {
      apiId: taxonomyApiId,
      displayName: `Category ${timestamp}`,
    };

    const taxonomyResult = await ensureTaxonomy({
      ...taxonomyParams,
      urqlClient: hygraphContentClient,
      mgmtClient: mgmtClient,
    });
    logOperation('ensureTaxonomy', 'Category', taxonomyResult.created, Date.now() - taxonomyStart);

    // Ensure taxonomy node (only if taxonomy was created or exists)
    if (taxonomyResult.created || true) { // Always try - existence check handles it
      const nodeStart = Date.now();
      const nodeApiId = marshalTaxonomyNodeApiId('tech'); // Must start with uppercase, alphanumeric + underscores
      const nodeParams: BatchMigrationCreateTaxonomyNodeInput = {
        taxonomyApiId: taxonomyApiId, // Use timestamped taxonomy API ID
        apiId: nodeApiId,
        displayName: 'Technology',
      };

      const nodeResult = await ensureTaxonomyNode({
        ...nodeParams,
        urqlClient: hygraphContentClient,
        mgmtClient: mgmtClient,
      });
      logOperation('ensureTaxonomyNode', `${taxonomyApiId}.${nodeApiId}`, nodeResult.created, Date.now() - nodeStart);

      // Ensure taxonomy field (use marshalled node API ID)
      const taxonomyFieldStart = Date.now();
      const taxonomyFieldParams: BatchMigrationCreateTaxonomyFieldInput = {
        parentApiId: apiId,
        apiId: marshalFieldApiId('category'), // camelCase for fields
        displayName: 'Category',
        taxonomyApiId: taxonomyApiId, // Use timestamped taxonomy API ID
        initialValue: JSON.stringify(nodeApiId), // JSON stringified apiId of taxonomy node (must match marshalled value)
      };

      const taxonomyFieldResult = await ensureTaxonomyField({
        ...taxonomyFieldParams,
        parentPluralApiId: apiIdPlural,
        urqlClient: hygraphContentClient,
        mgmtClient: mgmtClient,
      });
      logOperation('ensureTaxonomyField', `${apiId}.${taxonomyFieldParams.apiId}`, taxonomyFieldResult.created, Date.now() - taxonomyFieldStart);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logOperation('Taxonomy Operations', 'BATCH', false, 0, errorMsg);
    console.warn('⚠️  Taxonomy operations failed, continuing...');
  }

  // ============================================================================
  // Remote Source Operations
  // ============================================================================
  logSection('REMOTE SOURCE OPERATIONS');

  try {
    // ============================================================================
    // 1. REST Remote Source - Create
    // ============================================================================
    console.log('\n🌐 Demonstrating REST Remote Source:');
    
    // Create REST remote source using JSONPlaceholder (free public REST API)
    // JSONPlaceholder provides fake data for testing: https://jsonplaceholder.typicode.com
    // Example endpoint: /posts/1 returns { id: 1, title: "...", body: "...", userId: 1 }
    const restRemoteSourceStart = Date.now();
    const restRemotePrefix = marshalRemoteSourcePrefix('jsonplaceholder'); // Must start with uppercase
    const postTypeApiId = `Post${timestamp}`; // Unique API ID per invocation
    const restRemoteParams: BatchMigrationCreateRestRemoteSourceInput = {
      prefix: restRemotePrefix,
      url: 'https://jsonplaceholder.typicode.com',
      displayName: 'JSONPlaceholder API',
      kind: RemoteSourceKind.Custom, // Required field
      // Define remote type definitions for the API response structure
      // This matches the JSONPlaceholder /posts/{id} endpoint response
      // Input types must also be defined for use in inputArgs
      remoteTypeDefinitions: {
        sdl: `
          # Return type for the Post response
          type ${postTypeApiId} {
            id: Int!
            title: String!
            body: String!
            userId: Int!
          }
          
          # Input type for INTEGER arguments
          input INTEGER {
            value: Int!
          }
          
          # Input type for STRING arguments (for future use)
          input STRING {
            value: String!
          }
        `
      }
    };

    const restRemoteSourceResult = await ensureRESTRemoteSource({
      ...restRemoteParams,
      urqlClient: hygraphContentClient,
      mgmtClient: mgmtClient,
    });
    logOperation('ensureRESTRemoteSource', 'jsonplaceholder', restRemoteSourceResult.created, Date.now() - restRemoteSourceStart);

    // ============================================================================
    // 2. REST Remote Source - Update
    // ============================================================================
    if (restRemoteSourceResult.created || true) {
      try {
        const updateRestStart = Date.now();
        const updateRestParams: BatchMigrationUpdateRestRemoteSourceInput = {
          prefix: restRemotePrefix, // Use the marshalled prefix
          displayName: 'JSONPlaceholder API (Updated)',
          // Can update: displayName, description, url, headers, remoteTypeDefinitionsToUpsert, debugEnabled, kind, oAuth
          // Cannot update: prefix (immutable)
        };

        const updateRestResult = await updateRESTRemoteSource({
          ...updateRestParams,
          urqlClient: hygraphContentClient,
          mgmtClient: mgmtClient,
        });
        logOperation('updateRESTRemoteSource', 'jsonplaceholder', updateRestResult.updated, Date.now() - updateRestStart);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logOperation('updateRESTRemoteSource', 'jsonplaceholder', false, 0, errorMsg);
      }
    }

    // ============================================================================
    // 3. GraphQL Remote Source - Create
    // ============================================================================
    console.log('\n🌐 Demonstrating GraphQL Remote Source:');
    
    try {
      // Using Rick and Morty API - a public GraphQL API that doesn't require authentication
      // API Documentation: https://rickandmortyapi.com/documentation/#graphql
      const graphqlRemoteSourceStart = Date.now();
      const graphqlRemotePrefix = marshalRemoteSourcePrefix('rickAndMorty'); // Must start with uppercase
      const graphqlRemoteParams: BatchMigrationCreateGraphQlRemoteSourceInput = {
        prefix: graphqlRemotePrefix,
        url: 'https://rickandmortyapi.com/graphql', // Public GraphQL API (no auth required)
        introspectionUrl: 'https://rickandmortyapi.com/graphql',
        displayName: 'Rick and Morty API',
        kind: RemoteSourceKind.Custom,
        introspectionMethod: GraphQlRemoteSourceIntrospectionMethod.Post,
      };

      const graphqlRemoteSourceResult = await ensureGraphQLRemoteSource({
        ...graphqlRemoteParams,
        urqlClient: hygraphContentClient,
        mgmtClient: mgmtClient,
      });
      logOperation('ensureGraphQLRemoteSource', graphqlRemotePrefix, graphqlRemoteSourceResult.created, Date.now() - graphqlRemoteSourceStart);

      // ============================================================================
      // 4. GraphQL Remote Source - Update
      // ============================================================================
      if (graphqlRemoteSourceResult.created || true) {
        try {
          const updateGraphQLStart = Date.now();
          const updateGraphQLParams: BatchMigrationUpdateGraphQlRemoteSourceInput = {
            prefix: graphqlRemotePrefix, // Use the marshalled prefix
            displayName: 'Rick and Morty API (Updated)',
            // Can update: displayName, description, url, headers, introspectionUrl, introspectionMethod, 
            //            introspectionHeaders, remoteTypeDefinitionsToUpsert, debugEnabled, kind, oAuth
            // Cannot update: prefix (immutable)
          };

          const updateGraphQLResult = await updateGraphQLRemoteSource({
            ...updateGraphQLParams,
            urqlClient: hygraphContentClient,
            mgmtClient: mgmtClient,
          });
          logOperation('updateGraphQLRemoteSource', graphqlRemotePrefix, updateGraphQLResult.updated, Date.now() - updateGraphQLStart);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logOperation('updateGraphQLRemoteSource', graphqlRemotePrefix, false, 0, errorMsg);
        }
      }

      // ============================================================================
      // 5. GraphQL Remote Source - Refresh Schema
      // ============================================================================
      if (graphqlRemoteSourceResult.created || true) {
        try {
          const refreshStart = Date.now();
          const refreshResult = await refreshGraphQLRemoteSourceSchema({
            prefix: graphqlRemotePrefix, // Use the marshalled prefix
            urqlClient: hygraphContentClient,
            mgmtClient: mgmtClient,
          });
          logOperation('refreshGraphQLRemoteSourceSchema', graphqlRemotePrefix, refreshResult.refreshed, Date.now() - refreshStart);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logOperation('refreshGraphQLRemoteSourceSchema', graphqlRemotePrefix, false, 0, errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logOperation('GraphQL Remote Source Operations', 'BATCH', false, 0, errorMsg);
      console.warn('⚠️  GraphQL remote source operations failed - continuing...');
      console.warn(`   Error: ${errorMsg}`);
    }

    // ============================================================================
    // 6. Remote Field (requires remote source to exist)
    // ============================================================================
    if (restRemoteSourceResult.created || true) {
      console.log('\n🌐 Demonstrating RemoteField:');
      
      try {
        // Create a remote field that fetches a post from JSONPlaceholder
        // The returnTypeApiId must match a remote type defined in the remote source
        // For JSONPlaceholder, we'll use a simple structure that matches their /posts/{id} endpoint
        // Note: Remote types must be defined in the remote source first via remoteTypeDefinitions
        const remoteFieldStart = Date.now();
        const remoteFieldParams: BatchMigrationCreateRemoteFieldInput = {
          parentApiId: apiId,
          apiId: 'externalPost',
          displayName: 'External Post',
          type: RemoteFieldType.Rest,
          remoteConfig: {
            remoteSourcePrefix: restRemotePrefix, // Use the marshalled prefix
            returnTypeApiId: postTypeApiId, // Must match the type defined in remoteTypeDefinitions
            method: RemoteFieldApiMethod.Get,
            restPath: '/posts/{{!cast=INTEGER:doc.id}}', // Use field variable casting to pass model ID
          },
          inputArgs: [ // Note: property name is 'inputArgs', not 'inputArguments'
            {
              apiId: 'id',
              remoteTypeApiId: 'INTEGER',
              isRequired: true,
              isList: false,
            },
          ],
        };

        const remoteFieldResult = await ensureRemoteField({
          ...remoteFieldParams,
          parentPluralApiId: apiIdPlural,
          urqlClient: hygraphContentClient,
          mgmtClient: mgmtClient,
        });
        logOperation('ensureRemoteField', `${apiId}.externalPost`, remoteFieldResult.created, Date.now() - remoteFieldStart);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logOperation('ensureRemoteField', `${apiId}.externalPost`, false, 0, errorMsg);
        console.warn('⚠️  Remote field creation skipped - requires valid remote source configuration');
        console.warn('   Note: Remote fields require the remote source to have proper return types defined.');
        console.warn('   JSONPlaceholder may need return type configuration in Hygraph Studio first.');
      }
    }

    // ============================================================================
    // 7. Delete Remote Source (commented out - only uncomment if you want to test deletion)
    // ============================================================================
    // Note: Deleting a remote source will also delete all remote fields that depend on it
    // Uncomment the following block to test deletion:
    /*
    try {
      const deleteStart = Date.now();
      const deleteParams: BatchMigrationDeleteRemoteSourceInput = {
        prefix: restRemotePrefix, // or graphqlRemotePrefix
      };

      const deleteResult = await deleteRemoteSource({
        ...deleteParams,
        urqlClient: hygraphContentClient,
        mgmtClient: mgmtClient,
      });
      logOperation('deleteRemoteSource', 'jsonplaceholder', deleteResult.deleted, Date.now() - deleteStart);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logOperation('deleteRemoteSource', 'jsonplaceholder', false, 0, errorMsg);
    }
    */
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logOperation('Remote Source Operations', 'BATCH', false, 0, errorMsg);
    console.warn('⚠️  Remote source operations failed, continuing...');
  }

  // ============================================================================
  // Infrastructure Operations
  // ============================================================================
  // COMMENTED OUT: Infrastructure operations may be causing migration errors
  // logSection('INFRASTRUCTURE OPERATIONS');

  // try {
  //   const stageStart = Date.now();
  //   const stageParams: BatchMigrationCreateStageInput = {
  //     apiId: 'draft',
  //     displayName: 'Draft',
  //     color: ColorPalette.Blue,
  //   };

  //   const stageResult = await ensureStage({
  //     ...stageParams,
  //     urqlClient: hygraphContentClient,
  //     mgmtClient: mgmtClient,
  //   });
  //   logOperation('ensureStage', 'draft', stageResult.created, Date.now() - stageStart);

  //   const localeStart = Date.now();
  //   const localeParams: BatchMigrationCreateLocaleInput = {
  //     apiId: 'en',
  //     displayName: 'English',
  //   };

  //   const localeResult = await ensureLocale({
  //     ...localeParams,
  //     urqlClient: hygraphContentClient,
  //     mgmtClient: mgmtClient,
  //   });
  //   logOperation('ensureLocale', 'en', localeResult.created, Date.now() - localeStart);

  //   const webhookStart = Date.now();
  //   const webhookParams: BatchMigrationCreateWebhookInput = {
  //     name: 'example-webhook',
  //     url: 'https://example.com/webhook',
  //     models: [],
  //     stages: [],
  //     isActive: true,
  //     includePayload: false,
  //     triggerType: WebhookTriggerType.ContentModel,
  //     triggerActions: [],
  //   };

  //   const webhookResult = await ensureWebhook({
  //     ...webhookParams,
  //     urqlClient: hygraphContentClient,
  //     mgmtClient: mgmtClient,
  //   });
  //   logOperation('ensureWebhook', 'example-webhook', webhookResult.created, Date.now() - webhookStart);
  // } catch (error) {
  //   const errorMsg = error instanceof Error ? error.message : String(error);
  //   logOperation('Infrastructure Operations', 'BATCH', false, 0, errorMsg);
  //   console.warn('⚠️  Infrastructure operations failed, continuing...');
  // }

  // ============================================================================
  // Examine Environment Diff
  // ============================================================================
  logSection('EXAMINING ENVIRONMENT DIFF');
  
  try {
    // getEnvironmentDiff compares the current environment (associated with the auth token)
    // against a target environment and returns migrations needed to make the *target* match the current environment.
    //
    // IMPORTANT: This is a READ-ONLY operation - it does NOT modify scheduledMigrations.
    // It returns what migrations WOULD be needed to sync environments, but doesn't queue them.
    //
    // The environment to compare against can be set via HYGRAPH_TARGET_ENVIRONMENT (or HYGRAPH_ENVIRONMENT_COMPARE).
    // Default fallback (per product requirement) is "gbgcontent".
    const targetEnvironment =
      process.env['HYGRAPH_TARGET_ENVIRONMENT'] ??
      process.env['HYGRAPH_ENVIRONMENT_COMPARE'] ??
      'gbgcontent';
    const envDiffStart = Date.now();
    console.log(`\n🔍 Checking environment differences vs "${targetEnvironment}"...`);
    console.log('   NOTE: getEnvironmentDiff is read-only and does not modify scheduled migrations');
    
    // Store the count of scheduled migrations BEFORE calling getEnvironmentDiff
    const scheduledBeforeDiff = mgmtClient.dryRun().length;
    console.log(`   Scheduled migrations before getEnvironmentDiff: ${scheduledBeforeDiff}`);
    
    let envDiff: any[] | null = null;
    let envDiffSource: string | null = null;
    
    try {
      console.log(`  Attempting to get diff for environment: ${targetEnvironment}...`);
      const diff = await mgmtClient.getEnvironmentDiff(targetEnvironment);
      
      // Verify that getEnvironmentDiff doesn't modify scheduled migrations
      const scheduledAfterDiff = mgmtClient.dryRun().length;
      if (scheduledAfterDiff !== scheduledBeforeDiff) {
        console.warn(`  ⚠️  WARNING: getEnvironmentDiff modified scheduled migrations!`);
        console.warn(`     Before: ${scheduledBeforeDiff}, After: ${scheduledAfterDiff}`);
      }
      
      if (diff && diff.length > 0) {
        envDiff = diff;
        envDiffSource = targetEnvironment;
        console.log(`  ✅ Found ${diff.length} migration(s) in diff for ${targetEnvironment}`);
      } else {
        console.log(`  ℹ️  No differences found for ${targetEnvironment} (or environments are identical)`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ⚠️  Could not get diff for ${targetEnvironment}: ${errorMsg}`);
    }
    
    if (envDiff && envDiff.length > 0) {
      console.log(`\n📊 Environment Diff Analysis (${envDiff.length} operations):`);
      console.log(`   Source Environment: ${envDiffSource}`);
      console.log(`   Target Environment: (current - associated with Management SDK token)`);
      console.log(`   ⚠️  These are operations that WOULD sync environments - NOT queued for execution`);
      
      const diffOperationTypes = new Map<string, number>();
      const diffDeleteOps: Array<{ index: number; operation: any }> = [];
      
      envDiff.forEach((migration, index) => {
        const opName = migration.operationName || 'unknown';
        diffOperationTypes.set(opName, (diffOperationTypes.get(opName) || 0) + 1);
        
        if (opName.toLowerCase().includes('delete') || opName.toLowerCase().includes('remove')) {
          diffDeleteOps.push({ index: index + 1, operation: migration });
        }
        
        console.log(`  ${index + 1}. ${opName}`);
        if (migration.params) {
          const paramsStr = JSON.stringify(migration.params, null, 2);
          const preview = paramsStr.split('\n').slice(0, 5).join('\n');
          console.log(`     ${preview}${paramsStr.split('\n').length > 5 ? '...' : ''}`);
        }
      });
      
      console.log(`\n📈 Diff Operation Summary:`);
      diffOperationTypes.forEach((count, opName) => {
        console.log(`   ${opName}: ${count}`);
      });
      
      if (diffDeleteOps.length > 0) {
        console.warn(`\n⚠️  CRITICAL FINDING: ${diffDeleteOps.length} DELETE operation(s) in environment diff!`);
        console.warn(`   This indicates the current environment has schema elements that don't exist in "${envDiffSource}"`);
        console.warn(`   These DELETE operations are NOT queued - they're just informational`);
        console.warn(`   However, if environments get synced, these elements would be deleted`);
        console.warn(`   This may explain migration errors if Hygraph tries to sync environments automatically`);
        diffDeleteOps.forEach(({ index, operation }) => {
          console.warn(`     ${index}. ${operation.operationName}`);
          if (operation.params && operation.params.apiId) {
            console.warn(`        Would delete: ${operation.params.apiId}`);
          }
        });
      }
      
      console.log(`\n⏱️  Environment diff analysis completed in ${(Date.now() - envDiffStart).toFixed(2)}ms`);
    } else {
      console.log(`\n✅ No environment differences found (or no other environments available)`);
      console.log(`⏱️  Environment diff check completed in ${(Date.now() - envDiffStart).toFixed(2)}ms`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`\n⚠️  Could not examine environment diff: ${errorMsg}`);
    console.warn(`   This is not critical - continuing with migration execution...`);
  }

  // ============================================================================
  // Execute Migrations
  // ============================================================================
  logSection('EXECUTING MIGRATIONS');
  
  const dryRunStart = Date.now();
  const dryRunResult = mgmtClient.dryRun();
  console.log(`\n📋 Dry Run Results (${dryRunResult.length} migrations queued):`);
  
  // Analyze migrations for potential issues
  const operationTypes = new Map<string, number>();
  const deleteOperations: Array<{ index: number; operation: any }> = [];
  
  dryRunResult.forEach((migration, index) => {
    const opName = migration.operationName || 'unknown';
    operationTypes.set(opName, (operationTypes.get(opName) || 0) + 1);
    
    // Check for delete operations (potential data loss)
    if (opName.toLowerCase().includes('delete') || opName.toLowerCase().includes('remove')) {
      deleteOperations.push({ index: index + 1, operation: migration });
    }
    
    console.log(`  ${index + 1}. ${opName}`);
    console.log(`     Params: ${JSON.stringify(migration.params, null, 2).split('\n').slice(0, 3).join('\n')}...`);
  });
  
  console.log(`\n⏱️  Dry run completed in ${(Date.now() - dryRunStart).toFixed(2)}ms`);
  
  // Summary of operation types
  console.log(`\n📊 Migration Summary:`);
  operationTypes.forEach((count, opName) => {
    console.log(`  ${opName}: ${count}`);
  });

  if (dryRunResult.length === 0) {
    console.log('\n✅ No migrations to execute - all resources already exist!');
    logSummary();
    return { message: 'No migrations needed' };
  }

  // Warn about delete operations
  if (deleteOperations.length > 0) {
    console.warn(`\n⚠️  WARNING: ${deleteOperations.length} DELETE operation(s) detected!`);
    console.warn(`   These operations may cause data loss. Review carefully before proceeding.`);
    console.warn(`   Delete operations:`);
    deleteOperations.forEach(({ index, operation }) => {
      console.warn(`     ${index}. ${operation.operationName}`);
      console.warn(`        ${JSON.stringify(operation.params, null, 2).split('\n').slice(0, 2).join('\n')}`);
    });
    console.warn(`\n   Reference: https://hygraph.com/docs/api-reference/management-sdk/management-sdk-batchmigration`);
    console.warn(`   Batch migrations REPLACE schemas - they do not merge.`);
    console.warn(`   If target environment has changes not in source, they will be deleted.`);
  }

  console.log(`\n🚀 Executing ${dryRunResult.length} migration(s)...`);
  const executionStart = Date.now();
  
  try {
    const result = await mgmtClient.run(true);
    const executionDuration = Date.now() - executionStart;

    // Always log the full result structure for debugging
    console.log(`\n📊 Migration Result (raw):`);
    console.log(`  Result Type: ${typeof result}`);
    console.log(`  Result Constructor: ${result?.constructor?.name || 'unknown'}`);
    console.log(`  Result Keys: ${Object.keys(result || {}).join(', ')}`);
    console.log(`  Full Result JSON: ${JSON.stringify(result, null, 2)}`);

    if (result.errors) {
      console.error(`\n❌ Migration execution returned errors after ${executionDuration.toFixed(2)}ms`);
      console.error(`\n📋 Error Details:`);
      console.error(`  Errors Type: ${typeof result.errors}`);
      console.error(`  Errors Constructor: ${result.errors?.constructor?.name || 'unknown'}`);
      
      if (Array.isArray(result.errors)) {
        console.error(`  Errors Array Length: ${result.errors.length}`);
        result.errors.forEach((err: unknown, index: number) => {
          console.error(`\n  Error ${index + 1}:`);
          console.error(`    Type: ${typeof err}`);
          console.error(`    Constructor: ${err?.constructor?.name || 'unknown'}`);
          console.error(`    Value: ${JSON.stringify(err, null, 4)}`);
          if (err && typeof err === 'object') {
            console.error(`    Keys: ${Object.keys(err).join(', ')}`);
            if ('code' in err) console.error(`    Code: ${err.code}`);
            if ('message' in err) console.error(`    Message: ${err.message}`);
            if ('path' in err) console.error(`    Path: ${JSON.stringify(err.path)}`);
            if ('extensions' in err) console.error(`    Extensions: ${JSON.stringify(err.extensions, null, 4)}`);
          }
        });
      } else if (typeof result.errors === 'string') {
        console.error(`  Error String: ${result.errors}`);
      } else if (result.errors && typeof result.errors === 'object') {
        console.error(`  Error Object Keys: ${Object.keys(result.errors).join(', ')}`);
        console.error(`  Error Object: ${JSON.stringify(result.errors, null, 4)}`);
      } else {
        console.error(`  Error Value: ${String(result.errors)}`);
      }

      // Log other result properties that might be useful
      console.error(`\n📋 Result Properties:`);
      Object.keys(result).forEach(key => {
        if (key !== 'errors') {
          console.error(`  ${key}: ${JSON.stringify((result as any)[key], null, 2)}`);
        }
      });

      // Add context about batch migration limitations
      console.error(`\n💡 Troubleshooting Tips:`);
      console.error(`   This error may be related to batch migration limitations:`);
      console.error(`   - Batch migrations REPLACE schemas, they do not merge`);
      console.error(`   - If target environment has schema changes not in source, they may be deleted`);
      console.error(`   - Conflicting or unsynchronized schema changes can cause errors`);
      console.error(`   - Review the diff carefully before applying to avoid data loss`);
      console.error(`\n   Reference: https://hygraph.com/docs/api-reference/management-sdk/management-sdk-batchmigration`);
      console.error(`\n   Suggested actions:`);
      console.error(`   1. Ensure source and target environments are synchronized`);
      console.error(`   2. Review the dry run output above for DELETE operations`);
      console.error(`   3. Consider using getEnvironmentDiff() to compare environments`);
      console.error(`   4. Manually review and edit the diff before applying`);

      throw new Error(typeof result.errors === 'string' ? result.errors : JSON.stringify(result.errors, null, 2));
    }

    console.log(`\n✅ Migrations executed successfully in ${executionDuration.toFixed(2)}ms`);
    console.log(`\n📊 Migration Result:`);
    console.log(`  Status: ${(result as any).status || 'SUCCESS'}`);
    console.log(`  Migration ID: ${result.id || 'N/A'}`);
    if ((result as any).environmentId) {
      console.log(`  Environment ID: ${(result as any).environmentId}`);
    }
    if ((result as any).projectId) {
      console.log(`  Project ID: ${(result as any).projectId}`);
    }

    logSummary();
    return result;
  } catch (error) {
    const executionDuration = Date.now() - executionStart;
    
    console.error(`\n❌ Migration execution failed after ${executionDuration.toFixed(2)}ms`);
    console.error(`\n📋 Error Object Structure:`);
    console.error(`  Error Type: ${typeof error}`);
    console.error(`  Error Constructor: ${error?.constructor?.name || 'unknown'}`);
    console.error(`  Is Error Instance: ${error instanceof Error}`);
    
    if (error instanceof Error) {
      console.error(`  Error Name: ${error.name}`);
      console.error(`  Error Message: ${error.message}`);
      
      // Check for common error messages related to batch migrations
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('could not apply') || errorMsg.includes('schema changes')) {
        console.error(`\n💡 This error is likely related to batch migration limitations:`);
        console.error(`   - Batch migrations REPLACE schemas, they do not merge`);
        console.error(`   - Conflicting schema changes between environments can cause this`);
        console.error(`   - The target environment may have changes not present in source`);
        console.error(`   Reference: https://hygraph.com/docs/api-reference/management-sdk/management-sdk-batchmigration`);
      }
      
      if (error.stack) {
        console.error(`\n📚 Stack Trace:`);
        console.error(error.stack);
      }
      // Check for additional properties
      const errorKeys = Object.keys(error);
      if (errorKeys.length > 0) {
        console.error(`\n📋 Error Object Properties:`);
        errorKeys.forEach(key => {
          console.error(`  ${key}: ${JSON.stringify((error as any)[key], null, 2)}`);
        });
      }
    } else {
      console.error(`  Error Value: ${JSON.stringify(error, null, 2)}`);
    }

    // Try to stringify the entire error object
    try {
      console.error(`\n📋 Full Error JSON:`);
      console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (stringifyError) {
      console.error(`  Could not stringify error: ${stringifyError}`);
    }

    // Add troubleshooting context
    console.error(`\n💡 Troubleshooting Tips:`);
    console.error(`   1. Review the dry run output above for potential issues`);
    console.error(`   2. Check for DELETE operations that might conflict`);
    console.error(`   3. Ensure environments are synchronized before applying migrations`);
    console.error(`   4. Consider using getEnvironmentDiff() to compare environments`);
    console.error(`   5. Review: https://hygraph.com/docs/api-reference/management-sdk/management-sdk-batchmigration`);

    logSummary();
    throw error;
  }
};

// ============================================================================
// Main Execution
// ============================================================================

run()
  .then((result) => {
    console.log('\n🎉 All operations completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error occurred:');
    console.error(`\n📋 Top-Level Error Details:`);
    console.error(`  Error Type: ${typeof error}`);
    console.error(`  Error Constructor: ${error?.constructor?.name || 'unknown'}`);
    console.error(`  Is Error Instance: ${error instanceof Error}`);
    
    if (error instanceof Error) {
      console.error(`  Error Name: ${error.name}`);
      console.error(`  Error Message: ${error.message}`);
      if (error.stack) {
        console.error(`\n📚 Stack Trace:`);
        console.error(error.stack);
      }
      // Check for additional properties
      const errorKeys = Object.keys(error);
      if (errorKeys.length > 0) {
        console.error(`\n📋 Error Object Properties:`);
        errorKeys.forEach(key => {
          console.error(`  ${key}: ${JSON.stringify((error as any)[key], null, 2)}`);
        });
      }
    } else {
      console.error(`  Error Value: ${JSON.stringify(error, null, 2)}`);
    }

    // Try to stringify the entire error object
    try {
      console.error(`\n📋 Full Error JSON:`);
      console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (stringifyError) {
      console.error(`  Could not stringify error: ${stringifyError}`);
    }
    
    process.exit(1);
});
