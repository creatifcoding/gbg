/**
 * Grid Behavior Schema
 *
 * Behavioral configuration for GridVariant.
 * Variants can influence behavior, not just appearance.
 */

import { Schema } from 'effect'

// =============================================================================
// SELECTION MODE
// =============================================================================

export const SelectionMode = Schema.Literal('single', 'multiple', 'none')
export type SelectionMode = typeof SelectionMode.Type

// =============================================================================
// HOVER MODE
// =============================================================================

export const HoverMode = Schema.Literal('row', 'cell', 'none')
export type HoverMode = typeof HoverMode.Type

// =============================================================================
// FOCUS MODE
// =============================================================================

export const FocusMode = Schema.Literal('cell', 'row', 'none')
export type FocusMode = typeof FocusMode.Type

// =============================================================================
// EDIT TRIGGER
// =============================================================================

export const EditTrigger = Schema.Literal('click', 'doubleClick', 'enter', 'none')
export type EditTrigger = typeof EditTrigger.Type

// =============================================================================
// KEYBOARD NAV MODE
// =============================================================================

export const KeyboardNavMode = Schema.Literal('standard', 'vim', 'none')
export type KeyboardNavMode = typeof KeyboardNavMode.Type

// =============================================================================
// MICRO INTERACTIONS
// =============================================================================

export const MicroInteractions = Schema.Struct({
  /** Row hover effect */
  hoverRow: Schema.Literal('none', 'subtleFill', 'underline', 'glow'),
  /** Selected row effect */
  selectedRow: Schema.Literal('none', 'fill', 'invert', 'leftAccent'),
  /** Focus outline style */
  focusOutline: Schema.Literal('none', 'subtle', 'strong', 'accent'),
  /** Animate row reordering */
  animateRows: Schema.Boolean,
  /** Enable cell flash on value change */
  enableCellFlash: Schema.Boolean,
  /** Flash duration multiplier (1.0 = default, 0.5 = faster, 2.0 = slower) */
  flashDurationScale: Schema.optional(Schema.Number),
  /** Selected row transition duration in ms */
  selectedRowTransitionMs: Schema.optional(Schema.Number),
})
export type MicroInteractions = typeof MicroInteractions.Type

// =============================================================================
// RESIZE BEHAVIOR
// =============================================================================

export const ResizeBehavior = Schema.Struct({
  /** Enable column resizing */
  enableColumnResize: Schema.Boolean,
  /** Enable row height resize */
  enableRowResize: Schema.optional(Schema.Boolean),
  /** Minimum column width */
  minColumnWidth: Schema.optional(Schema.Number),
  /** Maximum column width */
  maxColumnWidth: Schema.optional(Schema.Number),
})
export type ResizeBehavior = typeof ResizeBehavior.Type

// =============================================================================
// SORT BEHAVIOR
// =============================================================================

export const SortBehavior = Schema.Struct({
  /** Enable sorting */
  enabled: Schema.Boolean,
  /** Allow multi-column sort */
  multiSort: Schema.optional(Schema.Boolean),
  /** Show sort indicators */
  showIndicators: Schema.optional(Schema.Boolean),
})
export type SortBehavior = typeof SortBehavior.Type

// =============================================================================
// DRAG BEHAVIOR
// =============================================================================

export const DragBehavior = Schema.Struct({
  /** Enable row dragging */
  enableRowDrag: Schema.Boolean,
  /** Enable external drop (drag to canvas) */
  enableExternalDrop: Schema.optional(Schema.Boolean),
  /** Enable internal reordering */
  enableReorder: Schema.optional(Schema.Boolean),
})
export type DragBehavior = typeof DragBehavior.Type

// =============================================================================
// COMPLETE BEHAVIOR CONFIG
// =============================================================================

export const BehaviorConfig = Schema.Struct({
  selection: SelectionMode,
  hover: HoverMode,
  focus: FocusMode,
  editTrigger: EditTrigger,
  keyboardNav: KeyboardNavMode,
  microInteractions: MicroInteractions,
  resize: ResizeBehavior,
  sort: SortBehavior,
  drag: DragBehavior,
})
export type BehaviorConfig = typeof BehaviorConfig.Type

// =============================================================================
// BEHAVIOR PRESETS
// =============================================================================

export const BEHAVIOR_PRESETS = {
  /** Standard interactive grid */
  interactive: {
    selection: 'single',
    hover: 'row',
    focus: 'cell',
    editTrigger: 'doubleClick',
    keyboardNav: 'standard',
    microInteractions: {
      hoverRow: 'subtleFill',
      selectedRow: 'fill',
      focusOutline: 'subtle',
      animateRows: true,
      enableCellFlash: true,
    },
    resize: { enableColumnResize: true },
    sort: { enabled: true },
    drag: { enableRowDrag: true },
  },

  /** Read-only monitoring view */
  monitor: {
    selection: 'none',
    hover: 'row',
    focus: 'none',
    editTrigger: 'none',
    keyboardNav: 'none',
    microInteractions: {
      hoverRow: 'subtleFill',
      selectedRow: 'none',
      focusOutline: 'none',
      animateRows: false,
      enableCellFlash: true,
      flashDurationScale: 0.5,
    },
    resize: { enableColumnResize: false },
    sort: { enabled: false },
    drag: { enableRowDrag: false },
  },

  /** Keyboard-focused operator console */
  operator: {
    selection: 'single',
    hover: 'none',
    focus: 'cell',
    editTrigger: 'enter',
    keyboardNav: 'vim',
    microInteractions: {
      hoverRow: 'none',
      selectedRow: 'fill',
      focusOutline: 'strong',
      animateRows: false,
      enableCellFlash: true,
    },
    resize: { enableColumnResize: false },
    sort: { enabled: true },
    drag: { enableRowDrag: false },
  },

  /** Presentation mode */
  presentation: {
    selection: 'none',
    hover: 'none',
    focus: 'none',
    editTrigger: 'none',
    keyboardNav: 'none',
    microInteractions: {
      hoverRow: 'none',
      selectedRow: 'none',
      focusOutline: 'none',
      animateRows: false,
      enableCellFlash: false,
    },
    resize: { enableColumnResize: false },
    sort: { enabled: false },
    drag: { enableRowDrag: false },
  },

  /** RVN Brutalist - high contrast invert selection */
  rvnBrutalist: {
    selection: 'single',
    hover: 'row',
    focus: 'cell',
    editTrigger: 'doubleClick',
    keyboardNav: 'standard',
    microInteractions: {
      hoverRow: 'subtleFill',
      selectedRow: 'invert',
      focusOutline: 'strong',
      animateRows: false,
      enableCellFlash: true,
      selectedRowTransitionMs: 100,
    },
    resize: { enableColumnResize: true },
    sort: { enabled: true },
    drag: { enableRowDrag: true },
  },
} as const satisfies Record<string, BehaviorConfig>

export type BehaviorPreset = keyof typeof BEHAVIOR_PRESETS
