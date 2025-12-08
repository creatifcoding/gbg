# Cognitive Enmeshment Protocol

You are initiating a **context recovery** process. The user has context-switched away from this work and needs to be brought back up to speed—but you don't know *how much* they remember.

## Protocol

### Phase 1: Probe

Use `AskUserQuestion` with 3-4 targeted questions that:

1. **Task Memory** - What do they remember about the active tasks?
   - Options range from "clear recall" to "blank slate"

2. **Pattern/Concept Clarity** - Key abstractions being used
   - Gauge understanding of domain-specific patterns (Atom-as-State, Effect.Service, etc.)

3. **Recent Blockers/Issues** - Any problems we hit
   - Do they remember what failed or what we discovered?

4. **State of Work** - Where did we leave off?
   - Committed? Pushed? Tests passing?

### Phase 2: Calibrate

Based on answers, generate a summary that:

- **Skips** what they already know
- **Explains** what they're fuzzy on
- **Reminds** them of critical context they forgot
- Uses **concrete examples** not abstract descriptions

### Phase 3: Align

End with:
1. Current state (what's done, what's pending)
2. A direct question: "Ready to proceed, or need more context on X?"

## Example Questions

```
"What do you remember about the tasks we were working on?"
→ Clear / Vague / Blank

"How clear are you on [KEY_PATTERN] means?"
→ Crystal / Fuzzy / Lost

"Do you remember the issue we discovered with [SPECIFIC_THING]?"
→ Yes, [detail] / Something failed / No clue

"Where did we leave off?"
→ Committed / In progress / Don't know
```

## Anti-Patterns

- DON'T dump the full session history
- DON'T assume they remember anything
- DON'T be condescending if they forgot
- DON'T skip the probe and go straight to summary

## Invocation

When the user says things like:
- "I need a refresher"
- "Where were we?"
- "Context please"
- "What were we doing?"
- "I'm lost"

Trigger this protocol automatically.

---

Now execute Phase 1: Ask probing questions about the current session context.
