/**
 * Chart Styler Errors
 *
 * Data.TaggedError classes for typed error handling in Effect services.
 *
 * @module charts/styler/errors
 */

import { Data } from 'effect';

// =============================================================================
// Input Errors
// =============================================================================

/**
 * Error for invalid styler input.
 */
export class StylerInputError extends Data.TaggedError('StylerInputError')<{
  readonly message: string;
  readonly field?: string;
}> {}

// =============================================================================
// Processing Errors
// =============================================================================

/**
 * Error when LLM-based styling fails.
 */
export class StylerLLMError extends Data.TaggedError('StylerLLMError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when no suitable style can be found.
 */
export class NoStyleMatchError extends Data.TaggedError('NoStyleMatchError')<{
  readonly message: string;
  readonly chartType: string;
  readonly intent?: string;
}> {}

/**
 * Error for palette generation failures.
 */
export class PaletteGenerationError extends Data.TaggedError('PaletteGenerationError')<{
  readonly message: string;
  readonly requestedCount?: number;
}> {}

/**
 * Error for animation configuration failures.
 */
export class AnimationConfigError extends Data.TaggedError('AnimationConfigError')<{
  readonly message: string;
  readonly chartType?: string;
}> {}

// =============================================================================
// Union Type
// =============================================================================

/**
 * Union of all styler errors for exhaustive matching.
 */
export type StylerError =
  | StylerInputError
  | StylerLLMError
  | NoStyleMatchError
  | PaletteGenerationError
  | AnimationConfigError;
