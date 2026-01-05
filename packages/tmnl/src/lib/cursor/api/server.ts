/**
 * Cursor Chat Server
 *
 * Standalone Bun HTTP server for cursor chat functionality.
 * Uses AI SDK 6 + Claude Code Provider with native MCP tool support.
 *
 * Run with: bun run scripts/cursor-server.ts
 *
 * MCP Server Configuration:
 * - Place .mcp.json in project root with server definitions
 * - Claude Code will spawn and manage MCP server processes
 * - Tools are automatically available to the AI
 */

import { Effect, Layer, Schema } from 'effect'
import * as HttpServer from '@effect/platform/HttpServer'
import * as HttpRouter from '@effect/platform/HttpRouter'
import * as HttpServerRequest from '@effect/platform/HttpServerRequest'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import { BunHttpServer, BunContext } from '@effect/platform-bun'
import { streamText } from 'ai'
import { claudeCode } from 'ai-sdk-provider-claude-code'

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const CURSOR_CHAT_PORT = 7682 // Separate from terminal server (7681)

// Project root for Claude Code to find .claude/ and CLAUDE.md
const PROJECT_ROOT = process.cwd()

// -----------------------------------------------------------------------------
// System Prompt for Terminal v3 Agent
// -----------------------------------------------------------------------------

const TERMINAL_SYSTEM_PROMPT = `You are a helpful AI assistant in the TMNL terminal.

You have access to MCP (Model Context Protocol) tools that extend your capabilities.
When you need to use a tool, call it directly. The tools available to you are loaded from the project's MCP configuration.

Available tool categories may include:
- Geospatial tools (geocoding, routing, POI search) via osmmcp
- File system tools (read, write, search)
- And more depending on the project configuration

Be helpful, concise, and use tools when they would help answer the user's question.
When using geospatial tools, provide clear explanations of the data returned.`

// Dynamic Island cursor system prompt (for floating chat panel)
const CURSOR_SYSTEM_PROMPT = `You are a helpful AI assistant embedded in the TMNL application.
You appear as a floating chat panel (Dynamic Island style) that can be positioned anywhere on screen.

POSITION CONTROL (express naturally in your response):
When you want to move, include ONE of these phrases in your response:
- "I'll move to the bottom-right" (default, out of the way)
- "I'll move to the bottom-left" (alternative corner)
- "I'll move to the top-right" (visible but non-intrusive)
- "I'll move to the top-left" (maximum visibility)
- "I'll move to the center" (when you need attention)

VISIBILITY CONTROL:
- Say "I'll minimize now" when you want to collapse to a small pill indicator
- Say "I'll expand" when transitioning to full chat mode

BEHAVIOR:
- Be concise and helpful
- Move proactively when it makes sense (e.g., if user says "get out of the way", move to a corner)
- The client will parse your response and execute the position/visibility commands automatically`

// -----------------------------------------------------------------------------
// Request Schema (AI SDK 5.0+ format: messages use 'parts' instead of 'content')
// -----------------------------------------------------------------------------

const TextPart = Schema.Struct({
  type: Schema.Literal('text'),
  text: Schema.String,
})

const UIMessagePart = Schema.Union(
  TextPart,
  // Add other part types as needed (tool-invocation, file, etc.)
  Schema.Struct({ type: Schema.String }) // Fallback for unknown types
)

const UIMessage = Schema.Struct({
  id: Schema.optional(Schema.String),
  role: Schema.String,
  parts: Schema.Array(UIMessagePart),
  metadata: Schema.optional(Schema.Unknown),
})

/**
 * Mode determines system prompt and tool configuration:
 * - 'terminal': Full tool access for Terminal v3 agent
 * - 'cursor': Dynamic Island floating chat (no tools)
 */
const ChatMode = Schema.Literal('terminal', 'cursor')

const ChatRequestSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  messages: Schema.Array(UIMessage),
  trigger: Schema.optional(Schema.String),
  messageId: Schema.optional(Schema.String),
  /** Chat mode - defaults to 'cursor' for backwards compatibility */
  mode: Schema.optional(ChatMode),
  /** System prompt override */
  systemPrompt: Schema.optional(Schema.String),
})

// Helper to convert AI SDK 5.0+ parts to content string for streamText
function partsToContent(parts: ReadonlyArray<{ type: string; text?: string }>): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
}

// -----------------------------------------------------------------------------
// Chat Handler
// -----------------------------------------------------------------------------

/**
 * Create claudeCode model configured for the given mode.
 *
 * Terminal mode: Full MCP tool access
 * - Loads project MCP config from .mcp.json
 * - Allows all MCP tools plus standard file/bash tools
 *
 * Cursor mode: No tools (natural language only)
 */
function createModel(mode: 'terminal' | 'cursor') {
  if (mode === 'terminal') {
    return claudeCode('sonnet', {
      cwd: PROJECT_ROOT,
      // Load MCP servers from project .mcp.json
      settingSources: ['project'],
      // Allow MCP tools + standard tools
      // Note: Specific tool names come from MCP server definitions
      allowedTools: [
        // MCP tools (loaded from .mcp.json)
        'mcp__OSM__geocode_address',
        'mcp__OSM__reverse_geocode',
        'mcp__OSM__get_route_directions',
        'mcp__OSM__find_nearby_places',
        'mcp__OSM__explore_area',
        'mcp__OSM__analyze_neighborhood',
        'mcp__OSM__find_schools_nearby',
        'mcp__OSM__find_parking_facilities',
        'mcp__OSM__find_charging_stations',
        'mcp__OSM__suggest_meeting_point',
        'mcp__OSM__analyze_commute',
        'mcp__OSM__get_map_image',
        // Standard Claude Code tools
        'Read',
        'Write',
        'Bash',
        'Glob',
        'Grep',
      ],
    })
  }

  // Cursor mode - no tools, just natural language
  return claudeCode('sonnet', {
    cwd: PROJECT_ROOT,
  })
}

const handleChat = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const body = yield* request.json

  // Validate request
  const decoded = yield* Schema.decodeUnknown(ChatRequestSchema)(body).pipe(
    Effect.mapError((e) => new Error(`Invalid request: ${String(e)}`))
  )

  const mode = decoded.mode ?? 'cursor'
  const systemPrompt = decoded.systemPrompt ?? (mode === 'terminal' ? TERMINAL_SYSTEM_PROMPT : CURSOR_SYSTEM_PROMPT)

  yield* Effect.log(`[cursor-chat] Mode: ${mode}, tools: ${mode === 'terminal' ? 'enabled' : 'disabled'}`)

  // Convert AI SDK 5.0+ messages (parts) to streamText format (content)
  const convertedMessages = decoded.messages.map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: partsToContent(msg.parts as Array<{ type: string; text?: string }>),
  }))

  // Call AI SDK with mode-appropriate configuration
  const result = yield* Effect.tryPromise({
    try: async () => {
      const aiResult = streamText({
        model: createModel(mode),
        system: systemPrompt,
        messages: convertedMessages,
      })

      // AI SDK 5.0+: Use toUIMessageStreamResponse() for useChat compatibility
      // This returns a Response with proper SSE formatting
      const response = aiResult.toUIMessageStreamResponse()

      // Add CORS headers to the response
      const headers = new Headers(response.headers)
      headers.set('Access-Control-Allow-Origin', '*')

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    },
    catch: (error) => new Error(`AI SDK error: ${String(error)}`),
  })

  return HttpServerResponse.raw(result)
})

// -----------------------------------------------------------------------------
// CORS Helper
// -----------------------------------------------------------------------------

const withCors = <R extends HttpServerResponse.HttpServerResponse>(response: R): R =>
  response.pipe(
    HttpServerResponse.setHeader('Access-Control-Allow-Origin', '*'),
    HttpServerResponse.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
    HttpServerResponse.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'),
  ) as R

// -----------------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------------

const router = HttpRouter.empty.pipe(
  // Health check
  HttpRouter.get('/health',
    HttpServerResponse.json({ status: 'ok', service: 'cursor-chat' }).pipe(
      Effect.map(withCors)
    )
  ),

  // CORS preflight
  HttpRouter.options('/chat',
    Effect.succeed(withCors(HttpServerResponse.empty()))
  ),

  // Chat endpoint
  HttpRouter.post('/chat', handleChat.pipe(
    Effect.tap(() => Effect.log('[cursor-chat] Request processed')),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[cursor-chat] Error:', error)
        return withCors(HttpServerResponse.unsafeJson({ error: String(error) }, { status: 500 }))
      })
    )
  )),
)

// -----------------------------------------------------------------------------
// Server Layer
// -----------------------------------------------------------------------------

export const CursorChatServerLive = router.pipe(
  HttpServer.serve(),
  HttpServer.withLogAddress,
  Layer.provide(BunHttpServer.layer({ port: CURSOR_CHAT_PORT })),
  Layer.provide(BunContext.layer)
)

// -----------------------------------------------------------------------------
// Runnable Entry Point
// -----------------------------------------------------------------------------

export const runCursorChatServer = Effect.gen(function* () {
  yield* Effect.log(`Cursor Chat Server starting on http://localhost:${CURSOR_CHAT_PORT}`)
  yield* Effect.log('Endpoints:')
  yield* Effect.log('  GET  /health  - Health check')
  yield* Effect.log('  POST /chat    - Chat endpoint (SSE stream)')
  yield* Effect.log('')
  yield* Effect.log('Note: Claude Code CLI must be authenticated (`claude login`)')
})

export { CURSOR_CHAT_PORT }
