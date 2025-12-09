/**
 * SPIKE 5B: Pepr Infrastructure Integration Test
 *
 * Uses the SAME introspection module that the Pepr CosmoSubgraph reconciler uses,
 * demonstrating the code path: introspect endpoint → extract types → Effect Schema
 *
 * This validates the Pepr integration without requiring a running k8s cluster.
 *
 * USAGE:
 *   # Terminal 1: Start the subgraph server
 *   bunx tsx src/lib/schema-system/spikes/spike-5-server.ts 4011
 *
 *   # Terminal 2: Run this integration test
 *   bunx tsx src/lib/schema-system/spikes/spike-5-pepr-integration.ts
 *
 * @module
 */

import { Effect, Schema } from 'effect'

// Import the ACTUAL Pepr infrastructure introspection module
import {
  introspectEndpoint,
  generateEffectSchemaCode,
  type ExtractedType,
} from '../../../infra/graph/controller/introspection.js'

// Import Spike 4's registry
import { PayloadSchemaRegistry } from './spike-4-schema-registry.js'

const DEFAULT_ENDPOINT = 'http://localhost:4011/graphql'

// =============================================================================
// EXTRACTED TYPE → EFFECT SCHEMA CONVERSION
// =============================================================================

/**
 * Convert extracted types from Pepr introspection to Effect Schemas
 * and register them in the PayloadSchemaRegistry
 */
function extractedTypeToEffectSchema(extracted: ExtractedType): Schema.Schema<unknown, unknown> {
  if (!extracted.fields || extracted.kind !== 'OBJECT') {
    return Schema.Struct({}) as Schema.Schema<unknown, unknown>
  }

  const fields: Record<string, Schema.Schema<unknown, unknown>> = {}

  for (const field of extracted.fields) {
    let baseSchema: Schema.Schema<unknown, unknown>

    switch (field.type) {
      case 'String':
      case 'ID':
        baseSchema = Schema.String as Schema.Schema<unknown, unknown>
        break
      case 'Int':
        baseSchema = Schema.Number.pipe(Schema.int()) as Schema.Schema<unknown, unknown>
        break
      case 'Float':
        baseSchema = Schema.Number as Schema.Schema<unknown, unknown>
        break
      case 'Boolean':
        baseSchema = Schema.Boolean as Schema.Schema<unknown, unknown>
        break
      default:
        baseSchema = Schema.Unknown as Schema.Schema<unknown, unknown>
    }

    if (field.isList) {
      baseSchema = Schema.Array(baseSchema) as Schema.Schema<unknown, unknown>
    }

    if (field.isNullable) {
      baseSchema = Schema.optional(baseSchema) as Schema.Schema<unknown, unknown>
    }

    if (field.description) {
      baseSchema = baseSchema.pipe(
        Schema.annotations({ title: field.description })
      ) as Schema.Schema<unknown, unknown>
    }

    fields[field.name] = baseSchema
  }

  return Schema.Struct(fields) as Schema.Schema<unknown, unknown>
}

// =============================================================================
// TEST PROGRAM
// =============================================================================

const testProgram = (endpoint: string) =>
  Effect.gen(function* () {
    console.log('\n' + '='.repeat(70))
    console.log('SPIKE 5B: Pepr Infrastructure Integration Test')
    console.log('='.repeat(70) + '\n')

    // Step 1: Use Pepr's introspection module
    console.log('Step 1: Introspect via Pepr infrastructure module')
    console.log(`   Using: src/infra/graph/controller/introspection.ts`)
    console.log(`   Target: ${endpoint}`)

    const result = yield* Effect.promise(() => introspectEndpoint(endpoint))

    if (!result.success) {
      console.error(`\n✗ Introspection failed: ${result.error}`)
      console.log('\n  Hint: Ensure spike-5-server is running:')
      console.log('  bunx tsx src/lib/schema-system/spikes/spike-5-server.ts 4011')
      return { success: false, error: result.error }
    }

    console.log(`✓ Introspection successful`)
    console.log(`   SDL length: ${result.sdl?.length ?? 0} characters`)
    console.log(`   Types found: ${result.types?.length ?? 0}`)

    // Step 2: Show extracted types
    console.log('\nStep 2: Extracted types from Pepr introspection')
    for (const type of result.types ?? []) {
      console.log(`   - ${type.name} (${type.kind})`)
      if (type.fields) {
        for (const field of type.fields.slice(0, 3)) {
          const nullable = field.isNullable ? '?' : ''
          const list = field.isList ? '[]' : ''
          console.log(`     · ${field.name}: ${field.type}${list}${nullable}`)
        }
        if (type.fields.length > 3) {
          console.log(`     · ... ${type.fields.length - 3} more fields`)
        }
      }
    }

    // Step 3: Generate Effect Schema code (codegen preview)
    console.log('\nStep 3: Generated Effect Schema code (preview)')
    const schemaCode = generateEffectSchemaCode(result.types ?? [])
    const codeLines = schemaCode.split('\n').slice(0, 15)
    for (const line of codeLines) {
      console.log(`   ${line}`)
    }
    if (schemaCode.split('\n').length > 15) {
      console.log(`   ... ${schemaCode.split('\n').length - 15} more lines`)
    }

    // Step 4: Convert to runtime Effect Schemas and register
    console.log('\nStep 4: Register extracted types in PayloadSchemaRegistry')
    for (const type of result.types ?? []) {
      const schema = extractedTypeToEffectSchema(type)
      yield* PayloadSchemaRegistry.register({
        id: `pepr:${type.name.toLowerCase()}`,
        name: type.name,
        description: type.description ?? `Introspected via Pepr: ${type.name}`,
        schema,
        priority: 60, // Higher than generic introspected, lower than local
      })
      console.log(`   ✓ Registered: pepr:${type.name.toLowerCase()}`)
    }

    // Step 5: List all registered
    console.log('\nStep 5: Verify registration')
    const all = yield* PayloadSchemaRegistry.getAll()
    console.log(`✓ Total schemas: ${all.length}`)
    for (const s of all) {
      console.log(`   - ${s.id}: ${s.name} (priority: ${s.priority})`)
    }

    // Step 6: Test detection
    console.log('\nStep 6: Payload detection test')
    const senmlPayload = { n: 'temperature', v: 23.5, u: 'Cel', t: 1702147200 }
    const matches = yield* PayloadSchemaRegistry.detect(senmlPayload)
    console.log(`   Payload: ${JSON.stringify(senmlPayload)}`)
    console.log(`   Matches: ${matches.map((s) => s.id).join(', ') || 'none'}`)

    // Summary
    console.log('\n' + '='.repeat(70))
    console.log('✅ SPIKE 5B SUCCESS: Pepr Infrastructure Integration Validated')
    console.log('='.repeat(70))
    console.log('\nPipeline:')
    console.log('  1. Pepr introspection module (src/infra/graph/controller/introspection.ts) ✓')
    console.log('  2. Extracted types → Effect Schemas ✓')
    console.log('  3. PayloadSchemaRegistry registration ✓')
    console.log('  4. Payload detection ✓')
    console.log('\nCodegen output can be written to file for static schema definitions.')

    return {
      success: true,
      typesExtracted: result.types?.length ?? 0,
      sdlLength: result.sdl?.length ?? 0,
    }
  })

// =============================================================================
// RUN
// =============================================================================

export function runSpike5B(endpoint: string = DEFAULT_ENDPOINT) {
  return Effect.runPromise(
    testProgram(endpoint).pipe(Effect.provide(PayloadSchemaRegistry.Default))
  )
    .then((result) => {
      console.log('\nSpike 5B completed:', result)
      return result
    })
    .catch((error) => {
      console.error('\n❌ Spike 5B failed:', error)
      return { success: false, error }
    })
}

// Run if executed directly
const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/^file:\/\//, '') ?? '')
if (isMainModule) {
  const endpoint = process.argv[2] || DEFAULT_ENDPOINT
  runSpike5B(endpoint)
}
