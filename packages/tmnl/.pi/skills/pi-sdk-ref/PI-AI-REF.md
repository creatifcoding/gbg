# @mariozechner/pi-ai SDK Reference

> **Complete API reference for pi-ai** — the unified streaming SDK for LLM providers.

---

## Table of Contents

- [Core Exports (index)](#core-exports-index)
- [Types](#types)
  - [API & Provider Types](#api--provider-types)
  - [Message Types](#message-types)
  - [Content Types](#content-types)
  - [Tool Types](#tool-types)
  - [Usage & Cost Types](#usage--cost-types)
  - [Streaming Options](#streaming-options)
  - [Compatibility Types](#compatibility-types)
  - [Model Types](#model-types)
  - [Event Types](#event-types)
- [API Registry](#api-registry)
- [Streaming Functions](#streaming-functions)
- [Models](#models)
- [Environment API Keys](#environment-api-keys)
- [Providers](#providers)
  - [Anthropic](#anthropic)
  - [Amazon Bedrock](#amazon-bedrock)
  - [Google Generative AI](#google-generative-ai)
  - [Google Gemini CLI](#google-gemini-cli)
  - [Google Vertex](#google-vertex)
  - [Google Shared Utilities](#google-shared-utilities)
  - [OpenAI Completions](#openai-completions)
  - [OpenAI Responses](#openai-responses)
  - [OpenAI Responses Shared](#openai-responses-shared)
  - [Azure OpenAI Responses](#azure-openai-responses)
  - [OpenAI Codex Responses](#openai-codex-responses)
  - [GitHub Copilot Headers](#github-copilot-headers)
  - [Simple Options](#simple-options)
  - [Transform Messages](#transform-messages)
  - [Register Builtins](#register-builtins)
- [Utilities](#utilities)
  - [Event Stream](#event-stream)
  - [JSON Parse](#json-parse)
  - [Overflow Detection](#overflow-detection)
  - [TypeBox Helpers](#typebox-helpers)
  - [Validation](#validation)
  - [Sanitize Unicode](#sanitize-unicode)
- [OAuth Utilities](#oauth-utilities)
  - [OAuth Index](#oauth-index)
  - [OAuth Types](#oauth-types)
  - [PKCE](#pkce)
  - [Anthropic OAuth](#anthropic-oauth)
  - [GitHub Copilot OAuth](#github-copilot-oauth)
  - [Google Antigravity OAuth](#google-antigravity-oauth)
  - [Google Gemini CLI OAuth](#google-gemini-cli-oauth)
  - [OpenAI Codex OAuth](#openai-codex-oauth)

---

## Core Exports (index)

**Module:** `@mariozechner/pi-ai`

Re-exports from TypeBox and all sub-modules:

```typescript
// TypeBox re-exports
export type { Static, TSchema } from "@sinclair/typebox";
export { Type } from "@sinclair/typebox";

// Re-exported modules
export * from "./api-registry.js";
export * from "./env-api-keys.js";
export * from "./models.js";
export * from "./providers/anthropic.js";
export * from "./providers/azure-openai-responses.js";
export * from "./providers/google.js";
export * from "./providers/google-gemini-cli.js";
export * from "./providers/google-vertex.js";
export * from "./providers/openai-completions.js";
export * from "./providers/openai-responses.js";
export * from "./providers/register-builtins.js";
export * from "./stream.js";
export * from "./types.js";
export * from "./utils/event-stream.js";
export * from "./utils/json-parse.js";
export * from "./utils/oauth/index.js";
export * from "./utils/overflow.js";
export * from "./utils/typebox-helpers.js";
export * from "./utils/validation.js";
```

---

## Types

**Module:** `@mariozechner/pi-ai/dist/types`

### API & Provider Types

```typescript
/** Known API types for LLM providers */
export type KnownApi = 
  | "openai-completions" 
  | "openai-responses" 
  | "azure-openai-responses" 
  | "openai-codex-responses" 
  | "anthropic-messages" 
  | "bedrock-converse-stream" 
  | "google-generative-ai" 
  | "google-gemini-cli" 
  | "google-vertex";

/** API type with extension support */
export type Api = KnownApi | (string & {});

/** Known provider identifiers */
export type KnownProvider = 
  | "amazon-bedrock" 
  | "anthropic" 
  | "google" 
  | "google-gemini-cli" 
  | "google-antigravity" 
  | "google-vertex" 
  | "openai" 
  | "azure-openai-responses" 
  | "openai-codex" 
  | "github-copilot" 
  | "xai" 
  | "groq" 
  | "cerebras" 
  | "openrouter" 
  | "vercel-ai-gateway" 
  | "zai" 
  | "mistral" 
  | "minimax" 
  | "minimax-cn" 
  | "huggingface" 
  | "opencode" 
  | "kimi-coding";

/** Provider type with extension support */
export type Provider = KnownProvider | string;
```

### Thinking & Cache Types

```typescript
/** Thinking/reasoning intensity level */
export type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh";

/** Token budgets for each thinking level (token-based providers only) */
export interface ThinkingBudgets {
  minimal?: number;
  low?: number;
  medium?: number;
  high?: number;
}

/** Prompt cache retention preference */
export type CacheRetention = "none" | "short" | "long";

/** Transport preference for streaming */
export type Transport = "sse" | "websocket" | "auto";
```

### Message Types

```typescript
/** User message in conversation */
export interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
}

/** Assistant/model response message */
export interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  api: Api;
  provider: Provider;
  model: string;
  usage: Usage;
  stopReason: StopReason;
  errorMessage?: string;
  timestamp: number;
}

/** Tool result message */
export interface ToolResultMessage<TDetails = any> {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: TDetails;
  isError: boolean;
  timestamp: number;
}

/** Union of all message types */
export type Message = UserMessage | AssistantMessage | ToolResultMessage;
```

### Content Types

```typescript
/** Text content block */
export interface TextContent {
  type: "text";
  text: string;
  textSignature?: string;
}

/** Thinking/reasoning content block */
export interface ThinkingContent {
  type: "thinking";
  thinking: string;
  thinkingSignature?: string;
}

/** Image content block */
export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

/** Tool invocation from model */
export interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, any>;
  thoughtSignature?: string;
}
```

### Tool Types

```typescript
import type { TSchema } from "@sinclair/typebox";

/** Tool definition with TypeBox schema */
export interface Tool<TParameters extends TSchema = TSchema> {
  name: string;
  description: string;
  parameters: TParameters;
}

/** Conversation context for streaming */
export interface Context {
  systemPrompt?: string;
  messages: Message[];
  tools?: Tool[];
}
```

### Usage & Cost Types

```typescript
/** Token usage statistics */
export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

/** Reason for stream completion */
export type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted";
```

### Streaming Options

```typescript
/** Base streaming options for all providers */
export interface StreamOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  apiKey?: string;
  
  /** Preferred transport for providers that support multiple transports. */
  transport?: Transport;
  
  /** Prompt cache retention preference. Default: "short". */
  cacheRetention?: CacheRetention;
  
  /** Session identifier for session-based caching. */
  sessionId?: string;
  
  /** Callback for inspecting provider payloads before sending. */
  onPayload?: (payload: unknown) => void;
  
  /** Custom HTTP headers to include in API requests. */
  headers?: Record<string, string>;
  
  /** Maximum delay in milliseconds to wait for a retry. Default: 60000. */
  maxRetryDelayMs?: number;
  
  /** Metadata to include in API requests. */
  metadata?: Record<string, unknown>;
}

/** Extended streaming options for custom providers */
export type ProviderStreamOptions = StreamOptions & Record<string, unknown>;

/** Simple streaming options with reasoning support */
export interface SimpleStreamOptions extends StreamOptions {
  reasoning?: ThinkingLevel;
  /** Custom token budgets for thinking levels (token-based providers only) */
  thinkingBudgets?: ThinkingBudgets;
}

/** Stream function type signature */
export type StreamFunction<
  TApi extends Api = Api, 
  TOptions extends StreamOptions = StreamOptions
> = (
  model: Model<TApi>, 
  context: Context, 
  options?: TOptions
) => AssistantMessageEventStream;
```

### Compatibility Types

```typescript
/** Compatibility settings for OpenAI-compatible completions APIs */
export interface OpenAICompletionsCompat {
  /** Whether the provider supports the `store` field. */
  supportsStore?: boolean;
  
  /** Whether the provider supports the `developer` role (vs `system`). */
  supportsDeveloperRole?: boolean;
  
  /** Whether the provider supports `reasoning_effort`. */
  supportsReasoningEffort?: boolean;
  
  /** Whether the provider supports usage in streaming responses. Default: true. */
  supportsUsageInStreaming?: boolean;
  
  /** Which field to use for max tokens. */
  maxTokensField?: "max_completion_tokens" | "max_tokens";
  
  /** Whether tool results require the `name` field. */
  requiresToolResultName?: boolean;
  
  /** Whether user message after tool results requires assistant message. */
  requiresAssistantAfterToolResult?: boolean;
  
  /** Whether thinking blocks must be converted to text with <thinking> delimiters. */
  requiresThinkingAsText?: boolean;
  
  /** Whether tool call IDs must be normalized to Mistral format. */
  requiresMistralToolIds?: boolean;
  
  /** Format for reasoning/thinking parameter. */
  thinkingFormat?: "openai" | "zai" | "qwen";
  
  /** OpenRouter-specific routing preferences. */
  openRouterRouting?: OpenRouterRouting;
  
  /** Vercel AI Gateway routing preferences. */
  vercelGatewayRouting?: VercelGatewayRouting;
  
  /** Whether the provider supports `strict` in tool definitions. Default: true. */
  supportsStrictMode?: boolean;
}

/** Compatibility settings for OpenAI Responses APIs */
export interface OpenAIResponsesCompat {
  // Currently empty - reserved for future use
}

/** OpenRouter provider routing preferences */
export interface OpenRouterRouting {
  /** Provider slugs to exclusively use. */
  only?: string[];
  /** Provider slugs to try in order. */
  order?: string[];
}

/** Vercel AI Gateway routing preferences */
export interface VercelGatewayRouting {
  /** Provider slugs to exclusively use. */
  only?: string[];
  /** Provider slugs to try in order. */
  order?: string[];
}
```

### Model Types

```typescript
/** Model definition with API-specific compatibility */
export interface Model<TApi extends Api> {
  id: string;
  name: string;
  api: TApi;
  provider: Provider;
  baseUrl: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
  headers?: Record<string, string>;
  
  /** Compatibility overrides for OpenAI-compatible APIs. */
  compat?: TApi extends "openai-completions" 
    ? OpenAICompletionsCompat 
    : TApi extends "openai-responses" 
      ? OpenAIResponsesCompat 
      : never;
}
```

### Event Types

```typescript
/** Union of all assistant message streaming events */
export type AssistantMessageEvent = 
  | { type: "start"; partial: AssistantMessage }
  | { type: "text_start"; contentIndex: number; partial: AssistantMessage }
  | { type: "text_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
  | { type: "text_end"; contentIndex: number; content: string; partial: AssistantMessage }
  | { type: "thinking_start"; contentIndex: number; partial: AssistantMessage }
  | { type: "thinking_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
  | { type: "thinking_end"; contentIndex: number; content: string; partial: AssistantMessage }
  | { type: "toolcall_start"; contentIndex: number; partial: AssistantMessage }
  | { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
  | { type: "toolcall_end"; contentIndex: number; toolCall: ToolCall; partial: AssistantMessage }
  | { type: "done"; reason: Extract<StopReason, "stop" | "length" | "toolUse">; message: AssistantMessage }
  | { type: "error"; reason: Extract<StopReason, "aborted" | "error">; error: AssistantMessage };
```

---

## API Registry

**Module:** `@mariozechner/pi-ai/dist/api-registry`

### Types

```typescript
/** Stream function type for API registry */
export type ApiStreamFunction = (
  model: Model<Api>, 
  context: Context, 
  options?: StreamOptions
) => AssistantMessageEventStream;

/** Simple stream function type */
export type ApiStreamSimpleFunction = (
  model: Model<Api>, 
  context: Context, 
  options?: SimpleStreamOptions
) => AssistantMessageEventStream;

/** API provider registration interface */
export interface ApiProvider<
  TApi extends Api = Api, 
  TOptions extends StreamOptions = StreamOptions
> {
  api: TApi;
  stream: StreamFunction<TApi, TOptions>;
  streamSimple: StreamFunction<TApi, SimpleStreamOptions>;
}
```

### Functions

```typescript
/** Register an API provider */
declare function registerApiProvider<TApi extends Api, TOptions extends StreamOptions>(
  provider: ApiProvider<TApi, TOptions>, 
  sourceId?: string
): void;

/** Get an API provider by API type */
declare function getApiProvider(api: Api): ApiProviderInternal | undefined;

/** Get all registered API providers */
declare function getApiProviders(): ApiProviderInternal[];

/** Unregister all providers from a source */
declare function unregisterApiProviders(sourceId: string): void;

/** Clear all registered API providers */
declare function clearApiProviders(): void;
```

---

## Streaming Functions

**Module:** `@mariozechner/pi-ai/dist/stream`

```typescript
import type { 
  Api, 
  AssistantMessage, 
  AssistantMessageEventStream, 
  Context, 
  Model, 
  ProviderStreamOptions, 
  SimpleStreamOptions 
} from "./types.js";

/** Stream responses with full provider options */
declare function stream<TApi extends Api>(
  model: Model<TApi>, 
  context: Context, 
  options?: ProviderStreamOptions
): AssistantMessageEventStream;

/** Complete (non-streaming) with full provider options */
declare function complete<TApi extends Api>(
  model: Model<TApi>, 
  context: Context, 
  options?: ProviderStreamOptions
): Promise<AssistantMessage>;

/** Stream responses with simple options (auto-configures reasoning) */
declare function streamSimple<TApi extends Api>(
  model: Model<TApi>, 
  context: Context, 
  options?: SimpleStreamOptions
): AssistantMessageEventStream;

/** Complete (non-streaming) with simple options */
declare function completeSimple<TApi extends Api>(
  model: Model<TApi>, 
  context: Context, 
  options?: SimpleStreamOptions
): Promise<AssistantMessage>;

/** Re-export from env-api-keys */
export { getEnvApiKey } from "./env-api-keys.js";
```

---

## Models

**Module:** `@mariozechner/pi-ai/dist/models`

```typescript
import { MODELS } from "./models.generated.js";
import type { Api, KnownProvider, Model, Usage } from "./types.js";

/** Get a specific model by provider and model ID */
declare function getModel<
  TProvider extends KnownProvider, 
  TModelId extends keyof (typeof MODELS)[TProvider]
>(
  provider: TProvider, 
  modelId: TModelId
): Model<ModelApi<TProvider, TModelId>>;

/** Get all known provider names */
declare function getProviders(): KnownProvider[];

/** Get all models for a specific provider */
declare function getModels<TProvider extends KnownProvider>(
  provider: TProvider
): Model<ModelApi<TProvider, keyof (typeof MODELS)[TProvider]>>[];

/** Calculate cost for a model and usage */
declare function calculateCost<TApi extends Api>(
  model: Model<TApi>, 
  usage: Usage
): Usage["cost"];

/**
 * Check if a model supports xhigh thinking level.
 * Supported: GPT-5.2/5.3, Anthropic Opus 4.6+
 */
declare function supportsXhigh<TApi extends Api>(model: Model<TApi>): boolean;

/** Check if two models are equal by id and provider */
declare function modelsAreEqual<TApi extends Api>(
  a: Model<TApi> | null | undefined, 
  b: Model<TApi> | null | undefined
): boolean;
```

### Generated Models Constant

**Module:** `@mariozechner/pi-ai/dist/models.generated`

```typescript
/** All known models organized by provider */
export declare const MODELS: {
  readonly "amazon-bedrock": { /* 80+ Bedrock model definitions */ };
  readonly "anthropic": { /* Claude model definitions */ };
  readonly "google": { /* Google Generative AI model definitions */ };
  readonly "google-gemini-cli": { /* Gemini CLI model definitions */ };
  readonly "google-antigravity": { /* Antigravity model definitions */ };
  readonly "google-vertex": { /* Vertex AI model definitions */ };
  readonly "openai": { /* OpenAI model definitions */ };
  readonly "azure-openai-responses": { /* Azure OpenAI model definitions */ };
  readonly "openai-codex": { /* Codex model definitions */ };
  readonly "github-copilot": { /* GitHub Copilot model definitions */ };
  readonly "xai": { /* xAI/Grok model definitions */ };
  readonly "groq": { /* Groq model definitions */ };
  readonly "cerebras": { /* Cerebras model definitions */ };
  readonly "openrouter": { /* OpenRouter model definitions */ };
  readonly "vercel-ai-gateway": { /* Vercel AI Gateway model definitions */ };
  readonly "zai": { /* z.ai model definitions */ };
  readonly "mistral": { /* Mistral model definitions */ };
  readonly "minimax": { /* MiniMax model definitions */ };
  readonly "minimax-cn": { /* MiniMax China model definitions */ };
  readonly "huggingface": { /* HuggingFace model definitions */ };
  readonly "opencode": { /* OpenCode model definitions */ };
  readonly "kimi-coding": { /* Kimi Coding model definitions */ };
};
```

---

## Environment API Keys

**Module:** `@mariozechner/pi-ai/dist/env-api-keys`

```typescript
import type { KnownProvider } from "./types.js";

/**
 * Get API key for provider from known environment variables.
 * E.g., OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.
 * Will not return API keys for providers that require OAuth tokens.
 */
declare function getEnvApiKey(provider: KnownProvider): string | undefined;
declare function getEnvApiKey(provider: string): string | undefined;
```

---

## Providers

### Anthropic

**Module:** `@mariozechner/pi-ai/dist/providers/anthropic`

```typescript
import type { SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";

/** Anthropic adaptive thinking effort level */
export type AnthropicEffort = "low" | "medium" | "high" | "max";

/** Anthropic-specific streaming options */
export interface AnthropicOptions extends StreamOptions {
  /** Enable extended thinking (adaptive for Opus 4.6+, budget-based for older). */
  thinkingEnabled?: boolean;
  
  /** Token budget for extended thinking (older models only). */
  thinkingBudgetTokens?: number;
  
  /** Effort level for adaptive thinking (Opus 4.6+ only). */
  effort?: AnthropicEffort;
  
  /** Enable interleaved thinking blocks. */
  interleavedThinking?: boolean;
  
  /** Tool choice configuration. */
  toolChoice?: "auto" | "any" | "none" | { type: "tool"; name: string };
}

/** Stream function for Anthropic Messages API */
export declare const streamAnthropic: StreamFunction<"anthropic-messages", AnthropicOptions>;

/** Simple stream function for Anthropic Messages API */
export declare const streamSimpleAnthropic: StreamFunction<"anthropic-messages", SimpleStreamOptions>;
```

### Amazon Bedrock

**Module:** `@mariozechner/pi-ai/dist/providers/amazon-bedrock`

```typescript
import type { 
  SimpleStreamOptions, 
  StreamFunction, 
  StreamOptions, 
  ThinkingBudgets, 
  ThinkingLevel 
} from "../types.js";

/** Bedrock-specific streaming options */
export interface BedrockOptions extends StreamOptions {
  /** AWS region for Bedrock endpoint. */
  region?: string;
  
  /** AWS profile name for credentials. */
  profile?: string;
  
  /** Tool choice configuration. */
  toolChoice?: "auto" | "any" | "none" | { type: "tool"; name: string };
  
  /** Reasoning/thinking level. */
  reasoning?: ThinkingLevel;
  
  /** Custom token budgets for thinking levels. */
  thinkingBudgets?: ThinkingBudgets;
  
  /** Enable interleaved thinking blocks. */
  interleavedThinking?: boolean;
}

/** Stream function for Bedrock Converse Stream API */
export declare const streamBedrock: StreamFunction<"bedrock-converse-stream", BedrockOptions>;

/** Simple stream function for Bedrock */
export declare const streamSimpleBedrock: StreamFunction<"bedrock-converse-stream", SimpleStreamOptions>;
```

### Google Generative AI

**Module:** `@mariozechner/pi-ai/dist/providers/google`

```typescript
import type { SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";
import type { GoogleThinkingLevel } from "./google-gemini-cli.js";

/** Google Generative AI streaming options */
export interface GoogleOptions extends StreamOptions {
  /** Tool choice configuration. */
  toolChoice?: "auto" | "none" | "any";
  
  /** Thinking/reasoning configuration. */
  thinking?: {
    enabled: boolean;
    budgetTokens?: number;
    level?: GoogleThinkingLevel;
  };
}

/** Stream function for Google Generative AI */
export declare const streamGoogle: StreamFunction<"google-generative-ai", GoogleOptions>;

/** Simple stream function for Google Generative AI */
export declare const streamSimpleGoogle: StreamFunction<"google-generative-ai", SimpleStreamOptions>;
```

### Google Gemini CLI

**Module:** `@mariozechner/pi-ai/dist/providers/google-gemini-cli`

```typescript
import type { Content, ThinkingConfig } from "@google/genai";
import type { Context, Model, SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";
import { convertTools, mapToolChoice } from "./google-shared.js";

/** Thinking level for Gemini 3 models */
export type GoogleThinkingLevel = 
  | "THINKING_LEVEL_UNSPECIFIED" 
  | "MINIMAL" 
  | "LOW" 
  | "MEDIUM" 
  | "HIGH";

/** Gemini CLI streaming options */
export interface GoogleGeminiCliOptions extends StreamOptions {
  /** Tool choice configuration. */
  toolChoice?: "auto" | "none" | "any";
  
  /**
   * Thinking/reasoning configuration.
   * - Gemini 2.x: use `budgetTokens`
   * - Gemini 3: use `level`
   */
  thinking?: {
    enabled: boolean;
    /** Thinking budget in tokens (Gemini 2.x). */
    budgetTokens?: number;
    /** Thinking level (Gemini 3). */
    level?: GoogleThinkingLevel;
  };
  
  /** Google Cloud project ID. */
  projectId?: string;
}

/** Extract retry delay from Gemini error response (in milliseconds) */
declare function extractRetryDelay(
  errorText: string, 
  response?: Response | Headers
): number | undefined;

/** Stream function for Gemini CLI */
export declare const streamGoogleGeminiCli: StreamFunction<"google-gemini-cli", GoogleGeminiCliOptions>;

/** Simple stream function for Gemini CLI */
export declare const streamSimpleGoogleGeminiCli: StreamFunction<"google-gemini-cli", SimpleStreamOptions>;

/** Build request payload for Gemini CLI */
declare function buildRequest(
  model: Model<"google-gemini-cli">, 
  context: Context, 
  projectId: string, 
  options?: GoogleGeminiCliOptions, 
  isAntigravity?: boolean
): CloudCodeAssistRequest;
```

### Google Vertex

**Module:** `@mariozechner/pi-ai/dist/providers/google-vertex`

```typescript
import type { SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";
import type { GoogleThinkingLevel } from "./google-gemini-cli.js";

/** Google Vertex AI streaming options */
export interface GoogleVertexOptions extends StreamOptions {
  /** Tool choice configuration. */
  toolChoice?: "auto" | "none" | "any";
  
  /** Thinking/reasoning configuration. */
  thinking?: {
    enabled: boolean;
    budgetTokens?: number;
    level?: GoogleThinkingLevel;
  };
  
  /** Google Cloud project ID. */
  project?: string;
  
  /** Vertex AI location/region. */
  location?: string;
}

/** Stream function for Google Vertex AI */
export declare const streamGoogleVertex: StreamFunction<"google-vertex", GoogleVertexOptions>;

/** Simple stream function for Google Vertex AI */
export declare const streamSimpleGoogleVertex: StreamFunction<"google-vertex", SimpleStreamOptions>;
```

### Google Shared Utilities

**Module:** `@mariozechner/pi-ai/dist/providers/google-shared`

```typescript
import { 
  type Content, 
  FinishReason, 
  FunctionCallingConfigMode, 
  type Part 
} from "@google/genai";
import type { Context, Model, StopReason, Tool } from "../types.js";

type GoogleApiType = "google-generative-ai" | "google-gemini-cli" | "google-vertex";

/**
 * Determines if a streamed Gemini Part should be treated as "thinking".
 * `thought: true` is the definitive marker for thinking content.
 * `thoughtSignature` is for context replay, not content identification.
 */
declare function isThinkingPart(part: Pick<Part, "thought" | "thoughtSignature">): boolean;

/** Retain thought signatures during streaming */
declare function retainThoughtSignature(
  existing: string | undefined, 
  incoming: string | undefined
): string | undefined;

/** Check if model requires explicit tool call IDs */
declare function requiresToolCallId(modelId: string): boolean;

/** Convert internal messages to Gemini Content[] format */
declare function convertMessages<T extends GoogleApiType>(
  model: Model<T>, 
  context: Context
): Content[];

/**
 * Convert tools to Gemini function declarations format.
 * Set `useParameters` to true for Cloud Code Assist with Claude models.
 */
declare function convertTools(
  tools: Tool[], 
  useParameters?: boolean
): { functionDeclarations: Record<string, unknown>[] }[] | undefined;

/** Map tool choice string to Gemini FunctionCallingConfigMode */
declare function mapToolChoice(choice: string): FunctionCallingConfigMode;

/** Map Gemini FinishReason to StopReason */
declare function mapStopReason(reason: FinishReason): StopReason;

/** Map string finish reason to StopReason (for raw API responses) */
declare function mapStopReasonString(reason: string): StopReason;
```

### OpenAI Completions

**Module:** `@mariozechner/pi-ai/dist/providers/openai-completions`

```typescript
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import type { 
  Context, 
  Model, 
  OpenAICompletionsCompat, 
  SimpleStreamOptions, 
  StreamFunction, 
  StreamOptions 
} from "../types.js";

/** OpenAI Completions API streaming options */
export interface OpenAICompletionsOptions extends StreamOptions {
  /** Tool choice configuration. */
  toolChoice?: "auto" | "none" | "required" | {
    type: "function";
    function: { name: string };
  };
  
  /** Reasoning effort level. */
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
}

/** Stream function for OpenAI Completions API */
export declare const streamOpenAICompletions: StreamFunction<"openai-completions", OpenAICompletionsOptions>;

/** Simple stream function for OpenAI Completions API */
export declare const streamSimpleOpenAICompletions: StreamFunction<"openai-completions", SimpleStreamOptions>;

/** Convert messages to OpenAI ChatCompletionMessageParam format */
declare function convertMessages(
  model: Model<"openai-completions">, 
  context: Context, 
  compat: Required<OpenAICompletionsCompat>
): ChatCompletionMessageParam[];
```

### OpenAI Responses

**Module:** `@mariozechner/pi-ai/dist/providers/openai-responses`

```typescript
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.js";
import type { SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";

/** OpenAI Responses API streaming options */
export interface OpenAIResponsesOptions extends StreamOptions {
  /** Reasoning effort level. */
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  
  /** Reasoning summary format. */
  reasoningSummary?: "auto" | "detailed" | "concise" | null;
  
  /** Service tier for request routing. */
  serviceTier?: ResponseCreateParamsStreaming["service_tier"];
}

/** Stream function for OpenAI Responses API */
export declare const streamOpenAIResponses: StreamFunction<"openai-responses", OpenAIResponsesOptions>;

/** Simple stream function for OpenAI Responses API */
export declare const streamSimpleOpenAIResponses: StreamFunction<"openai-responses", SimpleStreamOptions>;
```

### OpenAI Responses Shared

**Module:** `@mariozechner/pi-ai/dist/providers/openai-responses-shared`

```typescript
import type { 
  Tool as OpenAITool, 
  ResponseCreateParamsStreaming, 
  ResponseInput, 
  ResponseStreamEvent 
} from "openai/resources/responses/responses.js";
import type { Api, AssistantMessage, Context, Model, Tool, Usage } from "../types.js";
import type { AssistantMessageEventStream } from "../utils/event-stream.js";

/** Options for Responses API stream processing */
export interface OpenAIResponsesStreamOptions {
  serviceTier?: ResponseCreateParamsStreaming["service_tier"];
  applyServiceTierPricing?: (
    usage: Usage, 
    serviceTier: ResponseCreateParamsStreaming["service_tier"] | undefined
  ) => void;
}

/** Options for converting messages */
export interface ConvertResponsesMessagesOptions {
  includeSystemPrompt?: boolean;
}

/** Options for converting tools */
export interface ConvertResponsesToolsOptions {
  strict?: boolean | null;
}

/** Convert context to ResponseInput format */
declare function convertResponsesMessages<TApi extends Api>(
  model: Model<TApi>, 
  context: Context, 
  allowedToolCallProviders: ReadonlySet<string>, 
  options?: ConvertResponsesMessagesOptions
): ResponseInput;

/** Convert tools to OpenAI tool format */
declare function convertResponsesTools(
  tools: Tool[], 
  options?: ConvertResponsesToolsOptions
): OpenAITool[];

/** Process Responses API stream into AssistantMessage */
declare function processResponsesStream<TApi extends Api>(
  openaiStream: AsyncIterable<ResponseStreamEvent>, 
  output: AssistantMessage, 
  stream: AssistantMessageEventStream, 
  model: Model<TApi>, 
  options?: OpenAIResponsesStreamOptions
): Promise<void>;
```

### Azure OpenAI Responses

**Module:** `@mariozechner/pi-ai/dist/providers/azure-openai-responses`

```typescript
import type { SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";

/** Azure OpenAI Responses API streaming options */
export interface AzureOpenAIResponsesOptions extends StreamOptions {
  /** Reasoning effort level. */
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  
  /** Reasoning summary format. */
  reasoningSummary?: "auto" | "detailed" | "concise" | null;
  
  /** Azure API version. */
  azureApiVersion?: string;
  
  /** Azure resource name. */
  azureResourceName?: string;
  
  /** Azure base URL override. */
  azureBaseUrl?: string;
  
  /** Azure deployment name. */
  azureDeploymentName?: string;
}

/** Stream function for Azure OpenAI Responses API */
export declare const streamAzureOpenAIResponses: StreamFunction<"azure-openai-responses", AzureOpenAIResponsesOptions>;

/** Simple stream function for Azure OpenAI Responses API */
export declare const streamSimpleAzureOpenAIResponses: StreamFunction<"azure-openai-responses", SimpleStreamOptions>;
```

### OpenAI Codex Responses

**Module:** `@mariozechner/pi-ai/dist/providers/openai-codex-responses`

```typescript
import type { SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";

/** OpenAI Codex Responses API streaming options */
export interface OpenAICodexResponsesOptions extends StreamOptions {
  /** Reasoning effort level. */
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  
  /** Reasoning summary format. */
  reasoningSummary?: "auto" | "concise" | "detailed" | "off" | "on" | null;
  
  /** Text output verbosity. */
  textVerbosity?: "low" | "medium" | "high";
}

/** Stream function for OpenAI Codex Responses API */
export declare const streamOpenAICodexResponses: StreamFunction<"openai-codex-responses", OpenAICodexResponsesOptions>;

/** Simple stream function for OpenAI Codex Responses API */
export declare const streamSimpleOpenAICodexResponses: StreamFunction<"openai-codex-responses", SimpleStreamOptions>;
```

### GitHub Copilot Headers

**Module:** `@mariozechner/pi-ai/dist/providers/github-copilot-headers`

```typescript
import type { Message } from "../types.js";

/** Infer Copilot initiator from message history */
declare function inferCopilotInitiator(messages: Message[]): "user" | "agent";

/** Check if messages contain vision/image input */
declare function hasCopilotVisionInput(messages: Message[]): boolean;

/** Build dynamic headers for Copilot requests */
declare function buildCopilotDynamicHeaders(params: {
  messages: Message[];
  hasImages: boolean;
}): Record<string, string>;
```

### Simple Options

**Module:** `@mariozechner/pi-ai/dist/providers/simple-options`

```typescript
import type { 
  Api, 
  Model, 
  SimpleStreamOptions, 
  StreamOptions, 
  ThinkingBudgets, 
  ThinkingLevel 
} from "../types.js";

/** Build base options from simple options */
declare function buildBaseOptions(
  model: Model<Api>, 
  options?: SimpleStreamOptions, 
  apiKey?: string
): StreamOptions;

/** Clamp reasoning level to exclude xhigh */
declare function clampReasoning(
  effort: ThinkingLevel | undefined
): Exclude<ThinkingLevel, "xhigh"> | undefined;

/** Adjust max tokens to accommodate thinking budget */
declare function adjustMaxTokensForThinking(
  baseMaxTokens: number, 
  modelMaxTokens: number, 
  reasoningLevel: ThinkingLevel, 
  customBudgets?: ThinkingBudgets
): { maxTokens: number; thinkingBudget: number };
```

### Transform Messages

**Module:** `@mariozechner/pi-ai/dist/providers/transform-messages`

```typescript
import type { Api, AssistantMessage, Message, Model } from "../types.js";

/**
 * Normalize tool call ID for cross-provider compatibility.
 * OpenAI Responses API generates 450+ char IDs with special characters.
 * Anthropic requires IDs matching ^[a-zA-Z0-9_-]+$ (max 64 chars).
 */
declare function transformMessages<TApi extends Api>(
  messages: Message[], 
  model: Model<TApi>, 
  normalizeToolCallId?: (id: string, model: Model<TApi>, source: AssistantMessage) => string
): Message[];
```

### Register Builtins

**Module:** `@mariozechner/pi-ai/dist/providers/register-builtins`

```typescript
/** Register all built-in API providers */
declare function registerBuiltInApiProviders(): void;

/** Reset API providers to defaults */
declare function resetApiProviders(): void;
```

---

## Utilities

### Event Stream

**Module:** `@mariozechner/pi-ai/dist/utils/event-stream`

```typescript
import type { AssistantMessage, AssistantMessageEvent } from "../types.js";

/** Generic async event stream with completion detection */
export declare class EventStream<T, R = T> implements AsyncIterable<T> {
  constructor(
    isComplete: (event: T) => boolean, 
    extractResult: (event: T) => R
  );
  
  /** Push an event to the stream */
  push(event: T): void;
  
  /** End the stream with an optional result */
  end(result?: R): void;
  
  /** Async iterator implementation */
  [Symbol.asyncIterator](): AsyncIterator<T>;
  
  /** Get the final result (awaits completion) */
  result(): Promise<R>;
}

/** Specialized event stream for assistant messages */
export declare class AssistantMessageEventStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
  constructor();
}

/** Factory function for AssistantMessageEventStream (for extensions) */
declare function createAssistantMessageEventStream(): AssistantMessageEventStream;
```

### JSON Parse

**Module:** `@mariozechner/pi-ai/dist/utils/json-parse`

```typescript
/**
 * Attempts to parse potentially incomplete JSON during streaming.
 * Always returns a valid object, even if the JSON is incomplete.
 */
declare function parseStreamingJson<T = any>(partialJson: string | undefined): T;
```

### Overflow Detection

**Module:** `@mariozechner/pi-ai/dist/utils/overflow`

```typescript
import type { AssistantMessage } from "../types.js";

/**
 * Check if an assistant message represents a context overflow error.
 * 
 * Handles:
 * 1. Error-based overflow: stopReason "error" with specific message patterns
 * 2. Silent overflow: usage.input exceeds contextWindow
 * 
 * ## Reliable Detection:
 * - Anthropic, OpenAI, Google Gemini, xAI, Groq, Cerebras, Mistral
 * - OpenRouter, llama.cpp, LM Studio, Kimi For Coding
 * 
 * ## Unreliable Detection:
 * - z.ai: Sometimes silent (use contextWindow param)
 * - Ollama: Silently truncates (cannot detect)
 * 
 * @param message - The assistant message to check
 * @param contextWindow - Optional context window size for silent overflow detection
 */
declare function isContextOverflow(
  message: AssistantMessage, 
  contextWindow?: number
): boolean;

/** Get overflow patterns for testing */
declare function getOverflowPatterns(): RegExp[];
```

### TypeBox Helpers

**Module:** `@mariozechner/pi-ai/dist/utils/typebox-helpers`

```typescript
import { type TUnsafe } from "@sinclair/typebox";

/**
 * Creates a string enum schema compatible with Google's API and other providers
 * that don't support anyOf/const patterns.
 * 
 * @example
 * const OperationSchema = StringEnum(["add", "subtract", "multiply", "divide"], {
 *   description: "The operation to perform"
 * });
 * 
 * type Operation = Static<typeof OperationSchema>; 
 * // "add" | "subtract" | "multiply" | "divide"
 */
declare function StringEnum<T extends readonly string[]>(
  values: T, 
  options?: {
    description?: string;
    default?: T[number];
  }
): TUnsafe<T[number]>;
```

### Validation

**Module:** `@mariozechner/pi-ai/dist/utils/validation`

```typescript
import type { Tool, ToolCall } from "../types.js";

/**
 * Finds a tool by name and validates the tool call arguments
 * @throws Error if tool is not found or validation fails
 */
declare function validateToolCall(tools: Tool[], toolCall: ToolCall): any;

/**
 * Validates tool call arguments against the tool's TypeBox schema
 * @throws Error with formatted message if validation fails
 */
declare function validateToolArguments(tool: Tool, toolCall: ToolCall): any;
```

### Sanitize Unicode

**Module:** `@mariozechner/pi-ai/dist/utils/sanitize-unicode`

```typescript
/**
 * Removes unpaired Unicode surrogate characters from a string.
 * 
 * Unpaired surrogates cause JSON serialization errors.
 * Valid emoji (properly paired surrogates) are NOT affected.
 * 
 * @example
 * sanitizeSurrogates("Hello 🙈 World") // => "Hello 🙈 World"
 * 
 * const unpaired = String.fromCharCode(0xD83D);
 * sanitizeSurrogates(`Text ${unpaired} here`) // => "Text  here"
 */
declare function sanitizeSurrogates(text: string): string;
```

---

## OAuth Utilities

### OAuth Index

**Module:** `@mariozechner/pi-ai/dist/utils/oauth/index`

```typescript
import type { OAuthCredentials, OAuthProviderId, OAuthProviderInfo, OAuthProviderInterface } from "./types.js";

// Re-exports
export { anthropicOAuthProvider, loginAnthropic, refreshAnthropicToken } from "./anthropic.js";
export { 
  getGitHubCopilotBaseUrl, 
  githubCopilotOAuthProvider, 
  loginGitHubCopilot, 
  normalizeDomain, 
  refreshGitHubCopilotToken 
} from "./github-copilot.js";
export { antigravityOAuthProvider, loginAntigravity, refreshAntigravityToken } from "./google-antigravity.js";
export { geminiCliOAuthProvider, loginGeminiCli, refreshGoogleCloudToken } from "./google-gemini-cli.js";
export { loginOpenAICodex, openaiCodexOAuthProvider, refreshOpenAICodexToken } from "./openai-codex.js";
export * from "./types.js";

/** Get an OAuth provider by ID */
declare function getOAuthProvider(id: OAuthProviderId): OAuthProviderInterface | undefined;

/** Register a custom OAuth provider */
declare function registerOAuthProvider(provider: OAuthProviderInterface): void;

/** Get all registered OAuth providers */
declare function getOAuthProviders(): OAuthProviderInterface[];

/** @deprecated Use getOAuthProviders() instead */
declare function getOAuthProviderInfoList(): OAuthProviderInfo[];

/** @deprecated Use getOAuthProvider(id).refreshToken() instead */
declare function refreshOAuthToken(
  providerId: OAuthProviderId, 
  credentials: OAuthCredentials
): Promise<OAuthCredentials>;

/**
 * Get API key for a provider from OAuth credentials.
 * Automatically refreshes expired tokens.
 * @returns API key and updated credentials, or null if no credentials
 * @throws Error if refresh fails
 */
declare function getOAuthApiKey(
  providerId: OAuthProviderId, 
  credentials: Record<string, OAuthCredentials>
): Promise<{ newCredentials: OAuthCredentials; apiKey: string } | null>;
```

### OAuth Types

**Module:** `@mariozechner/pi-ai/dist/utils/oauth/types`

```typescript
import type { Api, Model } from "../../types.js";

/** OAuth credentials storage */
export type OAuthCredentials = {
  refresh: string;
  access: string;
  expires: number;
  [key: string]: unknown;
};

/** OAuth provider identifier */
export type OAuthProviderId = string;

/** @deprecated Use OAuthProviderId instead */
export type OAuthProvider = OAuthProviderId;

/** OAuth prompt configuration */
export type OAuthPrompt = {
  message: string;
  placeholder?: string;
  allowEmpty?: boolean;
};

/** OAuth authorization info */
export type OAuthAuthInfo = {
  url: string;
  instructions?: string;
};

/** OAuth login callback handlers */
export interface OAuthLoginCallbacks {
  onAuth: (info: OAuthAuthInfo) => void;
  onPrompt: (prompt: OAuthPrompt) => Promise<string>;
  onProgress?: (message: string) => void;
  onManualCodeInput?: () => Promise<string>;
  signal?: AbortSignal;
}

/** OAuth provider interface */
export interface OAuthProviderInterface {
  readonly id: OAuthProviderId;
  readonly name: string;
  
  /** Run the login flow, return credentials to persist */
  login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials>;
  
  /** Whether login uses a local callback server. */
  usesCallbackServer?: boolean;
  
  /** Refresh expired credentials */
  refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials>;
  
  /** Convert credentials to API key string */
  getApiKey(credentials: OAuthCredentials): string;
  
  /** Optional: modify models for this provider */
  modifyModels?(models: Model<Api>[], credentials: OAuthCredentials): Model<Api>[];
}

/** @deprecated Use OAuthProviderInterface instead */
export interface OAuthProviderInfo {
  id: OAuthProviderId;
  name: string;
  available: boolean;
}
```

### PKCE

**Module:** `@mariozechner/pi-ai/dist/utils/oauth/pkce`

```typescript
/**
 * Generate PKCE code verifier and challenge.
 * Uses Web Crypto API for cross-platform compatibility.
 */
declare function generatePKCE(): Promise<{
  verifier: string;
  challenge: string;
}>;
```

### Anthropic OAuth

**Module:** `@mariozechner/pi-ai/dist/utils/oauth/anthropic`

```typescript
import type { OAuthCredentials, OAuthProviderInterface } from "./types.js";

/**
 * Login with Anthropic OAuth (device code flow)
 * @param onAuthUrl - Callback to handle the authorization URL
 * @param onPromptCode - Callback to prompt user for the authorization code
 */
declare function loginAnthropic(
  onAuthUrl: (url: string) => void, 
  onPromptCode: () => Promise<string>
): Promise<OAuthCredentials>;

/** Refresh Anthropic OAuth token */
declare function refreshAnthropicToken(refreshToken: string): Promise<OAuthCredentials>;

/** Anthropic OAuth provider implementation */
export declare const anthropicOAuthProvider: OAuthProviderInterface;
```

### GitHub Copilot OAuth

**Module:** `@mariozechner/pi-ai/dist/utils/oauth/github-copilot`

```typescript
import type { OAuthCredentials, OAuthProviderInterface } from "./types.js";

/** Normalize domain input to standard format */
declare function normalizeDomain(input: string): string | null;

/** Get GitHub Copilot base URL for API requests */
declare function getGitHubCopilotBaseUrl(
  token?: string, 
  enterpriseDomain?: string
): string;

/** Refresh GitHub Copilot token */
declare function refreshGitHubCopilotToken(
  refreshToken: string, 
  enterpriseDomain?: string
): Promise<OAuthCredentials>;

/**
 * Login with GitHub Copilot OAuth (device code flow)
 */
declare function loginGitHubCopilot(options: {
  onAuth: (url: string, instructions?: string) => void;
  onPrompt: (prompt: {
    message: string;
    placeholder?: string;
    allowEmpty?: boolean;
  }) => Promise<string>;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}): Promise<OAuthCredentials>;

/** GitHub Copilot OAuth provider implementation */
export declare const githubCopilotOAuthProvider: OAuthProviderInterface;
```

### Google Antigravity OAuth

**Module:** `@mariozechner/pi-ai/dist/utils/oauth/google-antigravity`

```typescript
import type { OAuthCredentials, OAuthProviderInterface } from "./types.js";

/** Refresh Antigravity token */
declare function refreshAntigravityToken(
  refreshToken: string, 
  projectId: string
): Promise<OAuthCredentials>;

/**
 * Login with Antigravity OAuth.
 * Provides access to Gemini 3, Claude, GPT-OSS via Google Cloud.
 * 
 * NOTE: Uses Node.js http.createServer - CLI only.
 */
declare function loginAntigravity(
  onAuth: (info: { url: string; instructions?: string }) => void, 
  onProgress?: (message: string) => void, 
  onManualCodeInput?: () => Promise<string>
): Promise<OAuthCredentials>;

/** Antigravity OAuth provider implementation */
export declare const antigravityOAuthProvider: OAuthProviderInterface;
```

### Google Gemini CLI OAuth

**Module:** `@mariozechner/pi-ai/dist/utils/oauth/google-gemini-cli`

```typescript
import type { OAuthCredentials, OAuthProviderInterface } from "./types.js";

/** Refresh Google Cloud Code Assist token */
declare function refreshGoogleCloudToken(
  refreshToken: string, 
  projectId: string
): Promise<OAuthCredentials>;

/**
 * Login with Gemini CLI (Google Cloud Code Assist) OAuth.
 * Standard Gemini models only (gemini-2.0-flash, gemini-2.5-*).
 * 
 * NOTE: Uses Node.js http.createServer - CLI only.
 */
declare function loginGeminiCli(
  onAuth: (info: { url: string; instructions?: string }) => void, 
  onProgress?: (message: string) => void, 
  onManualCodeInput?: () => Promise<string>
): Promise<OAuthCredentials>;

/** Gemini CLI OAuth provider implementation */
export declare const geminiCliOAuthProvider: OAuthProviderInterface;
```

### OpenAI Codex OAuth

**Module:** `@mariozechner/pi-ai/dist/utils/oauth/openai-codex`

```typescript
import type { OAuthCredentials, OAuthPrompt, OAuthProviderInterface } from "./types.js";

/**
 * Login with OpenAI Codex OAuth (ChatGPT OAuth flow).
 * 
 * NOTE: Uses Node.js crypto and http - CLI only.
 */
declare function loginOpenAICodex(options: {
  onAuth: (info: { url: string; instructions?: string }) => void;
  onPrompt: (prompt: OAuthPrompt) => Promise<string>;
  onProgress?: (message: string) => void;
  onManualCodeInput?: () => Promise<string>;
  originator?: string;
}): Promise<OAuthCredentials>;

/** Refresh OpenAI Codex OAuth token */
declare function refreshOpenAICodexToken(refreshToken: string): Promise<OAuthCredentials>;

/** OpenAI Codex OAuth provider implementation */
export declare const openaiCodexOAuthProvider: OAuthProviderInterface;
```

---

## Usage Examples

### Basic Streaming

```typescript
import { stream, getModel, Type } from "@mariozechner/pi-ai";

const model = getModel("anthropic", "claude-sonnet-4-5");

const eventStream = stream(model, {
  systemPrompt: "You are a helpful assistant.",
  messages: [
    { role: "user", content: "Hello!", timestamp: Date.now() }
  ]
});

for await (const event of eventStream) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
  }
}

const message = await eventStream.result();
console.log("Usage:", message.usage);
```

### With Tools

```typescript
import { stream, getModel, Type, validateToolCall } from "@mariozechner/pi-ai";

const tools = [{
  name: "get_weather",
  description: "Get current weather for a location",
  parameters: Type.Object({
    location: Type.String({ description: "City name" }),
    unit: Type.Optional(Type.Union([
      Type.Literal("celsius"),
      Type.Literal("fahrenheit")
    ]))
  })
}];

const eventStream = stream(model, {
  messages: [{ role: "user", content: "What's the weather in Tokyo?", timestamp: Date.now() }],
  tools
});

for await (const event of eventStream) {
  if (event.type === "toolcall_end") {
    const args = validateToolCall(tools, event.toolCall);
    console.log("Tool call:", event.toolCall.name, args);
  }
}
```

### Simple Streaming with Reasoning

```typescript
import { streamSimple, getModel } from "@mariozechner/pi-ai";

const model = getModel("anthropic", "claude-opus-4-6");

const eventStream = streamSimple(model, {
  messages: [{ role: "user", content: "Solve this math problem...", timestamp: Date.now() }]
}, {
  reasoning: "high" // Enables extended thinking
});

for await (const event of eventStream) {
  if (event.type === "thinking_delta") {
    console.log("[thinking]", event.delta);
  } else if (event.type === "text_delta") {
    process.stdout.write(event.delta);
  }
}
```

### OAuth Login

```typescript
import { loginAnthropic, getOAuthProvider } from "@mariozechner/pi-ai";

// Manual login
const credentials = await loginAnthropic(
  (url) => console.log("Open:", url),
  () => prompt("Enter code:")
);

// Or via provider interface
const provider = getOAuthProvider("anthropic");
const creds = await provider?.login({
  onAuth: ({ url }) => console.log("Open:", url),
  onPrompt: (p) => Promise.resolve(prompt(p.message))
});
```

---

## Version

This reference was generated from `@mariozechner/pi-ai` TypeScript declarations.
