---
name: conceptual-alignment
description: Surface and resolve mental model divergence between agent and user with iterative deepening
user-invocable: true
---

# Conceptual Alignment Protocol

You are invoking a structured protocol to surface and resolve mental model divergence. This protocol prevents implementation churn by ensuring alignment BEFORE code is written.

## When to Use

- User describes an abstraction and your mental model differs
- Requirements feel ambiguous or could be interpreted multiple ways
- You're about to implement something but aren't sure about shape, composition, or scope
- A previous implementation missed the mark and you need to realign
- User says "that's not what I meant" or expresses conceptual friction

## The Protocol

### Phase 1: Surface the Gap (with Iterative Deepening)

Use **AskUserQuestion** with targeted questions across these dimensions:

| Dimension | Question Pattern | Examples |
|-----------|------------------|----------|
| **Shape** | "What is the data structure in your head?" | Object? Function? Class? Array? Tuple? |
| **Composition** | "How should these compose?" | Merge? Extend? Stack? Pipeline? Wrap? |
| **API** | "What does the consumer interface look like?" | Single arg vs object? Return shape? Sync/async? |
| **Scope** | "Where does this live? Who owns it?" | Module-level? Provider? Global singleton? |
| **Hidden** | "Is there anything else about this I haven't asked about?" | ALWAYS include this |

**CRITICAL: The Hidden Dimension**

Every Phase 1 round MUST include the Hidden dimension question. This probes for:
- User requirements you haven't considered
- Agent blind spots and latent assumptions
- Context the agent doesn't know it's missing

**Question Selection Rules:**
- Ask 2-4 questions maximum per round (don't overwhelm)
- Prioritize dimensions where you sense the most ambiguity
- Make questions concrete with examples, not abstract
- ALWAYS include the Hidden dimension question

**Example AskUserQuestion:**

```
Questions:
1. Shape: "Are you thinking of PanelConfig as a plain object with fields, or a class with methods like .render()?"
2. Composition: "When multiple configs apply, should they merge (deep), stack (array), or pipeline (transform chain)?"
3. API: "Should usePanel() take a single config or accept multiple keyed configs like usePanel({ main: {...}, sidebar: {...} })?"
4. Hidden: "Is there anything else about this system I haven't asked about?"
```

### Phase 2: Synthesize the Aligned Model

After receiving answers, write a **30-second summary** in this exact format:

```
ALIGNED MODEL (Round N):
- Shape: [concrete description]
- Composition: [merge strategy]
- API: [consumer interface]
- Scope: [ownership boundary]
- Surfaced This Round: [new insights from Hidden question]
```

**Example:**
```
ALIGNED MODEL (Round 1):
- Shape: Plain object with render/style functions, no class
- Composition: Mixin with slot-based merging (later wins)
- API: usePanel(single) returns keyed object { panel, controls }
- Scope: Provider-scoped, one per PanelProvider
- Surfaced This Round: User also needs panel persistence to localStorage
```

### Phase 3: Confirm with Iterative Loop Option

Present the aligned model to the user with EXPLICIT options:

```
Here's my understanding:

[ALIGNED MODEL block]

Options:
A) Confirmed - implement to this spec
B) Correction needed - [specify what to adjust]
C) Yes, there's more - loop back to surface additional dimensions

Which option?
```

**CRITICAL: "Yes, there's more" Option**

When user selects option C:
1. Agent must FIRST surface its own latent assumptions: "Before I ask more questions, let me expose what I'm assuming..."
2. List 2-3 assumptions the agent is making that haven't been validated
3. Then return to Phase 1 with fresh questions, including Hidden dimension again

**On Confirmation (Option A):**

Auto-persist the alignment by calling:
```bash
bun run .claude/scripts/cap-persist.ts --topic "<topic>" --round <N>
```

Pass the ALIGNED MODEL content via stdin. This creates an audit trail of all alignment sessions.

**If correction needed (Option B):** Loop back to Phase 1 for that dimension only.

### Phase 4: Implement to Spec

- Build exactly what was aligned - no creative additions
- If ambiguity resurfaces during implementation, **pause and re-invoke** this protocol
- Reference the aligned model in code comments if helpful for future maintenance

## Audit Trail

Each alignment session captures:

| Data Point | Purpose |
|------------|---------|
| Questions asked | Track what dimensions were explored |
| Raw user answers | Preserve exact user language |
| Corrections from previous rounds | Show convergence path |
| Agent's exposed assumptions | Surface blind spots |
| Final aligned model | The contract |

**Audit Format (for persistence):**

```yaml
topic: "<topic>"
round: <N>
timestamp: "<ISO timestamp>"
questions:
  - dimension: "Shape"
    question: "Are you thinking..."
    answer: "Config objects with..."
  - dimension: "Hidden"
    question: "Is there anything else..."
    answer: "Also need persistence"
corrections:
  - round: 1
    original: "Global singleton"
    corrected: "Provider-scoped"
agent_assumptions_exposed:
  - "Assumed synchronous rendering"
  - "Assumed single consumer"
aligned_model:
  shape: "..."
  composition: "..."
  api: "..."
  scope: "..."
```

## Signals That Trigger This Protocol

Invoke proactively when you detect:

| Signal | Example |
|--------|---------|
| Vague abstraction names | "a config thing", "some kind of manager" |
| Multiple valid interpretations | Could be HOC, hook, or render prop |
| User correction pattern | "No, I meant...", "That's not quite..." |
| Architectural uncertainty | "Should this be a service or a component?" |
| Composition ambiguity | "They need to work together somehow" |

## Anti-Patterns to Avoid

- **Asking too many questions** - 4 max per round, then synthesize
- **Abstract questions** - Always ground in concrete examples
- **Assuming alignment** - Confirm explicitly before coding
- **Ignoring course corrections** - If user corrects, fully integrate before proceeding
- **Skipping synthesis** - The ALIGNED MODEL block forces clarity
- **Omitting Hidden dimension** - ALWAYS ask what you haven't asked
- **Skipping assumption exposure** - When user says "there's more", surface YOUR assumptions first

## Integration with Other Skills

| Situation | Combine With |
|-----------|--------------|
| Effect service design | `/effect-service-authoring` |
| React component shape | `/react-compound-components` |
| State management scope | `/effect-atom-integration` |
| Schema design | `/effect-schema-mastery` |

## Quick Reference Card

```
+-------------------------------------------------------------+
|              CONCEPTUAL ALIGNMENT PROTOCOL                   |
|                 (with Iterative Deepening)                   |
+-------------------------------------------------------------+
|                                                              |
|  PHASE 1: SURFACE                                            |
|    Ask 2-4 questions across:                                 |
|    * Shape (structure)                                       |
|    * Composition (how they combine)                          |
|    * API (consumer interface)                                |
|    * Scope (ownership)                                       |
|    * Hidden (ALWAYS) <-- "What haven't I asked?"             |
|                                                              |
|  PHASE 2: SYNTHESIZE                                         |
|    Write ALIGNED MODEL block:                                |
|    - Shape: ...                                              |
|    - Composition: ...                                        |
|    - API: ...                                                |
|    - Scope: ...                                              |
|    - Surfaced This Round: ...                                |
|                                                              |
|  PHASE 3: CONFIRM (with options)                             |
|    A) Confirmed --> Phase 4 + auto-persist                   |
|    B) Correction --> Loop to Phase 1 (specific dimension)    |
|    C) There's more --> Expose agent assumptions, Phase 1     |
|                                                              |
|            +-------+                                         |
|            |       |                                         |
|            v       | "There's more"                          |
|    [Phase 1] ---> [Phase 2] ---> [Phase 3]                   |
|        ^                             |                       |
|        |         "Correction"        |                       |
|        +-----------------------------+                       |
|                                      |                       |
|                               "Confirmed"                    |
|                                      v                       |
|                               [Phase 4] + PERSIST            |
|                                                              |
|  PHASE 4: IMPLEMENT                                          |
|    Build to spec. Pause if ambiguity resurfaces.             |
|                                                              |
+-------------------------------------------------------------+
|  ITERATIVE DEEPENING LOOP:                                   |
|                                                              |
|  User: "There's more"                                        |
|       |                                                      |
|       v                                                      |
|  Agent: "Let me expose my assumptions first:"                |
|       - Assumption 1 I'm making...                           |
|       - Assumption 2 I'm making...                           |
|       |                                                      |
|       v                                                      |
|  Agent: [Fresh Phase 1 questions including Hidden]           |
|       |                                                      |
|       v                                                      |
|  [Continue loop until Confirmed]                             |
+-------------------------------------------------------------+
```

## Example Session (Multi-Round)

**User:** "I need a panel system for the dashboard"

**Agent (Phase 1, Round 1):**
> Before I implement, let me align on your mental model:
>
> 1. **Shape**: Are you thinking panels as React components, config objects, or something else?
> 2. **Composition**: When you have multiple panels, do they stack in a grid, tabs, or freely positioned?
> 3. **Scope**: Should panel state be global (app-wide) or scoped to a specific container?
> 4. **Hidden**: Is there anything else about this panel system I haven't asked about?

**User:** "Config objects that render into a grid. Scoped to the dashboard component. Oh, and panels need to be resizable."

**Agent (Phase 2, Round 1):**
```
ALIGNED MODEL (Round 1):
- Shape: Config objects with { id, render, gridPosition } fields
- Composition: Array of configs rendered into CSS grid
- API: usePanels(configs[]) returns rendered grid
- Scope: Dashboard-scoped via context provider
- Surfaced This Round: Panels must be resizable
```

**Agent (Phase 3, Round 1):**
> Does this match your mental model?
>
> Options:
> A) Confirmed - implement to this spec
> B) Correction needed - [specify what to adjust]
> C) Yes, there's more - loop back to surface additional dimensions
>
> Which option?

**User:** "C - there's more"

**Agent (exposing assumptions before Phase 1, Round 2):**
> Before I ask more questions, let me expose what I'm assuming:
>
> - I'm assuming resize state is ephemeral (not persisted)
> - I'm assuming single-user (no collaborative editing)
> - I'm assuming panels are rectangular CSS grid cells
>
> Now, additional questions:
>
> 1. **Persistence**: Should resize state persist to localStorage or reset on refresh?
> 2. **Constraints**: Are there min/max size constraints for panels?
> 3. **Hidden**: Is there anything else about resizing or the panel system I haven't asked?

**User:** "Persist to localStorage. Min size 200px, no max. That's everything."

**Agent (Phase 2, Round 2):**
```
ALIGNED MODEL (Round 2):
- Shape: Config objects with { id, render, gridPosition, minSize } fields
- Composition: Array of configs rendered into CSS grid with resize handles
- API: usePanels(configs[]) returns rendered grid with persistent sizing
- Scope: Dashboard-scoped via context provider, localStorage for persistence
- Surfaced This Round: Min size constraint (200px), localStorage persistence
```

**Agent (Phase 3, Round 2):**
> Does this match your mental model?
>
> Options:
> A) Confirmed - implement to this spec
> B) Correction needed - [specify what to adjust]
> C) Yes, there's more - loop back to surface additional dimensions

**User:** "A - confirmed"

**Agent (Phase 4):**
> Perfect. Persisting alignment...
> *calls `bun run .claude/scripts/cap-persist.ts --topic "panel-system" --round 2`*
> *implements exactly that*

## Persistence Script Interface

The `cap-persist.ts` script expects:

**CLI:**
```bash
bun run .claude/scripts/cap-persist.ts --topic "<topic>" --round <N>
```

**Stdin:** YAML-formatted audit data (see Audit Format above)

**Output:** Written to `.claude/alignments/<topic>-<timestamp>.yaml`

**Note:** If the script doesn't exist yet, document the aligned model in a code comment instead.
