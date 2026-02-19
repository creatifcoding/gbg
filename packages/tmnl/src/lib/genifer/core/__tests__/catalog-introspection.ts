/**
 * @fileoverview Lazy Catalog Introspection Utilities
 *
 * Provides memoized accessors for catalog schemas and prompts.
 * Designed for test performance - catalog is introspected only once per test run.
 *
 * @module genifer/core/__tests__/catalog-introspection
 */

import { JSONSchema } from "effect"
import {
  getCatalogSchemas,
  getCatalogSystemPrompt,
  type SchemaEntry,
} from "../../react/atoms/catalog"

// =============================================================================
// Memoization Cache
// =============================================================================

let _cachedSchemas: Record<string, SchemaEntry> | null = null
let _cachedPrompt: string | null = null

// =============================================================================
// Schema Introspection
// =============================================================================

/**
 * Get all fields exposed by a component's schema.
 * Uses JSON Schema conversion to extract property names.
 *
 * @param componentName - The component type name (e.g., "Grid", "Stack")
 * @returns Array of field names exposed in the schema
 */
export const getSchemaFields = (componentName: string): string[] => {
  _cachedSchemas ??= getCatalogSchemas()
  const entry = _cachedSchemas[componentName]
  if (!entry) return []

  try {
    const jsonSchema = JSONSchema.make(entry.schema)
    // JSON Schema properties object
    const properties = (jsonSchema as { properties?: Record<string, unknown> }).properties
    return properties ? Object.keys(properties) : []
  } catch {
    // Schema conversion may fail for complex types
    return []
  }
}

/**
 * Get all component type names registered in the catalog.
 */
export const getAllComponentNames = (): string[] => {
  _cachedSchemas ??= getCatalogSchemas()
  return Object.keys(_cachedSchemas)
}

/**
 * Get a schema entry by component name.
 */
export const getSchemaEntry = (componentName: string): SchemaEntry | undefined => {
  _cachedSchemas ??= getCatalogSchemas()
  return _cachedSchemas[componentName]
}

// =============================================================================
// Prompt Introspection
// =============================================================================

/**
 * Get the full AI system prompt.
 */
export const getPromptContent = (): string => {
  _cachedPrompt ??= getCatalogSystemPrompt()
  return _cachedPrompt
}

/**
 * Check if a substring exists in the AI prompt.
 */
export const promptContains = (substring: string): boolean => {
  return getPromptContent().includes(substring)
}

/**
 * Check if a component appears in the AI prompt (by section header).
 */
export const componentInPrompt = (name: string): boolean => {
  return getPromptContent().includes(`### ${name}`)
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear the introspection cache.
 * Useful for tests that modify the catalog at runtime.
 */
export const clearIntrospectionCache = (): void => {
  _cachedSchemas = null
  _cachedPrompt = null
}
