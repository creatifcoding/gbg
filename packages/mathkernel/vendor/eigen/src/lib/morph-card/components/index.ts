/**
 * MorphCard Components
 *
 * @module morph-card/components
 */

export {
  MorphCard,
  type MorphCardProps,
  type RenderRegistry,
  type ModeRender,
  type SizeViewStrategy,
  type SizeViewStrategyInput,
  type SizeViewRegistry,
  type SizeViewRender,
  type SizeViewEntry,
  type SizeKeysFromConfig,
  type MorphCardSlots,
  type MorphCardTheme,
  type MorphCardRenderers,
  useMorphCardSkin,
} from './MorphCard';
export { AnimatedItem, ANIMATION_PRESETS, type AnimatedItemProps } from './AnimatedItem';
export {
  MetricBlock,
  MetricGrid,
  type MetricBlockProps,
  type MetricGridProps,
  type MetricStatus,
} from './MetricBlock';
export {
  GenerativeLoading,
  MorphingPlaceholder,
  ScrambleIndicator,
  ProgressiveReveal,
  TypewriterText,
  DecodeErrorBoundary,
  type GenerativeLoadingProps,
  type DecodeErrorBoundaryProps,
} from './LoadingStates';
export { ReticleOverlay, type ReticleOverlayProps } from './ReticleOverlay';
export { MorphCardStage, type MorphCardStageProps } from './MorphCardStage';
export { LayoutGuard, type LayoutGuardMode } from './LayoutGuard';

// DynamicIslandCard Components
export { TabBar, type TabBarProps } from './TabBar';
export {
  DynamicIslandCard,
  useDynamicIslandContext,
  useDynamicIslandContextOptional,
  type DynamicIslandCardProps,
  type DynamicIslandViewProps,
} from './DynamicIslandCard';
export type {
  ViewSpec,
  ViewSpecBase,
  ViewRegistry,
  ViewIdsFromRegistry,
} from '../types/view-registry';
