import { Client } from '@hygraph/management-sdk';
import 'dotenv/config';

const authToken = process.env['HYGRAPH_MGMT_TOKEN'];
const endpoint = process.env['HYGRAPH_MGMT_ENDPOINT'];

if (!authToken || !endpoint) {
  console.error('❌ Missing required environment variables:');
  console.error('   HYGRAPH_MGMT_TOKEN:', authToken ? '✅' : '❌');
  console.error('   HYGRAPH_MGMT_ENDPOINT:', endpoint ? '✅' : '❌');
  process.exit(1);
}

const mgmtClient = new Client({
  authToken: authToken,
  endpoint: endpoint,
});

// System models that should NOT be deleted
const SYSTEM_MODELS = new Set([
  'Asset',
  'User',
  'ScheduledOperation',
  'ScheduledRelease',
]);

// Hardcoded list of custom models to delete (enumerated via Hygraph MCP)
// Note: Link, SeoOverride, Thing2 are not actual models (they may be components/enums/taxonomies)
const MODELS_TO_DELETE = [
  'Author',
  'Bar',
  'BarTest1763116867526',
  'BarTest1763119936410',
  'Blob',
  'FooTest1763116867526',
  'FooTest1763119936410',
  'Navigation',
  'Page',
  'Post',
  'Yada',
  'YadaExtra1763116867526',
  'YadaExtra1763119936410',
  'YadaMetadata',
  'YadaMetadata1763116867526',
  'YadaMetadata1763119936410',
];

const run = async () => {
  console.log('📋 ENUMERATION RESULTS (from Hygraph MCP):\n');
  console.log(`Found ${MODELS_TO_DELETE.length} custom model(s) to delete:\n`);
  
  MODELS_TO_DELETE.forEach((model, index) => {
    console.log(`  ${index + 1}. ${model}`);
  });
  
  console.log(`\n⚠️  System models excluded: ${Array.from(SYSTEM_MODELS).join(', ')}\n`);

  if (MODELS_TO_DELETE.length === 0) {
    console.log('✅ No custom models found to delete.');
    return;
  }

  console.log(`🗑️  Proceeding to delete ${MODELS_TO_DELETE.length} custom model(s)...\n`);
  console.log(`📋 Models to delete: ${MODELS_TO_DELETE.join(', ')}\n`);

  // Delete models one at a time to handle non-existent models gracefully
  const deletedModels: string[] = [];
  const failedModels: Array<{ model: string; error: string }> = [];
  const skippedModels: string[] = [];

  for (const modelApiId of MODELS_TO_DELETE) {
    // Create a fresh client for each deletion to avoid state issues
    const singleClient = new Client({
      authToken: authToken!,
      endpoint: endpoint!,
    });

    try {
      console.log(`\n🗑️  Deleting: ${modelApiId}`);
      singleClient.deleteModel({ apiId: modelApiId });
      
      const dryRun = singleClient.dryRun();
      if (dryRun.length === 0) {
        console.log(`  ⏭️  Skipped (no operation queued - may not exist)`);
        skippedModels.push(modelApiId);
        continue;
      }

      const executionStart = Date.now();
      const result = await singleClient.run(true);
      const executionDuration = Date.now() - executionStart;
      
      const status = (result as any).status || 'UNKNOWN';
      
      if (status === 'SUCCESS' || status === 'APPLIED') {
        console.log(`  ✅ Deleted successfully (${executionDuration.toFixed(2)}ms)`);
        deletedModels.push(modelApiId);
      } else {
        const errorMsg = (result as any).errors?.[0] || `Status: ${status}`;
        console.log(`  ❌ Failed: ${errorMsg}`);
        failedModels.push({ model: modelApiId, error: String(errorMsg) });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ Error: ${errorMsg}`);
      failedModels.push({ model: modelApiId, error: errorMsg });
    }
  }

  // Summary
  console.log(`\n\n📊 DELETION SUMMARY:\n`);
  console.log(`  ✅ Successfully deleted: ${deletedModels.length}`);
  if (deletedModels.length > 0) {
    deletedModels.forEach((model) => console.log(`     - ${model}`));
  }
  
  console.log(`\n  ⏭️  Skipped (may not exist): ${skippedModels.length}`);
  if (skippedModels.length > 0) {
    skippedModels.forEach((model) => console.log(`     - ${model}`));
  }
  
  console.log(`\n  ❌ Failed: ${failedModels.length}`);
  if (failedModels.length > 0) {
    failedModels.forEach(({ model, error }) => console.log(`     - ${model}: ${error}`));
  }

  if (deletedModels.length > 0) {
    console.log(`\n✅ Deletion process completed. ${deletedModels.length} model(s) deleted.`);
  } else if (skippedModels.length === MODELS_TO_DELETE.length) {
    console.log(`\n✅ All models appear to be already deleted or don't exist.`);
  }
};

run().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
