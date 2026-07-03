# @tmnl/pi-workflows Agent Notes

- This package is intentionally package-local and excluded from the root Bun workspace so Pi runtime dependencies can be installed in `packages/pi-workflows`, not at repo root.
- Use `bun`, never npm/yarn/pnpm.
- Use Effect v4 through the `effect-v4` alias, grounded against `../../submodules/effect-smol`.
- Runtime state should use `Atom.make` / `AtomRegistry` as primary state. Do not build a Ref→Atom bridge.
- Workflow scripts are coordinators only. Do not add filesystem, shell, network, timers, randomness, process, import, require, or direct Pi API access to script globals.
- Keep `pi-subagents` behind a `SubagentAdapter` port. The workflow runtime coordinates; child-agent orchestration belongs to pi-subagents.
- Literal workflow metadata is parsed without executing scripts. Preserve this boundary.
- Resume is digest/key based: stable `agent(..., { label })` values are the replay keys. Changing source or input should prevent replay.
- Run validation before handoff: `bun run typecheck && bun run test:run && bun run smoke:extension`.

## Key files

- `src/extension/index.ts` — Pi tool/command/event edge.
- `src/services/WorkflowRuntime.ts` — coordinator globals, journal events, resume replay.
- `src/services/WorkflowScriptRunner.ts` — restricted VM runner and API guards.
- `src/services/PiSubagentsAdapter.ts` — prompt-template/pi-subagents bridge and progress normalization.
- `src/services/WorkflowRegistry.ts` — project/user workflow discovery.
- `src/services/WorkflowJournal.ts` — memory and JSONL append-only journal layers.
- `test/` — Effect v4/runtime/extension smoke coverage.
