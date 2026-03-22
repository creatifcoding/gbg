/**
 * GraphQL Introspection for Pepr Operator
 *
 * Introspects live GraphQL endpoints and extracts schema information.
 * Used by the CosmoSubgraph reconciler when schema.introspection.url is set.
 *
 * @module
 */

import { Log } from 'pepr'
import {
  getIntrospectionQuery,
  buildClientSchema,
  printSchema,
  type IntrospectionQuery,
  type IntrospectionType,
  type IntrospectionOutputTypeRef,
  type IntrospectionNamedTypeRef,
} from 'graphql'

// =============================================================================
// INTROSPECTION CLIENT
// =============================================================================

const INTROSPECTION_QUERY = getIntrospectionQuery()

export interface IntrospectionResult {
  success: boolean
  sdl?: string
  types?: ExtractedType[]
  error?: string
}

export interface ExtractedType {
  name: string
  kind: 'OBJECT' | 'INPUT_OBJECT' | 'ENUM' | 'SCALAR' | 'INTERFACE' | 'UNION'
  description?: string
  fields?: ExtractedField[]
}

export interface ExtractedField {
  name: string
  type: string
  isNullable: boolean
  isList: boolean
  description?: string
}

/**
 * Introspect a GraphQL endpoint and return SDL + type information
 */
export async function introspectEndpoint(url: string): Promise<IntrospectionResult> {
  Log.info({ url }, 'Introspecting GraphQL endpoint')

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query: INTROSPECTION_QUERY }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const json = (await response.json()) as {
      data?: IntrospectionQuery
      errors?: Array<{ message: string }>
    }

    if (json.errors?.length) {
      return {
        success: false,
        error: json.errors.map((e) => e.message).join('; '),
      }
    }

    if (!json.data) {
      return {
        success: false,
        error: 'No data in introspection response',
      }
    }

    // Build schema from introspection and print SDL
    const schema = buildClientSchema(json.data)
    const sdl = printSchema(schema)

    // Extract types for further processing
    const types = extractTypes(json.data)

    Log.info({ url, typeCount: types.length }, 'Introspection successful')

    return {
      success: true,
      sdl,
      types,
    }
  } catch (error) {
    Log.error({ url, error }, 'Introspection failed')
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Extract object types from introspection (excluding builtins)
 */
function extractTypes(introspection: IntrospectionQuery): ExtractedType[] {
  return introspection.__schema.types
    .filter(
      (t) =>
        !t.name.startsWith('__') &&
        t.name !== 'Query' &&
        t.name !== 'Mutation' &&
        t.name !== 'Subscription' &&
        (t.kind === 'OBJECT' || t.kind === 'INPUT_OBJECT' || t.kind === 'ENUM')
    )
    .map((t) => extractType(t))
}

function extractType(type: IntrospectionType): ExtractedType {
  const extracted: ExtractedType = {
    name: type.name,
    kind: type.kind as ExtractedType['kind'],
    description: (type as { description?: string }).description,
  }

  if (type.kind === 'OBJECT' || type.kind === 'INPUT_OBJECT') {
    const withFields = type as { fields?: Array<{ name: string; type: IntrospectionOutputTypeRef; description?: string }> }
    const inputWithFields = type as { inputFields?: Array<{ name: string; type: IntrospectionOutputTypeRef; description?: string }> }

    const fields = withFields.fields ?? inputWithFields.inputFields ?? []

    extracted.fields = fields.map((f) => {
      const { baseName, isNullable, isList } = unwrapType(f.type)
      return {
        name: f.name,
        type: baseName,
        isNullable,
        isList,
        description: f.description,
      }
    })
  }

  return extracted
}

function unwrapType(typeRef: IntrospectionOutputTypeRef): {
  baseName: string
  isNullable: boolean
  isList: boolean
} {
  let current: IntrospectionOutputTypeRef = typeRef
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

// =============================================================================
// EFFECT SCHEMA GENERATION
// =============================================================================

/**
 * Generate Effect Schema code from extracted types
 *
 * This is useful for code generation / registry integration
 */
export function generateEffectSchemaCode(types: ExtractedType[]): string {
  const lines: string[] = [
    "import { Schema } from 'effect'",
    '',
  ]

  for (const type of types) {
    if (type.kind !== 'OBJECT' && type.kind !== 'INPUT_OBJECT') continue
    if (!type.fields?.length) continue

    lines.push(`export const ${type.name}Schema = Schema.Struct({`)

    for (const field of type.fields) {
      const schemaType = mapFieldToSchema(field)
      const description = field.description ? `.annotations({ title: '${field.description.replace(/'/g, "\\'")}' })` : ''
      lines.push(`  ${field.name}: ${schemaType}${description},`)
    }

    lines.push('})')
    lines.push('')
  }

  return lines.join('\n')
}

function mapFieldToSchema(field: ExtractedField): string {
  let base: string

  switch (field.type) {
    case 'String':
    case 'ID':
      base = 'Schema.String'
      break
    case 'Int':
      base = 'Schema.Number.pipe(Schema.int())'
      break
    case 'Float':
      base = 'Schema.Number'
      break
    case 'Boolean':
      base = 'Schema.Boolean'
      break
    default:
      base = 'Schema.Unknown'
  }

  if (field.isList) {
    base = `Schema.Array(${base})`
  }

  if (field.isNullable) {
    base = `Schema.optional(${base})`
  }

  return base
}
