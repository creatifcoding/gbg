/**
 * @fileoverview Per-Component className Filtering
 *
 * Each CatalogEntry declares which Tailwind utility groups are allowed.
 * `filterClassName` strips everything else, including ALL arbitrary values `[...]`.
 *
 * This is the enforcement layer between the model's className output
 * and what actually reaches the DOM.
 *
 * Spec: src/lib/genifer/docs/specs/CATALOG_REBUILD_SPEC.md §4
 *
 * @module genifer/catalog/className
 */

import type { ClassNamePolicy, PolicyGroup } from './types'

// =============================================================================
// Policy Groups — Tailwind prefix allowlists
// =============================================================================

/**
 * Maps group names to arrays of Tailwind class prefixes.
 * A class is allowed if it starts with any prefix in its group.
 */
export const POLICY_GROUPS: Record<PolicyGroup, readonly string[]> = {
  layout: [
    // Padding
    'p-', 'px-', 'py-', 'pt-', 'pb-', 'pl-', 'pr-',
    // Margin
    'm-', 'mx-', 'my-', 'mt-', 'mb-', 'ml-', 'mr-',
    // Gap / space
    'gap-', 'space-x-', 'space-y-',
    // Flexbox
    'flex', 'grid', 'items-', 'justify-', 'self-', 'place-',
    'order-', 'grow', 'shrink', 'basis-',
    // Display / position
    'relative', 'absolute', 'fixed', 'sticky',
    'hidden', 'block', 'inline', 'inline-flex', 'inline-block',
    // Grid spans
    'col-span-', 'row-span-', 'col-start-', 'col-end-',
    'row-start-', 'row-end-',
    // Inset
    'inset-', 'top-', 'right-', 'bottom-', 'left-',
    // Z-index
    'z-',
  ],

  sizing: [
    'w-', 'h-', 'min-w-', 'min-h-', 'max-w-', 'max-h-',
    'size-', 'aspect-',
  ],

  opacity: [
    'opacity-',
  ],

  'border-width': [
    'border', 'border-t', 'border-b', 'border-l', 'border-r',
    'border-x', 'border-y',
    'rounded', 'rounded-t', 'rounded-b', 'rounded-l', 'rounded-r',
    'rounded-tl', 'rounded-tr', 'rounded-bl', 'rounded-br',
  ],

  overflow: [
    'overflow-', 'truncate', 'text-ellipsis', 'text-clip',
    'line-clamp-',
  ],

  cursor: [
    'cursor-pointer', 'cursor-not-allowed', 'cursor-default',
    'cursor-grab', 'cursor-grabbing', 'cursor-text',
    'pointer-events-none', 'pointer-events-auto',
  ],

  selection: [
    'select-none', 'select-text', 'select-all', 'select-auto',
  ],
} as const

// =============================================================================
// Filter Function
// =============================================================================

/**
 * Filter a raw className string through a component's policy.
 *
 * Rules:
 * 1. Split on whitespace
 * 2. Block ALL arbitrary values: any class containing `[` is rejected
 * 3. Check each class against allowed prefixes from the policy groups
 * 4. Return filtered string (may be empty)
 *
 * @example
 * ```ts
 * const filtered = filterClassName(
 *   'p-4 text-red-500 bg-[#ff0000] w-full',
 *   { allow: ['layout', 'sizing'] }
 * )
 * // → 'p-4 w-full'
 * ```
 */
export function filterClassName(
  raw: string | undefined,
  policy: ClassNamePolicy,
): string {
  if (!raw) return ''

  // Build flat allowlist from policy groups
  const allowed = policy.allow.flatMap(g => POLICY_GROUPS[g] ?? [])

  return raw
    .split(/\s+/)
    .filter(cls => {
      if (!cls) return false
      // Block ALL arbitrary values
      if (cls.includes('[')) return false
      // Check against allowed prefixes
      return allowed.some(prefix => cls.startsWith(prefix))
    })
    .join(' ')
}

/**
 * Check if a specific class would pass a policy.
 * Useful for testing and debugging.
 */
export function classPassesPolicy(
  cls: string,
  policy: ClassNamePolicy,
): boolean {
  if (cls.includes('[')) return false
  const allowed = policy.allow.flatMap(g => POLICY_GROUPS[g] ?? [])
  return allowed.some(prefix => cls.startsWith(prefix))
}
