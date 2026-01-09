/**
 * Fusion View XState Machine
 *
 * State machine for multi-source intelligence fusion:
 * - Source correlation analysis
 * - Confidence scoring
 * - Entity matching across sources
 * - Correlation matrix visualization
 * - Fusion rules management
 *
 * @module geoint/machines/fusionViewMachine
 */

import { setup, assign, emit } from 'xstate'

// =============================================================================
// TYPES
// =============================================================================

export type FusionSource = 'track' | 'osm' | 'opensky' | 'ais' | 'sigint' | 'humint' | 'imagery'

export type CorrelationType = 'spatial' | 'temporal' | 'identity' | 'behavioral' | 'attribute'

export type CorrelationStrength = 'strong' | 'moderate' | 'weak' | 'none'

export type FusionConfidence = 'high' | 'medium' | 'low' | 'uncertain'

export interface SourceMetadata {
  id: FusionSource
  name: string
  color: string
  entityCount: number
  lastUpdate: Date
  reliability: number // 0-1
  coverage: number // 0-1
}

export interface CorrelationPair {
  sourceA: FusionSource
  sourceB: FusionSource
  correlationType: CorrelationType
  strength: CorrelationStrength
  matchCount: number
  confidence: number // 0-1
  examples: Array<{
    entityA: string
    entityB: string
    score: number
  }>
}

export interface FusedEntity {
  id: string
  primarySource: FusionSource
  sources: FusionSource[]
  sourceEntityIds: Record<FusionSource, string>
  attributes: Record<string, unknown>
  confidence: FusionConfidence
  score: number // 0-1
  createdAt: Date
  updatedAt: Date
  manuallyVerified: boolean
}

export interface FusionRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  sourceA: FusionSource | '*'
  sourceB: FusionSource | '*'
  correlationType: CorrelationType
  conditions: Array<{
    field: string
    operator: 'eq' | 'contains' | 'within' | 'gt' | 'lt'
    value: string | number
    weight: number
  }>
  minConfidence: number
}

export interface FusionViewContext {
  /** Available sources */
  sources: SourceMetadata[]
  /** Active sources for fusion */
  activeSources: FusionSource[]
  /** Correlation pairs matrix */
  correlations: CorrelationPair[]
  /** Fused entities */
  fusedEntities: FusedEntity[]
  /** Fusion rules */
  rules: FusionRule[]
  /** Selected correlation pair */
  selectedPair: { sourceA: FusionSource; sourceB: FusionSource } | null
  /** Selected fused entity */
  selectedEntityId: string | null
  /** Correlation type filter */
  correlationTypeFilter: CorrelationType | 'all'
  /** Minimum confidence threshold */
  minConfidenceThreshold: number
  /** Show only strong correlations */
  showStrongOnly: boolean
  /** Matrix display mode */
  matrixMode: 'count' | 'confidence' | 'strength'
  /** Sort fused entities by */
  sortBy: 'confidence' | 'sources' | 'updated'
  /** Is computing correlations */
  isComputing: boolean
  /** Last computation time */
  lastComputedAt: Date | null
  /** Computation progress (0-100) */
  computeProgress: number
  /** Active panel */
  activePanel: 'matrix' | 'entities' | 'rules'
  /** Highlighted sources */
  highlightedSources: FusionSource[]
}

export type FusionViewEvent =
  // Source management
  | { type: 'TOGGLE_SOURCE'; source: FusionSource }
  | { type: 'SET_ACTIVE_SOURCES'; sources: FusionSource[] }
  | { type: 'UPDATE_SOURCE_METADATA'; source: FusionSource; metadata: Partial<SourceMetadata> }

  // Correlation analysis
  | { type: 'COMPUTE_CORRELATIONS' }
  | { type: 'CORRELATION_PROGRESS'; progress: number }
  | { type: 'CORRELATIONS_COMPUTED'; correlations: CorrelationPair[] }
  | { type: 'SELECT_PAIR'; sourceA: FusionSource; sourceB: FusionSource }
  | { type: 'CLEAR_PAIR_SELECTION' }

  // Fused entities
  | { type: 'FUSE_ENTITIES' }
  | { type: 'ENTITIES_FUSED'; entities: FusedEntity[] }
  | { type: 'SELECT_ENTITY'; id: string }
  | { type: 'VERIFY_ENTITY'; id: string; verified: boolean }
  | { type: 'SPLIT_ENTITY'; id: string }
  | { type: 'MERGE_ENTITIES'; ids: string[] }

  // Fusion rules
  | { type: 'ADD_RULE'; rule: Omit<FusionRule, 'id'> }
  | { type: 'UPDATE_RULE'; id: string; updates: Partial<FusionRule> }
  | { type: 'DELETE_RULE'; id: string }
  | { type: 'TOGGLE_RULE'; id: string }
  | { type: 'REORDER_RULES'; ids: string[] }

  // Filters and display
  | { type: 'SET_CORRELATION_TYPE_FILTER'; filter: CorrelationType | 'all' }
  | { type: 'SET_MIN_CONFIDENCE'; threshold: number }
  | { type: 'TOGGLE_STRONG_ONLY' }
  | { type: 'SET_MATRIX_MODE'; mode: 'count' | 'confidence' | 'strength' }
  | { type: 'SET_SORT_BY'; sortBy: 'confidence' | 'sources' | 'updated' }
  | { type: 'SET_ACTIVE_PANEL'; panel: 'matrix' | 'entities' | 'rules' }

  // Highlight
  | { type: 'HIGHLIGHT_SOURCES'; sources: FusionSource[] }
  | { type: 'CLEAR_HIGHLIGHTS' }

export type FusionViewEmittedEvent =
  | { type: 'onCorrelationsComputed'; count: number }
  | { type: 'onEntitiesFused'; count: number }
  | { type: 'onEntitySelected'; entity: FusedEntity }
  | { type: 'onPairSelected'; sourceA: FusionSource; sourceB: FusionSource }

export interface FusionViewInput {
  initialSources?: SourceMetadata[]
  initialRules?: FusionRule[]
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const SOURCE_COLORS: Record<FusionSource, string> = {
  track: '#3b82f6',   // blue
  osm: '#22c55e',     // green
  opensky: '#f59e0b', // amber
  ais: '#06b6d4',     // cyan
  sigint: '#8b5cf6',  // purple
  humint: '#ef4444',  // red
  imagery: '#ec4899', // pink
}

export const SOURCE_NAMES: Record<FusionSource, string> = {
  track: 'Track',
  osm: 'OpenStreetMap',
  opensky: 'OpenSky',
  ais: 'AIS Maritime',
  sigint: 'SIGINT',
  humint: 'HUMINT',
  imagery: 'Imagery',
}

export const CORRELATION_TYPES: CorrelationType[] = [
  'spatial',
  'temporal',
  'identity',
  'behavioral',
  'attribute'
]

export const DEFAULT_SOURCES: SourceMetadata[] = [
  { id: 'track', name: 'Track', color: SOURCE_COLORS.track, entityCount: 0, lastUpdate: new Date(), reliability: 0.95, coverage: 0.8 },
  { id: 'osm', name: 'OpenStreetMap', color: SOURCE_COLORS.osm, entityCount: 0, lastUpdate: new Date(), reliability: 0.85, coverage: 0.95 },
  { id: 'opensky', name: 'OpenSky', color: SOURCE_COLORS.opensky, entityCount: 0, lastUpdate: new Date(), reliability: 0.9, coverage: 0.7 },
  { id: 'ais', name: 'AIS Maritime', color: SOURCE_COLORS.ais, entityCount: 0, lastUpdate: new Date(), reliability: 0.88, coverage: 0.6 },
]

// =============================================================================
// HELPERS
// =============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getCorrelationStrength(confidence: number): CorrelationStrength {
  if (confidence >= 0.8) return 'strong'
  if (confidence >= 0.5) return 'moderate'
  if (confidence >= 0.2) return 'weak'
  return 'none'
}

function getFusionConfidence(score: number): FusionConfidence {
  if (score >= 0.85) return 'high'
  if (score >= 0.6) return 'medium'
  if (score >= 0.3) return 'low'
  return 'uncertain'
}

// =============================================================================
// MACHINE
// =============================================================================

export const fusionViewMachine = setup({
  types: {
    context: {} as FusionViewContext,
    events: {} as FusionViewEvent,
    emitted: {} as FusionViewEmittedEvent,
    input: {} as FusionViewInput,
  },
  actions: {
    // Sources
    toggleSource: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_SOURCE') return {}
      const isActive = context.activeSources.includes(event.source)
      return {
        activeSources: isActive
          ? context.activeSources.filter(s => s !== event.source)
          : [...context.activeSources, event.source]
      }
    }),

    setActiveSources: assign(({ event }) => {
      if (event.type !== 'SET_ACTIVE_SOURCES') return {}
      return { activeSources: event.sources }
    }),

    updateSourceMetadata: assign(({ context, event }) => {
      if (event.type !== 'UPDATE_SOURCE_METADATA') return {}
      return {
        sources: context.sources.map(s =>
          s.id === event.source ? { ...s, ...event.metadata } : s
        )
      }
    }),

    // Correlations
    startComputing: assign({ isComputing: true, computeProgress: 0 }),

    updateProgress: assign(({ event }) => {
      if (event.type !== 'CORRELATION_PROGRESS') return {}
      return { computeProgress: event.progress }
    }),

    setCorrelations: assign(({ event }) => {
      if (event.type !== 'CORRELATIONS_COMPUTED') return {}
      return {
        correlations: event.correlations,
        isComputing: false,
        computeProgress: 100,
        lastComputedAt: new Date()
      }
    }),

    selectPair: assign(({ event }) => {
      if (event.type !== 'SELECT_PAIR') return {}
      return {
        selectedPair: { sourceA: event.sourceA, sourceB: event.sourceB }
      }
    }),

    clearPairSelection: assign({ selectedPair: null }),

    // Fused entities
    setFusedEntities: assign(({ event }) => {
      if (event.type !== 'ENTITIES_FUSED') return {}
      return { fusedEntities: event.entities }
    }),

    selectEntity: assign(({ event }) => {
      if (event.type !== 'SELECT_ENTITY') return {}
      return { selectedEntityId: event.id }
    }),

    verifyEntity: assign(({ context, event }) => {
      if (event.type !== 'VERIFY_ENTITY') return {}
      return {
        fusedEntities: context.fusedEntities.map(e =>
          e.id === event.id ? { ...e, manuallyVerified: event.verified, updatedAt: new Date() } : e
        )
      }
    }),

    splitEntity: assign(({ context, event }) => {
      if (event.type !== 'SPLIT_ENTITY') return {}
      return {
        fusedEntities: context.fusedEntities.filter(e => e.id !== event.id),
        selectedEntityId: context.selectedEntityId === event.id ? null : context.selectedEntityId
      }
    }),

    mergeEntities: assign(({ context, event }) => {
      if (event.type !== 'MERGE_ENTITIES') return {}
      const toMerge = context.fusedEntities.filter(e => event.ids.includes(e.id))
      if (toMerge.length < 2) return {}

      // Create merged entity
      const merged: FusedEntity = {
        id: generateId(),
        primarySource: toMerge[0].primarySource,
        sources: [...new Set(toMerge.flatMap(e => e.sources))],
        sourceEntityIds: toMerge.reduce((acc, e) => ({ ...acc, ...e.sourceEntityIds }), {} as Record<FusionSource, string>),
        attributes: toMerge.reduce((acc, e) => ({ ...acc, ...e.attributes }), {} as Record<string, unknown>),
        confidence: 'high',
        score: Math.max(...toMerge.map(e => e.score)),
        createdAt: new Date(),
        updatedAt: new Date(),
        manuallyVerified: true
      }

      return {
        fusedEntities: [
          ...context.fusedEntities.filter(e => !event.ids.includes(e.id)),
          merged
        ],
        selectedEntityId: merged.id
      }
    }),

    // Rules
    addRule: assign(({ context, event }) => {
      if (event.type !== 'ADD_RULE') return {}
      const newRule: FusionRule = {
        ...event.rule,
        id: generateId()
      }
      return { rules: [...context.rules, newRule] }
    }),

    updateRule: assign(({ context, event }) => {
      if (event.type !== 'UPDATE_RULE') return {}
      return {
        rules: context.rules.map(r =>
          r.id === event.id ? { ...r, ...event.updates } : r
        )
      }
    }),

    deleteRule: assign(({ context, event }) => {
      if (event.type !== 'DELETE_RULE') return {}
      return { rules: context.rules.filter(r => r.id !== event.id) }
    }),

    toggleRule: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_RULE') return {}
      return {
        rules: context.rules.map(r =>
          r.id === event.id ? { ...r, enabled: !r.enabled } : r
        )
      }
    }),

    reorderRules: assign(({ context, event }) => {
      if (event.type !== 'REORDER_RULES') return {}
      const orderedRules = event.ids.map((id, idx) => {
        const rule = context.rules.find(r => r.id === id)
        return rule ? { ...rule, priority: idx } : null
      }).filter((r): r is FusionRule => r !== null)
      return { rules: orderedRules }
    }),

    // Filters
    setCorrelationTypeFilter: assign(({ event }) => {
      if (event.type !== 'SET_CORRELATION_TYPE_FILTER') return {}
      return { correlationTypeFilter: event.filter }
    }),

    setMinConfidence: assign(({ event }) => {
      if (event.type !== 'SET_MIN_CONFIDENCE') return {}
      return { minConfidenceThreshold: Math.max(0, Math.min(1, event.threshold)) }
    }),

    toggleStrongOnly: assign(({ context }) => ({
      showStrongOnly: !context.showStrongOnly
    })),

    setMatrixMode: assign(({ event }) => {
      if (event.type !== 'SET_MATRIX_MODE') return {}
      return { matrixMode: event.mode }
    }),

    setSortBy: assign(({ event }) => {
      if (event.type !== 'SET_SORT_BY') return {}
      return { sortBy: event.sortBy }
    }),

    setActivePanel: assign(({ event }) => {
      if (event.type !== 'SET_ACTIVE_PANEL') return {}
      return { activePanel: event.panel }
    }),

    // Highlights
    highlightSources: assign(({ event }) => {
      if (event.type !== 'HIGHLIGHT_SOURCES') return {}
      return { highlightedSources: event.sources }
    }),

    clearHighlights: assign({ highlightedSources: [] }),

    // Emitted events
    emitCorrelationsComputed: emit(({ context }) => ({
      type: 'onCorrelationsComputed' as const,
      count: context.correlations.length
    })),

    emitEntitiesFused: emit(({ context }) => ({
      type: 'onEntitiesFused' as const,
      count: context.fusedEntities.length
    })),

    emitEntitySelected: emit(({ context }) => {
      const entity = context.fusedEntities.find(e => e.id === context.selectedEntityId)
      if (!entity) {
        return { type: 'onEntitySelected' as const, entity: null as unknown as FusedEntity }
      }
      return { type: 'onEntitySelected' as const, entity }
    }),

    emitPairSelected: emit(({ context }) => {
      if (!context.selectedPair) {
        return { type: 'onPairSelected' as const, sourceA: 'track' as FusionSource, sourceB: 'osm' as FusionSource }
      }
      return {
        type: 'onPairSelected' as const,
        sourceA: context.selectedPair.sourceA,
        sourceB: context.selectedPair.sourceB
      }
    }),
  },
}).createMachine({
  id: 'fusionView',
  initial: 'idle',
  context: ({ input }) => ({
    sources: input.initialSources ?? DEFAULT_SOURCES,
    activeSources: (input.initialSources ?? DEFAULT_SOURCES).map(s => s.id),
    correlations: [],
    fusedEntities: [],
    rules: input.initialRules ?? [],
    selectedPair: null,
    selectedEntityId: null,
    correlationTypeFilter: 'all',
    minConfidenceThreshold: 0.3,
    showStrongOnly: false,
    matrixMode: 'confidence',
    sortBy: 'confidence',
    isComputing: false,
    lastComputedAt: null,
    computeProgress: 0,
    activePanel: 'matrix',
    highlightedSources: [],
  }),
  states: {
    idle: {
      on: {
        // Sources
        TOGGLE_SOURCE: { actions: ['toggleSource'] },
        SET_ACTIVE_SOURCES: { actions: ['setActiveSources'] },
        UPDATE_SOURCE_METADATA: { actions: ['updateSourceMetadata'] },

        // Correlations
        COMPUTE_CORRELATIONS: { target: 'computing', actions: ['startComputing'] },
        SELECT_PAIR: { actions: ['selectPair', 'emitPairSelected'] },
        CLEAR_PAIR_SELECTION: { actions: ['clearPairSelection'] },

        // Fused entities
        FUSE_ENTITIES: { target: 'fusing' },
        SELECT_ENTITY: { actions: ['selectEntity', 'emitEntitySelected'] },
        VERIFY_ENTITY: { actions: ['verifyEntity'] },
        SPLIT_ENTITY: { actions: ['splitEntity'] },
        MERGE_ENTITIES: { actions: ['mergeEntities'] },

        // Rules
        ADD_RULE: { actions: ['addRule'] },
        UPDATE_RULE: { actions: ['updateRule'] },
        DELETE_RULE: { actions: ['deleteRule'] },
        TOGGLE_RULE: { actions: ['toggleRule'] },
        REORDER_RULES: { actions: ['reorderRules'] },

        // Filters
        SET_CORRELATION_TYPE_FILTER: { actions: ['setCorrelationTypeFilter'] },
        SET_MIN_CONFIDENCE: { actions: ['setMinConfidence'] },
        TOGGLE_STRONG_ONLY: { actions: ['toggleStrongOnly'] },
        SET_MATRIX_MODE: { actions: ['setMatrixMode'] },
        SET_SORT_BY: { actions: ['setSortBy'] },
        SET_ACTIVE_PANEL: { actions: ['setActivePanel'] },

        // Highlights
        HIGHLIGHT_SOURCES: { actions: ['highlightSources'] },
        CLEAR_HIGHLIGHTS: { actions: ['clearHighlights'] },
      },
    },
    computing: {
      on: {
        CORRELATION_PROGRESS: { actions: ['updateProgress'] },
        CORRELATIONS_COMPUTED: {
          target: 'idle',
          actions: ['setCorrelations', 'emitCorrelationsComputed']
        },
      },
    },
    fusing: {
      on: {
        ENTITIES_FUSED: {
          target: 'idle',
          actions: ['setFusedEntities', 'emitEntitiesFused']
        },
      },
    },
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export type FusionViewMachine = typeof fusionViewMachine
export type FusionViewSnapshot = ReturnType<typeof fusionViewMachine.getInitialSnapshot>

// Re-export helpers for use in components
export { getCorrelationStrength, getFusionConfidence }
