/**
 * Chat Handler for Vite Dev Server
 *
 * Handles AI chat requests using AI SDK 6 + Claude Code Provider.
 * Position tools are defined server-side but executed client-side
 * via onToolCall in useChat.
 *
 * Uses Effect.Schema - AI SDK 6+ native support.
 */

import { streamText, tool } from 'ai'
import { claudeCode } from 'ai-sdk-provider-claude-code'
import { Schema } from 'effect'
import type { IncomingMessage, ServerResponse } from 'http'

// -----------------------------------------------------------------------------
// Tool Schemas (Effect.Schema)
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

const MoveToParams = Schema.Struct({
  position: Schema.Union(CornerPosition, CoordinatePosition),
  reason: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Why the cursor is moving to this position' })
    )
  ),
})

const MinimizeParams = Schema.Struct({
  reason: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Why the cursor is being minimized' })
    )
  ),
})

const ExpandParams = Schema.Struct({
  reason: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Why the cursor is being expanded' })
    )
  ),
})

// -----------------------------------------------------------------------------
// Tool Definitions
// -----------------------------------------------------------------------------

const positionTools = {
  move_to: tool({
    description:
      'Move the chat panel to a corner position or specific coordinates. Use this when the user asks you to move, get out of the way, or when you need to reposition yourself.',
    parameters: MoveToParams,
    execute: async ({ position, reason }) => {
      // Tool result returned to AI - actual movement handled client-side via onToolCall
      return { moved: true, position, reason }
    },
  }),

  minimize: tool({
    description:
      'Collapse the chat panel to a minimal pill indicator. Use when the user wants you to be less intrusive.',
    parameters: MinimizeParams,
    execute: async ({ reason }) => ({ minimized: true, reason }),
  }),

  expand: tool({
    description:
      'Expand the chat panel to full chat mode. Use when starting a conversation.',
    parameters: ExpandParams,
    execute: async ({ reason }) => ({ expanded: true, reason }),
  }),

  get_bounds: tool({
    description: 'Get the current content area dimensions.',
    parameters: Schema.Struct({}),
    execute: async () => {
      // Actual bounds come from client-side state via onToolCall
      return { width: 0, height: 0, note: 'Bounds provided by client' }
    },
  }),
}

// -----------------------------------------------------------------------------
// System Prompt
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a helpful AI assistant embedded in the TMNL application.
You appear as a floating chat panel (Dynamic Island style) that can be positioned anywhere on screen.

When the user asks you to move, get out of the way, or mentions position, use the move_to tool.
When conversation pauses or user wants less intrusion, use the minimize tool.
When user wants to chat more, use the expand tool.

Position presets:
- 'bottom-right' (default) - Out of the way, good for passive monitoring
- 'bottom-left' - Alternative corner
- 'top-right' - Visible but non-intrusive
- 'top-left' - Maximum visibility
- 'center' - When you need attention

Be concise. Be helpful. Move proactively when it makes sense.`

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

interface ChatRequest {
  messages: Array<{ role: string; content: string }>
  bounds?: { width: number; height: number }
}

export async function handleChatRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // Parse request body
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const body = Buffer.concat(chunks).toString('utf-8')

  let request: ChatRequest
  try {
    request = JSON.parse(body)
  } catch {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }

  try {
    const result = streamText({
      model: claudeCode('sonnet'),
      system: SYSTEM_PROMPT,
      messages: request.messages as Parameters<typeof streamText>[0]['messages'],
      tools: positionTools,
      maxSteps: 5, // Allow multiple tool calls per turn
    })

    // Stream response as SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const stream = result.toDataStream()
    const reader = stream.getReader()

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          res.end()
          break
        }
        res.write(value)
      }
    }

    await pump()
  } catch (error) {
    console.error('[cursor/chat] Error:', error)
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'Chat request failed' }))
  }
}
