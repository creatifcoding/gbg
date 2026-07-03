# @tmnl/pi-workflows

Pi dynamic workflows, Effect v4 edition. V0 is a coordinator runtime: workflow scripts define literal metadata and call restricted globals (`phase`, `log`, `agent`, `parallel`, `pipeline`) while child agent execution stays behind a `SubagentAdapter` seam.

- Contract: [`docs/V0_WORKFLOW_CONTRACT.md`](docs/V0_WORKFLOW_CONTRACT.md)
- Runtime authority: Effect v4 / effect-smol (`effect-v4` alias)
- Child-agent substrate: `pi-subagents`

## Workflow shape

```ts
export const meta = {
  name: 'audit-system',
  description: 'Map a subsystem and summarize risks',
  phases: ['map', 'synthesize'],
  maxConcurrency: 2,
  tags: ['audit'],
} as const

export default async function workflow(input: { area: string }) {
  phase('map')
  const findings = await parallel([
    () => agent(`Map ${input.area}`, { label: 'map' }),
    () => agent(`Find risks in ${input.area}`, { label: 'risks' }),
  ])

  phase('synthesize')
  return await agent(`Summarize: ${JSON.stringify(findings)}`, { label: 'summary' })
}
```

## Pi surfaces

- Tool: `workflow`
  - exactly one source: `name`, `path`, or inline `script`
  - options: `input`, `dryRun`, `resume`
  - non-dry-run launches ask for UI approval when `ctx.ui.confirm` exists
- Command: `/workflows`
  - `list`
  - `inspect <runId>`
  - `run <name>`
  - `resume <runId>`

## Discovery

Saved workflows are discovered from:

1. `PI_WORKFLOWS_DIR` (`:`-separated)
2. `<cwd>/.pi/workflows`
3. `<cwd>/.claude/workflows`
4. `<cwd>/workflows`

Files with `.js`, `.mjs`, `.ts`, or `.mts` are indexed by literal `meta.name`, with filename fallback.

## Journal + resume

`WorkflowJournal.memoryLayer` is the default V0 journal. `WorkflowJournal.jsonlLayer(path)` provides append-only JSONL persistence. Resume matches a prior successful run by `workflowName + source.digest + inputDigest` and replays completed `agent()` calls by stable key/label.

## Scripts

```bash
bun run typecheck
bun run test:run
bun run build
bun run smoke:extension
```
