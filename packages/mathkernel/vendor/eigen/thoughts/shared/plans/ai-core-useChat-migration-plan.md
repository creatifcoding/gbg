# Feature Plan: AI Core Migration to @ai-sdk/react useChat

Created: 2026-02-01
Author: architect-agent (Val)

## Overview

Migrate the current custom ai-core streaming architecture to leverage `@ai-sdk/react`'s `useChat` hook. This simplifies client-side conversation management while preserving the Effect-TS service layer for tool execution and MCP bridge capabilities. The server already uses AI SDK v6's `toUIMessageStreamResponse()` - we need to align the client to consume it properly.

## Current Architecture Analysis

### What Exists Today

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CURRENT ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Client (React)                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ IsolationChat                                                    │    │
│  │   └─> useBlockTerminal()                                         │    │
│  │         └─> executeAIQueryOp                                     │    │
│  │               └─> BlockTerminalService.executeAIQuery()          │    │
│  │                     ├─> AICoreService.streamChat()               │    │
│  │                     │     └─> fetch(CURSOR_CHAT_URL)             │    │
│  │                     │           └─> Response body (SSE)          │    │
│  │                     └─> SSEAdapter.fromReadableStream()          │    │
│  │                           └─> AIStreamEvent stream               │    │
│  │                                 └─> applyStreamEventById()       │    │
│  │                                       └─> streamStatesByIdAtom   │    │
│  │                                                                   │    │
│  │ useAIBlockContent(block)                                          │    │
│  │   └─> streamStateByIdAtom(requestId) ─────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Server (Bun)                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ cursor-server.ts                                                 │    │
│  │   └─> streamText({ model: claudeCode('sonnet'), ... })          │    │
│  │         └─> toUIMessageStreamResponse()                          │    │
│  │               └─> SSE with data: {...} events                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File | Purpose | Lines |
|-----------|------|---------|-------|
| AICoreService | `ai-core/services/AICoreService.ts` | Effect.Service for streaming | 324 |
| SSEAdapter | `ai-core/services/SSEAdapter.ts` | SSE parsing to AIStreamEvent | 633 |
| atoms/index.tsx | `ai-core/atoms/index.tsx` | Multi-stream state (streamStatesByIdAtom) | 488 |
| BlockTerminalService | `terminal/v3/services/BlockTerminalService.ts` | Orchestrates AI queries | 476 |
| useAIBlockContent | `terminal/v3/hooks/useAIBlockContent.ts` | Derives content from ai-core state | 184 |
| IsolationChat | `testbed/IsolationChat.tsx` | Chat UI consuming terminal v3 | 1840 |
| cursor-server.ts | `cursor/api/server.ts` | Bun HTTP server with streamText | 894 |

### Current Data Flow

1. User submits prompt in IsolationChat
2. `useBlockTerminal().executeAIQuery()` creates AI block with `streamRef.requestId`
3. `BlockTerminalService` calls `AICoreService.streamChat()` which fetches from cursor server
4. `SSEAdapter` parses SSE events (data: {...}) into `AIStreamEvent` union types
5. Events are reduced into `streamStatesByIdAtom` via `applyStreamEventById()`
6. `useAIBlockContent(block)` derives content from `streamStateByIdAtom(requestId)`
7. UI renders text, thinking, tool calls from derived state

### Pain Points

1. **Custom SSE parsing** - SSEAdapter manually parses what useChat does automatically
2. **Conversation not managed** - Each prompt is independent; no conversation history
3. **Tool call complexity** - Custom event types for tool-input-start, tool-input-available, etc.
4. **Dual state systems** - Effect atoms + custom reducer, when useChat provides this
5. **No message.parts** - Missing the richer content model (reasoning, sources, steps)

## Target Architecture

### What @ai-sdk/react Provides

```typescript
// useChat from @ai-sdk/react
const {
  messages,      // UIMessage[] with parts (text, reasoning, tool-call, tool-result, etc.)
  input,         // Controlled input value
  setInput,      // Input setter
  handleSubmit,  // Form submit handler
  handleInputChange,
  isLoading,     // Streaming state
  error,         // Error state
  append,        // Programmatically add message
  reload,        // Retry last
  stop,          // Abort stream
} = useChat({
  api: '/chat',
  onToolCall: async ({ toolCall }) => { ... },  // Tool execution callback
  sendExtraMessageFields: true,                  // Include metadata
})
```

### AI SDK v5+ Message Parts

```typescript
// UIMessage structure
interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts: UIMessagePart[]
  metadata?: Record<string, unknown>
}

// Part types
type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; reasoning: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown; isError?: boolean }
  | { type: 'step-start'; messageId: string }
  | { type: 'source'; source: { url: string; title?: string } }
```

### Target Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TARGET ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Client (React)                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ IsolationChat                                                    │    │
│  │   └─> useChatWithTools() [NEW thin wrapper]                      │    │
│  │         ├─> useChat({ api: '/chat', onToolCall })                │    │
│  │         │     ├─> messages (auto-managed)                        │    │
│  │         │     ├─> isLoading (streaming state)                    │    │
│  │         │     └─> append/stop/reload                             │    │
│  │         │                                                         │    │
│  │         └─> Tool execution via Effect when onToolCall fires      │    │
│  │               └─> ToolBridge.executeTool()                       │    │
│  │                                                                   │    │
│  │ MessageRenderer (for message.parts)                               │    │
│  │   ├─> TextPart                                                    │    │
│  │   ├─> ReasoningPart (extended thinking)                          │    │
│  │   ├─> ToolCallPart                                                │    │
│  │   └─> ToolResultPart                                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Server (Bun) [UNCHANGED]                                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ cursor-server.ts                                                 │    │
│  │   └─> streamText({ model: claudeCode('sonnet'), ... })          │    │
│  │         └─> toUIMessageStreamResponse({                          │    │
│  │               sendReasoning: true,                                │    │
│  │               sendSources: true                                   │    │
│  │             })                                                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Requirements

- [x] Use @ai-sdk/react useChat hook for client-side state
- [x] messages.parts for rendering (text, reasoning, tool-call, tool-result, step-start)
- [x] Conversation history managed automatically by useChat
- [x] Server returns toUIMessageStreamResponse({sendReasoning: true, sendSources: true})
- [ ] Preserve Effect services for tool execution (ToolBridge)
- [ ] Preserve MCP bridge capabilities
- [ ] IsolationChat and Terminal v3 consume the new API
- [ ] Support system prompts for context injection
- [ ] Support abort/stop functionality

## Design

### Layer Preservation Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        KEEP vs REPLACE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  KEEP (Effect Services - Valuable Business Logic):                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ ToolBridge                                                       │    │
│  │   - getAvailableTools(): Effect<AggregatedTool[]>                │    │
│  │   - executeTool(req): Effect<ToolCallResult, Error>              │    │
│  │   - refreshTools(): Effect<AggregatedTool[]>                     │    │
│  │                                                                   │    │
│  │ MCP Integration (inside ToolBridge)                               │    │
│  │   - Server discovery                                              │    │
│  │   - Tool aggregation                                              │    │
│  │   - Call routing                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  REPLACE (Custom Streaming - useChat Does This Better):                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ SSEAdapter                                                       │    │
│  │   - Custom SSE parsing ─────────────────> useChat internal       │    │
│  │                                                                   │    │
│  │ AICoreService.streamChat()                                        │    │
│  │   - fetch() + stream handling ──────────> useChat({ api })       │    │
│  │                                                                   │    │
│  │ ai-core/atoms (streamStatesByIdAtom)                              │    │
│  │   - Multi-stream state ─────────────────> messages state         │    │
│  │   - reduceStreamEvent() ────────────────> useChat internal       │    │
│  │                                                                   │    │
│  │ useAIBlockContent()                                               │    │
│  │   - Derived content ────────────────────> Direct message.parts   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  MODIFY (Adapt to New API):                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ BlockTerminalService                                             │    │
│  │   - Keep for command execution (PTY)                             │    │
│  │   - Remove AI query orchestration (useChat replaces)             │    │
│  │                                                                   │    │
│  │ IsolationChat                                                     │    │
│  │   - Use useChatWithTools() instead of useBlockTerminal()         │    │
│  │   - Render message.parts instead of custom state                 │    │
│  │                                                                   │    │
│  │ cursor-server.ts                                                  │    │
│  │   - Add sendReasoning: true to toUIMessageStreamResponse()       │    │
│  │   - Add sendSources: true                                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### New Hook: useChatWithTools

```typescript
// src/lib/ai-core/hooks/useChatWithTools.ts

import { useChat } from '@ai-sdk/react'
import { useCallback, useEffect } from 'react'
import { Effect } from 'effect'
import { ToolBridge } from '../services'

interface UseChatWithToolsOptions {
  /** API endpoint (default: '/chat') */
  api?: string
  /** System prompt for context */
  systemPrompt?: string
  /** Callback when tool executes */
  onToolExecute?: (toolName: string, args: unknown) => void
  /** Callback when tool completes */
  onToolResult?: (toolCallId: string, result: unknown, isError: boolean) => void
}

export function useChatWithTools(options: UseChatWithToolsOptions = {}) {
  const {
    api = 'http://localhost:7682/chat',
    systemPrompt,
    onToolExecute,
    onToolResult,
  } = options

  // Core useChat - handles all streaming, messages, state
  const chat = useChat({
    api,
    body: systemPrompt ? { systemPrompt, mode: 'terminal' } : { mode: 'terminal' },
    // Tool execution callback - bridges to Effect ToolBridge
    onToolCall: async ({ toolCall }) => {
      onToolExecute?.(toolCall.toolName, toolCall.args)
      
      // Execute tool via Effect service
      const result = await Effect.runPromise(
        ToolBridge.executeTool({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          args: toolCall.args,
        }).pipe(
          Effect.provide(ToolBridgeLive)
        )
      )
      
      onToolResult?.(toolCall.toolCallId, result.result, result.isError)
      return result.result
    },
  })

  return {
    // Pass through useChat API
    ...chat,
    // Convenience accessors
    latestMessage: chat.messages[chat.messages.length - 1] ?? null,
    isStreaming: chat.status === 'streaming' || chat.status === 'submitted',
    hasMessages: chat.messages.length > 0,
  }
}
```

### Message Part Renderer

```typescript
// src/lib/ai-core/components/MessagePartRenderer.tsx

interface MessagePartRendererProps {
  part: UIMessagePart
  isStreaming?: boolean
}

export function MessagePartRenderer({ part, isStreaming }: MessagePartRendererProps) {
  switch (part.type) {
    case 'text':
      return <TextRenderer text={part.text} isStreaming={isStreaming} />
    
    case 'reasoning':
      return <ReasoningRenderer reasoning={part.reasoning} />
    
    case 'tool-call':
      return (
        <ToolCallRenderer
          toolCallId={part.toolCallId}
          toolName={part.toolName}
          args={part.args}
        />
      )
    
    case 'tool-result':
      return (
        <ToolResultRenderer
          toolCallId={part.toolCallId}
          result={part.result}
          isError={part.isError}
        />
      )
    
    case 'step-start':
      return <StepStartIndicator messageId={part.messageId} />
    
    case 'source':
      return <SourceRenderer source={part.source} />
    
    default:
      return null
  }
}
```

### Updated IsolationChat Usage

```typescript
// src/lib/testbed/IsolationChat.tsx (key changes)

function ChatContent({ componentId, onDesignAction, ...props }: ChatContentProps) {
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isStreaming,
    stop,
    error,
  } = useChatWithTools({
    api: 'http://localhost:7682/chat',
    systemPrompt: contextMessage,  // Component context
    onToolExecute: (name, args) => {
      console.log('[IsolationChat] Tool executing:', name)
    },
    onToolResult: (id, result, isError) => {
      // Auto-apply design tools
      if (!isError && isDesignTool(result)) {
        onDesignAction?.(result)
      }
    },
  })

  return (
    <div style={rvnStyles.container}>
      {/* Messages area - render message.parts */}
      <div style={rvnStyles.messagesArea}>
        {messages.map((msg) => (
          <MessageBlock key={msg.id} message={msg} isStreaming={isStreaming} />
        ))}
      </div>
      
      {/* Input - use handleSubmit from useChat */}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" disabled={isStreaming}>Send</button>
        {isStreaming && <button onClick={stop}>Stop</button>}
      </form>
    </div>
  )
}
```

### Server Changes (Minimal)

```typescript
// src/lib/cursor/api/server.ts (line ~236, modify toUIMessageStreamResponse call)

// BEFORE:
const response = aiResult.toUIMessageStreamResponse()

// AFTER:
const response = aiResult.toUIMessageStreamResponse({
  sendReasoning: true,   // Include extended thinking
  sendSources: true,     // Include source references
})
```

## Dependencies

| Dependency | Type | Reason |
|------------|------|--------|
| @ai-sdk/react | External | useChat hook |
| ai (v6.0.3) | External | Already present - UIMessage types |
| ToolBridge | Internal | Keep for tool execution |
| Effect | Internal | Service layer preserved |

## Implementation Phases

### Phase 1: Foundation - New Hook Layer
**Effort:** Small (2-4 hours)

**Files to create:**
- `src/lib/ai-core/hooks/useChatWithTools.ts` - Thin wrapper around useChat + ToolBridge

**Files to modify:**
- `src/lib/ai-core/hooks/index.ts` - Export new hook

**Acceptance:**
- [ ] useChatWithTools compiles with proper types
- [ ] Can make basic chat request
- [ ] Tool calls route to ToolBridge

### Phase 2: Message Rendering Components
**Effort:** Medium (4-6 hours)

**Files to create:**
- `src/lib/ai-core/components/MessagePartRenderer.tsx` - Part-based renderer
- `src/lib/ai-core/components/TextRenderer.tsx` - Text with streaming indicator
- `src/lib/ai-core/components/ReasoningRenderer.tsx` - Extended thinking display
- `src/lib/ai-core/components/ToolCallRenderer.tsx` - Tool call display
- `src/lib/ai-core/components/ToolResultRenderer.tsx` - Tool result display
- `src/lib/ai-core/components/index.ts` - Component exports

**Dependencies:** Phase 1

**Acceptance:**
- [ ] All message part types render correctly
- [ ] Streaming text shows progressive reveal
- [ ] Tool calls show collapsible details

### Phase 3: IsolationChat Migration
**Effort:** Medium (4-6 hours)

**Files to modify:**
- `src/lib/testbed/IsolationChat.tsx` - Replace useBlockTerminal with useChatWithTools

**Files to potentially remove/deprecate:**
- Custom BlockRenderer, AIResponseBlock rendering (replaced by MessagePartRenderer)

**Dependencies:** Phase 2

**Acceptance:**
- [ ] IsolationChat works with new hook
- [ ] Conversation history maintained
- [ ] Tool calls execute correctly
- [ ] Design actions still fire

### Phase 4: Server Enhancement
**Effort:** Small (1-2 hours)

**Files to modify:**
- `src/lib/cursor/api/server.ts` - Add sendReasoning, sendSources

**Acceptance:**
- [ ] Reasoning parts appear in messages
- [ ] Sources (if any) appear in messages

### Phase 5: Deprecation & Cleanup
**Effort:** Medium (3-4 hours)

**Files to mark deprecated:**
- `src/lib/ai-core/services/SSEAdapter.ts` - No longer needed
- `src/lib/ai-core/services/AICoreService.ts` - Keep ToolBridge only
- `src/lib/ai-core/atoms/index.tsx` - streamStatesByIdAtom obsolete
- `src/lib/terminal/v3/hooks/useAIBlockContent.ts` - Replaced by message.parts

**Acceptance:**
- [ ] No runtime usage of deprecated code
- [ ] Deprecation comments added
- [ ] Migration guide written

### Phase 6: Documentation
**Effort:** Small (2-3 hours)

**Files to create:**
- `docs/ai-core/migration-to-useChat.md` - Migration guide
- `docs/ai-core/message-parts.md` - Part type reference

**Files to modify:**
- `src/lib/ai-core/index.ts` - Update module docs
- `CLAUDE.md` - Update architecture notes

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tool execution timing differs | Medium | Test extensively; useChat's onToolCall may have different lifecycle |
| Message parts not matching our display needs | Medium | Create adapter layer if needed; verify AI SDK types match |
| Conversation state persistence | Low | useChat has no built-in persistence; may need localStorage adapter |
| Multiple chat instances (Terminal v3 blocks) | High | Each block needs own useChat instance; verify memory/perf |
| Server SSE format mismatch | Medium | Server already uses toUIMessageStreamResponse(); verify client parsing |

## Breaking Changes

### API Changes

| Old | New | Migration |
|-----|-----|-----------|
| `useBlockTerminal().executeAIQuery()` | `useChatWithTools().append()` | Replace call sites |
| `useAIBlockContent(block)` | Direct `message.parts` | Map parts in render |
| `streamStateAtom` | `messages` from useChat | Delete atom usage |
| Custom `AIStreamEvent` types | Standard `UIMessagePart` types | Update type imports |

### Component Changes

| Old Component | New Component | Notes |
|---------------|---------------|-------|
| AIResponseBlock | MessageBlock | Renders message.parts array |
| ThinkingSection | ReasoningRenderer | Consumes part.reasoning |
| ToolCallBlock | ToolCallRenderer + ToolResultRenderer | Split by part type |
| ScanlineDeclassify | TextRenderer | Preserve animation |

## Open Questions

- [ ] Should we keep terminal v3 block system for non-AI commands, or unify everything?
- [ ] Do we need conversation persistence (localStorage) or server-side?
- [ ] How do we handle multiple concurrent chats (multi-window)?
- [ ] Should IsolationChat maintain conversation across component switches?

## Success Criteria

1. **Functional:** IsolationChat works with useChat, including tool calls
2. **Performance:** No regression in streaming latency or memory
3. **Code Reduction:** At least 500 lines removed from custom streaming code
4. **Type Safety:** All message parts properly typed
5. **Conversation:** History maintained within session

## Quick Reference: AI SDK v6 Message Parts

```typescript
// Server sends these via toUIMessageStreamResponse()
type UIMessagePart =
  | { type: 'text'; text: string }                          // Regular text
  | { type: 'reasoning'; reasoning: string }                 // Extended thinking
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown; isError?: boolean }
  | { type: 'step-start'; messageId: string }               // Multi-step indicator
  | { type: 'source'; source: { url: string; title?: string } }  // Sources
  
// Client consumes via useChat()
const { messages } = useChat({ api: '/chat' })
messages.forEach(msg => {
  msg.parts.forEach(part => {
    switch (part.type) { ... }
  })
})
```
