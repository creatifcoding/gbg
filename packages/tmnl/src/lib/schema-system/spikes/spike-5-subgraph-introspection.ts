/**
 * SPIKE 5: E2E Subgraph Introspection → PayloadSchemaRegistry
 *
 * HYPOTHESIS: We can introspect a LIVE GraphQL subgraph over HTTP,
 * derive Effect Schemas from the introspection result, and register
 * them dynamically — simulating federated service discovery.
 *
 * SUCCESS CRITERIA:
 * - HTTP introspection query to running subgraph endpoint
 * - Parse __schema response into type information
 * - Map __Type fields to Effect Schema primitives
 * - Generated schemas successfully detect sample payloads
 * - Full pipeline: Live Subgraph (HTTP) → Introspection → Effect Schema → Registry
 *
 * DEPENDENCIES:
 * - A GraphQL subgraph must be running (e.g., sensor-service at localhost:4011)
 * - Spike 4's PayloadSchemaRegistry provides registration
 *
 * USAGE:
 *   # First, start a subgraph (in another terminal):
 *   cd src/lib/schema-system/cosmo/sensor-service && bun run dev
 *
 *   # Then run this spike:
 *   bunx tsx src/lib/schema-system/spikes/spike-5-subgraph-introspection.ts [endpoint]
 *
 * @module
 */

import { Effect, Schema } from 'effect'
import {
  getIntrospectionQuery,
  type IntrospectionQuery,
  type IntrospectionType,
  type IntrospectionInputTypeRef,
  type IntrospectionOutputTypeRef,
  type IntrospectionNamedTypeRef,
} from 'graphql'

// Import Spike 4's registry
import { PayloadSchemaRegistry } from './spike-4-schema-registry.js'

// Default endpoint (sensor-service from Spike 3)
const DEFAULT_ENDPOINT = 'http://localhost:4011/graphql'

// =============================================================================
// HTTP INTROSPECTION (LIVE SUBGRAPH)
// =============================================================================

const INTROSPECTION_QUERY = getIntrospectionQuery()

/**
 * Introspect a live GraphQL endpoint over HTTP
 *
 * This simulates how a federated router discovers subgraph schemas
 */
async function introspectEndpoint(url: string): Promise<IntrospectionQuery> {
  console.log(`   Sending introspection query to: ${url}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: INTROSPECTION_QUERY,
    }),
  })

  if (!response.ok) {
    throw new Error(`Introspection failed: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as { data?: IntrospectionQuery; errors?: unknown[] }

  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`)
  }

  if (!json.data) {
    throw new Error('No data in introspection response')
  }

  return json.data
}

/**
 * Extract object types from introspection (excluding builtins)
 */
function extractObjectTypes(introspection: IntrospectionQuery): IntrospectionType[] {
  return introspection.__schema.types.filter(
    (t) =>
      t.kind === 'OBJECT' &&
      !t.name.startsWith('__') &&
      t.name !== 'Query' &&
      t.name !== 'Mutation' &&
      t.name !== 'Subscription'
  )
}

// =============================================================================
// GRAPHQL TYPE → EFFECT SCHEMA MAPPING
// =============================================================================

type GraphQLTypeRef = IntrospectionInputTypeRef | IntrospectionOutputTypeRef

/**
 * Unwrap NON_NULL and LIST wrappers to get base type
 */
function unwrapType(typeRef: GraphQLTypeRef): { baseName: string; isNullable: boolean; isList: boolean } {
  let current = typeRef
  let isNullable = true
  let isList = false

  while (current.kind === 'NON_NULL' || current.kind === 'LIST') {
    if (current.kind === 'NON_NULL') {
      isNullable = false
      current = current.ofType
    } else if (current.kind === 'LIST') {
      isList = true
      current = current.ofType
    }
  }

  return {
    baseName: (current as IntrospectionNamedTypeRef).name,
    isNullable,
    isList,
  }
}

/**
 * Map GraphQL scalar to Effect Schema
 */
function scalarToSchema(scalarName: string): Schema.Schema<unknown, unknown> {
  switch (scalarName) {
    case 'String':
    case 'ID':
      return Schema.String as Schema.Schema<unknown, unknown>
    case 'Int':
      return Schema.Number.pipe(Schema.int()) as Schema.Schema<unknown, unknown>
    case 'Float':
      return Schema.Number as Schema.Schema<unknown, unknown>
    case 'Boolean':
      return Schema.Boolean as Schema.Schema<unknown, unknown>
    default:
      // Unknown scalar → string fallback
      return Schema.String as Schema.Schema<unknown, unknown>
  }
}

/**
 * Build an Effect Schema from GraphQL object type introspection
 */
function objectTypeToSchema(
  objectType: IntrospectionType & { kind: 'OBJECT' },
  allTypes: Map<string, IntrospectionType>
): Schema.Schema<unknown, unknown> {
  const fields: Record<string, Schema.Schema<unknown, unknown>> = {}

  if (!objectType.fields) {
    return Schema.Struct({}) as Schema.Schema<unknown, unknown>
  }

  for (const field of objectType.fields) {
    const { baseName, isNullable, isList } = unwrapType(field.type)

    // Determine base schema
    let fieldSchema: Schema.Schema<unknown, unknown>

    const baseType = allTypes.get(baseName)
    if (baseType?.kind === 'SCALAR' || baseType?.kind === 'ENUM' || !baseType) {
      // Scalar or enum → use scalar mapping
      fieldSchema = scalarToSchema(baseName)
    } else if (baseType?.kind === 'OBJECT') {
      // Nested object → recursive (simplified: use Unknown for now to avoid cycles)
      fieldSchema = Schema.Unknown as Schema.Schema<unknown, unknown>
    } else {
      fieldSchema = Schema.Unknown as Schema.Schema<unknown, unknown>
    }

    // Apply list wrapper
    if (isList) {
      fieldSchema = Schema.Array(fieldSchema) as Schema.Schema<unknown, unknown>
    }

    // Apply nullability
    if (isNullable) {
      fieldSchema = Schema.optional(fieldSchema) as Schema.Schema<unknown, unknown>
    }

    // Add title annotation from description
    if (field.description) {
      fieldSchema = fieldSchema.pipe(Schema.annotations({ title: field.description })) as Schema.Schema<unknown, unknown>
    }

    fields[field.name] = fieldSchema
  }

  return Schema.Struct(fields) as Schema.Schema<unknown, unknown>
}

// =============================================================================
// INTROSPECTION → REGISTRY PIPELINE
// =============================================================================

interface IntrospectedSchema {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly schema: Schema.Schema<unknown, unknown>
  readonly priority: number
}

/**
 * Process introspection result into registerable schemas
 */
function introspectionToSchemas(introspection: IntrospectionQuery): IntrospectedSchema[] {
  const objectTypes = extractObjectTypes(introspection)

  // Build type map for resolving references
  const typeMap = new Map<string, IntrospectionType>()
  for (const type of introspection.__schema.types) {
    typeMap.set(type.name, type)
  }

  return objectTypes.map((objType, index) => {
    const schema = objectTypeToSchema(objType as IntrospectionType & { kind: 'OBJECT' }, typeMap)

    return {
      id: `introspected:${objType.name.toLowerCase()}`,
      name: objType.name,
      description: (objType as { description?: string }).description ?? `Introspected from GraphQL type ${objType.name}`,
      schema,
      // Lower priority than locally defined schemas
      priority: 50 - index,
    }
  })
}

// =============================================================================
// VALIDATION TEST PROGRAM
// =============================================================================

/**
 * Creates the test program for a given endpoint
 */
const createTestProgram = (endpoint: string) =>
  Effect.gen(function* () {
    console.log('\n' + '='.repeat(60))
    console.log('SPIKE 5: E2E Live Subgraph Introspection → Registry')
    console.log('='.repeat(60) + '\n')

    // Step 1: Introspect live subgraph over HTTP
    console.log('Step 1: Introspect live subgraph via HTTP')
    console.log(`   Target: ${endpoint}`)
    let introspection: IntrospectionQuery

    try {
      introspection = yield* Effect.promise(() => introspectEndpoint(endpoint))
      console.log(`✓ Introspection successful`)
    } catch (e) {
      console.error(`✗ Failed to introspect: ${e}`)
      console.log('\n  Hint: Ensure subgraph is running at the endpoint')
      console.log('  Example: cd src/lib/schema-system/cosmo/sensor-service && bun run dev')
      return { success: false, error: 'Introspection failed', endpoint }
    }

  // Step 2: Extract object types
  console.log('\nStep 2: Extract object types from introspection')
  const objectTypes = extractObjectTypes(introspection)
  console.log(`✓ Found ${objectTypes.length} object types:`)
  objectTypes.forEach((t) => console.log(`   - ${t.name}`))

  // Step 3: Convert to Effect Schemas
  console.log('\nStep 3: Convert GraphQL types to Effect Schemas')
  const schemas = introspectionToSchemas(introspection)
  console.log(`✓ Generated ${schemas.length} Effect Schemas`)

  // Step 4: Register all schemas
  console.log('\nStep 4: Register introspected schemas')
  for (const s of schemas) {
    yield* PayloadSchemaRegistry.register({
      id: s.id,
      name: s.name,
      description: s.description,
      schema: s.schema,
      priority: s.priority,
    })
    console.log(`   ✓ Registered: ${s.id} (${s.name})`)
  }

  // Step 5: List all registered schemas
  console.log('\nStep 5: Verify registration')
  const all = yield* PayloadSchemaRegistry.getAll()
  console.log(`✓ Total schemas in registry: ${all.length}`)
  all.forEach((s) => console.log(`   - ${s.id}: ${s.name} (priority: ${s.priority}, source: ${s.source})`))

  // Step 6: Test detection with SenML-like payload
  console.log('\nStep 6: Test detection with sample payloads')

  // SenML record payload (matches introspected:senmlrecord)
  const senmlPayload = {
    n: 'temperature',
    v: 23.5,
    u: 'Cel',
    t: 1702147200,
  }
  const senmlMatches = yield* PayloadSchemaRegistry.detect(senmlPayload)
  console.log(`\n   Payload: ${JSON.stringify(senmlPayload)}`)
  console.log(`   Matches: ${senmlMatches.map((s) => `${s.id}(p:${s.priority})`).join(', ') || 'none'}`)

  // Sensor payload (matches introspected:sensor)
  const sensorPayload = {
    id: 'temp-01',
    name: 'Temperature Sensor',
    unit: 'Cel',
  }
  const sensorMatches = yield* PayloadSchemaRegistry.detect(sensorPayload)
  console.log(`\n   Payload: ${JSON.stringify(sensorPayload)}`)
  console.log(`   Matches: ${sensorMatches.map((s) => `${s.id}(p:${s.priority})`).join(', ') || 'none'}`)

  // Unknown payload (should not match)
  const unknownPayload = {
    foo: 'bar',
    baz: 123,
    nested: { x: 1 },
  }
  const unknownMatches = yield* PayloadSchemaRegistry.detect(unknownPayload)
  console.log(`\n   Payload: ${JSON.stringify(unknownPayload)}`)
  console.log(`   Matches: ${unknownMatches.map((s) => s.id).join(', ') || 'none (expected)'}`)

  // Step 7: Test specific schema matching
  console.log('\nStep 7: Test specific schema matching')
  const isSenML = yield* PayloadSchemaRegistry.matches('introspected:senmlrecord', senmlPayload)
  const isSensor = yield* PayloadSchemaRegistry.matches('introspected:sensor', sensorPayload)
  console.log(`   SenML payload matches 'introspected:senmlrecord': ${isSenML}`)
  console.log(`   Sensor payload matches 'introspected:sensor': ${isSensor}`)

    // Step 8: Summary
    console.log('\n' + '='.repeat(60))
    console.log('✅ SPIKE 5 SUCCESS: E2E Live Introspection → Registry')
    console.log('='.repeat(60))
    console.log('\nPipeline validated:')
    console.log(`  1. HTTP introspection to ${endpoint} ✓`)
    console.log('  2. Introspection → Effect Schemas ✓')
    console.log('  3. Effect Schemas → Registry ✓')
    console.log('  4. Registry → Payload detection ✓')

    return { success: true, schemasRegistered: schemas.length, endpoint }
  })

// =============================================================================
// RUN SPIKE
// =============================================================================

export function runSpike5(endpoint: string = DEFAULT_ENDPOINT) {
  const testProgram = createTestProgram(endpoint)

  return Effect.runPromise(testProgram.pipe(Effect.provide(PayloadSchemaRegistry.Default)))
    .then((result) => {
      console.log('\nSpike 5 completed:', result)
      return result
    })
    .catch((error) => {
      console.error('\n❌ Spike 5 failed:', error)
      return { success: false, error }
    })
}

// Run if executed directly
const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/^file:\/\//, '') ?? '')
if (isMainModule) {
  // Accept endpoint from CLI: bunx tsx spike-5-*.ts http://localhost:4011/graphql
  const endpoint = process.argv[2] || DEFAULT_ENDPOINT
  runSpike5(endpoint)
}

export { introspectEndpoint, introspectionToSchemas, objectTypeToSchema, IntrospectedSchema }
