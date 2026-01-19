/**
 * MorphCard State Schemas
 *
 * Effect Schema definitions for card modes, sizes, and state.
 *
 * @module morph-card/schemas/card-state
 */

import { Schema, Option } from 'effect';

// =============================================================================
// Card Mode
// =============================================================================

/**
 * Card display modes - from minimal to fully detailed
 *
 * - idle: Dormant state, minimal footprint
 * - compact: Condensed view, essential info only
 * - default: Standard display mode
 * - expanded: Additional details visible
 * - detail: Full information display
 */
export const CardMode = Schema.Literal(
  'idle',
  'compact',
  'default',
  'expanded',
  'detail'
);
export type CardMode = Schema.Schema.Type<typeof CardMode>;

// =============================================================================
// Size Preset
// =============================================================================

/**
 * Size preset defining dimensions for a card mode
 */
export const SizePreset = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number,
});
export type SizePreset = Schema.Schema.Type<typeof SizePreset>;

/**
 * Size configuration mapping modes to dimensions
 */
export const SizeConfig = Schema.Record({
  key: CardMode,
  value: SizePreset,
});
export type SizeConfig = Schema.Schema.Type<typeof SizeConfig>;

// =============================================================================
// Card State
// =============================================================================

/**
 * Runtime state for a MorphCard instance
 */
export const CardState = Schema.Struct({
  /** Current display mode */
  mode: CardMode,
  /** Previous mode (for transition context) */
  previousMode: CardMode,
  /** Whether card is hovered */
  isHovered: Schema.Boolean,
  /** Whether card is focused */
  isFocused: Schema.Boolean,
  /** Whether card is loading */
  isLoading: Schema.Boolean,
  /** Whether this card is in generative mode */
  isGenerative: Schema.Boolean,
  /** Optional custom height override */
  customHeight: Schema.OptionFromNullOr(Schema.Number),
  /** Optional custom width override */
  customWidth: Schema.OptionFromNullOr(Schema.Number),
});
export type CardState = Schema.Schema.Type<typeof CardState>;

/**
 * Default card state
 */
export const DEFAULT_CARD_STATE: CardState = {
  mode: 'default',
  previousMode: 'default',
  isHovered: false,
  isFocused: false,
  isLoading: false,
  isGenerative: false,
  customHeight: Option.none(),
  customWidth: Option.none(),
};

// =============================================================================
// Card Identity
// =============================================================================

/**
 * Branded card ID type
 */
export const CardId = Schema.String.pipe(Schema.brand('CardId'));
export type CardId = Schema.Schema.Type<typeof CardId>;

// =============================================================================
// Default Size Presets
// =============================================================================

/**
 * Default size presets for each mode
 */
export const DEFAULT_SIZES: Record<CardMode, SizePreset> = {
  idle: { width: 120, height: 48 },
  compact: { width: 200, height: 64 },
  default: { width: 320, height: 120 },
  expanded: { width: 400, height: 200 },
  detail: { width: 480, height: 320 },
};
