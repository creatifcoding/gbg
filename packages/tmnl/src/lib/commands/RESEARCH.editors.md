# Editor Research: Best of Breed Analysis

**Date**: 2025-12-01
**Goal**: Markdown-friendly editor with AI integration, multiplayer support, and code editing close to VSCode

---

## TL;DR Recommendation

| Use Case | Winner | Runner-up |
|----------|--------|-----------|
| **Rich Text / Markdown** | Tiptap + AI Toolkit | Novel.sh (Tiptap-based) |
| **Code Editing** | Monaco Editor | CodeMirror 6 |
| **Collaboration** | Liveblocks | Y.js native |
| **AI Integration** | Tiptap AI Toolkit | Plate AI Plugin |

**Stack Recommendation**: Tiptap + Monaco + Liveblocks + Vercel AI SDK

---

## 1. Rich Text / Markdown Editors

### Tiptap (RECOMMENDED)

**Why it wins:**
- **First-class Vercel AI SDK integration** via `@tiptap-pro/ai-toolkit-ai-sdk`
- Built-in collaboration (Y.js CRDT)
- Bidirectional Markdown support (new Oct 2025)
- AI Agent that reads AND edits documents
- Streaming tool calls with live document updates
- ProseMirror under the hood (battle-tested)

**Vercel AI SDK Integration:**
```ts
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { toolDefinitions } from '@tiptap-pro/ai-toolkit-ai-sdk'

const result = streamText({
  model: openai('gpt-4o'),
  tools: {
    ...toolDefinitions(), // Tiptap document editing tools
    // Your custom tools...
  },
})
```

**AI Toolkit Features:**
- `streamContent` - Stream AI responses directly into editor
- `setHtmlSuggestions` - Proofreading/grammar suggestions
- `applyAllSuggestions` - Accept AI changes
- Tool streaming with live preview

**Collaboration:**
```ts
import { TiptapCollabProvider } from '@tiptap-pro/provider'
import Collaboration from '@tiptap/extension-collaboration'

const provider = new TiptapCollabProvider({
  name: 'document-id',
  appId: 'your-app-id',
  token: 'jwt-token',
})
```

**Pricing:**
- Editor: Open source (MIT)
- Pro extensions: Paid (AI Toolkit, Collaboration Cloud)
- Self-host option available

**Links:**
- https://tiptap.dev/docs/content-ai/capabilities/ai-toolkit/tools/ai-sdk
- https://tiptap.dev/product/ai-toolkit

---

### Novel.sh (Alternative)

**What it is:** Notion-style WYSIWYG editor built ON Tiptap

**Why consider:**
- Pre-built UI components
- Vercel AI SDK native (built by Vercel team)
- Slash commands, bubble menus
- Open source

**When to use:** Quick start, don't need deep customization

**Links:**
- https://novel.sh
- https://github.com/steven-tey/novel

---

### Plate (Alternative)

**What it is:** Another Tiptap/Slate-based editor with rich plugins

**Features:**
- AI plugin with copilot-style completions
- Extensive plugin ecosystem
- TypeScript-first

**Links:**
- https://platejs.org

---

## 2. Code Editors

### Monaco Editor (RECOMMENDED)

**Why it wins:**
- **VSCode's actual editor** - same IntelliSense, language services
- TypeScript/JavaScript language services built-in
- 100k+ lines performance
- Multi-cursor, find/replace, diff editor
- Minimap, folding, breadcrumbs

**Bundle Size:** 5-10MB (heavy but complete)

**React Integration:**
```ts
import { Editor } from '@monaco-editor/react'

<Editor
  height="90vh"
  defaultLanguage="typescript"
  defaultValue="// code here"
  theme="vs-dark"
  options={{ minimap: { enabled: false } }}
/>
```

**Best package:** `@monaco-editor/react` (3M+ weekly downloads)

**Collaboration:** Possible via Y.js (`y-monaco`), more complex than Tiptap

---

### CodeMirror 6 (Alternative)

**Why consider:**
- **Much smaller**: ~300KB core (modular)
- Tree-shaking friendly
- Mobile-friendly
- Faster initial load

**Trade-offs:**
- Less out-of-box features
- Manual setup for IntelliSense
- Smaller ecosystem

**When to use:** Bundle size critical, simple editing needs

**Links:**
- https://codemirror.net

---

## 3. Collaboration Solutions

### Liveblocks (RECOMMENDED)

**Why it wins:**
- Drop-in integration with Tiptap AND Novel
- Managed infrastructure (no Y.js server)
- Presence, cursors, comments built-in
- Works with Monaco too

**Tiptap Integration:**
```tsx
import { useLiveblocksExtension } from '@liveblocks/react-tiptap'
import { useEditor } from '@tiptap/react'

const liveblocks = useLiveblocksExtension()
const editor = useEditor({
  extensions: [liveblocks, StarterKit],
})
```

**Pricing:** Free tier available, scales with users

---

### Y.js Native (Alternative)

**Why consider:**
- Self-hosted
- No vendor lock-in
- Works everywhere

**Trade-offs:**
- Need to run WebSocket server
- More setup

---

## 4. Architecture Recommendation

```
┌─────────────────────────────────────────────────────────────┐
│                      TMNL Editor Suite                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐    ┌──────────────────┐               │
│  │   Tiptap Editor  │    │   Monaco Editor  │               │
│  │  (Markdown/Rich) │    │     (Code)       │               │
│  └────────┬─────────┘    └────────┬─────────┘               │
│           │                       │                          │
│           └───────────┬───────────┘                          │
│                       │                                      │
│           ┌───────────┴───────────┐                          │
│           │     Liveblocks        │                          │
│           │   (Collaboration)     │                          │
│           └───────────┬───────────┘                          │
│                       │                                      │
│           ┌───────────┴───────────┐                          │
│           │   Vercel AI SDK       │                          │
│           │  + Tiptap AI Toolkit  │                          │
│           └───────────────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Plan

### Phase 1: Tiptap Core
```bash
bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-markdown
```

### Phase 2: AI Integration
```bash
bun add @tiptap-pro/ai-toolkit @tiptap-pro/ai-toolkit-ai-sdk ai @ai-sdk/openai
```

### Phase 3: Collaboration
```bash
bun add @liveblocks/react @liveblocks/react-tiptap
```

### Phase 4: Code Editor
```bash
bun add @monaco-editor/react
```

---

## 6. Key Code Patterns

### Vercel AI SDK + Tiptap Tool Streaming
```tsx
'use client'
import { useChat } from '@ai-sdk/react'
import { useEditor } from '@tiptap/react'
import { AiToolkit, getAiToolkit } from '@tiptap-pro/ai-toolkit'

export function AIEditor() {
  const editor = useEditor({
    extensions: [StarterKit, AiToolkit],
  })

  const { messages, sendMessage, addToolResult } = useChat({
    async onToolCall({ toolCall }) {
      const toolkit = getAiToolkit(editor)
      const result = toolkit.streamTool({
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.name,
        input: toolCall.input,
        hasFinished: true,
      })
      addToolResult({ tool: toolCall.name, toolCallId: toolCall.toolCallId, output: result.output })
    },
  })

  return <EditorContent editor={editor} />
}
```

### Server Route (Vercel AI SDK)
```ts
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { toolDefinitions } from '@tiptap-pro/ai-toolkit-ai-sdk'

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    tools: toolDefinitions(),
  })

  return result.toDataStreamResponse()
}
```

---

## 7. Pricing Summary

| Solution | Free Tier | Paid |
|----------|-----------|------|
| Tiptap Editor | Yes (MIT) | — |
| Tiptap Pro (AI) | No | ~$299/mo team |
| Liveblocks | 5K MAU | ~$99/mo |
| Monaco | Yes (MIT) | — |
| Vercel AI SDK | Yes (MIT) | — |

**Total estimated cost:** ~$400/mo for full stack (can self-host to reduce)

---

## 8. Decision

**Go with Tiptap ecosystem:**

1. **Tiptap + Vercel AI SDK** for rich text/markdown with AI
2. **Monaco** for code editing
3. **Liveblocks** for multiplayer (or self-host Y.js)
4. **Integrate with TMNL command system** via our existing hotkey architecture

This gives us:
- Notion-style editing
- VSCode-quality code editing
- Real-time collaboration
- Native Vercel AI SDK support with streaming tool calls
- Markdown in/out

Prime, green light?
