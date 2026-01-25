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
 * import { MorphCard, defaultTransitionStrategy } from '@/lib/morph-card'
 *
 * // Using render registry
 * <MorphCard
 *   cardId="status-card"
 *   initialSizeKey="compact"
 *   stateMachineConfig={{
 *     sizes: {
 *       compact: { width: 220, height: 80 },
 *       expanded: { width: 420, height: 220 }
 *     }
 *   }}
 *   transitionStrategy={defaultTransitionStrategy}
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
 *   transitionStrategy={defaultTransitionStrategy}
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
  MorphCardStage,
  LayoutGuard,
  ANIMATION_PRESETS,
  // Loading states
  GenerativeLoading,
  MorphingPlaceholder,
  ScrambleIndicator,
  ProgressiveReveal,
  TypewriterText,
  // DynamicIslandCard
  DynamicIslandCard,
  TabBar,
  ReticleOverlay,
  useDynamicIslandContext,
  useDynamicIslandContextOptional,
  // Types
  type MorphCardProps,
  type RenderRegistry,
  type ModeRender,
  type SizeViewStrategy,
  type SizeViewStrategyInput,
  type SizeViewRegistry,
  type SizeViewRender,
  type SizeViewEntry,
  type SizeKeysFromConfig,
  type AnimatedItemProps,
  type MetricBlockProps,
  type MetricGridProps,
  type MetricStatus,
  type MorphCardStageProps,
  type LayoutGuardMode,
  type GenerativeLoadingProps,
  type DynamicIslandCardProps,
  type DynamicIslandViewProps,
  type TabBarProps,
  type ReticleOverlayProps,
  type ViewSpec,
  type ViewSpecBase,
  type ViewRegistry,
  type ViewIdsFromRegistry,
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
  MorphCardStateMachineConfig,
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
  // Tab Schemas
  TabView,
  TabBarConfig,
  ViewState,
  DynamicIslandCardState,
  DEFAULT_DYNAMIC_ISLAND_STATE,
  ServerQueryRequest,
  ServerResponse,
  ServerStreamEvent,
} from './schemas';

export type {
  CardMode as CardModeType,
  SizePreset as SizePresetType,
  CardState as CardStateType,
  CardId as CardIdType,
  TransitionVerb as TransitionVerbType,
  TransitionGrammar as TransitionGrammarType,
  MorphCardConfig as MorphCardConfigType,
  MorphCardStateMachineConfig as MorphCardStateMachineConfigType,
  GenerationStatus as GenerationStatusType,
  GeneratedContent as GeneratedContentType,
  ModeGenerationState as ModeGenerationStateType,
  GenerativeCardState as GenerativeCardStateType,
} from './schemas';

// =============================================================================
// Card State Service + Machine Exports
// =============================================================================

export {
  CardStateService,
  CardStateServiceLive,
  createCardStateService,
  type CardStateServiceShape,
  type CardStateSnapshot,
  type HistoryState,
  type HistoryEntry,
  type Position,
  type Bounds,
  type TransitionComplexity,
  type SizeKey,
  DEFAULT_CARD_SNAPSHOT,
  DEFAULT_HISTORY_STATE,
  DEFAULT_HISTORY_SIZE,
  getCardStateAtoms,
  cardStateFamily,
} from './card-state';

export {
  islandMachine,
  type IslandMachine,
  type IslandMachineContext,
  type IslandMachineEvent,
  type TransitionStrategy,
  type TransitionStrategyInput,
  defaultTransitionStrategy,
} from './machines/islandMachine';
export {
  getOrCreateIslandActor,
  getIslandActor,
  sendIslandEvent,
  disposeIslandActor,
  disposeAllIslandActors,
  islandSnapshotAtomFamily,
  islandStateValueAtomFamily,
  type IslandActor,
  type IslandSnapshot,
} from './machines/island-stx';

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
// Registry Exports
// =============================================================================

export { morphCardRegistry, MorphCardRegistryProvider } from './atoms/registry';

// =============================================================================
// Atom Exports
// =============================================================================

export {
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
  // Tab atoms
  tabsAtomFamily,
  cardTabStateFamily,
  setActiveTab,
  updateView,
  updateViewState,
  registerTab,
  unregisterTab,
  getActiveTab,
  getViewState,
  clearCardState,
  type AtomRegistry,
} from './atoms';

// =============================================================================
// Hooks Exports
// =============================================================================

export {
  useGenerativeMode,
  type UseGenerativeModeResult,
  // DynamicIslandCard hooks
  useCardServer,
  type UseCardServerResult,
  useDynamicIslandCard,
  type UseDynamicIslandCardResult,
  // Durable stream hook
  useDurableStreamPatches,
  type UseDurableStreamPatchesResult,
  type StreamStatus,
} from './hooks';

// =============================================================================
// Services Exports
// =============================================================================

export {
  CardServerService,
  CardServerServiceLive,
  CardServerQueryError,
  CardServerStreamError,
  type CardServerServiceShape,
  type QueryParams,
  type QueryOptions,
  type StreamEvent,
} from './services';

// =============================================================================
// Catalog Export
// =============================================================================

export { morphCardDomainCatalog } from './catalog';
