/**
 * Spike 5 Integration Test (Pepr Infrastructure Path)
 *
 * Uses the actual Pepr introspection module to validate the E2E flow:
 *   Live endpoint → introspect → extract types → log results
 *
 * USAGE:
 *   # Terminal 1: Start subgraph server
 *   bunx tsx src/lib/schema-system/spikes/spike-5-server.ts 4011
 *
 *   # Terminal 2: Run this test (from infra/graph directory)
 *   cd src/infra/graph && bunx tsx test/integration-spike-5.ts
 *
 * @module
 */

import { Log } from 'pepr'
import { introspectEndpoint, generateEffectSchemaCode, type ExtractedType } from '../controller/introspection'

const ENDPOINT = process.argv[2] || 'http://localhost:4011/graphql'

async function main() {
  Log.info('─'.repeat(70))
  Log.info('SPIKE 5 INTEGRATION: Pepr Infrastructure Path')
  Log.info('─'.repeat(70))
  Log.info('')

  // Step 1: Introspect
  Log.info(`Step 1: Introspect endpoint`)
  Log.info({ url: ENDPOINT }, 'Target')

  const result = await introspectEndpoint(ENDPOINT)

  if (!result.success) {
    Log.error({ error: result.error }, 'Introspection failed')
    Log.info('')
    Log.info('Hint: Ensure spike-5-server is running:')
    Log.info('  bunx tsx src/lib/schema-system/spikes/spike-5-server.ts 4011')
    process.exit(1)
  }

  Log.info({ sdlLength: result.sdl?.length, typeCount: result.types?.length }, 'Introspection successful')

  // Step 2: Show extracted types
  Log.info('')
  Log.info('Step 2: Extracted types')
  for (const type of result.types ?? []) {
    Log.info({ name: type.name, kind: type.kind, fieldCount: type.fields?.length ?? 0 }, 'Type')
    if (type.fields) {
      for (const field of type.fields.slice(0, 5)) {
        const nullable = field.isNullable ? '?' : ''
        const list = field.isList ? '[]' : ''
        Log.debug(`  · ${field.name}: ${field.type}${list}${nullable}`)
      }
    }
  }

  // Step 3: Generate Effect Schema code
  Log.info('')
  Log.info('Step 3: Generated Effect Schema code (preview)')
  const schemaCode = generateEffectSchemaCode(result.types ?? [])
  const lines = schemaCode.split('\n').slice(0, 20)
  console.log('```typescript')
  for (const line of lines) {
    console.log(line)
  }
  if (schemaCode.split('\n').length > 20) {
    console.log(`// ... ${schemaCode.split('\n').length - 20} more lines`)
  }
  console.log('```')

  // Step 4: Summary
  Log.info('')
  Log.info('─'.repeat(70))
  Log.info('✅ SPIKE 5 INTEGRATION SUCCESS')
  Log.info('─'.repeat(70))
  Log.info('')
  Log.info('Pipeline validated:')
  Log.info('  1. HTTP introspection via Pepr module ✓')
  Log.info('  2. SDL extraction (buildClientSchema + printSchema) ✓')
  Log.info(`  3. Type extraction (${result.types?.length} types) ✓`)
  Log.info('  4. Effect Schema codegen ✓')
  Log.info('')
  Log.info('This is the same code path used by CosmoSubgraph reconciler.')
  Log.info('When schema.introspection.url is set, reconciler calls introspectEndpoint().')

  return {
    success: true,
    endpoint: ENDPOINT,
    sdlLength: result.sdl?.length ?? 0,
    typesExtracted: result.types?.length ?? 0,
  }
}

main()
  .then((result) => {
    Log.info({ result }, 'Integration test completed')
  })
  .catch((error) => {
    Log.error({ error }, 'Integration test failed')
    process.exit(1)
  })
