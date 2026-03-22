/**
 * @fileoverview Catalog Rebuild — Type Definitions
 *
 * New type system for the VANTA-grounded catalog rebuild.
 * These types extend the existing CatalogService interfaces with
 * className policy, prop schemas for prompt injection, and tier metadata.
 *
 * Spec: src/lib/genifer/docs/specs/CATALOG_REBUILD_SPEC.md §4, §9
 *
 * @module genifer/catalog/types
 */

import type { ReactNode } from 'react'
import type { UIElement, Action } from '@/lib/genifer/core/schemas'
import type { EntranceAnimation } from '@/lib/genifer/core/animation-schema'
import type { CatalogTier, CatalogDomain, ComponentRenderProps } from '@/lib/genifer/core/CatalogService'
import type { Schema } from 'effect'

// =============================================================================
// Spacing
// =============================================================================

/** Named spacing scale — model sees tokens, never pixel values */
export type SpacingToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// =============================================================================
// className Policy
// =============================================================================

/**
 * Policy group names.
 * Each group maps to a set of Tailwind prefix strings.
 */
export type PolicyGroup =
  | 'layout'
  | 'sizing'
  | 'opacity'
  | 'border-width'
  | 'overflow'
  | 'cursor'
  | 'selection'

/**
 * Per-component className filtering policy.
 * Determines which Tailwind utility groups are allowed through.
 */
export interface ClassNamePolicy {
  readonly allow: readonly PolicyGroup[]
}

// =============================================================================
// Prop Schema (for prompt injection + runtime validation)
// =============================================================================

/** Prop type discriminator */
export type PropType = 'string' | 'number' | 'boolean' | 'enum'

/**
 * Schema for a single prop — used for both prompt generation and runtime validation.
 * Intentionally simple: the model sees this as JSON in the system prompt.
 */
export interface PropSpec {
  readonly type: PropType
  /** Allowed values (for enum type) */
  readonly values?: readonly string[]
  /** Default value */
  readonly default?: unknown
  /** Human-readable description for the model */
  readonly description?: string
}

// =============================================================================
// Component Category
// =============================================================================

/** Category for prompt grouping */
export type ComponentCategory =
  | 'layout'
  | 'content'
  | 'surface'
  | 'interactive'
  | 'data'
  | 'form'
  | 'container'
  | 'rich'
  | 'composed'
  | 'specialized'

// =============================================================================
// Catalog Entry — the atomic unit of the rebuilt catalog
// =============================================================================

/**
 * Full component registration with metadata, policy, and renderer.
 *
 * Extends the existing ComponentDef pattern but adds:
 * - `classNamePolicy` for per-component Tailwind filtering
 * - `propsSchema` for prompt injection (model sees prop names/types/values)
 * - `category` for grouping in the system prompt
 * - Explicit `container` flag
 */
export interface CatalogEntry {
  /** Component type identifier — used in NDJSON `type` field */
  readonly type: string

  /** Tier: core (always in prompt) | standard (injected for forms/data) | domain (per-context) */
  readonly tier: 'core' | 'standard' | 'domain'

  /** Category for prompt grouping */
  readonly category: ComponentCategory

  /** Whether this component accepts children */
  readonly container: boolean

  /** className filtering policy */
  readonly classNamePolicy: ClassNamePolicy

  /** Props schema for prompt injection + validation */
  readonly propsSchema: Record<string, PropSpec>

  /** React renderer */
  readonly renderer: (props: ComponentRenderProps<any>) => ReactNode

  /** Effect Schema for component props (required by CatalogService) */
  readonly schema: Schema.Schema<any, any, never>

  /** Description for the model */
  readonly description?: string

  /** Default entrance animation */
  readonly defaultEntrance: EntranceAnimation

  /** Domain tags for scoping (defaults to ['ui']) */
  readonly domains?: readonly CatalogDomain[]
}

// =============================================================================
// Intent (shared across Alert, Badge, Button, Progress)
// =============================================================================

/** Semantic intent — drives accent color mapping */
export type Intent = 'info' | 'success' | 'warning' | 'danger'

/** Extended intent (includes neutral for Badge) */
export type ExtendedIntent = Intent | 'neutral'

// =============================================================================
// Default Policies by Category
// =============================================================================

/** Default className policies — use these in catalog entries */
export const DEFAULT_POLICIES: Record<string, ClassNamePolicy> = {
  layout:      { allow: ['layout', 'sizing', 'overflow'] },
  content:     { allow: ['layout'] },
  surface:     { allow: ['layout', 'sizing', 'opacity', 'border-width'] },
  interactive: { allow: ['layout', 'sizing', 'cursor'] },
  data:        { allow: ['layout'] },
  container:   { allow: ['layout', 'sizing', 'overflow'] },
  form:        { allow: ['layout', 'sizing'] },
} as const
