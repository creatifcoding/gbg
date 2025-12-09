/**
 * SPIKE 4: PayloadSchemaRegistry Effect.Service
 *
 * HYPOTHESIS: We can build a registry service that:
 * - Stores schemas with detection functions
 * - Auto-detects payload types via Schema.decodeUnknownEither
 * - Returns matches sorted by priority
 * - Uses canonical Effect.Service pattern with Ref for state
 *
 * SUCCESS CRITERIA:
 * - Effect.Service<T>() pattern with accessors: true
 * - Ref.make() for internal Map<id, RegisteredSchema> state
 * - Schema.decodeUnknownEither with { onExcessProperty: "ignore" }
 * - Priority-based detection ordering
 * - Type-safe schema registration and retrieval
 *
 * @module
 */

import { Effect, Layer, Ref, Option, Either, Schema } from 'effect'

// =============================================================================
// REGISTERED SCHEMA TYPE
// =============================================================================

/**
 * A schema registered with the registry, including detection capability
 */
interface RegisteredSchema<A = unknown, I = unknown> {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly schema: Schema.Schema<A, I>
  /** Priority for detection ordering (higher = checked first) */
  readonly priority: number
  /** Source: local, introspection, federation */
  readonly source: 'local' | 'introspection' | 'federation'
  /** Auto-generated detection function */
  readonly detect: (payload: unknown) => boolean
}

/**
 * Configuration for registering a schema (without detect function)
 */
interface RegisterSchemaConfig<A, I> {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly schema: Schema.Schema<A, I>
  readonly priority: number
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

interface PayloadSchemaRegistryShape {
  /** Register a local schema */
  readonly register: <A, I>(config: RegisterSchemaConfig<A, I>) => Effect.Effect<void>

  /** Get schema by ID */
  readonly get: (id: string) => Effect.Effect<Option.Option<RegisteredSchema>>

  /** Get all registered schemas */
  readonly getAll: () => Effect.Effect<readonly RegisteredSchema[]>

  /** Detect matching schemas for a payload (ordered by priority desc) */
  readonly detect: (payload: unknown) => Effect.Effect<readonly RegisteredSchema[]>

  /** Check if a specific schema matches a payload */
  readonly matches: (id: string, payload: unknown) => Effect.Effect<boolean>
}

// =============================================================================
// SERVICE IMPLEMENTATION (CANONICAL EFFECT.SERVICE PATTERN)
// =============================================================================

/**
 * PayloadSchemaRegistry - Effect.Service with Ref-based state
 *
 * Uses the canonical Effect.Service<T>() pattern from Effect 3.x
 * with accessors: true for convenient method access.
 */
class PayloadSchemaRegistry extends Effect.Service<PayloadSchemaRegistry>()(
  'tmnl/schema/PayloadSchemaRegistry',
  {
    accessors: true,

    effect: Effect.gen(function* () {
      // Internal state: Map of schema ID to RegisteredSchema
      const schemasRef = yield* Ref.make<Map<string, RegisteredSchema>>(new Map())

      /**
       * Creates a detection function for a schema using decodeUnknownEither
       * with lenient excess property handling
       */
      const createDetector = <A, I>(schema: Schema.Schema<A, I>) => {
        const decode = Schema.decodeUnknownEither(schema, { onExcessProperty: 'ignore' })
        return (payload: unknown): boolean => Either.isRight(decode(payload))
      }

      return {
        register: <A, I>(config: RegisterSchemaConfig<A, I>) =>
          Effect.gen(function* () {
            const detect = createDetector(config.schema)

            const registered: RegisteredSchema = {
              id: config.id,
              name: config.name,
              description: config.description,
              schema: config.schema as Schema.Schema<unknown, unknown>,
              priority: config.priority,
              source: 'local',
              detect,
            }

            yield* Ref.update(schemasRef, (map) => {
              const newMap = new Map(map)
              newMap.set(config.id, registered)
              return newMap
            })

            yield* Effect.logDebug(`Registered schema: ${config.id} (priority: ${config.priority})`)
          }).pipe(Effect.withSpan('PayloadSchemaRegistry.register', { attributes: { id: config.id } })),

        get: (id: string) =>
          Effect.gen(function* () {
            const schemas = yield* Ref.get(schemasRef)
            return Option.fromNullable(schemas.get(id))
          }),

        getAll: () =>
          Effect.gen(function* () {
            const schemas = yield* Ref.get(schemasRef)
            return Array.from(schemas.values())
          }),

        detect: (payload: unknown) =>
          Effect.gen(function* () {
            const schemas = yield* Ref.get(schemasRef)

            // Filter schemas that match, sort by priority descending
            const matching = Array.from(schemas.values())
              .filter((s) => s.detect(payload))
              .sort((a, b) => b.priority - a.priority)

            yield* Effect.logDebug(`Detected ${matching.length} matching schema(s)`)
            return matching
          }).pipe(Effect.withSpan('PayloadSchemaRegistry.detect')),

        matches: (id: string, payload: unknown) =>
          Effect.gen(function* () {
            const schemas = yield* Ref.get(schemasRef)
            const schema = schemas.get(id)
            if (!schema) return false
            return schema.detect(payload)
          }),
      } satisfies PayloadSchemaRegistryShape
    }),
  }
) {}

// =============================================================================
// CANONICAL PAYLOAD SCHEMAS (Effect Schema definitions)
// =============================================================================

/**
 * SenML Record - RFC 8428
 * Sensor Measurement Lists format
 */
const SenMLRecordSchema = Schema.Struct({
  n: Schema.optional(Schema.String).annotations({ title: 'Sensor name' }),
  bn: Schema.optional(Schema.String).annotations({ title: 'Base name' }),
  v: Schema.optional(Schema.Number).annotations({ title: 'Numeric value' }),
  vs: Schema.optional(Schema.String).annotations({ title: 'String value' }),
  vb: Schema.optional(Schema.Boolean).annotations({ title: 'Boolean value' }),
  u: Schema.optional(Schema.String).annotations({ title: 'Unit' }),
  t: Schema.optional(Schema.Number).annotations({ title: 'Time (Unix epoch)' }),
  s: Schema.optional(Schema.Number).annotations({ title: 'Sum value' }),
})

const SenMLPackSchema = Schema.Array(SenMLRecordSchema)

/**
 * OPC-UA PubSub JSON format
 */
const OpcUaMessageSchema = Schema.Struct({
  MessageType: Schema.Literal('ua-data'),
  PublisherId: Schema.optional(Schema.String),
  Messages: Schema.optional(Schema.Array(Schema.Unknown)),
})

/**
 * Prometheus text exposition format (simplified)
 */
const PrometheusMetricSchema = Schema.Struct({
  name: Schema.String,
  value: Schema.Number,
  labels: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  timestamp: Schema.optional(Schema.Number),
})

// =============================================================================
// VALIDATION TEST PROGRAM
// =============================================================================

const testProgram = Effect.gen(function* () {
  console.log('\n' + '='.repeat(60))
  console.log('SPIKE 4: PayloadSchemaRegistry Effect.Service')
  console.log('='.repeat(60) + '\n')

  // Step 1: Register schemas
  console.log('Step 1: Register payload schemas')

  yield* PayloadSchemaRegistry.register({
    id: 'senml',
    name: 'SenML',
    description: 'RFC 8428 Sensor Measurement Lists',
    schema: SenMLPackSchema,
    priority: 100,
  })

  yield* PayloadSchemaRegistry.register({
    id: 'opcua',
    name: 'OPC-UA',
    description: 'OPC UA PubSub JSON format',
    schema: OpcUaMessageSchema,
    priority: 90,
  })

  yield* PayloadSchemaRegistry.register({
    id: 'prometheus',
    name: 'Prometheus',
    description: 'Prometheus metric format',
    schema: PrometheusMetricSchema,
    priority: 80,
  })

  console.log('✓ Registered 3 schemas')

  // Step 2: List all schemas
  console.log('\nStep 2: List all registered schemas')
  const all = yield* PayloadSchemaRegistry.getAll()
  console.log(`✓ Found ${all.length} schemas:`)
  all.forEach((s) => console.log(`   - ${s.id}: ${s.name} (priority: ${s.priority})`))

  // Step 3: Test detection with SenML payload
  console.log('\nStep 3: Detect schema for SenML payload')
  const senmlPayload = [
    { n: 'temperature', v: 23.5, u: 'Cel' },
    { n: 'humidity', v: 65.2, u: '%RH' },
  ]
  const senmlMatches = yield* PayloadSchemaRegistry.detect(senmlPayload)
  console.log(`✓ SenML payload detected: ${senmlMatches.map((s) => s.id).join(', ') || 'none'}`)

  // Step 4: Test detection with OPC-UA payload
  console.log('\nStep 4: Detect schema for OPC-UA payload')
  const opcuaPayload = {
    MessageType: 'ua-data',
    PublisherId: 'Server1',
    Messages: [{ Payload: {} }],
  }
  const opcuaMatches = yield* PayloadSchemaRegistry.detect(opcuaPayload)
  console.log(`✓ OPC-UA payload detected: ${opcuaMatches.map((s) => s.id).join(', ') || 'none'}`)

  // Step 5: Test detection with Prometheus payload
  console.log('\nStep 5: Detect schema for Prometheus payload')
  const prometheusPayload = {
    name: 'http_requests_total',
    value: 1234,
    labels: { method: 'GET', path: '/api' },
  }
  const prometheusMatches = yield* PayloadSchemaRegistry.detect(prometheusPayload)
  console.log(`✓ Prometheus payload detected: ${prometheusMatches.map((s) => s.id).join(', ') || 'none'}`)

  // Step 6: Test detection with ambiguous payload (matches multiple)
  console.log('\nStep 6: Test ambiguous payload (could match multiple)')
  const ambiguousPayload = { name: 'sensor1', value: 42 }
  const ambiguousMatches = yield* PayloadSchemaRegistry.detect(ambiguousPayload)
  console.log(
    `✓ Ambiguous payload matches: ${ambiguousMatches.map((s) => `${s.id}(p:${s.priority})`).join(', ') || 'none'}`
  )

  // Step 7: Test detection with unknown payload
  console.log('\nStep 7: Test unknown payload format')
  const unknownPayload = { foo: 'bar', baz: 123 }
  const unknownMatches = yield* PayloadSchemaRegistry.detect(unknownPayload)
  console.log(`✓ Unknown payload matches: ${unknownMatches.map((s) => s.id).join(', ') || 'none (expected)'}`)

  // Step 8: Test specific match check
  console.log('\nStep 8: Test specific schema match')
  const isSenml = yield* PayloadSchemaRegistry.matches('senml', senmlPayload)
  const isOpcuaWrong = yield* PayloadSchemaRegistry.matches('opcua', senmlPayload)
  console.log(`✓ SenML payload matches 'senml': ${isSenml}`)
  console.log(`✓ SenML payload matches 'opcua': ${isOpcuaWrong}`)

  // Step 9: Get specific schema
  console.log('\nStep 9: Get schema by ID')
  const senmlSchema = yield* PayloadSchemaRegistry.get('senml')
  const nonexistent = yield* PayloadSchemaRegistry.get('nonexistent')
  console.log(`✓ get('senml'): ${Option.isSome(senmlSchema) ? senmlSchema.value.name : 'not found'}`)
  console.log(`✓ get('nonexistent'): ${Option.isSome(nonexistent) ? nonexistent.value.name : 'not found (expected)'}`)

  console.log('\n' + '='.repeat(60))
  console.log('✅ SPIKE 4 SUCCESS: PayloadSchemaRegistry operational')
  console.log('='.repeat(60))

  return { success: true }
})

// =============================================================================
// RUN SPIKE
// =============================================================================

export function runSpike4() {
  return Effect.runPromise(testProgram.pipe(Effect.provide(PayloadSchemaRegistry.Default)))
    .then((result) => {
      console.log('\nSpike 4 completed:', result)
      return result
    })
    .catch((error) => {
      console.error('\n❌ Spike 4 failed:', error)
      return { success: false, error }
    })
}

// Run if executed directly
const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/^file:\/\//, '') ?? '')
if (isMainModule) {
  runSpike4()
}

export {
  PayloadSchemaRegistry,
  RegisteredSchema,
  RegisterSchemaConfig,
  SenMLRecordSchema,
  SenMLPackSchema,
  OpcUaMessageSchema,
  PrometheusMetricSchema,
}
