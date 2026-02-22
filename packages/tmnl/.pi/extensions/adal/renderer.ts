/**
 * ASCII Diagram Renderer
 *
 * Generates ER-style box diagrams and diff tables.
 *
 * @module
 */

import type { DriftReport, FieldComparison, DriftStatus } from './analyzer'

// =============================================================================
// Box Drawing Characters
// =============================================================================

const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  cross: '┼',
  teeDown: '┬',
  teeUp: '┴',
  teeLeft: '┤',
  teeRight: '├',
}

const STATUS_ICONS: Record<DriftStatus, string> = {
  ok: '✓',
  warning: '⚠',
  error: '✗',
}

// =============================================================================
// ER Diagram Renderer
// =============================================================================

export function renderERDiagram(report: DriftReport): string {
  const lines: string[] = []

  // Calculate column widths
  const nameWidth = Math.max(
    10,
    ...report.fields.map((f) => f.name.length),
    'Field'.length
  )
  const schemaWidth = Math.max(
    12,
    ...report.fields.map((f) => (f.schema ? formatSchemaType(f.schema) : '—').length),
    'Schema'.length
  )
  const modelWidth = Math.max(
    12,
    ...report.fields.map((f) => (f.model ? formatModelType(f.model) : '—').length),
    'Model'.length
  )
  const ddlWidth = Math.max(
    15,
    ...report.fields.map((f) => (f.ddl ? formatDDLType(f.ddl) : '—').length),
    'DDL'.length
  )
  const statusWidth = 6

  const totalWidth = nameWidth + schemaWidth + modelWidth + ddlWidth + statusWidth + 14 // padding + separators

  // Title
  const title = ` ${report.entityName} — Schema Triad Alignment `
  const paddedTitle = title.padStart((totalWidth + title.length) / 2).padEnd(totalWidth)

  lines.push(BOX.topLeft + BOX.horizontal.repeat(totalWidth) + BOX.topRight)
  lines.push(BOX.vertical + paddedTitle + BOX.vertical)
  lines.push(
    BOX.teeRight +
      BOX.horizontal.repeat(nameWidth + 2) +
      BOX.teeDown +
      BOX.horizontal.repeat(schemaWidth + 2) +
      BOX.teeDown +
      BOX.horizontal.repeat(modelWidth + 2) +
      BOX.teeDown +
      BOX.horizontal.repeat(ddlWidth + 2) +
      BOX.teeDown +
      BOX.horizontal.repeat(statusWidth + 2) +
      BOX.teeLeft
  )

  // Header
  lines.push(
    BOX.vertical +
      ' ' + 'Field'.padEnd(nameWidth) + ' ' +
      BOX.vertical +
      ' ' + 'Schema'.padEnd(schemaWidth) + ' ' +
      BOX.vertical +
      ' ' + 'Model'.padEnd(modelWidth) + ' ' +
      BOX.vertical +
      ' ' + 'DDL'.padEnd(ddlWidth) + ' ' +
      BOX.vertical +
      ' ' + 'Status'.padEnd(statusWidth) + ' ' +
      BOX.vertical
  )

  lines.push(
    BOX.teeRight +
      BOX.horizontal.repeat(nameWidth + 2) +
      BOX.cross +
      BOX.horizontal.repeat(schemaWidth + 2) +
      BOX.cross +
      BOX.horizontal.repeat(modelWidth + 2) +
      BOX.cross +
      BOX.horizontal.repeat(ddlWidth + 2) +
      BOX.cross +
      BOX.horizontal.repeat(statusWidth + 2) +
      BOX.teeLeft
  )

  // Data rows
  for (const field of report.fields) {
    const name = field.name.padEnd(nameWidth)
    const schema = (field.schema ? formatSchemaType(field.schema) : '—').padEnd(schemaWidth)
    const model = (field.model ? formatModelType(field.model) : '—').padEnd(modelWidth)
    const ddl = (field.ddl ? formatDDLType(field.ddl) : '—').padEnd(ddlWidth)
    const status = `${STATUS_ICONS[field.status]} ${field.status.toUpperCase()}`.padEnd(statusWidth)

    lines.push(
      BOX.vertical +
        ' ' + name + ' ' +
        BOX.vertical +
        ' ' + schema + ' ' +
        BOX.vertical +
        ' ' + model + ' ' +
        BOX.vertical +
        ' ' + ddl + ' ' +
        BOX.vertical +
        ' ' + status + ' ' +
        BOX.vertical
    )
  }

  // Bottom border
  lines.push(
    BOX.bottomLeft +
      BOX.horizontal.repeat(nameWidth + 2) +
      BOX.teeUp +
      BOX.horizontal.repeat(schemaWidth + 2) +
      BOX.teeUp +
      BOX.horizontal.repeat(modelWidth + 2) +
      BOX.teeUp +
      BOX.horizontal.repeat(ddlWidth + 2) +
      BOX.teeUp +
      BOX.horizontal.repeat(statusWidth + 2) +
      BOX.bottomRight
  )

  return lines.join('\n')
}

function formatSchemaType(field: { type: string; optional: boolean; literalValues?: string[] }): string {
  let result = field.type

  if (field.literalValues && field.literalValues.length > 0) {
    result = `Lit(${field.literalValues.length})`
  }

  if (field.optional) {
    result = `${result}?`
  }

  return result
}

function formatModelType(field: { type: string; optional: boolean }): string {
  let result = field.type

  if (field.optional) {
    result = `${result}?`
  }

  return result
}

function formatDDLType(col: { type: string; nullable: boolean; hasDefault: boolean; checkValues?: string[] }): string {
  let result = col.type

  if (col.checkValues && col.checkValues.length > 0) {
    result = `${result} CHK(${col.checkValues.length})`
  }

  if (!col.nullable) {
    result = `${result} NN`
  }

  if (col.hasDefault) {
    result = `${result} DEF`
  }

  return result
}

// =============================================================================
// Diff Table Renderer
// =============================================================================

export function renderDiffTable(report: DriftReport): string {
  const lines: string[] = []

  lines.push('DRIFT ANALYSIS')
  lines.push('═'.repeat(60))
  lines.push('')

  // Group by status
  const errors = report.fields.filter((f) => f.status === 'error')
  const warnings = report.fields.filter((f) => f.status === 'warning')
  const ok = report.fields.filter((f) => f.status === 'ok')

  if (errors.length > 0) {
    lines.push('✗ ERRORS')
    lines.push('─'.repeat(40))
    for (const field of errors) {
      lines.push(`  ${field.name}:`)
      for (const issue of field.issues) {
        lines.push(`    • ${issue}`)
      }
    }
    lines.push('')
  }

  if (warnings.length > 0) {
    lines.push('⚠ WARNINGS')
    lines.push('─'.repeat(40))
    for (const field of warnings) {
      lines.push(`  ${field.name}:`)
      for (const issue of field.issues) {
        lines.push(`    • ${issue}`)
      }
    }
    lines.push('')
  }

  if (ok.length > 0 && ok.length <= 10) {
    lines.push('✓ OK')
    lines.push('─'.repeat(40))
    lines.push(`  ${ok.map((f) => f.name).join(', ')}`)
    lines.push('')
  } else if (ok.length > 10) {
    lines.push(`✓ OK: ${ok.length} fields aligned`)
    lines.push('')
  }

  return lines.join('\n')
}

// =============================================================================
// Summary Renderer
// =============================================================================

export function renderSummary(report: DriftReport): string {
  const lines: string[] = []

  const total = report.fields.length
  const pctOk = total > 0 ? Math.round((report.ok / total) * 100) : 0

  lines.push('SUMMARY')
  lines.push('═'.repeat(30))
  lines.push(`Entity:    ${report.entityName}`)
  lines.push(`Fields:    ${total}`)
  lines.push(``)
  lines.push(`✓ OK:      ${report.ok} (${pctOk}%)`)
  lines.push(`⚠ WARN:    ${report.warnings}`)
  lines.push(`✗ ERROR:   ${report.errors}`)
  lines.push('')

  if (report.errors === 0 && report.warnings === 0) {
    lines.push('🎉 Schema triad is fully aligned!')
  } else if (report.errors === 0) {
    lines.push('Schema triad has minor drift (warnings only)')
  } else {
    lines.push('⚠️  Schema triad has critical drift - review errors')
  }

  return lines.join('\n')
}
