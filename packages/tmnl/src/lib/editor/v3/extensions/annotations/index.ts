/**
 * Annotation System - Main Exports
 *
 * IntentMark + AnnotationNode annotation system for TipTap/ProseMirror.
 *
 * Features:
 * - Multiple visual styles (highlight, pill, squiggle, underline)
 * - Semantic intents (hyperlink, ultralink, popover, action, citation, note)
 * - Hidden content nodes for rich popovers
 * - Annotation graph with bidirectional references
 * - Effect-based service layer with Atom-as-State pattern
 * - Tag-based filtering and querying
 *
 * @module editor/v3/extensions/annotations
 */

// =============================================================================
// Schemas
// =============================================================================

export * from './schemas';

// =============================================================================
// Services
// =============================================================================

export * from './services';

// =============================================================================
// Machines
// =============================================================================

export * from './machines';

// =============================================================================
// Atoms
// =============================================================================

export {
  // Registry (CRITICAL for IntentMarkView ↔ AnnotationPopover communication)
  annotationRegistry,
  AnnotationRegistryProvider,

  // Materialized view atoms
  marksAtom,
  nodesAtom,
  activeQueryAtom,
  filteredMarkIdsAtom,
  selectedAnnotationIdAtom,
  hoveredAnnotationIdAtom,
  visibilityOverridesAtom,
  globalVisibilityAtom,

  // Derived atoms
  markCountAtom,
  nodeCountAtom,
  hasMarksAtom,
  marksArrayAtom,
  nodesArrayAtom,
  selectedMarkAtom,
  hoveredMarkAtom,
  visibleMarkIdsAtom,
  markStatsAtom,

  // Runtime
  annotationRuntimeAtom,

  // Operations
  markOps,
  nodeOps,
  queryOps,
  visibilityOps,
  selectionOps,
  adminOps,
  intentOps,
  popoverOps,
  toolOps,
  graphOps,

  // Popover atoms
  activePopoverAtom,
  popoverContentAtom,
  isPopoverOpenAtom,
} from './atoms';

// =============================================================================
// Popover Controller (stx)
// =============================================================================

export {
  getAnnotationPopoverControllerStx,
  dispatchPopoverEvent,
  popoverControllerOps,
  disposeAnnotationPopoverControllerStx,
} from './popover-stx';

// =============================================================================
// Hooks
// =============================================================================

export {
  // Primary hook (recommended)
  useAnnotations,
  type UseAnnotationsOptions,
  type UseAnnotationsReturn,

  // Lower-level hooks
  useIntentExecution,
  type UseIntentExecutionOptions,
  type UseIntentExecutionReturn,
  useAnnotationPopover,
  type UseAnnotationPopoverOptions,
  type UseAnnotationPopoverReturn,

  // Navigation hook
  useAnnotationNavigation,
  type UseAnnotationNavigationOptions,
  type UseAnnotationNavigationReturn,
} from './hooks';

// =============================================================================
// TipTap Extensions
// =============================================================================

export { IntentMark, default as IntentMarkExtension } from './extension';
export type { IntentMarkOptions } from './extension';

export { AnnotationNodeExtension, default as AnnotationNode } from './node-extension';
export type { AnnotationNodeOptions } from './node-extension';

// =============================================================================
// Components
// =============================================================================

export { AnnotationPopover, type AnnotationPopoverProps } from './components';
export { FilterPanel, type FilterPanelProps } from './components';

// =============================================================================
// Plugins
// =============================================================================

export {
  createFilterSyncPlugin,
  filterSyncPluginKey,
  type FilterSyncPluginOptions,
} from './plugins';

// =============================================================================
// Styles
// =============================================================================

export { annotationStyles } from './styles';

// =============================================================================
// Visual Style Generator (Centralized Color Tokens + CSS Generation)
// =============================================================================

export {
  TMNL_COLOR_TOKENS,
  getColorHex,
  getColorVar,
  generateVisualStyleCSSString,
  generateVisualStyleCSSProperties,
  parseVisualStyle,
  DEFAULT_VISUAL_STYLE,
} from './visual-style-generator';

/**
 * Import styles in your app:
 *
 * CSS import:
 * ```typescript
 * import '@/lib/editor/v3/extensions/annotations/styles.css';
 * ```
 *
 * Or use the CSS-in-JS export:
 * ```typescript
 * import { annotationStyles } from '@/lib/editor/v3/extensions/annotations';
 * // <style>{annotationStyles}</style>
 * ```
 */
