/**
 * Link - Resolved link definitions between ObjectTypes
 *
 * Links are extracted from ObjectTypeDef configs and resolved
 * into a normalized form for OSDK compilation.
 */

import type { Schema } from "effect"
import type { ObjectTypeDef, LinkCardinality } from "./object-type"

// =============================================================================
// Resolved Link
// =============================================================================

/**
 * A fully resolved link between two object types
 */
export interface ResolvedLink {
  readonly _tag: "ResolvedLink"
  /** Unique API name for this link (e.g., "EmployeeToDepartment") */
  readonly apiName: string
  /** The source object type name */
  readonly sourceName: string
  /** The target object type name */
  readonly targetName: string
  /** Link property name on the source */
  readonly propertyName: string
  /** Relationship cardinality */
  readonly cardinality: LinkCardinality
  /** Foreign key property (for many-to-one) */
  readonly foreignKey?: string
  /** Display name */
  readonly displayName?: string
}

// =============================================================================
// Link Resolution
// =============================================================================

/**
 * Extract and resolve all links from a collection of ObjectTypeDefs
 */
export const resolveLinks = (
  objects: ReadonlyMap<string, ObjectTypeDef>
): ResolvedLink[] => {
  const links: ResolvedLink[] = []

  for (const [sourceName, objectDef] of objects) {
    const linkConfigs = objectDef.config.links ?? {}

    for (const [propertyName, linkConfig] of globalThis.Object.entries(linkConfigs)) {
      // Resolve target schema to get name
      const targetSchema = linkConfig.target()
      const targetName = extractSchemaName(targetSchema)

      // Generate API name
      const apiName = `${sourceName}To${targetName}`

      links.push({
        _tag: "ResolvedLink",
        apiName,
        sourceName,
        targetName,
        propertyName,
        cardinality: linkConfig.cardinality,
        foreignKey: linkConfig.foreignKey,
        displayName: linkConfig.displayName,
      })
    }
  }

  return links
}

/**
 * Extract the name/tag from a Schema
 */
const extractSchemaName = (schema: Schema.Schema.AnyNoContext): string => {
  const schemaAny = schema as any

  // TaggedClass pattern: fields._tag.literals[0]
  if (schemaAny.fields?._tag?.literals?.[0]) {
    return schemaAny.fields._tag.literals[0]
  }

  // Direct _tag
  if (schemaAny._tag && typeof schemaAny._tag === "string") {
    return schemaAny._tag
  }

  // Schema identifier
  if (schemaAny.identifier) {
    return schemaAny.identifier
  }

  // Class name as fallback
  if (schemaAny.name) {
    return schemaAny.name
  }

  return "Unknown"
}

// =============================================================================
// Link Utilities
// =============================================================================

/**
 * Group links by source object type
 */
export const groupLinksBySource = (
  links: readonly ResolvedLink[]
): Map<string, ResolvedLink[]> => {
  const grouped = new Map<string, ResolvedLink[]>()

  for (const link of links) {
    const existing = grouped.get(link.sourceName) ?? []
    existing.push(link)
    grouped.set(link.sourceName, existing)
  }

  return grouped
}

/**
 * Get inverse links (links pointing TO a given object type)
 */
export const getInverseLinks = (
  links: readonly ResolvedLink[],
  targetName: string
): ResolvedLink[] => {
  return links.filter((link) => link.targetName === targetName)
}

/**
 * Type guard for ResolvedLink
 */
export const isResolvedLink = (value: unknown): value is ResolvedLink => {
  return (
    typeof value === "object" &&
    value !== null &&
    "_tag" in value &&
    value._tag === "ResolvedLink"
  )
}
