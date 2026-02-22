# pi-agent-core SDK Reference

> **Package:** `@mariozechner/pi-agent-core`  
> **Version:** As installed in pi-coding-agent  
> **Generated:** 2026-02-19

Complete API reference for building agents with the pi-agent-core SDK.

---

## Table of Contents

1. [Module: index](#module-index)
2. [Module: types](#module-types)
3. [Module: agent](#module-agent)
4. [Module: agent-loop](#module-agent-loop)
5. [Module: proxy](#module-proxy)

---

## Module: index

**File:** `dist/index.d.ts`

Re-exports all public APIs from the package.

```typescript
export * from "./agent.js";
export * from "./agent-loop.js";
export * from "./proxy.js";
export * from "./types.js";
```

---

## Module: types

**File:** `dist/types.d.ts`

Core type definitions for the agent system.

### Dependencies

```typescript
import type { 
  AssistantMessageEvent, 
  ImageContent, 
  Message, 
  Model, 
  SimpleStreamOptions, 
  streamSimple, 
  TextContent, 
  Tool, 
  ToolResultMessage 
} from "@mariozechner/pi-ai";
import type { Static, TSchema } from "@sinclair/typebox";
```

---

### Type: `StreamFn`

Stream function type that can return sync or Promise for async config lookup.

```typescript
type StreamFn = (
  ...args: Parameters<typeof streamSimple>
) => ReturnType<typeof streamSimple> | Promise<ReturnType<typeof streamSimple>>;
```

---

### Type: `ThinkingLevel`

Thinking/reasoning level for models that support extended thinking.

```typescript
type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
```

| Level | Description |
|-------|-------------|
| `"off"` | Disable thinking/reasoning |
| `"minimal"` | Minimal reasoning overhead |
| `"low"` | Low reasoning depth |
| `"medium"` | Moderate reasoning (default for most models) |
| `"high"` | Deep reasoning |
| `"xhigh"` | Maximum reasoning (OpenAI gpt-5.1-codex-max, gpt-5.2, gpt-5.2-codex, gpt-5.3, gpt-5.3-codex only) |

---

### Interface: `AgentLoopConfig`

Configuration for the agent loop. Extends `SimpleStreamOptions` from pi-ai.

```typescript
interface AgentLoopConfig extends SimpleStreamOptions {
  model: Model<any>;
  
  convertToLlm: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
  
  transformContext?: (
    messages: AgentMessage[], 
    signal?: AbortSignal
  ) => Promise<AgentMessage[]>;
  
  getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
  
  getSteeringMessages?: () => Promise<AgentMessage[]>;
  
  getFollowUpMessages?: () => Promise<AgentMessage[]>;
}
```

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `model` | `Model<any>` | Yes | The LLM model to use |
| `convertToLlm` | `(messages: AgentMessage[]) => Message[] \| Promise<Message[]>` | Yes | Converts AgentMessage[] to LLM-compatible Message[] before each call |
| `transformContext` | `(messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>` | No | Transform applied before `convertToLlm` for context pruning/injection |
| `getApiKey` | `(provider: string) => Promise<string \| undefined> \| string \| undefined` | No | Dynamic API key resolver for expiring tokens (e.g., GitHub Copilot OAuth) |
| `getSteeringMessages` | `() => Promise<AgentMessage[]>` | No | Returns steering messages to inject mid-run (interrupts tool execution) |
| `getFollowUpMessages` | `() => Promise<AgentMessage[]>` | No | Returns follow-up messages after agent finishes (continues conversation) |

#### Example: convertToLlm

```typescript
convertToLlm: (messages) => messages.flatMap(m => {
  if (m.role === "custom") {
    // Convert custom message to user message
    return [{ role: "user", content: m.content, timestamp: m.timestamp }];
  }
  if (m.role === "notification") {
    // Filter out UI-only messages
    return [];
  }
  // Pass through standard LLM messages
  return [m];
})
```

#### Example: transformContext

```typescript
transformContext: async (messages) => {
  if (estimateTokens(messages) > MAX_TOKENS) {
    return pruneOldMessages(messages);
  }
  return messages;
}
```

---

### Interface: `CustomAgentMessages`

Extensible interface for custom app messages. Apps extend via declaration merging.

```typescript
interface CustomAgentMessages {
  // Empty by default - apps extend this
}
```

#### Example: Declaration Merging

```typescript
declare module "@mariozechner/agent" {
  interface CustomAgentMessages {
    artifact: ArtifactMessage;
    notification: NotificationMessage;
  }
}
```

---

### Type: `AgentMessage`

Union of LLM messages plus any custom messages defined via `CustomAgentMessages`.

```typescript
type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages];
```

This abstraction allows apps to add custom message types while maintaining type safety and compatibility with base LLM messages.

---

### Interface: `AgentState`

Agent state containing all configuration and conversation data.

```typescript
interface AgentState {
  systemPrompt: string;
  model: Model<any>;
  thinkingLevel: ThinkingLevel;
  tools: AgentTool<any>[];
  messages: AgentMessage[];
  isStreaming: boolean;
  streamMessage: AgentMessage | null;
  pendingToolCalls: Set<string>;
  error?: string;
}
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `systemPrompt` | `string` | The system prompt for the agent |
| `model` | `Model<any>` | Current LLM model |
| `thinkingLevel` | `ThinkingLevel` | Current thinking/reasoning level |
| `tools` | `AgentTool<any>[]` | Available tools for the agent |
| `messages` | `AgentMessage[]` | Full conversation history |
| `isStreaming` | `boolean` | Whether agent is currently streaming a response |
| `streamMessage` | `AgentMessage \| null` | Current message being streamed (null when not streaming) |
| `pendingToolCalls` | `Set<string>` | IDs of tool calls currently executing |
| `error` | `string \| undefined` | Error message if something went wrong |

---

### Interface: `AgentToolResult<T>`

Result returned by tool execution.

```typescript
interface AgentToolResult<T> {
  content: (TextContent | ImageContent)[];
  details: T;
}
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `content` | `(TextContent \| ImageContent)[]` | Content to display/return to LLM |
| `details` | `T` | Typed details for the tool result |

---

### Type: `AgentToolUpdateCallback<T>`

Callback for streaming tool execution updates.

```typescript
type AgentToolUpdateCallback<T = any> = (partialResult: AgentToolResult<T>) => void;
```

---

### Interface: `AgentTool<TParameters, TDetails>`

Tool definition with typed parameters and execution function. Extends `Tool<TParameters>` from pi-ai.

```typescript
interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
  label: string;
  execute: (
    toolCallId: string,
    params: Static<TParameters>,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback<TDetails>
  ) => Promise<AgentToolResult<TDetails>>;
}
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `label` | `string` | Human-readable label for the tool |
| `execute` | Function | Async function that executes the tool |

#### Execute Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `toolCallId` | `string` | Unique ID for this tool call |
| `params` | `Static<TParameters>` | Parsed parameters matching the schema |
| `signal` | `AbortSignal \| undefined` | Signal for cancellation |
| `onUpdate` | `AgentToolUpdateCallback<TDetails> \| undefined` | Callback for streaming updates |

---

### Interface: `AgentContext`

Context passed to the agent loop.

```typescript
interface AgentContext {
  systemPrompt: string;
  messages: AgentMessage[];
  tools?: AgentTool<any>[];
}
```

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `systemPrompt` | `string` | Yes | System prompt for the conversation |
| `messages` | `AgentMessage[]` | Yes | Conversation history |
| `tools` | `AgentTool<any>[]` | No | Available tools |

---

### Type: `AgentEvent`

Events emitted by the Agent for UI updates. Provides fine-grained lifecycle information.

```typescript
type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }
  | { type: "turn_start" }
  | { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
  | { type: "message_end"; message: AgentMessage }
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
  | { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
  | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };
```

#### Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| `agent_start` | Agent begins processing | None |
| `agent_end` | Agent finishes all processing | `messages: AgentMessage[]` |
| `turn_start` | New LLM turn begins | None |
| `turn_end` | LLM turn completes | `message: AgentMessage`, `toolResults: ToolResultMessage[]` |
| `message_start` | Message streaming begins | `message: AgentMessage` |
| `message_update` | Message streaming delta | `message: AgentMessage`, `assistantMessageEvent: AssistantMessageEvent` |
| `message_end` | Message streaming ends | `message: AgentMessage` |
| `tool_execution_start` | Tool begins executing | `toolCallId`, `toolName`, `args` |
| `tool_execution_update` | Tool streams partial result | `toolCallId`, `toolName`, `args`, `partialResult` |
| `tool_execution_end` | Tool finishes | `toolCallId`, `toolName`, `result`, `isError` |

---

## Module: agent

**File:** `dist/agent.d.ts`

Main Agent class for building conversational AI agents.

### Dependencies

```typescript
import { 
  type ImageContent, 
  type Message, 
  type Model, 
  type ThinkingBudgets, 
  type Transport 
} from "@mariozechner/pi-ai";
import type { 
  AgentEvent, 
  AgentMessage, 
  AgentState, 
  AgentTool, 
  StreamFn, 
  ThinkingLevel 
} from "./types.js";
```

---

### Interface: `AgentOptions`

Options for constructing an Agent instance.

```typescript
interface AgentOptions {
  initialState?: Partial<AgentState>;
  
  convertToLlm?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
  
  transformContext?: (
    messages: AgentMessage[], 
    signal?: AbortSignal
  ) => Promise<AgentMessage[]>;
  
  steeringMode?: "all" | "one-at-a-time";
  
  followUpMode?: "all" | "one-at-a-time";
  
  streamFn?: StreamFn;
  
  sessionId?: string;
  
  getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
  
  thinkingBudgets?: ThinkingBudgets;
  
  transport?: Transport;
  
  maxRetryDelayMs?: number;
}
```

#### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `initialState` | `Partial<AgentState>` | `{}` | Initial state overrides |
| `convertToLlm` | Function | Default converter | Converts AgentMessage[] to Message[] |
| `transformContext` | Function | `undefined` | Transform context before conversion |
| `steeringMode` | `"all" \| "one-at-a-time"` | `"all"` | How to deliver steering messages |
| `followUpMode` | `"all" \| "one-at-a-time"` | `"all"` | How to deliver follow-up messages |
| `streamFn` | `StreamFn` | `streamSimple` | Custom stream function |
| `sessionId` | `string` | `undefined` | Session ID for provider caching |
| `getApiKey` | Function | `undefined` | Dynamic API key resolver |
| `thinkingBudgets` | `ThinkingBudgets` | `undefined` | Custom token budgets for thinking |
| `transport` | `Transport` | `undefined` | Preferred transport for multi-transport providers |
| `maxRetryDelayMs` | `number` | `60000` | Max wait for server retry requests (0 = no cap) |

---

### Class: `Agent`

Main agent class for managing conversations with LLMs.

```typescript
class Agent {
  constructor(opts?: AgentOptions);
  
  // Properties
  streamFn: StreamFn;
  getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
  
  // Getters/Setters
  get sessionId(): string | undefined;
  set sessionId(value: string | undefined);
  
  get thinkingBudgets(): ThinkingBudgets | undefined;
  set thinkingBudgets(value: ThinkingBudgets | undefined);
  
  get transport(): Transport;
  setTransport(value: Transport): void;
  
  get maxRetryDelayMs(): number | undefined;
  set maxRetryDelayMs(value: number | undefined);
  
  get state(): AgentState;
  
  // Event subscription
  subscribe(fn: (e: AgentEvent) => void): () => void;
  
  // Configuration
  setSystemPrompt(v: string): void;
  setModel(m: Model<any>): void;
  setThinkingLevel(l: ThinkingLevel): void;
  setTools(t: AgentTool<any>[]): void;
  
  // Steering/Follow-up modes
  setSteeringMode(mode: "all" | "one-at-a-time"): void;
  getSteeringMode(): "all" | "one-at-a-time";
  setFollowUpMode(mode: "all" | "one-at-a-time"): void;
  getFollowUpMode(): "all" | "one-at-a-time";
  
  // Message management
  replaceMessages(ms: AgentMessage[]): void;
  appendMessage(m: AgentMessage): void;
  clearMessages(): void;
  
  // Steering and follow-up queues
  steer(m: AgentMessage): void;
  followUp(m: AgentMessage): void;
  clearSteeringQueue(): void;
  clearFollowUpQueue(): void;
  clearAllQueues(): void;
  hasQueuedMessages(): boolean;
  
  // Lifecycle
  abort(): void;
  waitForIdle(): Promise<void>;
  reset(): void;
  
  // Prompting
  prompt(message: AgentMessage | AgentMessage[]): Promise<void>;
  prompt(input: string, images?: ImageContent[]): Promise<void>;
  continue(): Promise<void>;
}
```

---

#### Constructor

```typescript
constructor(opts?: AgentOptions)
```

Creates a new Agent instance with optional configuration.

---

#### Property: `streamFn`

```typescript
streamFn: StreamFn;
```

The stream function used for LLM calls. Can be replaced at runtime.

---

#### Property: `getApiKey`

```typescript
getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
```

Optional dynamic API key resolver for expiring tokens.

---

#### Getter/Setter: `sessionId`

```typescript
get sessionId(): string | undefined;
set sessionId(value: string | undefined);
```

Session ID used for provider caching (e.g., OpenAI Codex). Set when switching sessions.

---

#### Getter/Setter: `thinkingBudgets`

```typescript
get thinkingBudgets(): ThinkingBudgets | undefined;
set thinkingBudgets(value: ThinkingBudgets | undefined);
```

Custom thinking budgets for token-based providers.

---

#### Getter: `transport`

```typescript
get transport(): Transport;
```

Get the current preferred transport.

---

#### Method: `setTransport`

```typescript
setTransport(value: Transport): void;
```

Set the preferred transport for providers that support multiple transports.

---

#### Getter/Setter: `maxRetryDelayMs`

```typescript
get maxRetryDelayMs(): number | undefined;
set maxRetryDelayMs(value: number | undefined);
```

Maximum delay in milliseconds to wait for server-requested retries. Default: 60000 (60 seconds). Set to 0 to disable the cap.

---

#### Getter: `state`

```typescript
get state(): AgentState;
```

Returns the current agent state (read-only).

---

#### Method: `subscribe`

```typescript
subscribe(fn: (e: AgentEvent) => void): () => void;
```

Subscribe to agent events. Returns an unsubscribe function.

**Example:**

```typescript
const unsubscribe = agent.subscribe((event) => {
  if (event.type === "message_update") {
    console.log("Streaming:", event.message);
  }
});

// Later: unsubscribe();
```

---

#### Method: `setSystemPrompt`

```typescript
setSystemPrompt(v: string): void;
```

Set the system prompt for the agent.

---

#### Method: `setModel`

```typescript
setModel(m: Model<any>): void;
```

Set the LLM model to use.

---

#### Method: `setThinkingLevel`

```typescript
setThinkingLevel(l: ThinkingLevel): void;
```

Set the thinking/reasoning level.

---

#### Method: `setTools`

```typescript
setTools(t: AgentTool<any>[]): void;
```

Set the available tools for the agent.

---

#### Method: `setSteeringMode`

```typescript
setSteeringMode(mode: "all" | "one-at-a-time"): void;
```

Set how steering messages are delivered:
- `"all"`: Send all queued steering messages at once
- `"one-at-a-time"`: Send one steering message per turn

---

#### Method: `getSteeringMode`

```typescript
getSteeringMode(): "all" | "one-at-a-time";
```

Get the current steering mode.

---

#### Method: `setFollowUpMode`

```typescript
setFollowUpMode(mode: "all" | "one-at-a-time"): void;
```

Set how follow-up messages are delivered:
- `"all"`: Send all queued follow-up messages at once
- `"one-at-a-time"`: Send one follow-up message per turn

---

#### Method: `getFollowUpMode`

```typescript
getFollowUpMode(): "all" | "one-at-a-time";
```

Get the current follow-up mode.

---

#### Method: `replaceMessages`

```typescript
replaceMessages(ms: AgentMessage[]): void;
```

Replace the entire message history.

---

#### Method: `appendMessage`

```typescript
appendMessage(m: AgentMessage): void;
```

Append a message to the history without triggering a prompt.

---

#### Method: `clearMessages`

```typescript
clearMessages(): void;
```

Clear all messages from the conversation.

---

#### Method: `steer`

```typescript
steer(m: AgentMessage): void;
```

Queue a steering message to interrupt the agent mid-run. Delivered after current tool execution completes, skips remaining tools.

**Example:**

```typescript
// User types while agent is working
agent.steer({
  role: "user",
  content: [{ type: "text", text: "Actually, skip the tests" }],
  timestamp: Date.now()
});
```

---

#### Method: `followUp`

```typescript
followUp(m: AgentMessage): void;
```

Queue a follow-up message to be processed after the agent finishes. Delivered only when agent has no more tool calls or steering messages.

---

#### Method: `clearSteeringQueue`

```typescript
clearSteeringQueue(): void;
```

Clear all queued steering messages.

---

#### Method: `clearFollowUpQueue`

```typescript
clearFollowUpQueue(): void;
```

Clear all queued follow-up messages.

---

#### Method: `clearAllQueues`

```typescript
clearAllQueues(): void;
```

Clear both steering and follow-up queues.

---

#### Method: `hasQueuedMessages`

```typescript
hasQueuedMessages(): boolean;
```

Check if there are any queued steering or follow-up messages.

---

#### Method: `abort`

```typescript
abort(): void;
```

Abort the current operation (streaming or tool execution).

---

#### Method: `waitForIdle`

```typescript
waitForIdle(): Promise<void>;
```

Wait for the agent to finish all current operations.

---

#### Method: `reset`

```typescript
reset(): void;
```

Reset the agent state (clears messages, queues, and errors).

---

#### Method: `prompt` (overloads)

**Overload 1: AgentMessage**

```typescript
prompt(message: AgentMessage | AgentMessage[]): Promise<void>;
```

Send one or more AgentMessages as a prompt.

**Overload 2: String with optional images**

```typescript
prompt(input: string, images?: ImageContent[]): Promise<void>;
```

Send a text prompt with optional images.

**Example:**

```typescript
// Simple text prompt
await agent.prompt("Hello, how are you?");

// With images
await agent.prompt("Describe this image", [
  { type: "image", data: base64Data, mediaType: "image/png" }
]);

// Full AgentMessage
await agent.prompt({
  role: "user",
  content: [{ type: "text", text: "Help me debug this" }],
  timestamp: Date.now()
});
```

---

#### Method: `continue`

```typescript
continue(): Promise<void>;
```

Continue from current context without adding a new message. Used for retries and resuming queued messages.

**Important:** The last message in context must convert to a `user` or `toolResult` message via `convertToLlm`.

---

## Module: agent-loop

**File:** `dist/agent-loop.d.ts`

Low-level agent loop functions that work with AgentMessage throughout.

### Dependencies

```typescript
import { EventStream } from "@mariozechner/pi-ai";
import type { 
  AgentContext, 
  AgentEvent, 
  AgentLoopConfig, 
  AgentMessage, 
  StreamFn 
} from "./types.js";
```

---

### Function: `agentLoop`

Start an agent loop with a new prompt message.

```typescript
function agentLoop(
  prompts: AgentMessage[],
  context: AgentContext,
  config: AgentLoopConfig,
  signal?: AbortSignal,
  streamFn?: StreamFn
): EventStream<AgentEvent, AgentMessage[]>;
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompts` | `AgentMessage[]` | Yes | Prompt messages to add to context |
| `context` | `AgentContext` | Yes | Current agent context |
| `config` | `AgentLoopConfig` | Yes | Loop configuration |
| `signal` | `AbortSignal` | No | Cancellation signal |
| `streamFn` | `StreamFn` | No | Custom stream function |

#### Returns

`EventStream<AgentEvent, AgentMessage[]>` - Stream of agent events, resolves to final messages.

**Example:**

```typescript
const stream = agentLoop(
  [{ role: "user", content: [{ type: "text", text: "Hello" }], timestamp: Date.now() }],
  { systemPrompt: "You are helpful.", messages: [], tools: [] },
  { model: anthropicClaude4, convertToLlm: defaultConverter }
);

for await (const event of stream) {
  console.log(event.type);
}

const finalMessages = await stream;
```

---

### Function: `agentLoopContinue`

Continue an agent loop from the current context without adding a new message.

```typescript
function agentLoopContinue(
  context: AgentContext,
  config: AgentLoopConfig,
  signal?: AbortSignal,
  streamFn?: StreamFn
): EventStream<AgentEvent, AgentMessage[]>;
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `context` | `AgentContext` | Yes | Current agent context |
| `config` | `AgentLoopConfig` | Yes | Loop configuration |
| `signal` | `AbortSignal` | No | Cancellation signal |
| `streamFn` | `StreamFn` | No | Custom stream function |

#### Returns

`EventStream<AgentEvent, AgentMessage[]>` - Stream of agent events, resolves to final messages.

**Important:** The last message in context must convert to a `user` or `toolResult` message via `convertToLlm`. If it doesn't, the LLM provider will reject the request.

---

## Module: proxy

**File:** `dist/proxy.d.ts`

Proxy stream function for apps that route LLM calls through a server.

### Dependencies

```typescript
import { 
  type AssistantMessage, 
  type AssistantMessageEvent, 
  type Context, 
  EventStream, 
  type Model, 
  type SimpleStreamOptions, 
  type StopReason 
} from "@mariozechner/pi-ai";
```

---

### Type: `ProxyAssistantMessageEvent`

Proxy event types - server sends these with partial field stripped to reduce bandwidth.

```typescript
type ProxyAssistantMessageEvent =
  | { type: "start" }
  | { type: "text_start"; contentIndex: number }
  | { type: "text_delta"; contentIndex: number; delta: string }
  | { type: "text_end"; contentIndex: number; contentSignature?: string }
  | { type: "thinking_start"; contentIndex: number }
  | { type: "thinking_delta"; contentIndex: number; delta: string }
  | { type: "thinking_end"; contentIndex: number; contentSignature?: string }
  | { type: "toolcall_start"; contentIndex: number; id: string; toolName: string }
  | { type: "toolcall_delta"; contentIndex: number; delta: string }
  | { type: "toolcall_end"; contentIndex: number }
  | { type: "done"; reason: Extract<StopReason, "stop" | "length" | "toolUse">; usage: AssistantMessage["usage"] }
  | { type: "error"; reason: Extract<StopReason, "aborted" | "error">; errorMessage?: string; usage: AssistantMessage["usage"] };
```

#### Event Types

| Event | Description | Fields |
|-------|-------------|--------|
| `start` | Stream begins | None |
| `text_start` | Text content begins | `contentIndex` |
| `text_delta` | Text chunk received | `contentIndex`, `delta` |
| `text_end` | Text content ends | `contentIndex`, `contentSignature?` |
| `thinking_start` | Thinking/reasoning begins | `contentIndex` |
| `thinking_delta` | Thinking chunk received | `contentIndex`, `delta` |
| `thinking_end` | Thinking ends | `contentIndex`, `contentSignature?` |
| `toolcall_start` | Tool call begins | `contentIndex`, `id`, `toolName` |
| `toolcall_delta` | Tool args chunk | `contentIndex`, `delta` |
| `toolcall_end` | Tool call ends | `contentIndex` |
| `done` | Stream completes successfully | `reason`, `usage` |
| `error` | Stream ends with error | `reason`, `errorMessage?`, `usage` |

---

### Interface: `ProxyStreamOptions`

Options for the proxy stream function. Extends `SimpleStreamOptions`.

```typescript
interface ProxyStreamOptions extends SimpleStreamOptions {
  authToken: string;
  proxyUrl: string;
}
```

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `authToken` | `string` | Yes | Auth token for the proxy server |
| `proxyUrl` | `string` | Yes | Proxy server URL (e.g., `"https://genai.example.com"`) |

---

### Function: `streamProxy`

Stream function that proxies through a server instead of calling LLM providers directly.

```typescript
function streamProxy(
  model: Model<any>,
  context: Context,
  options: ProxyStreamOptions
): ProxyMessageEventStream;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `Model<any>` | The LLM model to use |
| `context` | `Context` | Conversation context |
| `options` | `ProxyStreamOptions` | Proxy configuration |

#### Returns

`ProxyMessageEventStream` - Extended `EventStream<AssistantMessageEvent, AssistantMessage>`.

The server strips the `partial` field from delta events to reduce bandwidth. The client reconstructs the partial message locally.

**Example:**

```typescript
const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: await getAuthToken(),
      proxyUrl: "https://genai.example.com",
    }),
});
```

---

## Usage Examples

### Basic Agent Setup

```typescript
import { Agent, AgentTool } from "@mariozechner/pi-agent-core";
import { anthropicClaude4Sonnet } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

// Define a tool
const greetTool: AgentTool<typeof GreetParams> = {
  name: "greet",
  label: "Greet User",
  description: "Greet a user by name",
  parameters: Type.Object({
    name: Type.String({ description: "Name to greet" })
  }),
  execute: async (toolCallId, params) => ({
    content: [{ type: "text", text: `Hello, ${params.name}!` }],
    details: { greeted: params.name }
  })
};

// Create agent
const agent = new Agent({
  initialState: {
    model: anthropicClaude4Sonnet,
    systemPrompt: "You are a helpful assistant.",
    thinkingLevel: "medium",
    tools: [greetTool]
  }
});

// Subscribe to events
agent.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      process.stdout.write(event.assistantMessageEvent.delta ?? "");
      break;
    case "tool_execution_start":
      console.log(`\nExecuting: ${event.toolName}`);
      break;
  }
});

// Send prompt
await agent.prompt("Hello! Can you greet Mario?");
```

### Steering Mid-Conversation

```typescript
// User sends message while agent is working
agent.steer({
  role: "user",
  content: [{ type: "text", text: "Actually, cancel that and do X instead" }],
  timestamp: Date.now()
});
```

### Custom Context Transform

```typescript
const agent = new Agent({
  transformContext: async (messages) => {
    // Prune old messages if context too large
    const tokens = estimateTokens(messages);
    if (tokens > 100000) {
      return messages.slice(-50); // Keep last 50 messages
    }
    return messages;
  }
});
```

### Proxy Setup

```typescript
import { Agent, streamProxy } from "@mariozechner/pi-agent-core";

const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: process.env.PROXY_TOKEN!,
      proxyUrl: "https://genai.mycompany.com",
    }),
});
```

---

## Type Summary

| Type/Interface | Module | Description |
|----------------|--------|-------------|
| `StreamFn` | types | Stream function signature |
| `ThinkingLevel` | types | Thinking levels: off, minimal, low, medium, high, xhigh |
| `AgentLoopConfig` | types | Loop configuration with converters |
| `CustomAgentMessages` | types | Extensible custom message interface |
| `AgentMessage` | types | Union of Message + custom messages |
| `AgentState` | types | Full agent state |
| `AgentToolResult<T>` | types | Tool execution result |
| `AgentToolUpdateCallback<T>` | types | Tool streaming callback |
| `AgentTool<T, D>` | types | Tool definition with execute |
| `AgentContext` | types | Context for agent loop |
| `AgentEvent` | types | Agent lifecycle events |
| `AgentOptions` | agent | Agent constructor options |
| `Agent` | agent | Main agent class |
| `ProxyAssistantMessageEvent` | proxy | Bandwidth-optimized proxy events |
| `ProxyStreamOptions` | proxy | Proxy stream configuration |

---

## Function Summary

| Function | Module | Description |
|----------|--------|-------------|
| `agentLoop` | agent-loop | Start agent loop with prompts |
| `agentLoopContinue` | agent-loop | Continue agent loop without new prompt |
| `streamProxy` | proxy | Proxy stream through server |

---

## Class Summary

| Class | Module | Description |
|-------|--------|-------------|
| `Agent` | agent | Main agent class with full lifecycle management |

---

*Reference generated from pi-agent-core TypeScript definitions.*
