/**
 * AI SDK Position Tools
 *
 * Tool definitions for AI-controlled cursor positioning.
 * These tools execute client-side via onToolCall.
 */

import { z } from 'zod'

// -----------------------------------------------------------------------------
// Tool Schemas (Zod for AI SDK)
// -----------------------------------------------------------------------------

export const MoveToSchema = z.object({
  position: z.union([
    z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center']),
    z.object({ x: z.number(), y: z.number() }),
  ]),
  reason: z.string().optional().describe('Why the cursor is moving to this position'),
})

export const MinimizeSchema = z.object({
  reason: z.string().optional().describe('Why the cursor is being minimized'),
})

export const ExpandSchema = z.object({
  reason: z.string().optional().describe('Why the cursor is being expanded'),
})

export const GetBoundsSchema = z.object({})

// -----------------------------------------------------------------------------
// Tool Definitions (for server-side streamText)
// -----------------------------------------------------------------------------

export const positionToolDefinitions = {
  move_to: {
    description: 'Move the chat panel to a corner position or specific coordinates. Use this when the user asks you to move, get out of the way, or when you need to reposition yourself.',
    parameters: MoveToSchema,
  },
  minimize: {
    description: 'Collapse the chat panel to a minimal pill indicator. Use when the user wants you to be less intrusive or when conversation pauses.',
    parameters: MinimizeSchema,
  },
  expand: {
    description: 'Expand the chat panel to full chat mode. Use when starting a conversation or when the user wants to see more content.',
    parameters: ExpandSchema,
  },
  get_bounds: {
    description: 'Get the current content area dimensions. Useful for understanding available space.',
    parameters: GetBoundsSchema,
  },
} as const

// -----------------------------------------------------------------------------
// Tool Types
// -----------------------------------------------------------------------------

export type MoveToArgs = z.infer<typeof MoveToSchema>
export type MinimizeArgs = z.infer<typeof MinimizeSchema>
export type ExpandArgs = z.infer<typeof ExpandSchema>
export type GetBoundsArgs = z.infer<typeof GetBoundsSchema>

export type PositionToolName = keyof typeof positionToolDefinitions
