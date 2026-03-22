/**
 * Document Navigation State Machine
 *
 * XState machine for 3D docs navigation.
 * Controls view states, camera positioning, and document selection.
 *
 * @module docs-3d/machines
 */

import { setup, assign } from "xstate"

// =============================================================================
// Types
// =============================================================================

export interface DocCard {
  id: string
  title: string
  description: string
  category: "architecture" | "flow" | "sequence" | "state" | "class" | "er" | "guide"
  span: "single" | "double" | "triple"
  route?: string
}

export interface CameraTarget {
  x: number
  y: number
  z: number
}

export interface DocNavContext {
  cards: DocCard[]
  selectedCard: DocCard | null
  searchQuery: string
  viewMode: "2d" | "3d"
  cameraTarget: CameraTarget
  categoryFilter: string | null
}

export type DocNavEvents =
  | { type: "SELECT_CARD"; card: DocCard }
  | { type: "CLOSE_CARD" }
  | { type: "SEARCH"; query: string }
  | { type: "CLEAR_SEARCH" }
  | { type: "TOGGLE_VIEW_MODE" }
  | { type: "ZOOM_IN" }
  | { type: "ZOOM_OUT" }
  | { type: "FILTER_CATEGORY"; category: string | null }
  | { type: "SET_CARDS"; cards: DocCard[] }

// =============================================================================
// Initial Context
// =============================================================================

const initialContext: DocNavContext = {
  cards: [],
  selectedCard: null,
  searchQuery: "",
  viewMode: "3d",
  cameraTarget: { x: 0, y: 0, z: 10 },
  categoryFilter: null,
}

// =============================================================================
// Machine Definition
// =============================================================================

export const docNavigationMachine = setup({
  types: {
    context: {} as DocNavContext,
    events: {} as DocNavEvents,
  },
  actions: {
    selectCard: assign({
      selectedCard: ({ event }) => {
        if (event.type !== "SELECT_CARD") return null
        return event.card
      },
      cameraTarget: { x: 0, y: 0, z: 3 },
    }),
    clearSelection: assign({
      selectedCard: null,
      cameraTarget: { x: 0, y: 0, z: 10 },
    }),
    setSearchQuery: assign({
      searchQuery: ({ event }) => {
        if (event.type !== "SEARCH") return ""
        return event.query
      },
    }),
    clearSearch: assign({
      searchQuery: "",
    }),
    toggleViewMode: assign({
      viewMode: ({ context }) => (context.viewMode === "2d" ? "3d" : "2d"),
    }),
    zoomIn: assign({
      cameraTarget: ({ context }) => ({
        ...context.cameraTarget,
        z: Math.max(context.cameraTarget.z - 2, 2),
      }),
    }),
    zoomOut: assign({
      cameraTarget: ({ context }) => ({
        ...context.cameraTarget,
        z: Math.min(context.cameraTarget.z + 2, 20),
      }),
    }),
    setFilter: assign({
      categoryFilter: ({ event }) => {
        if (event.type !== "FILTER_CATEGORY") return null
        return event.category
      },
    }),
    setCards: assign({
      cards: ({ event }) => {
        if (event.type !== "SET_CARDS") return []
        return event.cards
      },
    }),
  },
  guards: {
    hasSelectedCard: ({ context }) => context.selectedCard !== null,
    hasSearchQuery: ({ context }) => context.searchQuery.length > 0,
  },
}).createMachine({
  id: "docNavigation",
  initial: "grid",
  context: initialContext,
  on: {
    SET_CARDS: {
      actions: "setCards",
    },
    TOGGLE_VIEW_MODE: {
      actions: "toggleViewMode",
    },
    FILTER_CATEGORY: {
      actions: "setFilter",
    },
  },
  states: {
    grid: {
      on: {
        SELECT_CARD: {
          target: "focused",
          actions: "selectCard",
        },
        SEARCH: {
          target: "searching",
          actions: "setSearchQuery",
        },
        ZOOM_IN: {
          actions: "zoomIn",
        },
        ZOOM_OUT: {
          actions: "zoomOut",
        },
      },
    },
    focused: {
      on: {
        CLOSE_CARD: {
          target: "grid",
          actions: "clearSelection",
        },
        ZOOM_IN: {
          actions: "zoomIn",
        },
        ZOOM_OUT: {
          actions: "zoomOut",
        },
      },
    },
    searching: {
      on: {
        SEARCH: {
          actions: "setSearchQuery",
        },
        CLEAR_SEARCH: {
          target: "grid",
          actions: "clearSearch",
        },
        SELECT_CARD: {
          target: "focused",
          actions: ["selectCard", "clearSearch"],
        },
      },
    },
  },
})

// =============================================================================
// Selectors
// =============================================================================

/**
 * Filter cards based on current search query and category filter
 */
export function selectFilteredCards(context: DocNavContext): DocCard[] {
  let filtered = context.cards

  // Category filter
  if (context.categoryFilter) {
    filtered = filtered.filter((card) => card.category === context.categoryFilter)
  }

  // Search filter
  if (context.searchQuery) {
    const query = context.searchQuery.toLowerCase()
    filtered = filtered.filter(
      (card) =>
        card.title.toLowerCase().includes(query) ||
        card.description.toLowerCase().includes(query) ||
        card.category.toLowerCase().includes(query)
    )
  }

  return filtered
}

/**
 * Get unique categories from cards
 */
export function selectCategories(context: DocNavContext): string[] {
  const categories = new Set(context.cards.map((card) => card.category))
  return Array.from(categories).sort()
}
