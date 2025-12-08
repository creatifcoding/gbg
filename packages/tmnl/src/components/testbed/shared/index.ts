/**
 * Testbed Shared Components
 *
 * Re-exports all shared testbed components for easy importing:
 *
 * ```tsx
 * import {
 *   // Primitives
 *   SectionLabel,
 *   TestCard,
 *   Button,
 *
 *   // Hypothesis validation
 *   HypothesisBadge,
 *   DamageReport,
 *
 *   // Keyboard
 *   KeyChordDisplay,
 *
 *   // Render tracking (THE GOLD)
 *   useTrackRender,
 *   useRenderStats,
 *   RenderBadge,
 *   GlobalRenderCounter,
 * } from '@/components/testbed/shared'
 * ```
 *
 * STRUCTURE:
 * - primitives.tsx      - Basic UI components (SectionLabel, TestCard, Button, etc.)
 * - hypothesis.tsx      - EDIN hypothesis validation (DamageReport, ValidationCard, etc.)
 * - keyboard.tsx        - Keyboard visualization (KeyBadge, KeyChordDisplay, etc.)
 * - render-tracking.tsx - Render leak detection & diagnostics (useTrackRender, GlobalRenderCounter)
 *
 * RENDER TRACKING:
 * The render-tracking module is particularly valuable for debugging React render
 * cascades. It uses module-level storage (not atoms!) to avoid the infinite loop
 * antipattern discovered in H3.4a. See the module for full documentation.
 */

// Primitives
export {
  SectionLabel,
  type SectionLabelProps,
  TestCard,
  type TestCardProps,
  CollapsiblePanel,
  type CollapsiblePanelProps,
  Button,
  type ButtonProps,
  StatusIndicator,
  type StatusIndicatorProps,
  ValueDisplay,
  type ValueDisplayProps,
  DemoSection,
  type DemoSectionProps,
  TestbedHeader,
  type TestbedHeaderProps,
  VersionBadge,
  type VersionBadgeProps,
  ControlGroup,
  type ControlGroupProps,
  CodeBlock,
  type CodeBlockProps,
} from './primitives'

// Hypothesis validation
export {
  HypothesisBadge,
  type HypothesisBadgeProps,
  ValidationCard,
  type ValidationCardProps,
  HypothesisSection,
  type HypothesisSectionProps,
  SubHypothesisCard,
  type SubHypothesisCardProps,
  DamageReport,
  type DamageReportProps,
  type DamageReportFinding,
  HypothesisSummary,
  type HypothesisSummaryProps,
  type ValidationStatus,
  type HypothesisResult,
} from './hypothesis'

// Keyboard UI
export {
  KeyBadge,
  type KeyBadgeProps,
  KeyChordDisplay,
  type KeyChordDisplayProps,
  KeySequenceDisplay,
  type KeySequenceDisplayProps,
  ShortcutHint,
  type ShortcutHintProps,
} from './keyboard'

// Render tracking (THE GOLD - extracted from EffectAtomTestbed)
export {
  // Types
  type TrackingKey,
  type LeakSeverity,
  type RenderStats,
  type AggregatedRenderStats,

  // Constants
  SEVERITY_COLORS,

  // Core functions
  getTrackingState,
  calculateSeverity,
  resetRenderTracking,
  resetAllRenderTracking,
  getRegisteredKeys,

  // Hooks
  useTrackRender,
  useRenderStats,
  useAggregatedRenderStats,

  // Components
  RenderBadge,
  type RenderBadgeProps,
  TrackedSection,
  type TrackedSectionProps,
  TrackedCard,
  type TrackedCardProps,
  GlobalRenderCounter,
  type GlobalRenderCounterProps,
} from './render-tracking'
