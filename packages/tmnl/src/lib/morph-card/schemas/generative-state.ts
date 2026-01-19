/**
 * Generative State Schemas
 *
 * Effect Schema definitions for AI-generated card content.
 * Enables lazy generation with per-mode caching and Result pattern for error handling.
 *
 * @module morph-card/schemas/generative-state
 */

import { Schema, Option } from 'effect';
import { CardMode } from './card-state';

// =============================================================================
// Generation Status
// =============================================================================

/**
 * Generation status for a single mode
 */
export const GenerationStatus = Schema.Literal(
  'idle',      // Not yet requested
  'loading',   // Generation in progress
  'streaming', // Receiving progressive content
  'success',   // Completed successfully
  'error'      // Generation failed
);
export type GenerationStatus = Schema.Schema.Type<typeof GenerationStatus>;

// =============================================================================
// Generated Content
// =============================================================================

/**
 * Generated content for a mode (UITree structure)
 */
export const GeneratedContent = Schema.Struct({
  /** The UITree root element key */
  root: Schema.NullOr(Schema.String),
  /** Elements map from GenerativeContainer */
  elements: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  /** When this was generated (timestamp) */
  generatedAt: Schema.Number,
});
export type GeneratedContent = Schema.Schema.Type<typeof GeneratedContent>;

// =============================================================================
// Per-Mode Generation State
// =============================================================================

/**
 * Per-mode generation state (Result pattern)
 *
 * Each mode has its own loading/error/content state, enabling:
 * - Independent retry per mode
 * - Lazy generation on first visit
 * - Cache hit on subsequent visits
 */
export const ModeGenerationState = Schema.Struct({
  /** Current generation status */
  status: GenerationStatus,
  /** Generated content (Option.some when available) */
  content: Schema.OptionFromNullOr(GeneratedContent),
  /** Error message (Option.some when failed) */
  error: Schema.OptionFromNullOr(Schema.String),
  /** Progress for streaming (0-1) */
  progress: Schema.Number,
});
export type ModeGenerationState = Schema.Schema.Type<typeof ModeGenerationState>;

/**
 * Default state for a mode that hasn't been generated
 */
export const DEFAULT_MODE_GENERATION: ModeGenerationState = {
  status: 'idle',
  content: Option.none(),
  error: Option.none(),
  progress: 0,
};

// =============================================================================
// Full Generative Card State
// =============================================================================

/**
 * Full generative state for a card (all modes)
 *
 * Contains:
 * - Global enable flag
 * - Prompt template (supports {{mode}} interpolation)
 * - Per-mode generation state (lazy cache)
 * - Optional API endpoint override
 */
export const GenerativeCardState = Schema.Struct({
  /** Whether generative mode is enabled */
  enabled: Schema.Boolean,
  /** Prompt template (can use {{mode}} interpolation) */
  prompt: Schema.String,
  /** Additional context for generation */
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  /** Per-mode generation state (lazy cache) */
  modes: Schema.Record({ key: CardMode, value: ModeGenerationState }),
  /** API endpoint override */
  api: Schema.optional(Schema.String),
});
export type GenerativeCardState = Schema.Schema.Type<typeof GenerativeCardState>;

/**
 * Default generative card state (disabled)
 */
export const DEFAULT_GENERATIVE_STATE: GenerativeCardState = {
  enabled: false,
  prompt: '',
  context: undefined,
  modes: {
    idle: { ...DEFAULT_MODE_GENERATION },
    compact: { ...DEFAULT_MODE_GENERATION },
    default: { ...DEFAULT_MODE_GENERATION },
    expanded: { ...DEFAULT_MODE_GENERATION },
    detail: { ...DEFAULT_MODE_GENERATION },
  },
  api: undefined,
};
