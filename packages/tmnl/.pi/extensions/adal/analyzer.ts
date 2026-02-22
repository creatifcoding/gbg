/**
 * Drift Analyzer
 *
 * Compares Schema, Model, and DDL field definitions to detect discrepancies.
 *
 * @module
 */

import type { FieldInfo } from './inspectors'
import type { DDLColumn } from './ddl-parser'

// =============================================================================
// Types
// =============================================================================

export type DriftStatus = 'ok' | 'warning' | 'error'

export interface FieldComparison {
  name: string
  camelCase: string
  snakeCase: string

  schema: FieldInfo | null
  model: FieldInfo | null
  ddl: DDLColumn | null

  status: DriftStatus
  issues: string[]
}

export interface DriftReport {
  entityName: string
  fields: FieldComparison[]
  ok: number
  warnings: number
  errors: number
}

// =============================================================================
// Name Conversion
// =============================================================================

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '')
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

// =============================================================================
// Type Mapping
// =============================================================================

interface TypeMapping {
  schemaTypes: string[]
  modelTypes: string[]
  ddlTypes: string[]
}

// Known type mappings between Schema, Model, and DDL
const TYPE_MAPPINGS: TypeMapping[] = [
  {
    schemaTypes: ['string', 'NonEmptyString', 'NonEmptyTrimmedString'],
    modelTypes: ['string', 'String'],
    ddlTypes: ['TEXT', 'VARCHAR', 'CHAR'],
  },
  {
    schemaTypes: ['number', 'Int', 'Float'],
    modelTypes: ['number', 'Number'],
    ddlTypes: ['INTEGER', 'INT', 'INT4', 'BIGINT', 'INT8', 'SMALLINT', 'REAL', 'FLOAT', 'DOUBLE', 'NUMERIC', 'DECIMAL'],
  },
  {
    schemaTypes: ['boolean'],
    modelTypes: ['boolean', 'Boolean'],
    ddlTypes: ['BOOLEAN', 'BOOL'],
  },
  {
    schemaTypes: ['datetime', 'DateFromSelf', 'Date'],
    modelTypes: ['datetime', 'DateFromSelf', 'Date'],
    ddlTypes: ['TIMESTAMPTZ', 'TIMESTAMP', 'DATE', 'TIME'],
  },
  {
    schemaTypes: ['bigint', 'BigInt'],
    modelTypes: ['bigint', 'BigInt'],
    ddlTypes: ['BIGINT', 'INT8'],
  },
  {
    schemaTypes: ['object', 'record', 'array'],
    modelTypes: ['object', 'record', 'array'],
    ddlTypes: ['JSONB', 'JSON'],
  },
]

function normalizeType(type: string): string {
  // Remove array suffix
  type = type.replace(/\[\]$/, '')
  // Remove parentheses content
  type = type.replace(/\([^)]*\)/, '')
  // Uppercase for comparison
  return type.toUpperCase().trim()
}

function typesCompatible(schemaType: string, modelType: string, ddlType: string): boolean {
  const normSchema = normalizeType(schemaType)
  const normModel = normalizeType(modelType)
  const normDDL = normalizeType(ddlType)

  // union(2) is how Schema represents optional types - it's TYPE | undefined
  // If schema/model is union(2), treat it as compatible with nullable DDL
  const isSchemaOptionalUnion = schemaType.toLowerCase().includes('union(2)')
  const isModelOptionalUnion = modelType.toLowerCase().includes('union(2)')

  for (const mapping of TYPE_MAPPINGS) {
    const schemaMatch = mapping.schemaTypes.some((t) => normSchema.includes(t.toUpperCase()))
    const modelMatch = mapping.modelTypes.some((t) => normModel.includes(t.toUpperCase()))
    const ddlMatch = mapping.ddlTypes.some((t) => normDDL.includes(t))

    if ((schemaMatch || modelMatch) && ddlMatch) {
      return true
    }
  }

  // Enum/literal types map to TEXT with CHECK
  if (
    (normSchema.includes('ENUM') || normSchema.includes('LIT')) &&
    (normDDL === 'TEXT' || normDDL === 'VARCHAR')
  ) {
    return true
  }

  // union(2) (optional) types are compatible with nullable TEXT, TIMESTAMPTZ, JSONB, etc.
  if ((isSchemaOptionalUnion || isModelOptionalUnion)) {
    // Check if DDL is a basic type (text, timestamp, jsonb, boolean)
    const basicTypes = ['TEXT', 'VARCHAR', 'TIMESTAMPTZ', 'TIMESTAMP', 'JSONB', 'JSON', 'INTEGER', 'BOOLEAN']
    if (basicTypes.some((t) => normDDL.includes(t))) {
      return true
    }
  }

  return false
}

// =============================================================================
// Analyzer
// =============================================================================

export function analyzeDrift(
  schemaFields: FieldInfo[],
  modelFields: FieldInfo[],
  ddlColumns: DDLColumn[],
  entityName: string
): DriftReport {
  const comparisons: FieldComparison[] = []

  // Build lookup maps
  const schemaByName = new Map<string, FieldInfo>()
  const modelByName = new Map<string, FieldInfo>()
  const ddlByName = new Map<string, DDLColumn>()

  for (const f of schemaFields) {
    schemaByName.set(f.name.toLowerCase(), f)
    schemaByName.set(toSnakeCase(f.name).toLowerCase(), f)
  }

  for (const f of modelFields) {
    modelByName.set(f.name.toLowerCase(), f)
    modelByName.set(toSnakeCase(f.name).toLowerCase(), f)
  }

  for (const c of ddlColumns) {
    ddlByName.set(c.name.toLowerCase(), c)
    ddlByName.set(toCamelCase(c.name).toLowerCase(), c)
  }

  // Collect all unique field names
  const allNames = new Set<string>()

  for (const f of schemaFields) {
    allNames.add(f.name.toLowerCase())
  }
  for (const f of modelFields) {
    allNames.add(f.name.toLowerCase())
  }
  for (const c of ddlColumns) {
    allNames.add(toCamelCase(c.name).toLowerCase())
  }

  // Compare each field
  for (const name of allNames) {
    // Skip internal/discriminator fields
    if (name === '_tag' || name.startsWith('_')) {
      continue
    }

    const schema = schemaByName.get(name) ?? null
    const model = modelByName.get(name) ?? null
    const ddl = ddlByName.get(name) ?? ddlByName.get(toSnakeCase(name).toLowerCase()) ?? null

    const comparison = compareField(name, schema, model, ddl)
    comparisons.push(comparison)
  }

  // Sort by status (errors first) then by name
  comparisons.sort((a, b) => {
    const statusOrder = { error: 0, warning: 1, ok: 2 }
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff
    return a.name.localeCompare(b.name)
  })

  return {
    entityName,
    fields: comparisons,
    ok: comparisons.filter((c) => c.status === 'ok').length,
    warnings: comparisons.filter((c) => c.status === 'warning').length,
    errors: comparisons.filter((c) => c.status === 'error').length,
  }
}

function compareField(
  name: string,
  schema: FieldInfo | null,
  model: FieldInfo | null,
  ddl: DDLColumn | null
): FieldComparison {
  const issues: string[] = []
  let status: DriftStatus = 'ok'

  const camelCase = toCamelCase(name)
  const snakeCase = toSnakeCase(name)

  // Check presence
  if (!schema && (model || ddl)) {
    issues.push('Missing in Schema')
    status = 'warning'
  }
  if (!model && (schema || ddl)) {
    issues.push('Missing in Model')
    status = 'warning'
  }
  if (!ddl && (schema || model)) {
    issues.push('Missing in DDL')
    status = 'error' // DDL missing is an error - won't persist
  }

  // Check type compatibility
  if (schema && model && ddl) {
    const schemaType = schema.type
    const modelType = model.type
    const ddlType = ddl.type

    if (!typesCompatible(schemaType, modelType, ddlType)) {
      issues.push(`Type mismatch: Schema(${schemaType}) / Model(${modelType}) / DDL(${ddlType})`)
      status = 'error'
    }
  }

  // Check nullability
  if (schema && ddl) {
    const schemaOptional = schema.optional
    const ddlNullable = ddl.nullable

    if (schemaOptional && !ddlNullable && !ddl.hasDefault) {
      issues.push('Schema optional but DDL NOT NULL without default')
      status = status === 'ok' ? 'warning' : status
    }
    if (!schemaOptional && ddlNullable) {
      issues.push('Schema required but DDL nullable')
      status = status === 'ok' ? 'warning' : status
    }
  }

  // Check literal values vs CHECK constraint
  if (schema && schema.literalValues && ddl) {
    if (ddl.checkValues) {
      const schemaSet = new Set(schema.literalValues)
      const ddlSet = new Set(ddl.checkValues)

      const missingInDDL = schema.literalValues.filter((v) => !ddlSet.has(v))
      const extraInDDL = ddl.checkValues.filter((v) => !schemaSet.has(v))

      if (missingInDDL.length > 0) {
        issues.push(`Schema has values not in DDL CHECK: ${missingInDDL.join(', ')}`)
        status = 'error'
      }
      if (extraInDDL.length > 0) {
        issues.push(`DDL CHECK has values not in Schema: ${extraInDDL.join(', ')}`)
        status = status === 'ok' ? 'warning' : status
      }
    } else {
      issues.push('Schema has literal values but DDL has no CHECK constraint')
      status = status === 'ok' ? 'warning' : status
    }
  }

  // Check defaults
  if (schema && schema.hasDefault && ddl && !ddl.hasDefault) {
    issues.push('Schema has default but DDL does not')
    status = status === 'ok' ? 'warning' : status
  }

  return {
    name,
    camelCase,
    snakeCase,
    schema,
    model,
    ddl,
    status,
    issues,
  }
}
