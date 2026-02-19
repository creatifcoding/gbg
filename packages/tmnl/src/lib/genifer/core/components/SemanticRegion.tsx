/**
 * SemanticRegion Component
 *
 * Wrapper component for agent-addressable regions in UITree.
 * Used by /ui-generate to wrap logical sections of the UI.
 * Evolution agent uses get_semantic_map to discover these regions
 * and can target them for transformation.
 *
 * @module genifer/core/components/SemanticRegion
 */

import { type ReactNode, type HTMLAttributes, forwardRef } from 'react';

// =============================================================================
// Types
// =============================================================================

/** Semantic region type categories */
export type SemanticRegionType =
  | 'chart'
  | 'form'
  | 'list'
  | 'card'
  | 'navigation'
  | 'content'
  | 'interactive'
  | 'header'
  | 'footer'
  | 'sidebar'
  | 'main';

export interface SemanticRegionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  /** Unique region ID for agent targeting (required) */
  'data-semantic-id': string;
  /** Human-readable label (required) */
  'data-semantic-label': string;
  /** Region type for categorization */
  'data-semantic-type'?: SemanticRegionType;
  /** ARIA role (defaults to 'region') */
  role?: string;
  /** ARIA label (defaults to data-semantic-label) */
  'aria-label'?: string;
  /** Child elements */
  children?: ReactNode;
}

// =============================================================================
// Component
// =============================================================================

/**
 * SemanticRegion - Wrapper component for agent-addressable regions
 *
 * Used by /ui-generate to wrap logical sections of the UI.
 * Evolution agent uses get_semantic_map to discover these regions
 * and can target them for transformation.
 *
 * @example
 * ```tsx
 * <SemanticRegion
 *   data-semantic-id="sales-chart"
 *   data-semantic-label="Sales Trends Chart"
 *   data-semantic-type="chart"
 * >
 *   <LineChart data={salesData} />
 * </SemanticRegion>
 * ```
 *
 * @example UITree JSON representation
 * ```json
 * {
 *   "key": "chart-region",
 *   "type": "SemanticRegion",
 *   "props": {
 *     "data-semantic-id": "sales-chart",
 *     "data-semantic-label": "Sales Trends Chart",
 *     "data-semantic-type": "chart"
 *   },
 *   "children": ["salesChart"]
 * }
 * ```
 */
export const SemanticRegion = forwardRef<HTMLDivElement, SemanticRegionProps>(
  function SemanticRegion(
    {
      'data-semantic-id': id,
      'data-semantic-label': label,
      'data-semantic-type': type,
      role = 'region',
      'aria-label': ariaLabel,
      children,
      className,
      ...rest
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        data-semantic-id={id}
        data-semantic-label={label}
        data-semantic-type={type}
        role={role}
        aria-label={ariaLabel ?? label}
        className={className}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

SemanticRegion.displayName = 'SemanticRegion';

export default SemanticRegion;
