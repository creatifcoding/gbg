/**
 * AST Inspectors for Effect.Schema and @effect/sql Model
 *
 * Uses Effect's SchemaAST module for proper introspection.
 *
 * @module
 */

import { SchemaAST as AST, Schema } from 'effect'

// =============================================================================
// Types
// =============================================================================

export interface FieldInfo {
  name: string
  type: string
  astTag: string
  optional: boolean
  readonly: boolean
  hasDefault: boolean
  literalValues?: string[]
  branded?: string
  description?: string
}

// =============================================================================
// Schema Inspector
// =============================================================================

/**
 * Inspect an Effect.Schema and extract field information.
 *
 * Works with:
 * - Schema.Struct
 * - Schema.Class
 * - Schema.TaggedStruct
 * - Schema.TaggedClass
 * - Model.Class (Transformations)
 */
export function inspectSchema(schema: unknown, name: string): FieldInfo[] {
  const fields: FieldInfo[] = []

  // Check if it's a schema-like object (could be function or object)
  if (!schema) {
    return fields
  }

  const schemaObj = schema as any

  // Get the AST - works for both functions and objects
  let ast: AST.AST | undefined

  if (schemaObj.ast) {
    ast = schemaObj.ast as AST.AST
  }

  if (ast) {
    // Find the TypeLiteral in the AST (may need to traverse Transformations)
    const typeLiteral = findTypeLiteral(ast)

    if (typeLiteral) {
      for (const ps of typeLiteral.propertySignatures) {
        fields.push(propertySignatureToFieldInfo(ps))
      }
      if (fields.length > 0) {
        return fields
      }
    }

    // Try the standard getPropertySignatures (for non-Transformation ASTs)
    try {
      const propertySignatures = AST.getPropertySignatures(ast)
      for (const ps of propertySignatures) {
        fields.push(propertySignatureToFieldInfo(ps))
      }
      if (fields.length > 0) {
        return fields
      }
    } catch {
      // Fall through to fields inspection
    }
  }

  // Fallback: try accessing fields directly (for Schema.Struct)
  if (schemaObj.fields && typeof schemaObj.fields === 'object') {
    return inspectFields(schemaObj.fields as Record<string, unknown>)
  }

  return fields
}

/**
 * Find a TypeLiteral AST node by traversing through Transformations and Refinements.
 */
function findTypeLiteral(ast: AST.AST): AST.TypeLiteral | null {
  switch (ast._tag) {
    case 'TypeLiteral':
      return ast

    case 'Transformation': {
      const transform = ast as AST.Transformation
      // Check the "from" side first (encoded/database side)
      const fromResult = findTypeLiteral(transform.from)
      if (fromResult) return fromResult
      // Then check the "to" side (decoded/TypeScript side)
      return findTypeLiteral(transform.to)
    }

    case 'Refinement': {
      const refinement = ast as AST.Refinement
      return findTypeLiteral(refinement.from)
    }

    case 'Suspend': {
      const suspend = ast as AST.Suspend
      return findTypeLiteral(suspend.f())
    }

    default:
      return null
  }
}

/**
 * Inspect fields object directly (for Schema.Struct.fields)
 */
function inspectFields(fields: Record<string, unknown>): FieldInfo[] {
  const result: FieldInfo[] = []

  for (const [name, field] of Object.entries(fields)) {
    if (!field || typeof field !== 'object') continue

    const fieldObj = field as any
    let ast: AST.AST | undefined

    // PropertySignature or Schema
    if ('ast' in fieldObj) {
      ast = fieldObj.ast
    } else if (fieldObj._tag) {
      // It's already an AST node
      ast = fieldObj
    }

    if (ast) {
      result.push(astToFieldInfo(name, ast))
    }
  }

  return result
}

/**
 * Convert a PropertySignature to FieldInfo
 */
function propertySignatureToFieldInfo(ps: AST.PropertySignature): FieldInfo {
  const name = String(ps.name)
  const isOptional = ps.isOptional
  const isReadonly = ps.isReadonly

  // Get the underlying type
  const typeAst = ps.type
  const typeInfo = describeAST(typeAst)

  // Check for default annotation
  const hasDefault = AST.getAnnotation<unknown>(ps, AST.DefaultAnnotationId).pipe(
    (opt) => opt._tag === 'Some'
  )

  // Check for description
  const description = AST.getAnnotation<string>(ps, AST.DescriptionAnnotationId).pipe(
    (opt) => (opt._tag === 'Some' ? opt.value : undefined)
  )

  return {
    name,
    type: typeInfo.type,
    astTag: typeInfo.tag,
    optional: isOptional,
    readonly: isReadonly,
    hasDefault,
    literalValues: typeInfo.literalValues,
    branded: typeInfo.branded,
    description: description as string | undefined,
  }
}

/**
 * Convert an AST node to FieldInfo
 */
function astToFieldInfo(name: string, ast: AST.AST): FieldInfo {
  const typeInfo = describeAST(ast)

  // Check for PropertySignatureDeclaration
  if ('isOptional' in ast) {
    const ps = ast as unknown as { isOptional: boolean; isReadonly: boolean }
    return {
      name,
      type: typeInfo.type,
      astTag: typeInfo.tag,
      optional: ps.isOptional,
      readonly: ps.isReadonly,
      hasDefault: false,
      literalValues: typeInfo.literalValues,
      branded: typeInfo.branded,
    }
  }

  return {
    name,
    type: typeInfo.type,
    astTag: typeInfo.tag,
    optional: false,
    readonly: false,
    hasDefault: false,
    literalValues: typeInfo.literalValues,
    branded: typeInfo.branded,
  }
}

interface TypeDescription {
  type: string
  tag: string
  literalValues?: string[]
  branded?: string
}

/**
 * Describe an AST node's type
 */
function describeAST(ast: AST.AST): TypeDescription {
  const tag = ast._tag

  switch (tag) {
    case 'StringKeyword':
      return { type: 'string', tag }

    case 'NumberKeyword':
      return { type: 'number', tag }

    case 'BooleanKeyword':
      return { type: 'boolean', tag }

    case 'BigIntKeyword':
      return { type: 'bigint', tag }

    case 'Literal': {
      const lit = ast as AST.Literal
      return {
        type: `literal(${JSON.stringify(lit.literal)})`,
        tag,
        literalValues: [String(lit.literal)],
      }
    }

    case 'Union': {
      const union = ast as AST.Union
      // Check if it's a string literal union (enum-like)
      const literals: string[] = []
      let allLiterals = true

      for (const member of union.types) {
        if (member._tag === 'Literal') {
          literals.push(String((member as AST.Literal).literal))
        } else {
          allLiterals = false
          break
        }
      }

      if (allLiterals && literals.length > 0) {
        return {
          type: `enum(${literals.length})`,
          tag,
          literalValues: literals,
        }
      }

      return { type: `union(${union.types.length})`, tag }
    }

    case 'TupleType': {
      const tuple = ast as AST.TupleType
      return { type: `array`, tag }
    }

    case 'TypeLiteral': {
      const typeLit = ast as AST.TypeLiteral
      if (typeLit.propertySignatures.length === 0 && typeLit.indexSignatures.length > 0) {
        return { type: 'record', tag }
      }
      return { type: 'object', tag }
    }

    case 'Refinement': {
      const refinement = ast as AST.Refinement
      // Check for branded types
      const brand = AST.getAnnotation<string[]>(ast, AST.BrandAnnotationId)
      if (brand._tag === 'Some') {
        const baseType = describeAST(refinement.from)
        return {
          ...baseType,
          branded: brand.value.join(' & '),
        }
      }
      return describeAST(refinement.from)
    }

    case 'Transformation': {
      const transform = ast as AST.Transformation
      // For transformations, describe the "from" type (encoded side)
      return describeAST(transform.from)
    }

    case 'Suspend': {
      const suspend = ast as AST.Suspend
      return describeAST(suspend.f())
    }

    case 'Declaration': {
      const decl = ast as AST.Declaration
      // Check identifier annotation
      const identifier = AST.getAnnotation<string>(ast, AST.IdentifierAnnotationId)
      if (identifier._tag === 'Some') {
        // Common types
        const id = identifier.value
        if (id === 'DateFromSelf' || id === 'Date') {
          return { type: 'datetime', tag }
        }
        if (id === 'Option') {
          return { type: 'option', tag }
        }
        return { type: id, tag }
      }
      return { type: 'declaration', tag }
    }

    default:
      return { type: tag.toLowerCase(), tag }
  }
}

// =============================================================================
// Model Inspector
// =============================================================================

/**
 * Inspect an @effect/sql Model class and extract field information.
 *
 * Model.Class extends Schema.Class, so it has an `ast` property.
 * The AST is typically a Transformation that we need to traverse.
 */
export function inspectModel(modelClass: unknown, name: string): FieldInfo[] {
  // Model.Class is essentially a Schema with transformations
  // Use the same inspection logic
  return inspectSchema(modelClass, name)
}
