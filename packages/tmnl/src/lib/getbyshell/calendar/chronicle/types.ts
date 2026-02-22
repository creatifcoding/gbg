/**
 * Chronicle Modal — State Schemas
 *
 * Effect Schema types for the fullscreen calendar modal lifecycle,
 * side panel navigation, entrance animation phases, and day view modes.
 */

import { Schema } from 'effect'

// ─── Entrance Animation Phases ──────────────────────────────────────────────
// Each phase corresponds to a step in the holographic projection sequence.

export const EntrancePhase = Schema.Literal(
  'idle',       // Modal not open
  'bloom',      // Phosphor burst from origin
  'grid',       // Wireframe grid draws
  'cascade',    // Day cells cascade in
  'panels',     // Side panel + Melanie bar materialize
  'complete',   // All animations settled
)
export type EntrancePhase = typeof EntrancePhase.Type

// ─── Side Panel Tabs ────────────────────────────────────────────────────────

export const SidePanelTab = Schema.Literal(
  'canvas',     // Collaborative editor (default)
  'notes',      // Day notes list
  'cards',      // Morph cards
  'events',     // Calendar events
  'tasks',      // Todo/checklist
  'links',      // Knowledge graph (Melanie's domain)
  'mood',       // Mood / status
)
export type SidePanelTab = typeof SidePanelTab.Type

// ─── Day View Mode ──────────────────────────────────────────────────────────

export const DayViewMode = Schema.Literal(
  'canvas',     // Full collaborative editor canvas
  'timeline',   // Vertical timeline of events + notes
  'list',       // Compact list view
)
export type DayViewMode = typeof DayViewMode.Type

// ─── Month Navigation Direction ─────────────────────────────────────────────

export const NavDirection = Schema.Literal('prev', 'next')
export type NavDirection = typeof NavDirection.Type

// ─── Chronicle Modal State (for atom shape) ─────────────────────────────────

export class ChronicleState extends Schema.TaggedClass<ChronicleState>()('ChronicleState', {
  /** Whether the fullscreen modal is open */
  isOpen: Schema.Boolean,

  /** Current entrance animation phase */
  entrancePhase: EntrancePhase,

  /** Viewed year/month */
  viewYear: Schema.Number,
  viewMonth: Schema.Number,

  /** Currently selected day (if any) */
  selectedDay: Schema.NullOr(Schema.String),

  /** Active side panel tab */
  sidePanelTab: SidePanelTab,

  /** Day view mode */
  dayViewMode: DayViewMode,

  /** Origin coordinates for bloom animation (from clock button) */
  bloomOrigin: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
  }),
}) {
  static initial(): ChronicleState {
    const now = new Date()
    return new ChronicleState({
      isOpen: false,
      entrancePhase: 'idle' as const,
      viewYear: now.getFullYear(),
      viewMonth: now.getMonth(),
      selectedDay: null,
      sidePanelTab: 'canvas' as const,
      dayViewMode: 'canvas' as const,
      bloomOrigin: { x: 24, y: 0 },
    })
  }
}

// ─── Chronicle Open Command ─────────────────────────────────────────────────

export class ChronicleOpenCmd extends Schema.TaggedClass<ChronicleOpenCmd>()('ChronicleOpenCmd', {
  originX: Schema.Number,
  originY: Schema.Number,
}) {}

// ─── Chronicle Navigation Command ───────────────────────────────────────────

export class ChronicleNavCmd extends Schema.TaggedClass<ChronicleNavCmd>()('ChronicleNavCmd', {
  direction: NavDirection,
}) {}
