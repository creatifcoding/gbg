/**
 * SPIKE 3: Effect Schema → Pothos → SDL → Cosmo Router
 *
 * HYPOTHESIS: We can use Effect Schema as the canonical source, generate
 * GraphQL SDL via Pothos, and feed that to Cosmo's `wgc router compose`
 * for local federation development.
 *
 * SUCCESS CRITERIA:
 * - Effect Schema generates valid GraphQL SDL via Pothos
 * - SDL can be written to file for Cosmo consumption
 * - wgc router compose succeeds with generated SDL
 * - Full pipeline: Schema → SDL → compose.yaml → router.json
 *
 * @module
 */

import { Schema, SchemaAST as AST } from 'effect'
import SchemaBuilder from '@pothos/core'
import { printSchema, lexicographicSortSchema } from 'graphql'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// =============================================================================
// REUSE SPIKE 1 PATTERNS
// =============================================================================

/**
 * Maps Effect Schema AST type tag to Pothos scalar type name
 */
function astTagToScalarType(tag: string): 'String' | 'Float' | 'Int' | 'Boolean' | 'ID' | null {
  switch (tag) {
    case 'StringKeyword':
      return 'String'
    case 'NumberKeyword':
      return 'Float'
    case 'BooleanKeyword':
      return 'Boolean'
    case 'BigIntKeyword':
      return 'Int'
    default:
      return null
  }
}

/**
 * Unwraps optional/union types to get the inner type
 */
function unwrapOptional(ast: AST.AST): { innerAst: AST.AST; isOptional: boolean } {
  if (ast._tag === 'Union') {
    const hasUndefined = ast.types.some((t) => t._tag === 'UndefinedKeyword')
    if (hasUndefined) {
      const innerType = ast.types.find((t) => t._tag !== 'UndefinedKeyword')
      if (innerType) {
        return { innerAst: innerType, isOptional: true }
      }
    }
  }
  return { innerAst: ast, isOptional: false }
}

/**
 * Get property signatures from TypeLiteral or Transformation
 */
function getPropertySignatures(ast: AST.AST): ReadonlyArray<AST.PropertySignature> {
  if (ast._tag === 'TypeLiteral') {
    return ast.propertySignatures
  }
  if (ast._tag === 'Transformation') {
    return getPropertySignatures(ast.to)
  }
  return []
}

// =============================================================================
// EFFECT SCHEMA → POTHOS TRANSFORMER
// =============================================================================

interface SchemaToObjectRefOptions {
  name: string
  description?: string
}

function schemaToObjectRef<Fields extends Schema.Struct.Fields>(
  builder: SchemaBuilder<object>,
  schema: Schema.Struct<Fields>,
  options: SchemaToObjectRefOptions
) {
  type Shape = Schema.Schema.Type<Schema.Struct<Fields>>

  const ref = builder.objectRef<Shape>(options.name)

  return ref.implement({
    description: options.description,
    fields: (t) => {
      const fieldDefs: Record<string, unknown> = {}
      const ast = schema.ast
      const props = getPropertySignatures(ast)

      for (const prop of props) {
        const fieldName = String(prop.name)
        const propIsOptional = prop.isOptional
        const { innerAst, isOptional: typeIsOptional } = unwrapOptional(prop.type)
        const nullable = propIsOptional || typeIsOptional
        const scalarType = astTagToScalarType(innerAst._tag)

        const propTitle = prop.type.annotations[AST.TitleAnnotationId] as string | undefined
        const innerTitle = innerAst.annotations[AST.TitleAnnotationId] as string | undefined
        const title = propTitle ?? innerTitle

        if (!scalarType) {
          fieldDefs[fieldName] = t.string({
            nullable: true,
            description: title,
            resolve: (parent) => String((parent as Record<string, unknown>)[fieldName] ?? ''),
          })
          continue
        }

        switch (scalarType) {
          case 'String':
            fieldDefs[fieldName] = t.string({
              nullable,
              description: title,
              resolve: (parent) => (parent as Record<string, unknown>)[fieldName] as string | null,
            })
            break

          case 'Float':
            fieldDefs[fieldName] = t.float({
              nullable,
              description: title,
              resolve: (parent) => (parent as Record<string, unknown>)[fieldName] as number | null,
            })
            break

          case 'Int':
            fieldDefs[fieldName] = t.int({
              nullable,
              description: title,
              resolve: (parent) =>
                Number((parent as Record<string, unknown>)[fieldName]) as number | null,
            })
            break

          case 'Boolean':
            fieldDefs[fieldName] = t.boolean({
              nullable,
              description: title,
              resolve: (parent) => (parent as Record<string, unknown>)[fieldName] as boolean | null,
            })
            break
        }
      }

      return fieldDefs
    },
  })
}

// =============================================================================
// CANONICAL EFFECT SCHEMAS
// =============================================================================

/**
 * SenML Record - RFC 8428
 * SINGLE SOURCE OF TRUTH for both GraphQL and AG-Grid
 */
const SenMLRecord = Schema.Struct({
  n: Schema.String.annotations({ title: 'Sensor name (required)' }),
  v: Schema.optional(Schema.Number.annotations({ title: 'Numeric value' })),
  vs: Schema.optional(Schema.String.annotations({ title: 'String value' })),
  vb: Schema.optional(Schema.Boolean.annotations({ title: 'Boolean value' })),
  u: Schema.optional(Schema.String.annotations({ title: 'Unit (e.g., Cel, %RH, hPa)' })),
  t: Schema.optional(Schema.Number.annotations({ title: 'Time in seconds since Unix epoch' })),
  s: Schema.optional(Schema.Number.annotations({ title: 'Sum value for cumulative measurements' })),
})

type SenMLRecordType = typeof SenMLRecord.Type

/**
 * Sensor metadata
 */
const Sensor = Schema.Struct({
  id: Schema.String.annotations({ title: 'Sensor ID' }),
  name: Schema.String.annotations({ title: 'Sensor name' }),
  unit: Schema.optional(Schema.String.annotations({ title: 'Default unit' })),
})

type SensorType = typeof Sensor.Type

// =============================================================================
// POTHOS SCHEMA BUILDER
// =============================================================================

function buildGraphQLSchema() {
  const builder = new SchemaBuilder<object>({})

  // Create Pothos types from Effect Schemas
  const SenMLRecordRef = schemaToObjectRef(builder, SenMLRecord, {
    name: 'SenMLRecord',
    description: 'RFC 8428 SenML Record',
  })

  const SensorRef = schemaToObjectRef(builder, Sensor, {
    name: 'Sensor',
    description: 'Sensor metadata',
  })

  // Add lastReading field to Sensor (cross-type reference)
  builder.objectField(SensorRef, 'lastReading', (t) =>
    t.field({
      type: SenMLRecordRef,
      nullable: true,
      description: 'Most recent reading from this sensor',
      resolve: () => null, // Resolved by subgraph
    })
  )

  // Query type
  builder.queryType({
    fields: (t) => ({
      getSensorReading: t.field({
        type: SenMLRecordRef,
        nullable: true,
        description: 'Get latest reading for a sensor',
        args: {
          sensorId: t.arg.id({ required: true }),
        },
        resolve: () => null,
      }),
      getSensorHistory: t.field({
        type: [SenMLRecordRef],
        description: 'Get historical readings for a sensor',
        args: {
          sensorId: t.arg.id({ required: true }),
          limit: t.arg.int({ defaultValue: 10 }),
        },
        resolve: () => [],
      }),
      listSensors: t.field({
        type: [SensorRef],
        description: 'List all available sensors',
        resolve: () => [],
      }),
    }),
  })

  // Input type for mutations (manually defined - Effect Schema doesn't generate inputs)
  const SenMLRecordInput = builder.inputType('SenMLRecordInput', {
    description: 'Input for publishing sensor readings',
    fields: (t) => ({
      n: t.string({ required: true }),
      v: t.float(),
      vs: t.string(),
      vb: t.boolean(),
      u: t.string(),
    }),
  })

  // Mutation type
  builder.mutationType({
    fields: (t) => ({
      publishReading: t.field({
        type: SenMLRecordRef,
        description: 'Publish a new sensor reading',
        args: {
          input: t.arg({ type: SenMLRecordInput, required: true }),
        },
        resolve: (_, args) => ({
          n: args.input.n,
          v: args.input.v ?? undefined,
          vs: args.input.vs ?? undefined,
          vb: args.input.vb ?? undefined,
          u: args.input.u ?? undefined,
          t: Date.now() / 1000,
        }),
      }),
    }),
  })

  return builder.toSchema()
}

// =============================================================================
// SDL GENERATION & FILE OUTPUT
// =============================================================================

function generateSDL(): string {
  const schema = buildGraphQLSchema()
  return printSchema(lexicographicSortSchema(schema))
}

function writeSDLToFile(outputPath: string): void {
  const sdl = generateSDL()
  const dir = dirname(outputPath)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  writeFileSync(outputPath, sdl, 'utf-8')
  console.log(`✓ SDL written to: ${outputPath}`)
}

// =============================================================================
// COSMO COMPOSE CONFIGURATION
// =============================================================================

function generateComposeYaml(schemaPath: string): string {
  return `version: 1
subgraphs:
  - name: sensors
    routing_url: http://localhost:4011/graphql
    schema:
      file: ${schemaPath}
`
}

function generateRouterConfig(): string {
  return `dev_mode: true
execution_config:
  file:
    path: "router.json"
    watch: true
graph:
  token: ""
`
}

// =============================================================================
// VALIDATION
// =============================================================================

export function runSpike3() {
  console.log('\n' + '='.repeat(60))
  console.log('SPIKE 3: Effect Schema → Pothos → SDL → Cosmo')
  console.log('='.repeat(60) + '\n')

  try {
    // Step 1: Generate SDL from Effect Schema via Pothos
    console.log('Step 1: Generate SDL from Effect Schema via Pothos')
    const sdl = generateSDL()
    console.log('✓ SDL generated successfully')

    // Step 2: Write SDL to file
    console.log('\nStep 2: Write SDL to Cosmo service directory')
    const cosmoDir = join(__dirname, '../cosmo/sensor-service/src/graph')
    const sdlPath = join(cosmoDir, 'schema.graphql')
    writeSDLToFile(sdlPath)

    // Step 3: Write compose.yaml
    console.log('\nStep 3: Generate compose.yaml')
    const composeYaml = generateComposeYaml('./src/graph/schema.graphql')
    const composePath = join(__dirname, '../cosmo/sensor-service/router.compose.yaml')
    writeFileSync(composePath, composeYaml, 'utf-8')
    console.log(`✓ compose.yaml written to: ${composePath}`)

    // Step 4: Write router config
    console.log('\nStep 4: Generate router.config.yaml')
    const routerConfig = generateRouterConfig()
    const routerConfigPath = join(__dirname, '../cosmo/sensor-service/router.config.yaml')
    writeFileSync(routerConfigPath, routerConfig, 'utf-8')
    console.log(`✓ router.config.yaml written to: ${routerConfigPath}`)

    // Print generated SDL
    console.log('\n' + '─'.repeat(60))
    console.log('GENERATED SDL (from Effect Schema):')
    console.log('─'.repeat(60))
    console.log(sdl)

    console.log('\n' + '='.repeat(60))
    console.log('✅ SPIKE 3 SUCCESS: Effect Schema → Cosmo pipeline ready')
    console.log('='.repeat(60))
    console.log('\nNext: Run wgc router compose to generate router.json:')
    console.log('  cd src/lib/schema-system/cosmo/sensor-service')
    console.log('  bunx wgc router compose -i router.compose.yaml -o router.json')

    return { success: true, sdl }
  } catch (error) {
    console.error('\n❌ FAILURE:', error)
    return { success: false, error }
  }
}

// Run if executed directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/^file:\/\//, '') ?? '')) {
  runSpike3()
}

export { SenMLRecord, Sensor, generateSDL, buildGraphQLSchema }
