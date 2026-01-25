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

import { Effect, Layer, Schema } from 'effect';
import { type ComponentDoc } from '@/lib/json-render/server/catalogs';
import { buildUIGenerationPrompt } from '@/lib/cursor/prompts/ui-generation';
import * as HttpServer from '@effect/platform/HttpServer';
import * as HttpRouter from '@effect/platform/HttpRouter';
import * as HttpServerRequest from '@effect/platform/HttpServerRequest';
import * as HttpServerResponse from '@effect/platform/HttpServerResponse';
import { BunHttpServer, BunContext } from '@effect/platform-bun';
import { streamText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import {
  streamChartStyleAgent,
  ChartStylerAgentInputSchema,
} from '@/lib/charts/styler/agent';
import { streamFixAgent, type FixAgentResult } from '@/lib/morph-card/agents/fix-agent';
import { streamEvolutionAgent, type EvolutionAgentResult } from '@/lib/morph-card/agents/evolution-agent';
import {
  FixAgentRequest,
  EvolutionAgentRequest,
  type JsonPatch,
  type MorphPatch,
} from '@/lib/morph-card/schemas/patch-protocol';
// Note: UITree, UIElement, JsonPatch are defined in @/lib/json-render/core/schemas
// We use inline JSON Schema here for AI SDK compatibility

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const CURSOR_CHAT_PORT = 7682; // Separate from terminal server (7681)

// Project root for Claude Code to find .claude/ and CLAUDE.md
const PROJECT_ROOT = process.cwd();

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
When using geospatial tools, provide clear explanations of the data returned.`;

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
- The client will parse your response and execute the position/visibility commands automatically`;

// -----------------------------------------------------------------------------
// Request Schema (AI SDK 5.0+ format: messages use 'parts' instead of 'content')
// -----------------------------------------------------------------------------

const TextPart = Schema.Struct({
  type: Schema.Literal('text'),
  text: Schema.String,
});

const UIMessagePart = Schema.Union(
  TextPart,
  // Add other part types as needed (tool-invocation, file, etc.)
  Schema.Struct({ type: Schema.String }) // Fallback for unknown types
);

const UIMessage = Schema.Struct({
  id: Schema.optional(Schema.String),
  role: Schema.String,
  parts: Schema.Array(UIMessagePart),
  metadata: Schema.optional(Schema.Unknown),
});

/**
 * Mode determines system prompt and tool configuration:
 * - 'terminal': Full tool access for Terminal v3 agent
 * - 'cursor': Dynamic Island floating chat (no tools)
 */
const ChatMode = Schema.Literal('terminal', 'cursor');

const ChatRequestSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  messages: Schema.Array(UIMessage),
  trigger: Schema.optional(Schema.String),
  messageId: Schema.optional(Schema.String),
  /** Chat mode - defaults to 'cursor' for backwards compatibility */
  mode: Schema.optional(ChatMode),
  /** System prompt override */
  systemPrompt: Schema.optional(Schema.String),
});

// Helper to convert AI SDK 5.0+ parts to content string for streamText
function partsToContent(
  parts: ReadonlyArray<{ type: string; text?: string }>
): string {
  return parts
    .filter(
      (p): p is { type: 'text'; text: string } =>
        p.type === 'text' && typeof p.text === 'string'
    )
    .map((p) => p.text)
    .join('');
}

// -----------------------------------------------------------------------------
// Chat Handler
// -----------------------------------------------------------------------------

/**
 * Create claudeCode model configured for the given mode.
 *
 * Terminal mode: Full MCP tool access
 * - Passes osmmcp server config directly via mcpServers
 * - Allows all MCP tools plus standard file/bash tools
 *
 * Cursor mode: No tools (natural language only)
 */
function createModel(mode: 'terminal' | 'cursor') {
  if (mode === 'terminal') {
    return claudeCode('sonnet', {
      cwd: PROJECT_ROOT,
      // OSM MCP server disabled due to invalid schema (analyze_commute tool has array without items spec)
      // mcpServers: {
      //   OSM: {
      //     command: './bin/osmmcp',
      //     args: [],
      //     env: {},
      //   },
      // },
      // Allow standard tools only (OSM tools removed)
      allowedTools: [
        // Standard Claude Code tools
        'Read',
        'Write',
        'Bash',
        'Glob',
        'Grep',
      ],
    });
  }

  // Cursor mode - no tools, just natural language
  return claudeCode('sonnet', {
    cwd: PROJECT_ROOT,
  });
}

const handleChat = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const body = yield* request.json;

  // Validate request
  const decoded = yield* Schema.decodeUnknown(ChatRequestSchema)(body).pipe(
    Effect.mapError((e) => new Error(`Invalid request: ${String(e)}`))
  );

  const mode = decoded.mode ?? 'cursor';
  const systemPrompt =
    decoded.systemPrompt ??
    (mode === 'terminal' ? TERMINAL_SYSTEM_PROMPT : CURSOR_SYSTEM_PROMPT);

  yield* Effect.log(
    `[cursor-chat] Mode: ${mode}, tools: ${
      mode === 'terminal' ? 'enabled' : 'disabled'
    }`
  );

  // Convert AI SDK 5.0+ messages (parts) to streamText format (content)
  const convertedMessages = decoded.messages.map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: partsToContent(
      msg.parts as Array<{ type: string; text?: string }>
    ),
  }));

  // Call AI SDK with mode-appropriate configuration
  const result = yield* Effect.tryPromise({
    try: async () => {
      const aiResult = streamText({
        model: createModel(mode),
        system: systemPrompt,
        messages: convertedMessages,
      });

      // AI SDK 5.0+: Use toUIMessageStreamResponse() for useChat compatibility
      // This returns a Response with proper SSE formatting
      const response = aiResult.toUIMessageStreamResponse();

      // Add CORS headers to the response
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
    catch: (error) => new Error(`AI SDK error: ${String(error)}`),
  });

  return HttpServerResponse.raw(result);
});

// -----------------------------------------------------------------------------
// UI Generation System Prompt (JSONL Streaming - True Progressive)
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// UI Generation Request Schema
// -----------------------------------------------------------------------------

/**
 * Schema for dynamic component documentation.
 * Allows clients to inject additional component knowledge at request time.
 */
const ComponentDocSchema = Schema.Struct({
  /** Component name as used in type field */
  name: Schema.String,
  /** Human-readable description */
  description: Schema.String,
  /** Props documentation (can be multi-line) */
  props: Schema.optional(Schema.String),
  /** Whether component has children */
  hasChildren: Schema.optional(Schema.Boolean),
});

const UIGenerateRequestSchema = Schema.Struct({
  prompt: Schema.String,
  currentTree: Schema.optional(Schema.Unknown),
  /** Dynamic component documentation to inject into the prompt */
  components: Schema.optional(Schema.Array(ComponentDocSchema)),
});

// -----------------------------------------------------------------------------
// UI Generate Handler (JSONL Streaming - True Progressive)
// -----------------------------------------------------------------------------

const handleUIGenerate = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const body = yield* request.json;

  // Validate request
  const decoded = yield* Schema.decodeUnknown(UIGenerateRequestSchema)(body).pipe(
    Effect.mapError((e) => new Error(`Invalid request: ${String(e)}`))
  );

  yield* Effect.log(`[ui-generate] Prompt: "${decoded.prompt.slice(0, 100)}..."`);
  if (decoded.components?.length) {
    yield* Effect.log(`[ui-generate] Dynamic components: ${decoded.components.map(c => c.name).join(', ')}`);
  }

  // Build context for the AI
  const contextMessage = decoded.currentTree
    ? `Current UI tree:\n${JSON.stringify(decoded.currentTree, null, 2)}\n\nModify or extend based on:`
    : '';

  // Use raw streamText WITHOUT Output.object - this gives us true token-by-token streaming
  // Claude outputs JSONL directly, each line is a complete JSON patch
  // Client-side validates each line with Effect Schema (decodeJsonPatchSync)
  const result = streamText({
    model: claudeCode('sonnet', { cwd: PROJECT_ROOT }),
    system: buildUIGenerationPrompt(decoded.components as ComponentDoc[] | undefined),
    prompt: contextMessage ? `${contextMessage}\n\n${decoded.prompt}` : decoded.prompt,
  });

  // Return raw text stream using result.textStream directly
  // NOT toTextStreamResponse() which wraps in SSE format (data: ...)
  // Client parses complete JSONL lines and validates with Effect Schema
  const sanitizedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      const reader = result.textStream.getReader();
      let buffer = '';
      let strippedFence = false;

      const pushLine = (line: string) => {
        if (!line) return;
        if (line.startsWith('```')) return;
        controller.enqueue(new TextEncoder().encode(line + '\n'));
      };

      const pump = (): void => {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              if (buffer.length > 0) {
                const finalLine = buffer.trimEnd();
                if (finalLine && !finalLine.startsWith('```')) {
                  controller.enqueue(
                    new TextEncoder().encode(finalLine + '\n')
                  );
                }
              }
              controller.close();
              return;
            }

            buffer += new TextDecoder().decode(value);
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const rawLine of lines) {
              const line = rawLine.trimEnd();
              if (!strippedFence && line.startsWith('```')) {
                strippedFence = true;
                continue;
              }
              if (line.startsWith('```')) {
                continue;
              }
              pushLine(line);
            }

            pump();
          })
          .catch((error) => {
            controller.error(error);
          });
      };

      pump();
    },
  });

  const response = new Response(sanitizedStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    },
  });

  return HttpServerResponse.raw(response);
});

// -----------------------------------------------------------------------------
// Chart Style Handler - JSONL streaming from LLM agent
// -----------------------------------------------------------------------------

/**
 * Handle chart style requests.
 * Uses streamChartStyleAgent to stream JSONL patches directly from LLM.
 * Follows the same archetype as /ui-generate.
 */
const handleChartStyle = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const body = yield* request.json;

  // Validate request using Effect Schema
  const decoded = yield* Schema.decodeUnknown(ChartStylerAgentInputSchema)(body).pipe(
    Effect.mapError((e) => new Error(`Invalid request: ${String(e)}`))
  );

  yield* Effect.log(
    `[chart-style] Chart: ${decoded.chartId}, Type: ${decoded.chartType}, Intent: ${decoded.intent ?? 'auto'}`
  );

  // Create a ReadableStream from the async generator
  const generator = streamChartStyleAgent({
    chartId: decoded.chartId,
    prompt: decoded.prompt,
    chartType: decoded.chartType,
    intent: decoded.intent,
    dataContext: decoded.dataContext ? {
      fields: decoded.dataContext.fields,
      shape: decoded.dataContext.shape,
      rowCount: decoded.dataContext.rowCount,
    } : undefined,
  });

  // Convert async generator to ReadableStream (JSONL output)
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const patch of generator) {
          // Each patch is a complete JSON object, output as JSONL
          controller.enqueue(new TextEncoder().encode(JSON.stringify(patch) + '\n'));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  // Return raw text stream (same pattern as /ui-generate)
  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    },
  });

  return HttpServerResponse.raw(response);
});

// -----------------------------------------------------------------------------
// MorphCard Agent Handlers
// -----------------------------------------------------------------------------

/**
 * Durable stream base URL for patch persistence.
 * Connects to the durable streams server (default port 4437).
 * @see scripts/durable-streams-server.ts
 */
const DURABLE_STREAM_BASE = 'http://localhost:4437/v1/stream';

/**
 * Helper to emit a patch to the durable stream.
 * In production, this would POST to the durable stream service.
 */
async function emitPatchToDurableStream(
  userId: string,
  cardId: string,
  patches: JsonPatch[],
  source: 'fix-agent' | 'evolution-agent',
  description?: string
): Promise<{ success: boolean; seq?: number }> {
  try {
    const morphPatch: MorphPatch = {
      _tag: 'MorphPatch',
      cardId,
      patches,
      metadata: {
        source,
        description,
        createdAt: Date.now(),
      },
    };

    const response = await fetch(`${DURABLE_STREAM_BASE}/${userId}/${cardId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(morphPatch),
    });

    if (!response.ok) {
      console.warn(`[morph-agent] Durable stream POST failed: ${response.status}`);
      return { success: false };
    }

    const result = await response.json();
    return { success: true, seq: result.seq };
  } catch (e) {
    // Durable stream not available - patches still returned to client
    console.warn('[morph-agent] Durable stream unavailable:', e);
    return { success: true }; // Consider success for client-side application
  }
}

/**
 * Handle fix agent requests.
 * Streams tool calls and results as SSE, with final patch emitted to durable stream.
 */
const handleFixAgent = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const body = yield* request.json;

  // Validate request using Effect Schema
  const decoded = yield* Schema.decodeUnknown(FixAgentRequest)(body).pipe(
    Effect.mapError((e) => new Error(`Invalid request: ${String(e)}`))
  );

  yield* Effect.log(
    `[morph-agent/fix] Card: ${decoded.cardId}, Error: ${decoded.errorMessage.slice(0, 50)}...`
  );

  // Default userId for durable stream (would come from auth in production)
  const userId = 'default-user';

  // Create emit callback for the agent
  const emitPatch = async (patches: JsonPatch[], description?: string) => {
    return emitPatchToDurableStream(userId, decoded.cardId, patches, 'fix-agent', description);
  };

  // Create SSE stream from agent generator
  const generator = streamFixAgent(decoded, emitPatch);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generator) {
          // Format as SSE
          const data = JSON.stringify(event);
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        }
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    },
  });

  return HttpServerResponse.raw(response);
});

/**
 * Handle evolution agent requests.
 * Streams tool calls and results as SSE, with final patches emitted to durable stream.
 */
const handleEvolutionAgent = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const body = yield* request.json;

  // Validate request using Effect Schema
  const decoded = yield* Schema.decodeUnknown(EvolutionAgentRequest)(body).pipe(
    Effect.mapError((e) => new Error(`Invalid request: ${String(e)}`))
  );

  yield* Effect.log(
    `[morph-agent/evolve] Card: ${decoded.cardId}, User: ${decoded.userId}, Message: ${decoded.userMessage.slice(0, 50)}...`
  );

  // Create emit callback for the agent
  const emitPatch = async (patches: JsonPatch[], description: string) => {
    return emitPatchToDurableStream(decoded.userId, decoded.cardId, patches, 'evolution-agent', description);
  };

  // Stub regenerateSubtree - would call /ui-generate in production
  const regenerateSubtree = async (prompt: string) => {
    // In production, this would POST to /ui-generate and collect the result
    // For now, return a simple placeholder
    console.log(`[morph-agent/evolve] Regenerate subtree requested: ${prompt.slice(0, 50)}...`);
    return {
      root: 'placeholder',
      elements: {
        placeholder: {
          key: 'placeholder',
          type: 'Text',
          props: { text: 'Regenerated content placeholder' },
        },
      },
    };
  };

  // Create SSE stream from agent generator
  const generator = streamEvolutionAgent(decoded, emitPatch, regenerateSubtree);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generator) {
          // Format as SSE
          const data = JSON.stringify(event);
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        }
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    },
  });

  return HttpServerResponse.raw(response);
});

// -----------------------------------------------------------------------------
// CORS Helper
// -----------------------------------------------------------------------------

const withCors = <R extends HttpServerResponse.HttpServerResponse>(
  response: R
): R =>
  response.pipe(
    HttpServerResponse.setHeader('Access-Control-Allow-Origin', '*'),
    HttpServerResponse.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, OPTIONS'
    ),
    HttpServerResponse.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    )
  ) as R;

// -----------------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------------

const router = HttpRouter.empty.pipe(
  // Health check
  HttpRouter.get(
    '/health',
    HttpServerResponse.json({ status: 'ok', service: 'cursor-chat' }).pipe(
      Effect.map(withCors)
    )
  ),

  // CORS preflight
  HttpRouter.options(
    '/chat',
    Effect.succeed(withCors(HttpServerResponse.empty()))
  ),

  // Chat endpoint
  HttpRouter.post(
    '/chat',
    handleChat.pipe(
      Effect.tap(() => Effect.log('[cursor-chat] Request processed')),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError('[cursor-chat] Error:', error);
          return withCors(
            HttpServerResponse.unsafeJson(
              { error: String(error) },
              { status: 500 }
            )
          );
        })
      )
    )
  ),

  // CORS preflight for ui-generate
  HttpRouter.options(
    '/ui-generate',
    Effect.succeed(withCors(HttpServerResponse.empty()))
  ),

  // UI Generate endpoint - structured output for json-render
  HttpRouter.post(
    '/ui-generate',
    handleUIGenerate.pipe(
      Effect.tap(() => Effect.log('[ui-generate] Request processed')),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError('[ui-generate] Error:', error);
          return withCors(
            HttpServerResponse.unsafeJson(
              { error: String(error) },
              { status: 500 }
            )
          );
        })
      )
    )
  ),

  // CORS preflight for chart-style
  HttpRouter.options(
    '/chart-style',
    Effect.succeed(withCors(HttpServerResponse.empty()))
  ),

  // Chart Style endpoint - JSONL patches from LLM styler agent
  HttpRouter.post(
    '/chart-style',
    handleChartStyle.pipe(
      Effect.tap(() => Effect.log('[chart-style] Request processed')),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError('[chart-style] Error:', error);
          return withCors(
            HttpServerResponse.unsafeJson(
              { error: String(error) },
              { status: 500 }
            )
          );
        })
      )
    )
  ),

  // CORS preflight for morph-agent/fix
  HttpRouter.options(
    '/morph-agent/fix',
    Effect.succeed(withCors(HttpServerResponse.empty()))
  ),

  // MorphCard Fix Agent endpoint - Auto-fix decode errors
  HttpRouter.post(
    '/morph-agent/fix',
    handleFixAgent.pipe(
      Effect.tap(() => Effect.log('[morph-agent/fix] Request processed')),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError('[morph-agent/fix] Error:', error);
          return withCors(
            HttpServerResponse.unsafeJson(
              { error: String(error) },
              { status: 500 }
            )
          );
        })
      )
    )
  ),

  // CORS preflight for morph-agent/evolve
  HttpRouter.options(
    '/morph-agent/evolve',
    Effect.succeed(withCors(HttpServerResponse.empty()))
  ),

  // MorphCard Evolution Agent endpoint - User-driven UI modification
  HttpRouter.post(
    '/morph-agent/evolve',
    handleEvolutionAgent.pipe(
      Effect.tap(() => Effect.log('[morph-agent/evolve] Request processed')),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError('[morph-agent/evolve] Error:', error);
          return withCors(
            HttpServerResponse.unsafeJson(
              { error: String(error) },
              { status: 500 }
            )
          );
        })
      )
    )
  )
);

// -----------------------------------------------------------------------------
// Server Layer
// -----------------------------------------------------------------------------

export const CursorChatServerLive = router.pipe(
  HttpServer.serve(),
  HttpServer.withLogAddress,
  Layer.provide(
    BunHttpServer.layer({
      port: CURSOR_CHAT_PORT,
      idleTimeout: 120, // 2 minutes for streaming responses
    })
  ),
  Layer.provide(BunContext.layer)
);

// -----------------------------------------------------------------------------
// Runnable Entry Point
// -----------------------------------------------------------------------------

export const runCursorChatServer = Effect.gen(function* () {
  yield* Effect.log(
    `Cursor Chat Server starting on http://localhost:${CURSOR_CHAT_PORT}`
  );
  yield* Effect.log('Endpoints:');
  yield* Effect.log('  GET  /health       - Health check');
  yield* Effect.log('  POST /chat         - Chat endpoint (SSE stream)');
  yield* Effect.log('  POST /ui-generate  - UI generation (NDJSON patches)');
  yield* Effect.log('  POST /chart-style  - Chart styling agent (JSONL patches)');
  yield* Effect.log('');
  yield* Effect.log('Note: Claude Code CLI must be authenticated (`claude login`)');
});

export { CURSOR_CHAT_PORT };
