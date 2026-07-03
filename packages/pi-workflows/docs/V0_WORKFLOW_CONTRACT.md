# Pi Workflows V0 Contract

This document freezes the V0 behavior surface for `@tmnl/pi-workflows`, a Pi extension clone of Claude Code dynamic workflows. It is intentionally small: V0 coordinates child work, persists enough state to resume within the same Pi session, and leaves durable distributed workflow semantics for a later cut.

## Source grounding

- Claude Code dynamic workflow docs: scripts coordinate subagents, preserve script-local state, run in the background, and are best suited for multi-agent research, audits, migrations, and planning.
- Pi extension docs: extension packages expose tools and commands through `pi.registerTool()` and `pi.registerCommand()`, and can persist session-local custom entries with `pi.appendEntry()`.
- `pi-subagents`: already owns child Pi session execution, async runs, progress, resume/interrupt surfaces, chains, parallel fan-out, and prompt-template bridge events.
- Effect v4 / effect-smol: use `Context.Service`, `Layer`, `ManagedRuntime`, `Schema.TaggedStruct`, `Schema.TaggedClass`, `Schema.TaggedErrorClass`, and `effect/unstable/reactivity` atoms.

## Package boundary

`@tmnl/pi-workflows` owns:

1. Workflow script discovery and metadata validation.
2. Restricted coordinator runtime globals.
3. Run lifecycle, phases, progress normalization, and journal records.
4. A narrow `SubagentAdapter` port.
5. Pi tool/command/TUI surfaces.

It does **not** own:

1. Child agent process/session execution.
2. Model/provider fallback policy.
3. Worktree management.
4. Cross-session durable replay.
5. Arbitrary filesystem or shell capabilities for workflow scripts.

Those stay below the `SubagentAdapter`, initially fake in tests, then bridged to `pi-subagents`.

## Workflow script shape

A workflow is a JavaScript or TypeScript-flavored script file discovered from configured workflow roots.

```ts
export const meta = {
  name: "deep-audit",
  description: "Audit a codebase from several specialist angles.",
  phases: ["survey", "parallel-review", "synthesis"],
  maxConcurrency: 4,
} as const

export default async function workflow(input) {
  phase("survey")
  const map = await agent("Map the subsystem and return risks.", {
    label: "system-map",
  })

  phase("parallel-review")
  const reviews = await parallel([
    () => agent(`Security review:\n${map}`, { label: "security" }),
    () => agent(`API review:\n${map}`, { label: "api" }),
  ])

  phase("synthesis")
  return await agent(`Synthesize:\n${reviews.filter(Boolean).join("\n---\n")}`, {
    label: "synthesis",
  })
}
```

### `meta`

V0 accepts a pure literal `export const meta = { ... }` object.

Required:

- `name: string` — stable workflow name used for discovery and selection.
- `description: string` — human-readable purpose.

Optional:

- `phases: readonly string[]` — display and validation hints.
- `maxConcurrency: number` — local workflow cap; runtime also enforces a global cap.
- `tags: readonly string[]` — discovery and filtering.

Deferred:

- Dynamic metadata.
- Metadata imported from other modules.
- User prompts or interactive parameter forms.

## Runtime globals

Workflow scripts receive only these coordinator globals:

### `phase(name: string): void`

Sets current run phase, appends a phase journal entry, and updates live progress atoms.

### `log(message: string, details?: unknown): void`

Appends an operator-visible log entry. `details` must be JSON-serializable.

### `agent(prompt: string, options?: AgentOptions): Promise<AgentResult>`

Delegates one child task through `SubagentAdapter`.

```ts
type AgentOptions = {
  label?: string
  agent?: string
  model?: string
  output?: "text" | "json"
  schema?: unknown
  reads?: readonly string[] | false
  progress?: boolean
  timeoutMs?: number
}

type AgentResult = string | unknown
```

V0 contract:

- `prompt` must be a string.
- `label` is used as the stable journal call key when present.
- `schema` is accepted as a placeholder and passed to the adapter; runtime does not yet enforce structured output validation.
- A failed child call records failure and returns `null` only when invoked through `parallel()`; direct `agent()` rejects with a schema-backed workflow error.

### `parallel(tasks, options?): Promise<Array<T | null>>`

Runs task thunks concurrently behind a concurrency gate.

```ts
type ParallelOptions = {
  label?: string
  maxConcurrency?: number
  failFast?: boolean
}
```

V0 contract:

- Input must be an array of zero-argument async/sync thunks.
- Results preserve input order.
- Default behavior is barrier-style: all tasks settle; failed tasks become `null`.
- `failFast: true` is reserved and may throw on first failure in a later version.

### `pipeline(items, stages, options?): Promise<Array<T | null>>`

Processes each item through ordered stages without global stage barriers.

```ts
type PipelineStage<T, U> = (item: T, index: number) => U | Promise<U>
type PipelineOptions = {
  label?: string
  maxConcurrency?: number
}
```

V0 contract:

- Each item advances stage-by-stage independently.
- Item failures record a journal failure and return `null` for that item.
- Stage labels are display-only in V0 unless explicitly logged by the script.

## Deterministic restrictions

Workflow scripts are coordinators, not local programs. V0 blocks or withholds:

- `process`, `require`, `import()`, `Bun`, `Deno`.
- Node filesystem, shell, network, and child-process APIs.
- Direct Pi extension API access.
- `Date.now()`, argless `new Date()`, and `Math.random()` inside script code.
- Mid-run user input.

Allowed data must be JSON-serializable across the runtime boundary.

## Journal contract

Every run appends entries in order:

- `RunStarted`
- `PhaseStarted`
- `LogRecorded`
- `AgentCallStarted`
- `AgentCallSucceeded`
- `AgentCallFailed`
- `ParallelStarted` / `ParallelCompleted`
- `PipelineStarted` / `PipelineCompleted`
- `RunSucceeded`
- `RunFailed`
- `RunCancelled`

V0 resume is prefix replay:

1. Match same session, same workflow name, same script digest, and same input digest.
2. Rehydrate completed agent call results by stable call key.
3. Re-execute the script; completed call keys return journaled results instead of delegating again.
4. Divergence fails closed with `ResumeDivergenceError`.

Cross-session durable resume is deferred.

## Effect architecture contract

- Domain data is schema-first.
- Service ports use `Context.Service` and are wired by `Layer`.
- Extension entry creates a `ManagedRuntime` at the Pi boundary and disposes it on shutdown.
- Live run state uses `Atom.make` and `AtomRegistry` as primary state; services mutate atoms directly.
- Runtime core depends only on `SubagentAdapter`, never on `pi-subagents` implementation modules.

## V0 tool/command surface

### Tool: `workflow`

Parameters:

- `name?: string` — saved workflow to run.
- `script?: string` — inline workflow script.
- `path?: string` — explicit workflow file path.
- `input?: unknown` — JSON input for the workflow.
- `resume?: boolean` — attempt prefix replay.
- `dryRun?: boolean` — parse and validate only.

Exactly one of `name`, `script`, or `path` is required.

### Command: `/workflows`

V0 subcommands:

- `/workflows` — list discovered workflows.
- `/workflows run <name>` — run a saved workflow.
- `/workflows inspect <name>` — show metadata and script path.
- `/workflows resume <runId>` — attempt same-session resume.

## Deferred features

- Full Claude-compatible `/deep-research` parity.
- Durable cross-session replay.
- Permission prompts inside workflow code.
- Arbitrary package imports from workflow scripts.
- Workflow-authored tools.
- Rich schema-guided structured output enforcement.
- Distributed worker/runtime scheduling.
