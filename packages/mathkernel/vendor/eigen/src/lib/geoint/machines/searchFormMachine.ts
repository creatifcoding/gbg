/**
 * Search Form UI State Machine
 *
 * XState machine for search panel form orchestration:
 * - Field focus management
 * - Input validation with debounce
 * - Autocomplete/suggestion flow
 * - Form section expand/collapse animations
 * - Submit state coordination
 *
 * This machine handles UI interactions while the searchMachine
 * handles the actual search workflow.
 *
 * @module geoint/machines/searchFormMachine
 */

import { setup, assign, emit, fromPromise } from 'xstate'

// =============================================================================
// TYPES
// =============================================================================

export type FormSection = 'query' | 'sources' | 'filters' | 'timeRange' | 'advanced'
export type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid'

export interface FormFieldState {
  value: string
  touched: boolean
  focused: boolean
  error: string | null
}

export interface SearchFormContext {
  /** Query input field state */
  queryField: FormFieldState
  /** Active/expanded sections */
  expandedSections: FormSection[]
  /** Currently focused field */
  focusedField: FormSection | null
  /** Validation status */
  validationStatus: ValidationStatus
  /** Validation errors by field */
  validationErrors: Partial<Record<FormSection, string>>
  /** Autocomplete suggestions */
  suggestions: string[]
  /** Show suggestions dropdown */
  showSuggestions: boolean
  /** Selected suggestion index (-1 = none) */
  selectedSuggestionIndex: number
  /** Form dirty state */
  isDirty: boolean
  /** Animation phase for sections */
  animationPhase: 'idle' | 'expanding' | 'collapsing'
  /** Section being animated */
  animatingSection: FormSection | null
}

export type SearchFormEvent =
  // Query events
  | { type: 'QUERY_CHANGE'; value: string }
  | { type: 'QUERY_FOCUS' }
  | { type: 'QUERY_BLUR' }
  | { type: 'QUERY_CLEAR' }

  // Section events
  | { type: 'TOGGLE_SECTION'; section: FormSection }
  | { type: 'EXPAND_SECTION'; section: FormSection }
  | { type: 'COLLAPSE_SECTION'; section: FormSection }
  | { type: 'COLLAPSE_ALL' }

  // Suggestion events
  | { type: 'SUGGESTIONS_LOADED'; suggestions: string[] }
  | { type: 'SUGGESTION_SELECT'; index: number }
  | { type: 'SUGGESTION_HOVER'; index: number }
  | { type: 'SUGGESTION_KEYBOARD'; direction: 'up' | 'down' }
  | { type: 'SUGGESTIONS_DISMISS' }

  // Validation events
  | { type: 'VALIDATE' }
  | { type: 'VALIDATION_COMPLETE'; errors: Partial<Record<FormSection, string>> }

  // Form events
  | { type: 'SUBMIT' }
  | { type: 'RESET' }
  | { type: 'ANIMATION_COMPLETE' }

export type SearchFormEmittedEvent =
  | { type: 'onQueryChange'; value: string }
  | { type: 'onSectionToggle'; section: FormSection; expanded: boolean }
  | { type: 'onSubmit'; query: string }
  | { type: 'onReset' }
  | { type: 'onFocusChange'; field: FormSection | null }

export interface SearchFormInput {
  initialQuery?: string
  initialExpandedSections?: FormSection[]
}

// =============================================================================
// ACTORS
// =============================================================================

/**
 * Fetch autocomplete suggestions
 */
const fetchSuggestions = fromPromise<string[], { query: string }>(
  async ({ input }) => {
    // In real implementation, this would call a suggestions API
    await new Promise(resolve => setTimeout(resolve, 150))

    // Mock suggestions based on query
    const suggestions: string[] = []
    if (input.query.length >= 2) {
      suggestions.push(
        `${input.query} near me`,
        `${input.query} location`,
        `${input.query} aircraft`,
        `${input.query} vessel`
      )
    }
    return suggestions
  }
)

/**
 * Validate form fields
 */
const validateForm = fromPromise<
  Partial<Record<FormSection, string>>,
  { query: string }
>(async ({ input }) => {
  await new Promise(resolve => setTimeout(resolve, 100))

  const errors: Partial<Record<FormSection, string>> = {}

  // Query validation
  if (input.query.length > 0 && input.query.length < 2) {
    errors.query = 'Query must be at least 2 characters'
  }

  return errors
})

// =============================================================================
// MACHINE
// =============================================================================

export const searchFormMachine = setup({
  types: {
    context: {} as SearchFormContext,
    events: {} as SearchFormEvent,
    emitted: {} as SearchFormEmittedEvent,
    input: {} as SearchFormInput,
  },
  actions: {
    updateQuery: assign(({ context, event }) => {
      if (event.type !== 'QUERY_CHANGE') return context
      return {
        queryField: {
          ...context.queryField,
          value: event.value,
          touched: true,
          error: null,
        },
        isDirty: true,
        showSuggestions: event.value.length >= 2,
        selectedSuggestionIndex: -1,
      }
    }),

    clearQuery: assign(({ context }) => ({
      queryField: {
        ...context.queryField,
        value: '',
        touched: false,
        error: null,
      },
      suggestions: [],
      showSuggestions: false,
      isDirty: context.queryField.value !== '',
    })),

    focusQuery: assign({
      focusedField: 'query' as FormSection,
      queryField: ({ context }) => ({
        ...context.queryField,
        focused: true,
      }),
    }),

    blurQuery: assign({
      focusedField: null,
      queryField: ({ context }) => ({
        ...context.queryField,
        focused: false,
      }),
      showSuggestions: false,
    }),

    toggleSection: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_SECTION') return context
      const expanded = context.expandedSections.includes(event.section)
      return {
        expandedSections: expanded
          ? context.expandedSections.filter(s => s !== event.section)
          : [...context.expandedSections, event.section],
        animatingSection: event.section,
        animationPhase: expanded ? 'collapsing' as const : 'expanding' as const,
      }
    }),

    expandSection: assign(({ context, event }) => {
      if (event.type !== 'EXPAND_SECTION') return context
      if (context.expandedSections.includes(event.section)) return context
      return {
        expandedSections: [...context.expandedSections, event.section],
        animatingSection: event.section,
        animationPhase: 'expanding' as const,
      }
    }),

    collapseSection: assign(({ context, event }) => {
      if (event.type !== 'COLLAPSE_SECTION') return context
      return {
        expandedSections: context.expandedSections.filter(s => s !== event.section),
        animatingSection: event.section,
        animationPhase: 'collapsing' as const,
      }
    }),

    collapseAll: assign({
      expandedSections: [],
      animationPhase: 'collapsing' as const,
    }),

    setSuggestions: assign(({ event }) => {
      if (event.type !== 'SUGGESTIONS_LOADED') return {}
      return { suggestions: event.suggestions }
    }),

    selectSuggestion: assign(({ context, event }) => {
      if (event.type !== 'SUGGESTION_SELECT') return context
      const suggestion = context.suggestions[event.index]
      if (!suggestion) return context
      return {
        queryField: {
          ...context.queryField,
          value: suggestion,
        },
        showSuggestions: false,
        selectedSuggestionIndex: -1,
        isDirty: true,
      }
    }),

    navigateSuggestions: assign(({ context, event }) => {
      if (event.type !== 'SUGGESTION_KEYBOARD') return context
      const max = context.suggestions.length - 1
      let newIndex = context.selectedSuggestionIndex

      if (event.direction === 'down') {
        newIndex = Math.min(newIndex + 1, max)
      } else {
        newIndex = Math.max(newIndex - 1, -1)
      }

      return { selectedSuggestionIndex: newIndex }
    }),

    hoverSuggestion: assign(({ event }) => {
      if (event.type !== 'SUGGESTION_HOVER') return {}
      return { selectedSuggestionIndex: event.index }
    }),

    dismissSuggestions: assign({
      showSuggestions: false,
      selectedSuggestionIndex: -1,
    }),

    setValidationErrors: assign(({ event }) => {
      if (event.type !== 'VALIDATION_COMPLETE') return {}
      const hasErrors = Object.keys(event.errors).length > 0
      return {
        validationErrors: event.errors,
        validationStatus: hasErrors ? 'invalid' as const : 'valid' as const,
      }
    }),

    clearAnimation: assign({
      animationPhase: 'idle' as const,
      animatingSection: null,
    }),

    resetForm: assign({
      queryField: {
        value: '',
        touched: false,
        focused: false,
        error: null,
      },
      isDirty: false,
      validationStatus: 'idle' as const,
      validationErrors: {},
      suggestions: [],
      showSuggestions: false,
    }),

    emitQueryChange: emit(({ context, event }) => {
      if (event.type !== 'QUERY_CHANGE') {
        return { type: 'onQueryChange' as const, value: context.queryField.value }
      }
      return { type: 'onQueryChange' as const, value: event.value }
    }),

    emitSectionToggle: emit(({ context, event }) => {
      if (event.type !== 'TOGGLE_SECTION') {
        return { type: 'onSectionToggle' as const, section: 'query' as FormSection, expanded: false }
      }
      return {
        type: 'onSectionToggle' as const,
        section: event.section,
        expanded: !context.expandedSections.includes(event.section),
      }
    }),

    emitSubmit: emit(({ context }) => ({
      type: 'onSubmit' as const,
      query: context.queryField.value,
    })),

    emitReset: emit({ type: 'onReset' as const }),

    emitFocusChange: emit(({ context }) => ({
      type: 'onFocusChange' as const,
      field: context.focusedField,
    })),
  },
  guards: {
    hasQuery: ({ context }) => context.queryField.value.length > 0,
    isValid: ({ context }) => context.validationStatus === 'valid',
    hasSuggestions: ({ context }) => context.suggestions.length > 0,
    canSubmit: ({ context }) =>
      context.queryField.value.length >= 2 &&
      context.validationStatus !== 'invalid',
  },
  actors: {
    fetchSuggestions,
    validateForm,
  },
}).createMachine({
  id: 'searchForm',
  initial: 'idle',
  context: ({ input }) => ({
    queryField: {
      value: input?.initialQuery ?? '',
      touched: false,
      focused: false,
      error: null,
    },
    expandedSections: input?.initialExpandedSections ?? ['sources'],
    focusedField: null,
    validationStatus: 'idle',
    validationErrors: {},
    suggestions: [],
    showSuggestions: false,
    selectedSuggestionIndex: -1,
    isDirty: false,
    animationPhase: 'idle',
    animatingSection: null,
  }),
  states: {
    idle: {
      on: {
        QUERY_CHANGE: {
          actions: ['updateQuery', 'emitQueryChange'],
          target: 'debouncing',
        },
        QUERY_FOCUS: {
          actions: ['focusQuery', 'emitFocusChange'],
        },
        QUERY_BLUR: {
          actions: ['blurQuery', 'emitFocusChange'],
        },
        QUERY_CLEAR: {
          actions: ['clearQuery', 'emitQueryChange'],
        },
        TOGGLE_SECTION: {
          actions: ['toggleSection', 'emitSectionToggle'],
          target: 'animating',
        },
        EXPAND_SECTION: {
          actions: 'expandSection',
          target: 'animating',
        },
        COLLAPSE_SECTION: {
          actions: 'collapseSection',
          target: 'animating',
        },
        COLLAPSE_ALL: {
          actions: 'collapseAll',
          target: 'animating',
        },
        SUGGESTION_SELECT: {
          actions: 'selectSuggestion',
        },
        SUGGESTION_HOVER: {
          actions: 'hoverSuggestion',
        },
        SUGGESTION_KEYBOARD: {
          actions: 'navigateSuggestions',
        },
        SUGGESTIONS_DISMISS: {
          actions: 'dismissSuggestions',
        },
        SUBMIT: {
          guard: 'canSubmit',
          target: 'validating',
        },
        RESET: {
          actions: ['resetForm', 'emitReset'],
        },
      },
    },

    debouncing: {
      after: {
        300: [
          {
            guard: 'hasQuery',
            target: 'fetchingSuggestions',
          },
          {
            target: 'idle',
          },
        ],
      },
      on: {
        QUERY_CHANGE: {
          actions: ['updateQuery', 'emitQueryChange'],
          target: 'debouncing',
          reenter: true,
        },
        QUERY_BLUR: {
          actions: ['blurQuery', 'emitFocusChange'],
          target: 'idle',
        },
        QUERY_CLEAR: {
          actions: ['clearQuery', 'emitQueryChange'],
          target: 'idle',
        },
      },
    },

    fetchingSuggestions: {
      invoke: {
        src: 'fetchSuggestions',
        input: ({ context }) => ({ query: context.queryField.value }),
        onDone: {
          target: 'idle',
          actions: assign({
            suggestions: ({ event }) => event.output,
            showSuggestions: ({ context, event }) =>
              context.queryField.focused && event.output.length > 0,
          }),
        },
        onError: {
          target: 'idle',
        },
      },
      on: {
        QUERY_CHANGE: {
          actions: ['updateQuery', 'emitQueryChange'],
          target: 'debouncing',
        },
        QUERY_BLUR: {
          actions: ['blurQuery', 'emitFocusChange'],
          target: 'idle',
        },
      },
    },

    validating: {
      entry: assign({ validationStatus: 'validating' }),
      invoke: {
        src: 'validateForm',
        input: ({ context }) => ({ query: context.queryField.value }),
        onDone: [
          {
            guard: ({ event }) => Object.keys(event.output).length === 0,
            target: 'submitting',
            actions: assign({ validationStatus: 'valid', validationErrors: {} }),
          },
          {
            target: 'idle',
            actions: 'setValidationErrors',
          },
        ],
        onError: {
          target: 'idle',
          actions: assign({ validationStatus: 'invalid' }),
        },
      },
    },

    submitting: {
      entry: 'emitSubmit',
      always: 'idle',
    },

    animating: {
      after: {
        250: {
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

export type SearchFormMachine = typeof searchFormMachine
export type SearchFormSnapshot = ReturnType<typeof searchFormMachine.getInitialSnapshot>
