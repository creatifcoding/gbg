/**
 * @fileoverview Server-Side Catalog Utilities
 *
 * Provides utilities for dynamic catalog injection at request time.
 *
 * NOTE: Core domain catalogs (MorphCard, Layout, UI, Charts, Geoint) are
 * registered at build time via CatalogComponentsLive in atoms/catalog.ts.
 * This module provides helpers for request-time catalog extension only.
 *
 * @module genifer/server/catalogs
 */

// =============================================================================
// Dynamic Catalog Injection
// =============================================================================

/**
 * Component documentation for dynamic injection.
 * Use when clients need to pass additional component knowledge at request time.
 */
export interface ComponentDoc {
  /** Component name as used in type field */
  name: string;
  /** Human-readable description */
  description: string;
  /** Props documentation (can be multi-line) */
  props?: string;
  /** Whether component has children */
  hasChildren?: boolean;
}

/**
 * Build additional prompt context from a list of component descriptions.
 * Used for dynamic catalog injection at request time.
 *
 * @param components - Array of component descriptions
 * @returns Formatted string for system prompt injection
 *
 * @example
 * ```ts
 * const additionalDocs = buildCatalogPrompt([
 *   { name: 'CustomWidget', description: 'A custom widget', props: 'text: string' },
 * ])
 * ```
 */
export function buildCatalogPrompt(components: ComponentDoc[]): string {
  if (components.length === 0) return '';

  const lines = ['## Dynamic Components (Request-Specific)', ''];

  for (const comp of components) {
    lines.push(`### ${comp.name}`);
    lines.push(comp.description);
    if (comp.props) {
      lines.push(`Props: ${comp.props}`);
    }
    if (comp.hasChildren !== undefined) {
      lines.push(`Has children: ${comp.hasChildren ? 'yes' : 'no'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
