/**
 * DDL Parser for PostgreSQL CREATE TABLE statements
 *
 * Uses pgsql-ast-parser for proper SQL parsing.
 *
 * @module
 */

import { parse, toSql } from 'pgsql-ast-parser'

// =============================================================================
// Types
// =============================================================================

export interface DDLColumn {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
  hasDefault: boolean
  defaultValue?: string
  checkConstraint?: string
  checkValues?: string[] // Extracted from CHECK (col IN ('a', 'b', 'c'))
  references?: {
    table: string
    column: string
  }
}

export interface DDLTable {
  schema?: string
  name: string
  columns: DDLColumn[]
}

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse DDL content and extract column definitions.
 *
 * The DDL content is typically a TypeScript file with template literals
 * containing SQL. We extract the SQL strings and parse them.
 */
export function parseDDL(content: string): DDLColumn[] {
  const columns: DDLColumn[] = []

  // Extract SQL from template literals (sql`...`)
  const sqlStrings = extractSQLStrings(content)

  for (const sql of sqlStrings) {
    try {
      // Parse the SQL statement
      const statements = parse(sql, { locationTracking: false })

      for (const stmt of statements) {
        if (stmt.type === 'create table') {
          const tableColumns = parseCreateTable(stmt)
          columns.push(...tableColumns)
        }
      }
    } catch (e) {
      // Parsing failed - try to extract column info from the raw SQL
      const rawColumns = parseRawCreateTable(sql)
      columns.push(...rawColumns)
    }
  }

  return columns
}

/**
 * Extract SQL strings from TypeScript template literals.
 *
 * Looks for patterns like:
 * - sql`CREATE TABLE ...`
 * - yield* sql`CREATE TABLE ...`
 */
function extractSQLStrings(content: string): string[] {
  const results: string[] = []

  // Match sql`...` template literals
  // This regex handles multi-line template literals
  const sqlTemplateRegex = /sql\s*`([\s\S]*?)`/g
  let match

  while ((match = sqlTemplateRegex.exec(content)) !== null) {
    let sql = match[1]

    // Clean up the SQL
    sql = sql
      .replace(/\$\{[^}]+\}/g, '') // Remove template expressions
      .replace(/^\s+/gm, ' ') // Normalize whitespace
      .trim()

    if (sql.toUpperCase().includes('CREATE TABLE')) {
      results.push(sql)
    }
  }

  return results
}

/**
 * Parse a CREATE TABLE statement using pgsql-ast-parser
 */
function parseCreateTable(stmt: any): DDLColumn[] {
  const columns: DDLColumn[] = []

  if (!stmt.columns) return columns

  // Track constraints defined at table level
  const pkColumns = new Set<string>()
  const checkConstraints = new Map<string, { values?: string[] }>()

  // First pass: collect table-level constraints
  for (const item of stmt.columns) {
    if (item.kind === 'primary key' && item.columns) {
      for (const col of item.columns) {
        pkColumns.add(col.name)
      }
    }
  }

  // Second pass: collect column definitions
  for (const item of stmt.columns) {
    if (item.kind !== 'column') continue

    const col: DDLColumn = {
      name: item.name.name,
      type: formatDataType(item.dataType),
      nullable: true,
      primaryKey: pkColumns.has(item.name.name),
      hasDefault: false,
    }

    // Check column constraints
    if (item.constraints) {
      for (const constraint of item.constraints) {
        switch (constraint.type) {
          case 'not null':
            col.nullable = false
            break

          case 'null':
            col.nullable = true
            break

          case 'primary key':
            col.primaryKey = true
            col.nullable = false
            break

          case 'default':
            col.hasDefault = true
            col.defaultValue = constraintToString(constraint)
            break

          case 'check':
            col.checkConstraint = constraintToString(constraint)
            col.checkValues = extractCheckValues(constraint)
            break

          case 'reference':
            if (constraint.foreignTable) {
              col.references = {
                table: constraint.foreignTable.name,
                column: constraint.foreignColumns?.[0]?.name ?? 'id',
              }
            }
            break
        }
      }
    }

    columns.push(col)
  }

  return columns
}

/**
 * Format a data type node to a string
 */
function formatDataType(dataType: any): string {
  if (!dataType) return 'unknown'

  if (typeof dataType === 'string') return dataType

  let result = dataType.name ?? 'unknown'

  if (dataType.config) {
    result += `(${dataType.config.join(', ')})`
  }

  if (dataType.arrayOf) {
    result = `${formatDataType(dataType.arrayOf)}[]`
  }

  return result.toUpperCase()
}

/**
 * Convert a constraint to a string representation
 */
function constraintToString(constraint: any): string {
  try {
    if (constraint.expr) {
      return toSql.expr(constraint.expr)
    }
    if (constraint.default) {
      return toSql.expr(constraint.default)
    }
  } catch {
    // Fallback
  }
  return JSON.stringify(constraint)
}

/**
 * Extract values from a CHECK constraint like CHECK (col IN ('a', 'b', 'c'))
 */
function extractCheckValues(constraint: any): string[] | undefined {
  const values: string[] = []

  try {
    // Walk the expression tree looking for string literals in IN clauses
    const walk = (node: any) => {
      if (!node) return

      if (node.type === 'list' && Array.isArray(node.expressions)) {
        for (const expr of node.expressions) {
          if (expr.type === 'string' && expr.value) {
            values.push(expr.value)
          }
        }
      }

      // Recurse into child nodes
      for (const key of Object.keys(node)) {
        const child = node[key]
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach(walk)
          } else {
            walk(child)
          }
        }
      }
    }

    walk(constraint.expr)
  } catch {
    // Ignore errors
  }

  return values.length > 0 ? values : undefined
}

/**
 * Fallback parser for when pgsql-ast-parser fails.
 * Uses regex to extract basic column information.
 */
function parseRawCreateTable(sql: string): DDLColumn[] {
  const columns: DDLColumn[] = []

  // Find CREATE TABLE block
  const createTableMatch = sql.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\w.]+\s*\(([\s\S]+?)\)(?:\s*;)?/i
  )
  if (!createTableMatch) return columns

  const body = createTableMatch[1]

  // Split by commas, but respect parentheses
  const parts = splitRespectingParens(body)

  for (const part of parts) {
    const trimmed = part.trim()

    // Skip constraints
    if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)/i.test(trimmed)) {
      continue
    }

    // Parse column: name TYPE [constraints...]
    const colMatch = trimmed.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)/i)
    if (!colMatch) continue

    const [, name, type] = colMatch

    const col: DDLColumn = {
      name,
      type: type.toUpperCase(),
      nullable: !trimmed.toUpperCase().includes('NOT NULL'),
      primaryKey: trimmed.toUpperCase().includes('PRIMARY KEY'),
      hasDefault: trimmed.toUpperCase().includes('DEFAULT'),
    }

    // Extract default value
    const defaultMatch = trimmed.match(/DEFAULT\s+([^,\s]+(?:\([^)]*\))?)/i)
    if (defaultMatch) {
      col.defaultValue = defaultMatch[1]
    }

    // Extract CHECK constraint values
    const checkMatch = trimmed.match(/CHECK\s*\([^)]*IN\s*\(([^)]+)\)/i)
    if (checkMatch) {
      col.checkValues = checkMatch[1]
        .split(',')
        .map((v) => v.trim().replace(/^'|'$/g, ''))
    }

    // Extract REFERENCES
    const refMatch = trimmed.match(/REFERENCES\s+([\w.]+)(?:\s*\(\s*(\w+)\s*\))?/i)
    if (refMatch) {
      col.references = {
        table: refMatch[1],
        column: refMatch[2] ?? 'id',
      }
    }

    columns.push(col)
  }

  return columns
}

/**
 * Split a string by commas, respecting parentheses depth
 */
function splitRespectingParens(str: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0

  for (const char of str) {
    if (char === '(') {
      depth++
      current += char
    } else if (char === ')') {
      depth--
      current += char
    } else if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) {
    parts.push(current)
  }

  return parts
}
