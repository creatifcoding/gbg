# 2026-01-16: Autopoietic Spike System & Skill Steering

## Summary

Extended the spike CLI with autopoietic capabilities and implemented skill activation steering for LLM guidance.

---

## Work Completed

### 1. Autopoietic Spike Commands (Prior Session)

Added three new commands to `scripts/spike-cli.ts`:

| Command | Purpose |
|---------|---------|
| `bun spike learn <file> --fix "..."` | Extract learnings from completed spikes, update pattern store |
| `bun spike suggest "<error>"` | Match error against patterns, suggest H1-H4 hypotheses |
| `bun spike stats [--evolve]` | View pattern statistics, optionally evolve templates |

**Pattern Store:** `.claude/cache/spike-patterns.json`
- Stores success/failure rates per pattern
- Records fixes applied
- Enables autopoietic learning loop

### 2. JSON-Render Spike Reauthoring

Converted `scripts/diagnose-generative-container.ts` to new spike format:
- Created `scripts/spike-json-render-streaming.ts`
- Added `json-render-streaming` pattern to pattern store
- Hypotheses: H1 (JSONL buffering) → H2 (GenerativeContainer gen) → H3 (UITree building) → H4 (Component rendering)

### 3. Spike Config Setup Schema

Enhanced `SpikeConfig` schema with scaffolding capabilities:

```typescript
setup: {
  directories: string[]        // Dirs to create
  files: Array<{
    path: string
    content?: string           // Inline content
    template?: string          // Template name
    vars?: Record<string, string>
  }>
  fixtures: Record<string, unknown>  // Test data
}
```

**File Templates Available:**
- `effect-service` — Effect.Service boilerplate
- `test-fixture` — JSON fixture export

### 4. CLI Steering Messages

Added machine-readable steering output to spike commands:

```html
<!-- SPIKE_STEERING
{"action":"CREATE_SPIKE",
 "suggestedName":"json-render-streaming",
 "hypotheses":[{"id":"H1","claim":"..."},...],
 "nextCommand":"bun spike init ...",
 "skills":["spike-testing"]}
-->
```

**Actions:**
| Action | When Emitted |
|--------|--------------|
| `CREATE_SPIKE` | After `bun spike suggest` |
| `IMPLEMENT_SPIKE` | After `bun spike new --config` |

### 5. Skill Activation Rule

Created `.claude/rules/skill-activation-from-hooks.md`:

- Defines hook output patterns (`⚠️ CRITICAL SKILLS`, `📚 RECOMMENDED SKILLS`)
- Documents CLI steering message format
- Mandates skill invocation before responding
- Provides action table for steering actions

---

## Files Modified

| File | Change |
|------|--------|
| `scripts/spike-cli.ts` | +Setup schema, +executeSetup, +steering output, +minified config |
| `scripts/spike-json-render-streaming.ts` | NEW — Reauthored json-render spike |
| `.claude/cache/spike-patterns.json` | +json-render-streaming pattern |
| `.claude/rules/skill-activation-from-hooks.md` | NEW — Skill activation protocol |

---

## Architecture Notes

### Autopoietic Feedback Loop

```
Error occurs
    ↓
bun spike suggest "<error>"  ← Matches patterns, suggests H1-H4
    ↓
bun spike init <name>        ← Generates config with setup
    ↓
bun spike new --config       ← Creates spike + scaffolding
    ↓
Implement & run spike        ← Progressive isolation
    ↓
bun spike learn --fix "..."  ← Records pattern + fix
    ↓
Pattern store updated        ← Future suggests use this learning
```

### Steering Message Contract

CLI tools emit `<!-- SPIKE_STEERING ... -->` blocks containing:
- `action` — What the LLM should do next
- `skills` — Skills to invoke for context
- `nextCommand` — Suggested CLI command
- `hypotheses` — H1-H4 context for implementation

The rule `.claude/rules/skill-activation-from-hooks.md` instructs the LLM to parse and act on these.

---

## Open Items

- [ ] Add more file templates (react-component, test-suite, etc.)
- [ ] Hook to auto-detect steering messages and inject into context
- [ ] Visual pattern explorer in testbed

---

## Commands Reference

```bash
# Autopoietic workflow
bun spike suggest "SQLITE_CONSTRAINT: NOT NULL"
bun spike init datetime-fix
bun spike new --config spike-datetime-fix.config.json
bun spike run scripts/spike-datetime-fix.ts --verbose
bun spike learn scripts/spike-datetime-fix.ts --fix "Use DateTimeInsert"
bun spike stats --evolve

# With setup scaffolding
# Edit config to add setup.directories, setup.files
bun spike new --config my-spike.config.json
# → Creates spike file + directories + generated files
```

---

*Val*
