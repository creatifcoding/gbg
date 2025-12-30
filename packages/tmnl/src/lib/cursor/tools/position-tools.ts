/**
 * AI SDK Position Tools
 *
 * Tool definitions for AI-controlled cursor positioning.
 * Uses Effect.Schema - AI SDK 6+ native support.
 */

import { Schema } from 'effect'

// -----------------------------------------------------------------------------
// Tool Schemas (Effect.Schema for AI SDK)
// -----------------------------------------------------------------------------

const CornerPosition = Schema.Literal(
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
  'center'
)

const CoordinatePosition = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})

export const MoveToParams = Schema.Struct({
  position: Schema.Union(CornerPosition, CoordinatePosition),
  reason: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Why the cursor is moving to this position' })
    )
  ),
})
export type MoveToParams = typeof MoveToParams.Type

export const MinimizeParams = Schema.Struct({
  reason: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Why the cursor is being minimized' })
    )
  ),
})
export type MinimizeParams = typeof MinimizeParams.Type

export const ExpandParams = Schema.Struct({
  reason: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Why the cursor is being expanded' })
    )
  ),
})
export type ExpandParams = typeof ExpandParams.Type

export const GetBoundsParams = Schema.Struct({})
export type GetBoundsParams = typeof GetBoundsParams.Type

// -----------------------------------------------------------------------------
// Tool Definitions (for server-side streamText)
// -----------------------------------------------------------------------------

export const positionToolDefinitions = {
  move_to: {
    description:
      'Move the chat panel to a corner position or specific coordinates. Use this when the user asks you to move, get out of the way, or when you need to reposition yourself.',
    parameters: MoveToParams,
  },
  minimize: {
    description:
      'Collapse the chat panel to a minimal pill indicator. Use when the user wants you to be less intrusive or when conversation pauses.',
    parameters: MinimizeParams,
  },
  expand: {
    description:
      'Expand the chat panel to full chat mode. Use when starting a conversation or when the user wants to see more content.',
    parameters: ExpandParams,
  },
  get_bounds: {
    description:
      'Get the current content area dimensions. Useful for understanding available space.',
    parameters: GetBoundsParams,
  },
} as const

// -----------------------------------------------------------------------------
// Tool Types
// -----------------------------------------------------------------------------

export type PositionToolName = keyof typeof positionToolDefinitions
