# EPOCH-0003: Self-Adapting System Prompt Architecture

> **Status**: Proposal  
> **Author**: Val  
> **Created**: 2026-02-26  
> **Scope**: `src/lib/harness/prompt/`  
> **Depends on**: PiAiPolicy, PiAiHarnessEngine, HarnessToolRuntime

---

## Problem

The TMNL harness agent receives a **58-byte** system prompt:

```
"You are TMNL Harness, a concise and reliable coding assistant."
```

Pi's agent receives a **~10-15KB** composite prompt assembled from 7 distinct sources: identity, tool manifest, behavioral guidelines, project context (AGENTS.md walk), skills catalog, extension hooks, and runtime stamps.

The harness agent doesn't know:
- What tools it has or when to use them
- What project it's in or what conventions apply
- What day it is or what directory it's working in
- What persona or behavioral frame to adopt
- What skills or capabilities are available

**Result**: The agent "has a hard time realizing it's a harness agent."

## Vision

Don't just match pi's static concatenation — **build a self-adapting prompt system** where the agent can intelligently modify its own context to better succeed at tasks. The system prompt becomes a living, composable Effect pipeline that evolves with the conversation.

### What Makes This Different From Pi

| Dimension | Pi | Harness (proposed) |
|-----------|-----|---------------------|
| Assembly | String concatenation | Effect Service pipeline with typed sections |
| Adaptation | Static per session | Agent can self-modify sections mid-session |
| Scoping | Global (all sessions same) | Session-scoped layers (base + per-session context) |
| Observability | None | Effect.withSpan per section, token counts |
| Hot reload | Rebuild on tool change only | File watcher on AGENTS.md, rebuild on change |
| Tool awareness | Hardcoded descriptions | Auto-generated from tool Schema + runtime |
| Testing | Untestable (string output) | Each section independently testable as Effect |
| Composition | Flat append | Priority-ordered, Layer-swappable sections |

---

## Architecture

### Service Graph

```
PiAiPolicy (existing)
    │
    ▼
SystemPromptBuilder ◄──── Effect.Service<SystemPromptBuilderShape>
    │
    ├── SectionRegistry ◄── Manages ordered, typed PromptSection[]
    │   │
    │   ├── IdentitySection         (persona, role, behavioral frame)
    │   ├── ToolManifestSection     (auto-generated from toolRuntime.tools)
    │   ├── GuidelinesSection       (conditional rules based on active tools)
    │   ├── ProjectContextSection   (AGENTS.md / CLAUDE.md walk: CWD → root)
    │   ├── RuntimeStampSection     (date/time, working directory)
    │   └── SessionContextSections  (per-session additions, agent-modifiable)
    │
    ├── PromptAssembler ◄── Concatenates sections by priority order
    │
    └── PromptObserver ◄── Traces builds, counts tokens per section
```

### Core Types

```typescript
import { Schema } from 'effect'

// ── Section Definition ──────────────────────────────────────
const PromptSectionId = Schema.String.pipe(Schema.brand('PromptSectionId'))

const PromptSection = Schema.Struct({
  /** Unique identifier for this section */
  id: PromptSectionId,
  /** Display name for observability */
  name: Schema.String,
  /** Assembly priority: lower = earlier in prompt. Core identity = 0, runtime stamp = 900 */
  priority: Schema.Number.pipe(Schema.between(0, 1000)),
  /** The actual prompt text */
  content: Schema.String,
  /** Whether this section can be modified by the agent mid-session */
  mutable: Schema.Boolean,
  /** Whether this section is required (cannot be removed) */
  required: Schema.Boolean,
  /** Source attribution for observability */
  source: Schema.Literal('builtin', 'agents-md', 'session', 'agent-self-modified', 'extension'),
})
type PromptSection = typeof PromptSection.Type

// ── Builder Shape ───────────────────────────────────────────
interface SystemPromptBuilderShape {
  /** Build the full system prompt from all registered sections */
  readonly build: () => Effect.Effect<string>
  
  /** Get all sections (for observability/debugging) */
  readonly getSections: () => Effect.Effect<ReadonlyArray<PromptSection>>
  
  /** Add a session-scoped section (e.g., agent self-modification) */
  readonly addSection: (section: PromptSection) => Effect.Effect<void>
  
  /** Update a mutable section's content */
  readonly updateSection: (
    id: typeof PromptSectionId.Type,
    content: string,
  ) => Effect.Effect<void, PromptSectionNotFoundError | PromptSectionImmutableError>
  
  /** Remove a non-required section */
  readonly removeSection: (
    id: typeof PromptSectionId.Type,
  ) => Effect.Effect<void, PromptSectionNotFoundError | PromptSectionRequiredError>
  
  /** Rebuild from sources (e.g., after AGENTS.md change) */
  readonly reload: () => Effect.Effect<void>
  
  /** Get token estimate for current prompt */
  readonly estimateTokens: () => Effect.Effect<number>
}
```

### Section Details

#### Layer 0 — Identity (priority: 0, required, immutable)

```typescript
const IDENTITY_CONTENT = `You are a TMNL Harness agent — an expert coding assistant \
operating inside the TMNL development environment. You help users by reading files, \
executing commands, editing code, and writing new files.

You operate within an Effect-TS service architecture. Your responses should be precise, \
concise, and architecturally aware. You have access to the project's full context \
including conventions, patterns, and domain-specific knowledge.`
```

**Why this matters**: Establishes the agent as a *specific* entity in a *specific* system, not a generic chatbot. The phrase "TMNL Harness agent" gives it an identity anchor.

#### Layer 1 — Tool Manifest (priority: 100, required, immutable)

Auto-generated from `toolRuntime.tools`:

```typescript
const buildToolManifest = (tools: ReadonlyArray<ToolDefinition>): string => {
  const header = 'Available tools:'
  const entries = tools.map(t => `- ${t.name}: ${t.description}`).join('\n')
  return `${header}\n${entries}`
}
```

**Why auto-generated**: When tools change (new tools registered, tools removed), the manifest updates automatically. No hardcoded descriptions to drift.

#### Layer 2 — Guidelines (priority: 200, required, immutable)

Conditional rules based on active tools:

```typescript
const buildGuidelines = (toolNames: Set<string>): string => {
  const rules: string[] = []
  
  if (toolNames.has('read') && toolNames.has('edit'))
    rules.push('Use read to examine files before editing')
  if (toolNames.has('edit'))
    rules.push('Use edit for precise changes (old text must match exactly)')
  if (toolNames.has('write'))
    rules.push('Use write only for new files or complete rewrites')
  if (toolNames.has('bash'))
    rules.push('Use bash for file operations like ls, grep, find')
  
  rules.push('Be concise in your responses')
  rules.push('Show file paths clearly when working with files')
  
  return `Guidelines:\n${rules.map(r => `- ${r}`).join('\n')}`
}
```

#### Layer 3 — Project Context (priority: 300, required, immutable)

Full AGENTS.md injection — walks CWD → root like pi does:

```typescript
const loadProjectContextFiles = (cwd: string): Effect.Effect<PromptSection[]> =>
  Effect.gen(function* () {
    const sections: PromptSection[] = []
    let dir = cwd
    const root = path.resolve('/')
    const seen = new Set<string>()

    while (true) {
      for (const filename of ['AGENTS.md', 'CLAUDE.md']) {
        const filePath = path.join(dir, filename)
        if (seen.has(filePath)) continue
        seen.add(filePath)
        
        const content = yield* Effect.try(() => 
          fs.readFileSync(filePath, 'utf-8')
        ).pipe(Effect.option)
        
        if (Option.isSome(content)) {
          sections.push({
            id: PromptSectionId.make(`agents-md:${filePath}`),
            name: `Project Context: ${filePath}`,
            priority: 300,
            content: `## ${filePath}\n\n${content.value}`,
            mutable: false,
            required: true,
            source: 'agents-md',
          })
        }
      }

      if (dir === root) break
      const parent = path.resolve(dir, '..')
      if (parent === dir) break
      dir = parent
    }

    return sections
  })
```

**Full injection, not selective**: Per the design decision, the entire file is loaded. This project's AGENTS.md is comprehensive and battle-tested — every section earns its token cost.

#### Layer 4 — Runtime Stamp (priority: 900, required, immutable)

```typescript
const buildRuntimeStamp = (cwd: string): string => {
  const now = new Date()
  const dateTime = now.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  })
  return `Current date and time: ${dateTime}\nCurrent working directory: ${cwd}`
}
```

#### Layer 5 — Session Context (priority: 500-800, NOT required, MUTABLE)

This is where the magic happens. Session-scoped sections that the **agent itself** can add, update, or remove:

```typescript
// Agent adds context to help itself succeed:
yield* promptBuilder.addSection({
  id: PromptSectionId.make('session:task-focus'),
  name: 'Current Task Focus',
  priority: 500,
  content: 'Currently working on animation system integration. ' +
    'Key files: src/lib/animation/, src/components/splash/. ' +
    'Using GSAP driver with animatable() + useAnimatable() pattern.',
  mutable: true,
  required: false,
  source: 'agent-self-modified',
})
```

---

## Self-Modification: The Differentiator

The agent gets a tool (exposed via the harness tool runtime) that lets it modify its own system prompt:

### Tool: `update_prompt_context`

```typescript
const updatePromptContextTool = {
  name: 'update_prompt_context',
  description: 
    'Add or update a section of your own system prompt to improve your ' +
    'effectiveness for the current task. Use this when you realize you need ' +
    'to remember specific context, conventions, or focus areas across messages. ' +
    'Sections you add are session-scoped (lost when session ends) and mutable.',
  parameters: Schema.Struct({
    action: Schema.Literal('add', 'update', 'remove', 'list'),
    id: Schema.optional(Schema.String),
    name: Schema.optional(Schema.String),
    content: Schema.optional(Schema.String),
    priority: Schema.optional(Schema.Number.pipe(Schema.between(500, 800))),
  }),
}
```

### How the Agent Uses It

**Scenario 1 — Task Focus**
User asks: "Help me refactor the animation system."
Agent recognizes this is a domain-specific task and self-modifies:

```
→ update_prompt_context({
    action: 'add',
    id: 'task-focus',
    name: 'Animation Refactor Context',
    content: 'Focus: animation system refactor. Key patterns: animatable() + useAnimatable() hook, GSAP/anime.js drivers, effect-atom state. Files: src/lib/animation/. Constraint: use Effect.withSpan for observability.',
    priority: 500,
  })
```

Now every subsequent message in this session has that context in the system prompt. The agent doesn't forget mid-conversation what it's working on.

**Scenario 2 — Convention Reinforcement**
Agent makes a mistake (uses npm instead of bun). User corrects it. Agent reinforces:

```
→ update_prompt_context({
    action: 'add',
    id: 'correction-bun',
    name: 'Package Manager Correction',
    content: 'CRITICAL: This project uses bun exclusively. Never use npm, yarn, or pnpm. Use bun install, bun run, bunx.',
    priority: 510,
  })
```

**Scenario 3 — Working Memory**
Agent is debugging a complex issue across multiple files. It builds a mental model:

```
→ update_prompt_context({
    action: 'add',
    id: 'working-memory',
    name: 'Debug Working Memory',
    content: 'Investigating: double render in thread-view. Root cause traced to sync bridge race in useHarnessAdapter.ts line 247. The messages$ subscription fires during rAF flush window. Need single-writer discipline.',
    priority: 600,
  })
```

This is **persistent working memory** for the duration of a session. The agent doesn't lose context across long conversations.

---

## File Structure

```
src/lib/harness/prompt/
├── index.ts                        # Public exports
├── types.ts                        # PromptSection, error types
├── SystemPromptBuilder.ts          # Effect.Service<SystemPromptBuilderShape>
├── sections/
│   ├── identity.ts                 # Layer 0: persona + role
│   ├── tool-manifest.ts            # Layer 1: auto-generated from tools
│   ├── guidelines.ts               # Layer 2: conditional rules
│   ├── project-context.ts          # Layer 3: AGENTS.md walk
│   └── runtime-stamp.ts            # Layer 4: date + cwd
├── tools/
│   └── update-prompt-context.ts    # Self-modification tool
└── __tests__/
    ├── SystemPromptBuilder.test.ts
    ├── sections.test.ts
    └── self-modification.test.ts
```

## Integration Points

### 1. PiAiPolicy → SystemPromptBuilder

Currently, `PiAiPolicyConfig.systemPrompt` is a flat string. Replace with:

```typescript
// Before (PiAiPolicy.ts)
systemPrompt: Config.string('PI_HARNESS_PIAI_SYSTEM_PROMPT').pipe(
  Config.withDefault('You are TMNL Harness, a concise and reliable coding assistant.'),
),

// After — PiAiPolicy provides the base identity to SystemPromptBuilder
// SystemPromptBuilder.build() produces the full prompt
// PiAiHarnessEngine uses builder.build() instead of policy.config.systemPrompt
```

### 2. PiAiHarnessEngine — Session Context Injection

When a session is created, the engine initializes a session-scoped SystemPromptBuilder:

```typescript
// In createSession:
const promptBuilder = yield* SystemPromptBuilder
const sessionPromptBuilder = yield* promptBuilder.fork() // session-scoped copy

// Session's context now uses the builder:
context: {
  systemPrompt: yield* sessionPromptBuilder.build(),
  messages: [],
  tools: [...toolRuntime.tools],
},
```

### 3. Tool Runtime — Self-Modification Tool

The `update_prompt_context` tool is registered in the harness tool runtime alongside existing tools:

```typescript
// In HarnessToolRuntime or equivalent
const allTools = [
  ...existingTools,
  updatePromptContextTool, // new
]
```

### 4. Per-Message Rebuild

On each `sendMessage`, rebuild the system prompt (sections may have changed):

```typescript
// Before streaming:
const freshPrompt = yield* sessionPromptBuilder.build()
yield* Ref.update(sessionsRef, HashMap.modify(sessionId, session => ({
  ...session,
  context: { ...session.context, systemPrompt: freshPrompt },
})))
```

This is cheap — it's string concatenation of cached sections. Only rebuilds sections that changed.

### 5. Hot Reload (Future Enhancement)

File watcher on AGENTS.md paths:

```typescript
// When AGENTS.md changes:
yield* promptBuilder.reload() // re-reads files, rebuilds project-context sections
// Next message gets updated context
```

---

## Observability

Every prompt build is traced:

```typescript
const build = (): Effect.Effect<string> =>
  Effect.gen(function* () {
    const sections = yield* getSections()
    const assembled = sections
      .sort((a, b) => a.priority - b.priority)
      .map(s => s.content)
      .join('\n\n')
    
    yield* Effect.annotateCurrentSpan({
      'prompt.sections': sections.length,
      'prompt.chars': assembled.length,
      'prompt.estimated_tokens': Math.ceil(assembled.length / 4),
      'prompt.sources': JSON.stringify(
        sections.reduce((acc, s) => {
          acc[s.source] = (acc[s.source] ?? 0) + 1
          return acc
        }, {} as Record<string, number>)
      ),
    })

    return assembled
  }).pipe(Effect.withSpan('tmnl.harness.prompt.build'))
```

DevTools shows:
- How many sections were assembled
- Token estimate per build  
- Which sources contributed (builtin: 4, agents-md: 2, session: 1, agent-self-modified: 1)
- When the agent self-modified and what it added

---

## Migration Path

### Phase 1 — Foundation (fills the gap)
1. Create `SystemPromptBuilder` service with sections 0-4 (identity, tools, guidelines, AGENTS.md, runtime stamp)
2. Wire into `PiAiHarnessEngine` replacing `policy.config.systemPrompt`
3. Add Effect.withSpan observability
4. Test: agent should now know its tools, project, and conventions

### Phase 2 — Session Scoping
1. Add `fork()` for session-scoped builders
2. Per-message prompt rebuild from session builder
3. Session context sections (mutable, non-required)

### Phase 3 — Self-Modification (the differentiator)
1. Build `update_prompt_context` tool
2. Register in tool runtime
3. Agent can now add/update/remove session context
4. Test: agent remembers task focus across long conversations

### Phase 4 — Hot Reload + Extensions (stretch)
1. File watcher on AGENTS.md paths
2. Extension hook: `appendSystemPrompt` equivalent
3. Prompt versioning (track what prompt produced what response)

---

## Why This Eclipses Pi

1. **Pi's prompt is write-once**. Ours adapts mid-session.
2. **Pi's agent can't modify its own context**. Ours builds working memory.
3. **Pi has no observability into prompt assembly**. Ours traces every build.
4. **Pi's sections are hardcoded strings**. Ours are typed, prioritized, composable Effect services.
5. **Pi rebuilds only on tool change**. Ours rebuilds per-message (cheap) and on file change (hot reload).
6. **Pi has no session scoping**. Ours isolates context per session.

The self-modification capability is the real breakthrough. An agent that can recognize "I need to remember this for the rest of this conversation" and actually write it into its own system prompt — that's not a prompt system, that's **metacognition**.

---

## Open Questions

1. **Token budget management**: With full AGENTS.md injection (~15KB) + self-modified sections, how do we handle models with smaller context windows? Do we need a budget allocator even with full-injection strategy?

2. **Self-modification guardrails**: Should there be limits on what the agent can self-modify? Max section count? Max total self-modified content size? Priority range restrictions?

3. **Persistence**: Should session context sections survive harness restarts? Currently proposed as ephemeral (lost on session end). Could persist to session store.

4. **Multi-agent coordination**: If multiple agents share a session (future), how do self-modifications compose? Namespaced by agent ID?
