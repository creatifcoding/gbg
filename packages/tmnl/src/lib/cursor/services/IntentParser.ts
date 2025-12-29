/**
 * IntentParser Service
 *
 * Detects position intent from AI response text.
 * Enables semantic repositioning when AI says things like:
 * - "Let me move out of your way"
 * - "I'll position myself in the corner"
 * - "Moving to the top-right"
 */

import { Effect, Layer, Context } from 'effect'
import * as Option from 'effect/Option'
import type { CornerPreset } from '../schemas/position'

// -----------------------------------------------------------------------------
// Intent Patterns
// -----------------------------------------------------------------------------

interface MovePattern {
  readonly pattern: RegExp
  readonly corner: CornerPreset
}

/**
 * Patterns that indicate AI wants to move to a specific position.
 * Order matters — more specific patterns should come first.
 */
const MOVE_PATTERNS: ReadonlyArray<MovePattern> = [
  // Explicit corner mentions
  { pattern: /top[\s-]?left/i, corner: 'top-left' },
  { pattern: /top[\s-]?right/i, corner: 'top-right' },
  { pattern: /bottom[\s-]?left/i, corner: 'bottom-left' },
  { pattern: /bottom[\s-]?right/i, corner: 'bottom-right' },
  { pattern: /\bcenter\b|\bmiddle\b/i, corner: 'center' },

  // Semantic phrases → default to bottom-right (out of the way)
  { pattern: /(?:move|get|step)\s+(?:out\s+of\s+)?(?:your|the)\s+way/i, corner: 'bottom-right' },
  { pattern: /moving\s+(?:aside|over|away)/i, corner: 'bottom-right' },
  { pattern: /move\s+(?:to\s+the\s+)?(?:side|corner)/i, corner: 'bottom-right' },
  { pattern: /let\s+me\s+(?:get\s+)?out\s+of\s+(?:your\s+)?way/i, corner: 'bottom-right' },
  { pattern: /stepping\s+aside/i, corner: 'bottom-right' },

  // Position to specific sides (without corner specified)
  { pattern: /(?:move|position|place)\s+(?:myself\s+)?(?:to\s+)?the\s+left/i, corner: 'bottom-left' },
  { pattern: /(?:move|position|place)\s+(?:myself\s+)?(?:to\s+)?the\s+right/i, corner: 'bottom-right' },
  { pattern: /(?:move|position|place)\s+(?:myself\s+)?(?:to\s+)?the\s+top/i, corner: 'top-right' },
  { pattern: /(?:move|position|place)\s+(?:myself\s+)?(?:to\s+)?the\s+bottom/i, corner: 'bottom-right' },
]

/**
 * Patterns that indicate AI wants to collapse/minimize
 */
const MINIMIZE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bminimiz(?:e|ing)\b/i,
  /\bcollaps(?:e|ing)\b/i,
  /\bget\s+(?:out\s+of\s+)?(?:the\s+)?way\s+(?:for\s+now|temporarily)\b/i,
  /\bhide\s+(?:for\s+now|temporarily)\b/i,
  /\bstep\s+back\b/i,
]

/**
 * Patterns that indicate AI wants to expand/show
 */
const EXPAND_PATTERNS: ReadonlyArray<RegExp> = [
  /\bexpand(?:ing)?\b/i,
  /\bshow(?:ing)?\s+(?:myself|more)\b/i,
  /\bopen(?:ing)?\s+(?:up|chat)\b/i,
  /\blet\s+me\s+show\s+you\b/i,
]

// -----------------------------------------------------------------------------
// Intent Types
// -----------------------------------------------------------------------------

export type PositionIntent = {
  readonly _tag: 'move'
  readonly corner: CornerPreset
}

export type VisibilityIntent = {
  readonly _tag: 'minimize' | 'expand'
}

export type Intent = PositionIntent | VisibilityIntent

// -----------------------------------------------------------------------------
// Service Interface
// -----------------------------------------------------------------------------

export interface IntentParserShape {
  /**
   * Parse text for position intent (move to corner)
   */
  readonly parsePositionIntent: (text: string) => Option.Option<PositionIntent>

  /**
   * Parse text for visibility intent (minimize/expand)
   */
  readonly parseVisibilityIntent: (text: string) => Option.Option<VisibilityIntent>

  /**
   * Parse text for any intent
   */
  readonly parseIntent: (text: string) => Option.Option<Intent>
}

// -----------------------------------------------------------------------------
// Service Tag
// -----------------------------------------------------------------------------

export class IntentParser extends Context.Tag('tmnl/cursor/IntentParser')<
  IntentParser,
  IntentParserShape
>() {}

// -----------------------------------------------------------------------------
// Implementation
// -----------------------------------------------------------------------------

const intentParserImpl: IntentParserShape = {
  parsePositionIntent: (text: string): Option.Option<PositionIntent> => {
    for (const { pattern, corner } of MOVE_PATTERNS) {
      if (pattern.test(text)) {
        return Option.some({ _tag: 'move', corner })
      }
    }
    return Option.none()
  },

  parseVisibilityIntent: (text: string): Option.Option<VisibilityIntent> => {
    // Check minimize patterns first
    for (const pattern of MINIMIZE_PATTERNS) {
      if (pattern.test(text)) {
        return Option.some({ _tag: 'minimize' })
      }
    }

    // Then check expand patterns
    for (const pattern of EXPAND_PATTERNS) {
      if (pattern.test(text)) {
        return Option.some({ _tag: 'expand' })
      }
    }

    return Option.none()
  },

  parseIntent: (text: string): Option.Option<Intent> => {
    // Position intent takes precedence
    const positionIntent = intentParserImpl.parsePositionIntent(text)
    if (Option.isSome(positionIntent)) {
      return positionIntent
    }

    // Then visibility intent
    return intentParserImpl.parseVisibilityIntent(text)
  },
}

// -----------------------------------------------------------------------------
// Layer
// -----------------------------------------------------------------------------

export const IntentParserLive = Layer.succeed(IntentParser, intentParserImpl)

export const IntentParserDefault = IntentParserLive

// -----------------------------------------------------------------------------
// Utility Functions (for direct use without Effect runtime)
// -----------------------------------------------------------------------------

/**
 * Direct function to parse position intent (no Effect runtime needed)
 */
export function parsePositionIntent(text: string): Option.Option<PositionIntent> {
  return intentParserImpl.parsePositionIntent(text)
}

/**
 * Direct function to parse any intent (no Effect runtime needed)
 */
export function parseIntent(text: string): Option.Option<Intent> {
  return intentParserImpl.parseIntent(text)
}
