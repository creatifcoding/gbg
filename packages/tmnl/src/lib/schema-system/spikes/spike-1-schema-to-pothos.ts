/**
 * SPIKE 1: Effect Schema → Pothos ObjectRef
 *
 * HYPOTHESIS: We can derive Pothos GraphQL types from Effect Schemas
 * with full type safety preserved by walking the AST.
 *
 * SUCCESS CRITERIA:
 * - TypeScript infers correct types for generated ObjectRef
 * - All Effect Schema primitives map to Pothos field types
 * - Optional fields become nullable in GraphQL
 * - Schema builds without error
 *
 * @module
 */

import { Schema, SchemaAST as AST } from 'effect'
import SchemaBuilder from '@pothos/core'
import { printSchema, lexicographicSortSchema } from 'graphql'

// =============================================================================
// TEST SCHEMAS
// =============================================================================

/**
 * SenML Record - RFC 8428 Sensor Measurement Lists
 */
const SenMLRecord = Schema.Struct({
  n: Schema.String.annotations({ title: 'Sensor Name' }),
  // Note: Annotate INNER type, then wrap with optional - annotation survives in Union member
  v: Schema.optional(Schema.Number.annotations({ title: 'Value' })),
  u: Schema.optional(Schema.String.annotations({ title: 'Unit' })),
  t: Schema.optional(Schema.Number.annotations({ title: 'Time' })),
  s: Schema.optional(Schema.Number.annotations({ title: 'Sum' })),
  vb: Schema.optional(Schema.Boolean.annotations({ title: 'Boolean Value' })),
  vs: Schema.optional(Schema.String.annotations({ title: 'String Value' })),
})

type SenMLRecordType = typeof SenMLRecord.Type

// =============================================================================
// AST → POTHOS MAPPING
// =============================================================================

/**
 * Maps Effect Schema AST type tag to Pothos scalar type name
 */
function astTagToScalarType(tag: string): 'String' | 'Float' | 'Int' | 'Boolean' | 'ID' | null {
  switch (tag) {
    case 'StringKeyword':
      return 'String'
    case 'NumberKeyword':
      return 'Float' // GraphQL Float for JS number
    case 'BooleanKeyword':
      return 'Boolean'
    case 'BigIntKeyword':
      return 'Int' // Lossy but functional
    default:
      return null
  }
}

/**
 * Unwraps optional/union types to get the inner type
 * Schema.optional(Schema.Number) creates Union([NumberKeyword, UndefinedKeyword])
 */
function unwrapOptional(ast: AST.AST): { innerAst: AST.AST; isOptional: boolean } {
  if (ast._tag === 'Union') {
    // Check if it's T | undefined (optional pattern)
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
 * Extract property signatures from a TypeLiteral AST
 */
function getPropertySignatures(ast: AST.AST): ReadonlyArray<AST.PropertySignature> {
  if (ast._tag === 'TypeLiteral') {
    return ast.propertySignatures
  }
  // Handle Transformation (Schema.optional wraps in transformation)
  if (ast._tag === 'Transformation') {
    return getPropertySignatures(ast.to)
  }
  return []
}

// =============================================================================
// SCHEMA → POTHOS TRANSFORMER
// =============================================================================

interface SchemaToObjectRefOptions {
  name: string
  description?: string
}

/**
 * Transforms an Effect Schema.Struct into a Pothos ObjectRef
 *
 * @example
 * const SenMLRef = schemaToObjectRef(builder, SenMLRecord, { name: 'SenML' })
 */
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

      console.log(`[Spike 1] Processing ${props.length} properties for ${options.name}`)

      for (const prop of props) {
        const fieldName = String(prop.name)
        const propIsOptional = prop.isOptional

        // Unwrap the type (handle Schema.optional wrapper)
        const { innerAst, isOptional: typeIsOptional } = unwrapOptional(prop.type)
        const nullable = propIsOptional || typeIsOptional

        // Get scalar type from AST tag
        const scalarType = astTagToScalarType(innerAst._tag)

        // Get title annotation - check property type, then inner type
        // Schema.optional(T).annotations() wraps in Transformation, title ends up on outer
        const propTitle = prop.type.annotations[AST.TitleAnnotationId] as string | undefined
        const innerTitle = innerAst.annotations[AST.TitleAnnotationId] as string | undefined
        const title = propTitle ?? innerTitle

        console.log(
          `  - ${fieldName}: ${innerAst._tag} → ${scalarType ?? 'unknown'} (nullable: ${nullable})`
        )

        if (!scalarType) {
          console.warn(`    ⚠ Unmapped AST type: ${innerAst._tag}, defaulting to String`)
          fieldDefs[fieldName] = t.string({
            nullable: true,
            description: title,
            resolve: (parent) => String((parent as Record<string, unknown>)[fieldName] ?? ''),
          })
          continue
        }

        // Create appropriate field based on scalar type
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
// VALIDATION
// =============================================================================

export function runSpike1() {
  console.log('\n' + '='.repeat(60))
  console.log('SPIKE 1: Effect Schema → Pothos ObjectRef')
  console.log('='.repeat(60) + '\n')

  try {
    // Create Pothos builder
    const builder = new SchemaBuilder<object>({})

    // Transform Effect Schema to Pothos ObjectRef
    const SenMLRef = schemaToObjectRef(builder, SenMLRecord, {
      name: 'SenMLRecord',
      description: 'RFC 8428 Sensor Measurement List record',
    })

    // Add a query field to make schema valid
    builder.queryType({
      fields: (t) => ({
        senmlRecord: t.field({
          type: SenMLRef,
          resolve: () =>
            ({
              n: 'temperature',
              v: 23.5,
              u: 'Cel',
            }) as SenMLRecordType,
        }),
      }),
    })

    // Build the schema
    const schema = builder.toSchema()

    console.log('\n✅ SUCCESS: GraphQL schema built successfully')
    console.log(`   Schema has ${Object.keys(schema.getTypeMap()).length} types`)

    // Print type info
    const senmlType = schema.getType('SenMLRecord')
    if (senmlType && 'getFields' in senmlType) {
      const fields = (senmlType as { getFields: () => Record<string, unknown> }).getFields()
      console.log(`   SenMLRecord has ${Object.keys(fields).length} fields:`)
      for (const [name, field] of Object.entries(fields)) {
        const f = field as { type: { toString: () => string } }
        console.log(`     - ${name}: ${f.type.toString()}`)
      }
    }

    // Print SDL
    const sdl = printSchema(lexicographicSortSchema(schema))
    console.log('\n' + '─'.repeat(60))
    console.log('GENERATED SDL:')
    console.log('─'.repeat(60))
    console.log(sdl)

    return { success: true, schema, sdl }
  } catch (error) {
    console.error('\n❌ FAILURE:', error)
    return { success: false, error }
  }
}

// Run if executed directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/^file:\/\//, '') ?? '')) {
  runSpike1()
}

export { schemaToObjectRef, SenMLRecord }
