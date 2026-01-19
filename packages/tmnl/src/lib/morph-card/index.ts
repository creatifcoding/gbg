/**
 * MorphCard Module
 *
 * Polymorphic card system with render registry pattern.
 * Inspired by dynamic island for morphing container behavior.
 *
 * @module morph-card
 *
 * @example
 * ```tsx
 * import { MorphCard, type CardMode } from '@/lib/morph-card'
 *
 * // Using render registry
 * <MorphCard
 *   cardId="status-card"
 *   initialMode="compact"
 *   renders={{
 *     compact: () => (
 *       <MorphCard.Content>
 *         <MorphCard.AnimatedItem>
 *           <span>Compact View</span>
 *         </MorphCard.AnimatedItem>
 *       </MorphCard.Content>
 *     ),
 *     expanded: () => (
 *       <MorphCard.Content>
 *         <MorphCard.MetricGrid columns={2}>
 *           <MorphCard.MetricBlock label="CPU" value="42%" status="nominal" />
 *           <MorphCard.MetricBlock label="MEM" value="8GB" status="warning" />
 *         </MorphCard.MetricGrid>
 *       </MorphCard.Content>
 *     ),
 *   }}
 * />
 *
 * // Using render function
 * <MorphCard cardId="data-card">
 *   {(mode) => (
 *     <MorphCard.Content>
 *       {mode === 'expanded' ? <DetailView /> : <SummaryView />}
 *     </MorphCard.Content>
 *   )}
 * </MorphCard>
 *
 * // Generative mode - AI generates content per mode
 * <MorphCard
 *   cardId="gen-card"
 *   generative
 *   prompt="Generate a {{mode}} view of system metrics"
 *   componentCatalog={tmnlCatalog}
 * />
 * ```
 */

// =============================================================================
// Component Exports
// =============================================================================

export {
  MorphCard,
  AnimatedItem,
  MetricBlock,
  MetricGrid,
  ANIMATION_PRESETS,
  // Loading states
  GenerativeLoading,
  MorphingPlaceholder,
  ScrambleIndicator,
  ProgressiveReveal,
  TypewriterText,
  // Types
  type MorphCardProps,
  type RenderRegistry,
  type ModeRender,
  type AnimatedItemProps,
  type MetricBlockProps,
  type MetricGridProps,
  type MetricStatus,
  type GenerativeLoadingProps,
} from './components';

// =============================================================================
// Schema Exports
// =============================================================================

export {
  // Card State
  CardMode,
  SizePreset,
  SizeConfig,
  CardState,
  CardId,
  DEFAULT_CARD_STATE,
  DEFAULT_SIZES,
  // Transition Grammar
  TransitionVerb,
  TransitionModifier,
  TransitionDirection,
  TransitionGrammar,
  DEFAULT_TRANSITION,
  VERB_VARIANTS,
  MODIFIER_TIMING,
  EASING,
  parseGrammar,
  grammarToVariants,
  // Animation Config
  ItemAnimationStyle,
  ItemAnimationDirection,
  ItemAnimationConfig,
  ReticleVariant,
  MorphCardConfig,
  DEFAULT_ITEM_CONFIG,
  ITEM_STYLE_VARIANTS,
  DEFAULT_CARD_CONFIG,
  // Generative State
  GenerationStatus,
  GeneratedContent,
  ModeGenerationState,
  GenerativeCardState,
  DEFAULT_MODE_GENERATION,
  DEFAULT_GENERATIVE_STATE,
} from './schemas';

export type {
  CardMode as CardModeType,
  SizePreset as SizePresetType,
  CardState as CardStateType,
  CardId as CardIdType,
  TransitionVerb as TransitionVerbType,
  TransitionGrammar as TransitionGrammarType,
  MorphCardConfig as MorphCardConfigType,
  GenerationStatus as GenerationStatusType,
  GeneratedContent as GeneratedContentType,
  ModeGenerationState as ModeGenerationStateType,
  GenerativeCardState as GenerativeCardStateType,
} from './schemas';

// =============================================================================
// Context Exports
// =============================================================================

export {
  CardContext,
  useCard,
  useCardOptional,
  useCardActions,
  useCardContextValue,
  type CardContextValue,
  type CardActions,
} from './context';

// =============================================================================
// Atom Exports
// =============================================================================

export {
  cardStateFamily,
  cardConfigFamily,
  cardTransitionFamily,
  cardSizesFamily,
  cardShowControlsFamily,
  cardDimensionsFamily,
  getCardAtoms,
  type CardAtoms,
  // Generative atoms
  generativeStateFamily,
  modeGenerationFamily,
  isModeLoadingFamily,
  hasModeContentFamily,
  currentModeStatusFamily,
  currentModeProgressFamily,
  currentModeErrorFamily,
  getGenerativeAtoms,
  type GenerativeCardAtoms,
} from './atoms';

// =============================================================================
// Hooks Exports
// =============================================================================

export {
  useGenerativeMode,
  type UseGenerativeModeResult,
} from './hooks';

// =============================================================================
// Catalog Export
// =============================================================================

export { morphCardDomainCatalog } from './catalog';
