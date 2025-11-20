import { Client } from '@hygraph/management-sdk';
import 'dotenv/config';
import { hygraphContentClient } from './hygraph-urql-client';

const authToken = process.env['HYGRAPH_MGMT_TOKEN'];
const endpoint = process.env['HYGRAPH_MGMT_ENDPOINT'];

if (!authToken || !endpoint) {
  console.error('❌ Missing required environment variables:');
  console.error('   HYGRAPH_MGMT_TOKEN:', authToken ? '✅' : '❌');
  console.error('   HYGRAPH_MGMT_ENDPOINT:', endpoint ? '✅' : '❌');
  process.exit(1);
}

/**
 * Discover enumerations using GraphQL introspection
 */
async function discoverEnumerations(): Promise<string[]> {
  const introspectionQuery = `
    query IntrospectEnumerations {
      __schema {
        types {
          name
          kind
          enumValues {
            name
          }
        }
      }
    }
  `;

  try {
    const result = await hygraphContentClient.query(introspectionQuery, {}).toPromise();
    
    if (result.error) {
      console.warn('⚠️  Error discovering enumerations:', result.error.message);
      return [];
    }

    const types = result.data?.__schema?.types || [];
    const enumerations: string[] = [];
    
    // System enumerations that should NOT be deleted
    const SYSTEM_ENUMS = new Set([
      'AssetOrderByInput',
      'AssetUploadStatus',
      'DocumentFileTypes',
      'EntityTypeName',
      'ImageFit',
      'Locale',
      'ScheduledOperationOrderByInput',
      'ScheduledReleaseOrderByInput',
      'SeoOverrideOrderByInput',
      'Stage',
      'SystemDateTimeFieldVariation',
      'UserKind',
      'UserOrderByInput',
    ]);
    
    for (const type of types) {
      if (type.kind === 'ENUM' && type.enumValues && type.enumValues.length > 0) {
        // Skip system enums and introspection types
        if (
          !type.name.startsWith('_') &&
          !type.name.startsWith('__') &&
          !SYSTEM_ENUMS.has(type.name)
        ) {
          enumerations.push(type.name);
        }
      }
    }

    return enumerations.sort();
  } catch (error) {
    console.warn('⚠️  Error discovering enumerations:', error);
    return [];
  }
}

/**
 * Discover taxonomies using GraphQL introspection
 */
async function discoverTaxonomies(): Promise<string[]> {
  const introspectionQuery = `
    query IntrospectTaxonomies {
      __schema {
        types {
          name
          kind
          fields {
            name
            type {
              name
              kind
            }
          }
        }
      }
    }
  `;

  try {
    const result = await hygraphContentClient.query(introspectionQuery, {}).toPromise();
    
    if (result.error) {
      console.warn('⚠️  Error discovering taxonomies:', result.error.message);
      return [];
    }

    const types = result.data?.__schema?.types || [];
    const taxonomies = new Set<string>();
    
    // Taxonomies appear as OBJECT types with specific field patterns
    // They typically have fields like: id, name, slug, path, etc.
    for (const type of types) {
      if (type.kind === 'OBJECT' && type.fields) {
        const fieldNames = type.fields.map((f: any) => f.name);
        // Check if it looks like a taxonomy (has id, name, and path fields)
        if (
          fieldNames.includes('id') &&
          fieldNames.includes('name') &&
          fieldNames.includes('path') &&
          !type.name.startsWith('_') &&
          !type.name.startsWith('__') &&
          type.name !== 'Query' &&
          type.name !== 'Mutation' &&
          type.name !== 'Subscription' &&
          !type.name.includes('Connection') &&
          !type.name.includes('Edge')
        ) {
          taxonomies.add(type.name);
        }
      }
    }

    return Array.from(taxonomies).sort();
  } catch (error) {
    console.warn('⚠️  Error discovering taxonomies:', error);
    return [];
  }
}

// Hardcoded lists (can be discovered or manually specified)
// Remote sources cannot be discovered via Content API - must be specified manually
const REMOTE_SOURCES_TO_DELETE = [
  'Jsonplaceholder',  // From hello-world script
  'Rickandmortyapi',  // From hello-world script (marshalled prefix)
];

/**
 * Delete a resource individually and track results
 */
async function deleteResource(
  client: Client,
  resourceType: string,
  apiId: string,
  deleteFn: (params: any) => void,
  params: any,
): Promise<{ success: boolean; error?: string }> {
  try {
    deleteFn.call(client, params);
    
    const dryRun = client.dryRun();
    if (dryRun.length === 0) {
      return { success: false, error: 'No operation queued (may not exist)' };
    }

    const executionStart = Date.now();
    const result = await client.run(true);
    const executionDuration = Date.now() - executionStart;
    
    const status = (result as any).status || 'UNKNOWN';
    
    if (status === 'SUCCESS' || status === 'APPLIED') {
      return { success: true };
    } else {
      // Extract error message more thoroughly
      let errorMsg = `Status: ${status}`;
      if ((result as any).errors) {
        if (Array.isArray((result as any).errors)) {
          errorMsg = (result as any).errors[0] || errorMsg;
        } else if (typeof (result as any).errors === 'string') {
          errorMsg = (result as any).errors;
        } else if ((result as any).errors.message) {
          errorMsg = (result as any).errors.message;
        }
      }
      if ((result as any).message) {
        errorMsg = (result as any).message;
      }
      return { success: false, error: String(errorMsg) };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

const run = async () => {
  console.log('🔍 Discovering Enumerations and Taxonomies...\n');
  
  // Discover enumerations and taxonomies
  const discoveredEnumerations = await discoverEnumerations();
  const discoveredTaxonomies = await discoverTaxonomies();
  
  console.log(`📋 Discovered ${discoveredEnumerations.length} enumeration(s): ${discoveredEnumerations.join(', ') || 'none'}`);
  console.log(`🌳 Discovered ${discoveredTaxonomies.length} taxonomy/taxonomy node(s): ${discoveredTaxonomies.join(', ') || 'none'}`);
  console.log(`🔗 Remote sources to delete: ${REMOTE_SOURCES_TO_DELETE.join(', ') || 'none'}\n`);

  // Components are already deleted, but keeping the structure for future use
  const COMPONENTS_TO_DELETE: string[] = [];
  
  const ENUMERATIONS_TO_DELETE = discoveredEnumerations;
  const TAXONOMIES_TO_DELETE = discoveredTaxonomies;
  
  console.log('🗑️  Deleting Components, Enumerations, Taxonomies, and Remote Sources\n');
  
  const results = {
    components: { deleted: [] as string[], failed: [] as Array<{ name: string; error: string }> },
    enumerations: { deleted: [] as string[], failed: [] as Array<{ name: string; error: string }> },
    taxonomies: { deleted: [] as string[], failed: [] as Array<{ name: string; error: string }> },
    remoteSources: { deleted: [] as string[], failed: [] as Array<{ name: string; error: string }> },
  };

  // Delete Components
  if (COMPONENTS_TO_DELETE.length > 0) {
    console.log(`\n📦 Deleting ${COMPONENTS_TO_DELETE.length} component(s)...`);
    for (const apiId of COMPONENTS_TO_DELETE) {
      const client = new Client({ authToken: authToken!, endpoint: endpoint! });
      console.log(`  🗑️  Deleting component: ${apiId}`);
      const result = await deleteResource(
        client,
        'component',
        apiId,
        client.deleteComponent,
        { apiId },
      );
      
      if (result.success) {
        console.log(`    ✅ Deleted successfully`);
        results.components.deleted.push(apiId);
      } else {
        console.log(`    ❌ Failed: ${result.error}`);
        results.components.failed.push({ name: apiId, error: result.error || 'Unknown error' });
      }
    }
  }

  // Delete Enumerations
  if (ENUMERATIONS_TO_DELETE.length > 0) {
    console.log(`\n📋 Deleting ${ENUMERATIONS_TO_DELETE.length} enumeration(s)...`);
    for (const apiId of ENUMERATIONS_TO_DELETE) {
      const client = new Client({ authToken: authToken!, endpoint: endpoint! });
      console.log(`  🗑️  Deleting enumeration: ${apiId}`);
      const result = await deleteResource(
        client,
        'enumeration',
        apiId,
        client.deleteEnumeration,
        { apiId },
      );
      
      if (result.success) {
        console.log(`    ✅ Deleted successfully`);
        results.enumerations.deleted.push(apiId);
      } else {
        console.log(`    ❌ Failed: ${result.error}`);
        results.enumerations.failed.push({ name: apiId, error: result.error || 'Unknown error' });
      }
    }
  }

  // Delete Taxonomies
  if (TAXONOMIES_TO_DELETE.length > 0) {
    console.log(`\n🌳 Deleting ${TAXONOMIES_TO_DELETE.length} taxonomy/taxonomy node(s)...`);
    for (const apiId of TAXONOMIES_TO_DELETE) {
      const client = new Client({ authToken: authToken!, endpoint: endpoint! });
      console.log(`  🗑️  Deleting taxonomy: ${apiId}`);
      const result = await deleteResource(
        client,
        'taxonomy',
        apiId,
        client.deleteTaxonomy,
        { apiId },
      );
      
      if (result.success) {
        console.log(`    ✅ Deleted successfully`);
        results.taxonomies.deleted.push(apiId);
      } else {
        console.log(`    ❌ Failed: ${result.error}`);
        results.taxonomies.failed.push({ name: apiId, error: result.error || 'Unknown error' });
      }
    }
  }

  // Delete Remote Sources
  if (REMOTE_SOURCES_TO_DELETE.length > 0) {
    console.log(`\n🔗 Deleting ${REMOTE_SOURCES_TO_DELETE.length} remote source(s)...`);
    for (const prefix of REMOTE_SOURCES_TO_DELETE) {
      const client = new Client({ authToken: authToken!, endpoint: endpoint! });
      console.log(`  🗑️  Deleting remote source: ${prefix}`);
      const result = await deleteResource(
        client,
        'remoteSource',
        prefix,
        client.deleteRemoteSource,
        { prefix },
      );
      
      if (result.success) {
        console.log(`    ✅ Deleted successfully`);
        results.remoteSources.deleted.push(prefix);
      } else {
        console.log(`    ❌ Failed: ${result.error}`);
        results.remoteSources.failed.push({ name: prefix, error: result.error || 'Unknown error' });
      }
    }
  }

  // Summary
  console.log(`\n\n📊 DELETION SUMMARY:\n`);
  
  console.log(`  📦 Components:`);
  console.log(`     ✅ Deleted: ${results.components.deleted.length}`);
  if (results.components.deleted.length > 0) {
    results.components.deleted.forEach((name) => console.log(`        - ${name}`));
  }
  console.log(`     ❌ Failed: ${results.components.failed.length}`);
  if (results.components.failed.length > 0) {
    results.components.failed.forEach(({ name, error }) => console.log(`        - ${name}: ${error}`));
  }
  
  console.log(`\n  📋 Enumerations:`);
  console.log(`     ✅ Deleted: ${results.enumerations.deleted.length}`);
  if (results.enumerations.deleted.length > 0) {
    results.enumerations.deleted.forEach((name) => console.log(`        - ${name}`));
  }
  console.log(`     ❌ Failed: ${results.enumerations.failed.length}`);
  if (results.enumerations.failed.length > 0) {
    results.enumerations.failed.forEach(({ name, error }) => console.log(`        - ${name}: ${error}`));
  }
  
  console.log(`\n  🌳 Taxonomies:`);
  console.log(`     ✅ Deleted: ${results.taxonomies.deleted.length}`);
  if (results.taxonomies.deleted.length > 0) {
    results.taxonomies.deleted.forEach((name) => console.log(`        - ${name}`));
  }
  console.log(`     ❌ Failed: ${results.taxonomies.failed.length}`);
  if (results.taxonomies.failed.length > 0) {
    results.taxonomies.failed.forEach(({ name, error }) => console.log(`        - ${name}: ${error}`));
  }
  
  console.log(`\n  🔗 Remote Sources:`);
  console.log(`     ✅ Deleted: ${results.remoteSources.deleted.length}`);
  if (results.remoteSources.deleted.length > 0) {
    results.remoteSources.deleted.forEach((name) => console.log(`        - ${name}`));
  }
  console.log(`     ❌ Failed: ${results.remoteSources.failed.length}`);
  if (results.remoteSources.failed.length > 0) {
    results.remoteSources.failed.forEach(({ name, error }) => console.log(`        - ${name}: ${error}`));
  }

  const totalDeleted = 
    results.components.deleted.length +
    results.enumerations.deleted.length +
    results.taxonomies.deleted.length +
    results.remoteSources.deleted.length;

  if (totalDeleted > 0) {
    console.log(`\n✅ Deletion process completed. ${totalDeleted} resource(s) deleted.`);
  } else {
    console.log(`\n✅ No resources to delete or all resources already deleted.`);
  }
};

run().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

