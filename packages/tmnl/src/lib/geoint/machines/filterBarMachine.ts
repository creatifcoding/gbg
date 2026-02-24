/**
 * FilterBar XState Machine
 *
 * State machine for filter orchestration:
 * - Preset filter configurations (quick filters)
 * - Filter group management (expand/collapse)
 * - Batch filter operations
 * - Keyboard shortcuts
 * - Animation coordination
 *
 * This machine handles UI interactions while filterStateAtom handles data.
 *
 * @module geoint/machines/filterBarMachine
 */

import { setup, assign, emit, raise } from 'xstate'
import type { IntelSource, Classification, BBox } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export type FilterPreset =
  | 'all'
  | 'tracks_only'
  | 'high_confidence'
  | 'hostile_only'
  | 'live_feeds'
  | 'custom'

export type FilterGroup = 'sources' | 'classifications' | 'confidence' | 'bounds'

export interface FilterPresetConfig {
  id: FilterPreset
  label: string
  shortcut?: string
  sources: readonly IntelSource[]
  classifications: readonly Classification[]
  minConfidence: number
  bounds: BBox | null
}

export interface FilterBarMachineContext {
  /** Currently active preset (or 'custom' if modified) */
  activePreset: FilterPreset
  /** Expanded filter groups */
  expandedGroups: FilterGroup[]
  /** Group being animated */
  animatingGroup: FilterGroup | null
  /** Animation phase */
  animationPhase: 'idle' | 'expanding' | 'collapsing'
  /** Keyboard shortcuts enabled */
  keyboardEnabled: boolean
  /** Show preset dropdown */
  showPresetDropdown: boolean
  /** Hovered preset index */
  hoveredPresetIndex: number
  /** Last applied filters (for undo) */
  lastFilters: {
    sources: readonly IntelSource[]
    classifications: readonly Classification[]
    minConfidence: number
    bounds: BBox | null
  } | null
}

export type FilterBarMachineEvent =
  // Preset events
  | { type: 'APPLY_PRESET'; preset: FilterPreset }
  | { type: 'TOGGLE_PRESET_DROPDOWN' }
  | { type: 'CLOSE_PRESET_DROPDOWN' }
  | { type: 'HOVER_PRESET'; index: number }
  | { type: 'PRESET_KEYBOARD'; direction: 'up' | 'down' | 'select' }

  // Group events
  | { type: 'TOGGLE_GROUP'; group: FilterGroup }
  | { type: 'EXPAND_GROUP'; group: FilterGroup }
  | { type: 'COLLAPSE_GROUP'; group: FilterGroup }
  | { type: 'EXPAND_ALL' }
  | { type: 'COLLAPSE_ALL' }

  // Batch operations
  | { type: 'ENABLE_ALL_SOURCES' }
  | { type: 'DISABLE_ALL_SOURCES' }
  | { type: 'ENABLE_ALL_CLASSIFICATIONS' }
  | { type: 'DISABLE_ALL_CLASSIFICATIONS' }
  | { type: 'RESET_FILTERS' }
  | { type: 'UNDO_FILTER_CHANGE' }

  // Animation
  | { type: 'ANIMATION_COMPLETE' }

  // Keyboard
  | { type: 'ENABLE_KEYBOARD' }
  | { type: 'DISABLE_KEYBOARD' }
  | { type: 'KEYBOARD_SHORTCUT'; key: string; modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean } }

  // State sync
  | { type: 'FILTERS_CHANGED' }

export type FilterBarEmittedEvent =
  | { type: 'onPresetApply'; preset: FilterPreset; config: FilterPresetConfig }
  | { type: 'onGroupToggle'; group: FilterGroup; expanded: boolean }
  | { type: 'onBatchSourceChange'; sources: readonly IntelSource[] }
  | { type: 'onBatchClassificationChange'; classifications: readonly Classification[] }
  | { type: 'onResetFilters' }
  | { type: 'onUndoFilters'; filters: NonNullable<FilterBarMachineContext['lastFilters']> }

export interface FilterBarMachineInput {
  initialPreset?: FilterPreset
  initialExpandedGroups?: FilterGroup[]
  keyboardEnabled?: boolean
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ALL_SOURCES: readonly IntelSource[] = [
  'track',
  'osm',
  'opensky',
  'feature',
  'adsb-lol',
  'planet',
  'sentinel',
  'openmeteo',
  'custom',
]

const ALL_CLASSIFICATIONS: readonly Classification[] = [
  'friendly',
  'hostile',
  'neutral',
  'unknown',
]

export const FILTER_PRESETS: readonly FilterPresetConfig[] = [
  {
    id: 'all',
    label: 'All Sources',
    shortcut: '1',
    sources: ALL_SOURCES,
    classifications: ALL_CLASSIFICATIONS,
    minConfidence: 0,
    bounds: null,
  },
  {
    id: 'tracks_only',
    label: 'Tracks Only',
    shortcut: '2',
    sources: ['track'],
    classifications: ALL_CLASSIFICATIONS,
    minConfidence: 0,
    bounds: null,
  },
  {
    id: 'high_confidence',
    label: 'High Confidence',
    shortcut: '3',
    sources: ALL_SOURCES,
    classifications: ALL_CLASSIFICATIONS,
    minConfidence: 0.8,
    bounds: null,
  },
  {
    id: 'hostile_only',
    label: 'Hostile Only',
    shortcut: '4',
    sources: ALL_SOURCES,
    classifications: ['hostile'],
    minConfidence: 0.5,
    bounds: null,
  },
  {
    id: 'live_feeds',
    label: 'Live Feeds',
    shortcut: '5',
    sources: ['track', 'opensky', 'adsb-lol', 'openmeteo'],
    classifications: ALL_CLASSIFICATIONS,
    minConfidence: 0,
    bounds: null,
  },
] as const

export const FILTER_PRESET_MAP: Record<FilterPreset, FilterPresetConfig | undefined> = {
  all: FILTER_PRESETS[0],
  tracks_only: FILTER_PRESETS[1],
  high_confidence: FILTER_PRESETS[2],
  hostile_only: FILTER_PRESETS[3],
  live_feeds: FILTER_PRESETS[4],
  custom: undefined,
}

// =============================================================================
// MACHINE
// =============================================================================

export const filterBarMachine = setup({
  types: {
    context: {} as FilterBarMachineContext,
    events: {} as FilterBarMachineEvent,
    emitted: {} as FilterBarEmittedEvent,
    input: {} as FilterBarMachineInput,
  },
  actions: {
    // Preset actions
    setActivePreset: assign(({ event }) => {
      if (event.type !== 'APPLY_PRESET') return {}
      return { activePreset: event.preset }
    }),

    markCustom: assign({
      activePreset: 'custom' as FilterPreset,
    }),

    togglePresetDropdown: assign(({ context }) => ({
      showPresetDropdown: !context.showPresetDropdown,
      hoveredPresetIndex: context.showPresetDropdown ? -1 : 0,
    })),

    closePresetDropdown: assign({
      showPresetDropdown: false,
      hoveredPresetIndex: -1,
    }),

    hoverPreset: assign(({ event }) => {
      if (event.type !== 'HOVER_PRESET') return {}
      return { hoveredPresetIndex: event.index }
    }),

    navigatePresets: assign(({ context, event }) => {
      if (event.type !== 'PRESET_KEYBOARD') return {}
      const max = FILTER_PRESETS.length - 1
      let newIndex = context.hoveredPresetIndex

      if (event.direction === 'down') {
        newIndex = Math.min(newIndex + 1, max)
      } else if (event.direction === 'up') {
        newIndex = Math.max(newIndex - 1, 0)
      }

      return { hoveredPresetIndex: newIndex }
    }),

    // Group actions
    toggleGroup: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_GROUP') return context
      const expanded = context.expandedGroups.includes(event.group)
      return {
        expandedGroups: expanded
          ? context.expandedGroups.filter((g) => g !== event.group)
          : [...context.expandedGroups, event.group],
        animatingGroup: event.group,
        animationPhase: expanded ? ('collapsing' as const) : ('expanding' as const),
      }
    }),

    expandGroup: assign(({ context, event }) => {
      if (event.type !== 'EXPAND_GROUP') return context
      if (context.expandedGroups.includes(event.group)) return context
      return {
        expandedGroups: [...context.expandedGroups, event.group],
        animatingGroup: event.group,
        animationPhase: 'expanding' as const,
      }
    }),

    collapseGroup: assign(({ context, event }) => {
      if (event.type !== 'COLLAPSE_GROUP') return context
      return {
        expandedGroups: context.expandedGroups.filter((g) => g !== event.group),
        animatingGroup: event.group,
        animationPhase: 'collapsing' as const,
      }
    }),

    expandAll: assign({
      expandedGroups: ['sources', 'classifications', 'confidence', 'bounds'] as FilterGroup[],
      animationPhase: 'expanding' as const,
    }),

    collapseAll: assign({
      expandedGroups: [] as FilterGroup[],
      animationPhase: 'collapsing' as const,
    }),

    // Animation
    clearAnimation: assign({
      animationPhase: 'idle' as const,
      animatingGroup: null,
    }),

    // Keyboard
    enableKeyboard: assign({ keyboardEnabled: true }),
    disableKeyboard: assign({ keyboardEnabled: false }),

    // Last filters (for undo)
    saveLastFilters: assign(({ context }) => ({
      lastFilters: context.lastFilters, // This would be set externally
    })),

    // Emitters
    emitPresetApply: emit(({ event }) => {
      if (event.type !== 'APPLY_PRESET') {
        return { type: 'onPresetApply' as const, preset: 'all' as FilterPreset, config: FILTER_PRESETS[0] }
      }
      const config = FILTER_PRESET_MAP[event.preset] ?? FILTER_PRESETS[0]
      return {
        type: 'onPresetApply' as const,
        preset: event.preset,
        config,
      }
    }),

    emitGroupToggle: emit(({ context, event }) => {
      if (event.type !== 'TOGGLE_GROUP') {
        return { type: 'onGroupToggle' as const, group: 'sources' as FilterGroup, expanded: false }
      }
      return {
        type: 'onGroupToggle' as const,
        group: event.group,
        expanded: !context.expandedGroups.includes(event.group),
      }
    }),

    emitBatchSources: emit(({ event }) => {
      const sources = event.type === 'ENABLE_ALL_SOURCES' ? ALL_SOURCES : []
      return {
        type: 'onBatchSourceChange' as const,
        sources,
      }
    }),

    emitBatchClassifications: emit(({ event }) => {
      const classifications = event.type === 'ENABLE_ALL_CLASSIFICATIONS' ? ALL_CLASSIFICATIONS : []
      return {
        type: 'onBatchClassificationChange' as const,
        classifications,
      }
    }),

    emitReset: emit({
      type: 'onResetFilters' as const,
    }),

    emitUndo: emit(({ context }) => ({
      type: 'onUndoFilters' as const,
      filters: context.lastFilters ?? {
        sources: ALL_SOURCES,
        classifications: ALL_CLASSIFICATIONS,
        minConfidence: 0,
        bounds: null,
      },
    })),
  },
  guards: {
    hasLastFilters: ({ context }) => context.lastFilters !== null,
    isPresetDropdownOpen: ({ context }) => context.showPresetDropdown,
    isKeyboardEnabled: ({ context }) => context.keyboardEnabled,
    isSelectDirection: ({ event }) =>
      event.type === 'PRESET_KEYBOARD' && event.direction === 'select',
  },
}).createMachine({
  id: 'filterBar',
  initial: 'idle',
  context: ({ input }) => ({
    activePreset: input?.initialPreset ?? 'all',
    expandedGroups: input?.initialExpandedGroups ?? ['sources', 'classifications'],
    animatingGroup: null,
    animationPhase: 'idle',
    keyboardEnabled: input?.keyboardEnabled ?? true,
    showPresetDropdown: false,
    hoveredPresetIndex: -1,
    lastFilters: null,
  }),
  on: {
    // Global keyboard shortcuts
    KEYBOARD_SHORTCUT: [
      // Number keys for preset shortcuts (1-5)
      {
        guard: ({ context, event }) =>
          context.keyboardEnabled &&
          !context.showPresetDropdown &&
          ['1', '2', '3', '4', '5'].includes(event.key),
        actions: [
          assign(({ event }) => {
            const presetIndex = parseInt(event.key) - 1
            const preset = FILTER_PRESETS[presetIndex]
            return preset ? { activePreset: preset.id } : {}
          }),
          emit(({ event }) => {
            const presetIndex = parseInt(event.key) - 1
            const preset = FILTER_PRESETS[presetIndex]
            return {
              type: 'onPresetApply' as const,
              preset: preset?.id ?? 'all',
              config: preset ?? FILTER_PRESETS[0],
            }
          }),
        ],
      },
      // r = Reset
      {
        guard: ({ context, event }) => context.keyboardEnabled && event.key === 'r',
        actions: raise({ type: 'RESET_FILTERS' }),
      },
      // z = Undo (with ctrl/cmd)
      {
        guard: ({ context, event }) =>
          context.keyboardEnabled && event.key === 'z' && (event.modifiers?.ctrl === true),
        actions: raise({ type: 'UNDO_FILTER_CHANGE' }),
      },
      // p = Toggle preset dropdown
      {
        guard: ({ context, event }) => context.keyboardEnabled && event.key === 'p',
        actions: raise({ type: 'TOGGLE_PRESET_DROPDOWN' }),
      },
      // Escape = Close dropdown
      {
        guard: ({ context, event }) => context.keyboardEnabled && event.key === 'Escape',
        actions: raise({ type: 'CLOSE_PRESET_DROPDOWN' }),
      },
    ],

    // Always available
    ENABLE_KEYBOARD: {
      actions: 'enableKeyboard',
    },
    DISABLE_KEYBOARD: {
      actions: 'disableKeyboard',
    },
    FILTERS_CHANGED: {
      actions: 'markCustom',
    },
  },
  states: {
    idle: {
      on: {
        APPLY_PRESET: {
          actions: ['setActivePreset', 'emitPresetApply', 'closePresetDropdown'],
        },
        TOGGLE_PRESET_DROPDOWN: {
          actions: 'togglePresetDropdown',
        },
        CLOSE_PRESET_DROPDOWN: {
          actions: 'closePresetDropdown',
        },
        HOVER_PRESET: {
          actions: 'hoverPreset',
        },
        PRESET_KEYBOARD: [
          {
            guard: 'isSelectDirection',
            actions: [
              assign(({ context }) => {
                const preset = FILTER_PRESETS[context.hoveredPresetIndex]
                return preset ? { activePreset: preset.id } : {}
              }),
              emit(({ context }) => {
                const preset = FILTER_PRESETS[context.hoveredPresetIndex]
                return {
                  type: 'onPresetApply' as const,
                  preset: preset?.id ?? 'all',
                  config: preset ?? FILTER_PRESETS[0],
                }
              }),
              'closePresetDropdown',
            ],
          },
          {
            actions: 'navigatePresets',
          },
        ],
        TOGGLE_GROUP: {
          actions: ['toggleGroup', 'emitGroupToggle'],
          target: 'animating',
        },
        EXPAND_GROUP: {
          actions: 'expandGroup',
          target: 'animating',
        },
        COLLAPSE_GROUP: {
          actions: 'collapseGroup',
          target: 'animating',
        },
        EXPAND_ALL: {
          actions: 'expandAll',
          target: 'animating',
        },
        COLLAPSE_ALL: {
          actions: 'collapseAll',
          target: 'animating',
        },
        ENABLE_ALL_SOURCES: {
          actions: ['emitBatchSources', 'markCustom'],
        },
        DISABLE_ALL_SOURCES: {
          actions: ['emitBatchSources', 'markCustom'],
        },
        ENABLE_ALL_CLASSIFICATIONS: {
          actions: ['emitBatchClassifications', 'markCustom'],
        },
        DISABLE_ALL_CLASSIFICATIONS: {
          actions: ['emitBatchClassifications', 'markCustom'],
        },
        RESET_FILTERS: {
          actions: ['saveLastFilters', 'emitReset', assign({ activePreset: 'all' as FilterPreset })],
        },
        UNDO_FILTER_CHANGE: {
          guard: 'hasLastFilters',
          actions: 'emitUndo',
        },
      },
    },

    animating: {
      after: {
        200: {
          target: 'idle',
          actions: 'clearAnimation',
        },
      },
      on: {
        ANIMATION_COMPLETE: {
          target: 'idle',
          actions: 'clearAnimation',
        },
      },
    },
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export type FilterBarMachine = typeof filterBarMachine
export type FilterBarMachineSnapshot = ReturnType<typeof filterBarMachine.getInitialSnapshot>
