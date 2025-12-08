/**
 * Grid Schemas
 *
 * Effect Schema definitions for the data-grid abstraction layer.
 */

// Density
export {
  DensityTier,
  DensityConfig,
  DENSITY_PRESETS,
  getDensityConfig,
} from './density'
export type { DensityTier as DensityTierType, DensityConfig as DensityConfigType } from './density'

// Column Intent
export {
  ColumnIntent,
  ColumnIntentMeta,
  INTENT_DEFAULTS,
  getIntentDefaults,
} from './column-intent'
export type { ColumnIntent as ColumnIntentType, ColumnIntentMeta as ColumnIntentMetaType } from './column-intent'

// Color Semantics
export {
  HexColor,
  RgbaColor,
  CssColor,
  BackgroundColors,
  TextColors,
  SignalColors,
  BorderColors,
  FlashColors,
  ColorSemantics,
} from './color-semantics'
export type {
  HexColor as HexColorType,
  CssColor as CssColorType,
  BackgroundColors as BackgroundColorsType,
  TextColors as TextColorsType,
  SignalColors as SignalColorsType,
  BorderColors as BorderColorsType,
  FlashColors as FlashColorsType,
  ColorSemantics as ColorSemanticsType,
} from './color-semantics'

// Behavior
export {
  SelectionMode,
  HoverMode,
  FocusMode,
  EditTrigger,
  KeyboardNavMode,
  MicroInteractions,
  ResizeBehavior,
  SortBehavior,
  DragBehavior,
  BehaviorConfig,
  BEHAVIOR_PRESETS,
} from './behavior'
export type {
  SelectionMode as SelectionModeType,
  HoverMode as HoverModeType,
  FocusMode as FocusModeType,
  EditTrigger as EditTriggerType,
  KeyboardNavMode as KeyboardNavModeType,
  MicroInteractions as MicroInteractionsType,
  BehaviorConfig as BehaviorConfigType,
  BehaviorPreset,
} from './behavior'

// Variant
export {
  VariantId,
  TypographyConfig,
  IntentOverrides,
  GridVariant,
  GridVariantPartial,
} from './variant'
export type {
  VariantId as VariantIdType,
  TypographyConfig as TypographyConfigType,
  IntentOverrides as IntentOverridesType,
  GridVariant as GridVariantType,
  GridVariantPartial as GridVariantPartialType,
} from './variant'
