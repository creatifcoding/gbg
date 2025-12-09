/**
 * SPIKE 2: Schema Annotations → AG-Grid ColDef
 *
 * HYPOTHESIS: We can embed grid configuration in Effect Schema annotations
 * and extract them to generate AG-Grid column definitions.
 *
 * SUCCESS CRITERIA:
 * - Annotations survive schema composition (pipe, extend)
 * - Custom annotation namespace doesn't conflict with standard ones
 * - Generated ColDefs have correct field, headerName, width, etc.
 * - Variant styling merges cleanly with annotation styles
 *
 * @module
 */

import { Schema, SchemaAST as AST } from 'effect'
import type { ColDef } from 'ag-grid-community'

// =============================================================================
// GRID ANNOTATION TYPES
// =============================================================================

/**
 * Grid column configuration stored in Schema annotations
 */
export interface GridColumnAnnotation {
  /** Column width in pixels */
  width?: number
  /** Minimum width */
  minWidth?: number
  /** Maximum width */
  maxWidth?: number
  /** Pin to left or right */
  pinned?: 'left' | 'right' | null
  /** Cell text color */
  color?: string
  /** Background color */
  backgroundColor?: string
  /** Value format: 'number:N', 'percent', 'currency', 'date:FORMAT' */
  format?: string
  /** Custom cell renderer key */
  cellRenderer?: string
  /** Column group name */
  columnGroup?: string
  /** Suppress auto-sizing */
  suppressSizeToFit?: boolean
  /** Sort direction */
  sort?: 'asc' | 'desc' | null
  /** Editable */
  editable?: boolean
}

// Annotation symbol for type safety
const GridAnnotationId: unique symbol = Symbol.for('@gbg/grid')

// =============================================================================
// ANNOTATION HELPERS
// =============================================================================

/**
 * Adds grid column configuration to a schema field
 *
 * @example
 * const Temperature = Schema.Number.pipe(
 *   gridColumn({ width: 70, color: '#ef4444', format: 'number:1' })
 * )
 */
export function gridColumn(config: GridColumnAnnotation) {
  return Schema.annotations({ [GridAnnotationId]: config })
}

/**
 * Extracts grid annotations from an AST node
 */
function getGridAnnotation(ast: AST.AST): GridColumnAnnotation | undefined {
  // Check current node
  const annotation = ast.annotations[GridAnnotationId] as GridColumnAnnotation | undefined
  if (annotation) return annotation

  // Check through transformations (pipe chains)
  if (ast._tag === 'Transformation') {
    return getGridAnnotation(ast.from) ?? getGridAnnotation(ast.to)
  }

  // Check refinements (Schema.filter, Schema.brand)
  if (ast._tag === 'Refinement') {
    return getGridAnnotation(ast.from)
  }

  return undefined
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
// COLDEF GENERATOR
// =============================================================================

/**
 * Minimal variant type for testing (matches GridVariantType shape)
 */
interface MinimalVariant {
  density: {
    fontSize: number
    minColumnWidth: number
  }
  typography: {
    fontFamily: string
  }
  colors: {
    text: {
      primary: string
      secondary: string
      muted: string
    }
  }
}

/**
 * Creates a valueFormatter function from format string
 */
function createValueFormatter(
  format: string
): ((params: { value: unknown }) => string) | undefined {
  if (format.startsWith('number:')) {
    const decimals = parseInt(format.split(':')[1], 10)
    return (params) =>
      typeof params.value === 'number' ? params.value.toFixed(decimals) : '—'
  }

  if (format === 'percent') {
    return (params) =>
      typeof params.value === 'number' ? `${(params.value * 100).toFixed(1)}%` : '—'
  }

  if (format === 'currency') {
    return (params) =>
      typeof params.value === 'number'
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
            params.value
          )
        : '—'
  }

  return undefined
}

/**
 * Generates AG-Grid ColDefs from an annotated Effect Schema
 */
export function schemaToColDefs<Fields extends Schema.Struct.Fields>(
  schema: Schema.Struct<Fields>,
  variant: MinimalVariant
): ColDef[] {
  const colDefs: ColDef[] = []
  const ast = schema.ast
  const props = getPropertySignatures(ast)

  console.log(`[Spike 2] Processing ${props.length} properties for ColDefs`)

  for (const prop of props) {
    const fieldName = String(prop.name)

    // Unwrap optional wrapper to get to the actual type with annotations
    const { innerAst } = unwrapOptional(prop.type)

    // Get grid annotations - check both the wrapper and inner type
    const gridConfig = getGridAnnotation(prop.type) ?? getGridAnnotation(innerAst) ?? {}

    // Get title annotation (standard Effect Schema annotation)
    const title =
      (prop.type.annotations[AST.TitleAnnotationId] as string) ??
      (innerAst.annotations[AST.TitleAnnotationId] as string) ??
      fieldName

    console.log(`  - ${fieldName}: title="${title}", grid=${JSON.stringify(gridConfig)}`)

    // Build ColDef from annotations + variant
    const colDef: ColDef = {
      field: fieldName,
      headerName: title,

      // From grid annotations
      width: gridConfig.width,
      minWidth: gridConfig.minWidth ?? variant.density.minColumnWidth,
      maxWidth: gridConfig.maxWidth,
      pinned: gridConfig.pinned,
      suppressSizeToFit: gridConfig.suppressSizeToFit,
      sort: gridConfig.sort,
      editable: gridConfig.editable,

      // Cell styling merged with variant
      cellStyle: {
        fontFamily: variant.typography.fontFamily,
        fontSize: variant.density.fontSize,
        ...(gridConfig.color && { color: gridConfig.color }),
        ...(gridConfig.backgroundColor && { backgroundColor: gridConfig.backgroundColor }),
      },

      // Value formatter from format annotation
      valueFormatter: gridConfig.format ? createValueFormatter(gridConfig.format) : undefined,
    }

    colDefs.push(colDef)
  }

  return colDefs
}

// =============================================================================
// TEST SCHEMAS
// =============================================================================

/**
 * SenML Record with grid annotations
 */
/**
 * CRITICAL LEARNING: When using Schema.optional, annotate the INNER type first.
 * Schema.Struct unwraps outer Transformations, losing annotations on the wrapper.
 *
 * Pattern: Schema.optional(InnerType.pipe(annotations)) NOT Schema.optional(InnerType).pipe(annotations)
 */
const SenMLRecordAnnotated = Schema.Struct({
  n: Schema.String.pipe(
    Schema.annotations({ title: 'Sensor Name' }),
    gridColumn({ width: 120, pinned: 'left' })
  ),
  v: Schema.optional(
    Schema.Number.pipe(
      Schema.annotations({ title: 'Value' }),
      gridColumn({ width: 70, color: '#ef4444', format: 'number:2' })
    )
  ),
  u: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ title: 'Unit' }),
      gridColumn({ width: 50, suppressSizeToFit: true })
    )
  ),
  t: Schema.optional(
    Schema.Number.pipe(
      Schema.annotations({ title: 'Time' }),
      gridColumn({ width: 100, format: 'number:0' })
    )
  ),
})

// =============================================================================
// VALIDATION
// =============================================================================

export function runSpike2() {
  console.log('\n' + '='.repeat(60))
  console.log('SPIKE 2: Schema Annotations → AG-Grid ColDef')
  console.log('='.repeat(60) + '\n')

  // Mock variant for testing
  const mockVariant: MinimalVariant = {
    density: {
      fontSize: 12,
      minColumnWidth: 40,
    },
    typography: {
      fontFamily: 'ui-monospace, monospace',
    },
    colors: {
      text: {
        primary: '#e8e6e3',
        secondary: '#a8a5a0',
        muted: '#6b6965',
      },
    },
  }

  try {
    // Generate ColDefs
    const colDefs = schemaToColDefs(SenMLRecordAnnotated, mockVariant)

    console.log('\n✅ SUCCESS: Generated ColDefs')
    console.log(`   Total columns: ${colDefs.length}`)

    for (const col of colDefs) {
      console.log(`\n   ${col.field}:`)
      console.log(`     headerName: ${col.headerName}`)
      console.log(`     width: ${col.width}`)
      console.log(`     pinned: ${col.pinned ?? 'none'}`)
      console.log(`     cellStyle: ${JSON.stringify(col.cellStyle)}`)
      console.log(`     hasFormatter: ${!!col.valueFormatter}`)
    }

    // Test formatter
    const valueCol = colDefs.find((c) => c.field === 'v')
    if (valueCol?.valueFormatter) {
      const formatted = (valueCol.valueFormatter as (p: { value: unknown }) => string)({
        value: 23.456,
      })
      console.log(`\n   Value formatter test: 23.456 → "${formatted}"`)
    }

    return { success: true, colDefs }
  } catch (error) {
    console.error('\n❌ FAILURE:', error)
    return { success: false, error }
  }
}

// Run if executed directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/^file:\/\//, '') ?? '')) {
  runSpike2()
}

export { SenMLRecordAnnotated, GridAnnotationId }
