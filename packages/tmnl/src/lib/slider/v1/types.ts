/**
 * TMNL Slider System - Core Types
 *
 * A DAW-grade slider system with runtime-swappable behaviors,
 * precision modifiers, and debug overlay support.
 */

// =============================================================================
// MODIFIER KEYS
// =============================================================================

export interface ModifierKeys {
  readonly shift: boolean // Fine control (0.1x)
  readonly ctrl: boolean // Ultra-fine (0.01x)
  readonly alt: boolean // Snap to grid
  readonly meta: boolean // Reserved for future use
}

export const DEFAULT_MODIFIERS: ModifierKeys = {
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
}

// =============================================================================
// SLIDER STATE
// =============================================================================

export interface SliderState {
  // Current value
  readonly value: number
  readonly normalizedValue: number // 0-1 for rendering

  // Interaction state
  readonly isDragging: boolean
  readonly isFocused: boolean
  readonly isEditing: boolean // Text input mode
  readonly isHovered: boolean

  // Drag tracking
  readonly dragStartValue: number | null
  readonly dragStartY: number | null
  readonly dragStartX: number | null

  // Active modifiers
  readonly modifiers: ModifierKeys

  // Computed sensitivity
  readonly activeSensitivity: number
}

export const initialSliderState = (value: number, min: number, max: number): SliderState => ({
  value,
  normalizedValue: (value - min) / (max - min),
  isDragging: false,
  isFocused: false,
  isEditing: false,
  isHovered: false,
  dragStartValue: null,
  dragStartY: null,
  dragStartX: null,
  modifiers: DEFAULT_MODIFIERS,
  activeSensitivity: 1,
})

// =============================================================================
// SLIDER CONFIGURATION
// =============================================================================

export interface SliderConfig {
  // Range
  readonly min: number
  readonly max: number
  readonly defaultValue: number

  // Step (null = continuous)
  readonly step: number | null

  // Orientation
  readonly orientation: 'horizontal' | 'vertical'

  // Sensitivity multipliers
  readonly baseSensitivity: number
  readonly shiftSensitivity: number // Fine
  readonly ctrlSensitivity: number // Ultra-fine
  readonly altSnap: boolean // Snap to step when alt pressed

  // Display
  readonly precision: number // Decimal places
  readonly unit: string // e.g., "Hz", "dB", "%"
  readonly showValue: boolean
  readonly showTicks: boolean
  readonly tickCount: number

  // Interaction
  readonly doubleClickReset: boolean
  readonly wheelEnabled: boolean
  readonly keyboardEnabled: boolean

  // Debug
  readonly debugMode: boolean
}

export const DEFAULT_SLIDER_CONFIG: SliderConfig = {
  min: 0,
  max: 100,
  defaultValue: 50,
  step: null,
  orientation: 'horizontal',
  baseSensitivity: 1,
  shiftSensitivity: 0.1,
  ctrlSensitivity: 0.01,
  altSnap: true,
  precision: 1,
  unit: '',
  showValue: true,
  showTicks: false,
  tickCount: 5,
  doubleClickReset: true,
  wheelEnabled: true,
  keyboardEnabled: true,
  debugMode: false,
}

// =============================================================================
// BEHAVIOR INTERFACE
// =============================================================================

/**
 * SliderBehavior defines how values are transformed and displayed.
 * This is the injectable service that can be swapped at runtime.
 */
export interface SliderBehaviorShape {
  /** Behavior identifier for debugging */
  readonly id: string
  readonly name: string

  /** Convert raw value (min-max) to normalized (0-1) */
  normalize(value: number, min: number, max: number): number

  /** Convert normalized (0-1) to raw value (min-max) */
  denormalize(normalized: number, min: number, max: number): number

  /** Get sensitivity multiplier based on active modifiers */
  getSensitivity(modifiers: ModifierKeys, config: SliderConfig): number

  /** Snap value to nearest valid position */
  snap(value: number, step: number | null, min: number, max: number): number

  /** Format value for display */
  format(value: number, precision: number, unit: string): string

  /** Get tick values for visualization */
  getTicks(min: number, max: number, count: number): number[]
}

// =============================================================================
// SLIDER EVENTS
// =============================================================================

export type SliderEvent =
  | { type: 'SET_VALUE'; value: number }
  | { type: 'SET_NORMALIZED'; normalized: number }
  | { type: 'INCREMENT'; amount?: number }
  | { type: 'DECREMENT'; amount?: number }
  | { type: 'RESET' }
  | { type: 'DRAG_START'; x: number; y: number }
  | { type: 'DRAG_MOVE'; x: number; y: number }
  | { type: 'DRAG_END' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'HOVER_START' }
  | { type: 'HOVER_END' }
  | { type: 'EDIT_START' }
  | { type: 'EDIT_END'; value?: number }
  | { type: 'MODIFIER_CHANGE'; modifiers: Partial<ModifierKeys> }

// =============================================================================
// DEBUG OVERLAY TYPES
// =============================================================================

export interface SliderDebugInfo {
  // Identity
  readonly behaviorId: string
  readonly behaviorName: string

  // Values
  readonly rawValue: number
  readonly normalizedValue: number
  readonly displayValue: string

  // Range
  readonly min: number
  readonly max: number
  readonly step: number | null

  // State
  readonly isDragging: boolean
  readonly isFocused: boolean
  readonly isEditing: boolean

  // Sensitivity
  readonly baseSensitivity: number
  readonly activeSensitivity: number
  readonly activeModifiers: string[]

  // Timing
  readonly lastUpdateMs: number
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface SliderProps {
  // Value control
  value: number
  onChange: (value: number) => void
  onChangeEnd?: (value: number) => void // Called on drag end

  // Configuration (partial, merged with defaults)
  config?: Partial<SliderConfig>

  // Styling
  className?: string
  trackClassName?: string
  thumbClassName?: string
  valueClassName?: string

  // Debug
  debug?: boolean

  // Accessibility
  ariaLabel?: string
  ariaValueText?: string
}

export interface SliderTrackProps {
  normalizedValue: number
  orientation: 'horizontal' | 'vertical'
  className?: string
  ticks?: number[]
  showTicks?: boolean
}

export interface SliderThumbProps {
  normalizedValue: number
  orientation: 'horizontal' | 'vertical'
  isDragging: boolean
  isFocused: boolean
  className?: string
  onDragStart: (e: React.PointerEvent) => void
}

export interface SliderValueProps {
  value: number
  displayValue: string
  isEditing: boolean
  onEditStart: () => void
  onEditEnd: (value?: number) => void
  className?: string
}
