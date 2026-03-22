# INLINE UI FENCE SPEC

**Status:** Design Contract (implementation-facing)  
**Date:** 2026-02-28  
**Scope:** Inline genifer UI rendering via custom code fence in assistant stream  
**Inputs:** INTERLEAVED_RENDERING_SPEC.md, questionnaire alignment (interleaved-stream-modality)

---

## 1) Purpose

Enable the model to emit UI tree snapshots **inline** in its natural text stream using a custom code fence (` ```ui `). The harness detects these fences during streaming, parses the content as a UITree snapshot, and renders the UI **interleaved with the surrounding text** — no tool call round-trip required.

This is a **new modality** alongside the existing `genifer_generate` tool (which remains as explicit fallback).

---

## 2) Aligned Architecture Decisions

| Decision | Value | Source |
|---|---|---|
| Fence marker | ` ```ui ` | Questionnaire: "Short, model-friendly" |
| Fence content | Full UITree JSON snapshot | Questionnaire: "Complete tree per fence" |
| Model awareness | Model-aware — prompted to emit ` ```ui ` blocks | Questionnaire |
| Trigger | Always-on — every response parsed for ` ```ui ` fences | Questionnaire |
| Tool fate | Keep both — streaming fence is primary, `genifer_generate` stays as fallback | Questionnaire |
| Detection mechanism | Existing `appendTextDelta` code fence parser in `harness-event-processor.ts` | Existing infrastructure |

---

## 3) Wire Format

### 3.1 Model Output Shape

The model emits natural text interspersed with ` ```ui ` fenced blocks:

```
Here's the login form you asked for:

` ` `ui
{
  "root": "login-form",
  "elements": {
    "login-form": {
      "type": "form",
      "key": "login-form",
      "props": { "title": "Sign In" },
      "children": ["email-field", "password-field", "submit-btn"]
    },
    "email-field": {
      "type": "input",
      "key": "email-field",
      "props": { "label": "Email", "placeholder": "you@example.com" }
    },
    "password-field": {
      "type": "input",
      "key": "password-field",
      "props": { "label": "Password", "type": "password" }
    },
    "submit-btn": {
      "type": "button",
      "key": "submit-btn",
      "props": { "label": "Sign In", "variant": "primary" }
    }
  }
}
` ` `

I've included email and password fields with a primary submit button.
You can refine this further if you need validation or additional fields.
```

(Backticks above are spaced to avoid Markdown collision — actual fences are standard triple backtick.)

### 3.2 JSON Schema (inside fence)

The content **must** decode as a valid `UITree`:

```typescript
{
  root: string,             // key of root element
  elements: Record<string, UIElement>  // keyed element map
}
```

Where `UIElement` follows the existing genifer schema (`type`, `key`, `props`, `children`, etc.).

### 3.3 Invalid Fence Handling

If the content inside a ` ```ui ` fence fails to parse as valid UITree JSON:
- Fall back to rendering it as a normal `CodePart` with `language: 'ui'`
- Do **not** crash the stream or discard surrounding text
- Log a warning (not an error)

---

## 4) Detection & Routing

### 4.1 Existing Infrastructure

The code fence parser in `harness-event-processor.ts` (`appendTextDelta`) already:
- Detects opening fences (` ```lang\n `) with language extraction
- Buffers content across delta boundaries
- Detects closing fences (` ``` `)
- Produces `CodePart` with `{ _tag: 'code', language, code, isStreaming }`

**No changes to the fence parser itself.** It already handles ` ```ui ` correctly.

### 4.2 New: Post-Fence Routing

When `appendTextDelta` closes a code fence (sets `isStreaming: false`), a new check runs:

```
if (closedPart.language === 'ui') → attempt UITree parse → emit UITreePart or fall back to CodePart
```

This happens **inside** `appendTextDelta` at the point where a `CodePart` transitions from `isStreaming: true` to `isStreaming: false`.

### 4.3 Streaming Behavior

While the fence is still open (`isStreaming: true`), the block is a normal streaming `CodePart`. The user sees JSON appearing token by token. When the fence closes:
- **Success**: `CodePart` is replaced with a `UITreePart` — the rendered UI appears
- **Failure**: `CodePart` stays as-is — user sees the raw JSON as a code block

This gives natural progressive disclosure: raw JSON streams in, then "snaps" to rendered UI on fence close.

---

## 5) New Part Type: `UITreePart`

### 5.1 Schema

```typescript
export const UITreePart = Schema.TaggedStruct('ui-tree', {
  /** The parsed UITree (uses Effect HashMap internally) */
  tree: UITree,
  /** Original JSON source (for copy/debug) */
  source: Schema.String,
})
export type UITreePart = typeof UITreePart.Type
```

### 5.2 Union Update

Add `UITreePart` to `ChatMessagePart` union:

```typescript
export const ChatMessagePart = Schema.Union(
  TextPart,
  ThinkingPart,
  ToolInvocationPart,
  FilePart,
  CodePart,
  UITreePart,   // ← new
)
```

### 5.3 Rationale: New Type vs Special CodePart

A dedicated `_tag: 'ui-tree'` is preferred over checking `language === 'ui'` on `CodePart` because:
- Clean pattern match in `PartRenderer` (no conditional inside `case 'code'`)
- Carries parsed `UITree` object (no re-parsing on every render)
- Preserves `source` for clipboard/debug without mixing concerns
- Aligns with the `InterleavedPart` schema direction from INTERLEAVED_RENDERING_SPEC

---

## 6) Rendering

### 6.1 PartRenderer Addition

In `thread-view.tsx` `PartRenderer`, add:

```typescript
case 'ui-tree':
  return (
    <InlineUITreeCard
      tree={part.tree}
      source={part.source}
      isStreaming={isStreaming}
    />
  )
```

### 6.2 InlineUITreeCard Component

A new component that renders a UITree inline in the chat thread. Reuses existing genifer rendering infrastructure:

```
InlineUITreeCard
├── BehaviorProvider (existing — provides element behaviors)
│   └── Renderer (existing — walks tree, renders elements)
├── Collapse toggle (optional — hide/show rendered UI)
└── Source toggle (optional — show raw JSON)
```

**Key reuse points from existing work:**
- `BehaviorProvider` from `src/lib/genifer/react/BehaviorBridge.tsx`
- `Renderer` + `DefaultFallback` from `src/lib/genifer/react/renderer.tsx`
- `UITree` class with `fromRecord` for construction
- `decodeUITree` / `decodeUITreeSync` for validation
- Q-Branch palette tokens (`T.bg`, `T.border`, etc.) from genifer-renderers

### 6.3 Styling Contract

- Matches existing `GeniferGenerateRenderer` card style (same palette, borders, glow)
- Visually distinct enough to not be confused with tool invocation cards
- No scan line animation (this is not a pending operation — it's a completed snapshot)
- Minimum height to prevent layout shift on parse

---

## 7) Data Flow Diagram

```
Model Stream
    │
    ▼
PiAiHarnessEngine (text_delta fast path)
    │
    ▼ chat:v2/assistant_delta { delta }
    │
harness-event-processor.ts
    │
    ▼ appendTextDelta()
    │
    ├── Text part          → TextPart { _tag: 'text', content }
    ├── Code fence (other) → CodePart { _tag: 'code', language, code }
    └── Code fence (ui)    → while streaming: CodePart { language: 'ui', isStreaming: true }
                             on close: attempt UITree parse
                               ├── success → UITreePart { _tag: 'ui-tree', tree, source }
                               └── failure → CodePart { _tag: 'code', language: 'ui', code }
    │
    ▼ parts array on ChatMessage
    │
thread-view.tsx PartRenderer
    │
    ├── case 'text'     → ChatMessageBodyContent (existing)
    ├── case 'thinking' → ChatThinkingBlock (existing)
    ├── case 'code'     → ChatCodeBlock (existing)
    ├── case 'tool-invocation' → ChatToolBlock (existing)
    └── case 'ui-tree'  → InlineUITreeCard (NEW)
                            └── BehaviorProvider + Renderer (existing genifer react)
```

---

## 8) What Existing Work Enables This

| Existing Asset | Role in This Spec |
|---|---|
| `appendTextDelta` fence parser | Detects ` ```ui ` fences, buffers across deltas, signals close |
| `UITree` class + `decodeUITree` | Parses and validates fence content |
| `BehaviorProvider` | Provides element behavior context for rendering |
| `Renderer` + `DefaultFallback` | Walks tree and renders each element type |
| `ChatMessagePart` union (Schema) | Extensible tagged union — add `UITreePart` |
| `PartRenderer` switch | Extensible render dispatch — add `case 'ui-tree'` |
| `normalizeTree` pipeline | Can repair/normalize malformed model output before rendering |
| Q-Branch card palette | Consistent styling tokens |
| Interleaved contract tests | Validates branch-local rerender, part ordering |

---

## 9) What's New (Implementation Slices)

### Slice 1 — UITreePart Schema + Union
- Add `UITreePart` to `src/lib/morphchat/schemas/message-types.tsx`
- Add to `ChatMessagePart` union
- Zero runtime behavior change

### Slice 2 — Fence Intercept in appendTextDelta
- On fence close with `language === 'ui'`: attempt `decodeUITreeSync`
- Success → replace `CodePart` with `UITreePart`
- Failure → keep `CodePart` as-is
- Optional: run `normalizeTree` for repair before decode

### Slice 3 — InlineUITreeCard Component
- New component: `src/lib/chat/msg/inline-ui-tree-card.tsx`
- Uses `BehaviorProvider` + `Renderer`
- Collapse/expand toggle
- Source view toggle (debug)

### Slice 4 — PartRenderer Wiring
- Add `case 'ui-tree'` to `PartRenderer` in `thread-view.tsx`
- Render `InlineUITreeCard`

### Slice 5 — Contract Tests
- Fence detection with ` ```ui ` language tag
- Valid JSON → `UITreePart` in parts array
- Invalid JSON → falls back to `CodePart`
- Rendered output visible in thread

### Slice 6 — Prompt Engineering (separate concern)
- System prompt additions to instruct model about ` ```ui ` fence format
- UITree JSON schema reference for the model
- Examples of well-formed ` ```ui ` blocks

---

## 10) Acceptance Criteria

| Criterion | Pass Condition |
|---|---|
| Fence detection | ` ```ui ` blocks detected and separated from text during streaming |
| Parse success | Valid UITree JSON produces `UITreePart` with rendered UI |
| Parse failure | Invalid JSON falls back to `CodePart` display (no crash) |
| Interleave ordering | Text before and after the fence renders correctly around the UI card |
| Streaming progressive | While fence is open, raw JSON streams visually; on close, snaps to rendered UI |
| No tool required | UI renders without any tool call — pure assistant text stream |
| Existing tools unaffected | `genifer_generate` and other tools continue working |

---

## 11) Out of Scope

- Refine-via-fence (subsequent ` ```ui ` blocks patching previous ones) — future work
- Multiple UI blocks in one message sharing state — each is independent
- Model prompt engineering — separate slice, does not block rendering infra
- Persistence of inline trees to genifer surface/thread system — future integration
