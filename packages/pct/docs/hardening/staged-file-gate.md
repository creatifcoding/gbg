# PCT/LNK/MSH Staged-File Gate

Status: hardening gate  
Owner: `#F1166 Workspace Hygiene and Lockfile Guardrails`  
Task: `#4241 Slice E: Closeout staged-file gate`  
Last updated: 2026-05-26

## Purpose

This gate checks the actual staged set before a PCT/LNK/MSH hardening closeout.
It exists because `git add -A` is a tiny disaster with a friendly CLI.

Policy references:

- [staging-hygiene.md](./staging-hygiene.md)
- [workspace-dirty-report.md](./workspace-dirty-report.md)
- [RFC-WORKSPACE-LOCKFILE-HYGIENE.md](../../RFC-WORKSPACE-LOCKFILE-HYGIENE.md)

## Command

From `packages/pct`:

```bash
bun run workspace:staged-gate
```

Direct command:

```bash
bun scripts/check-staged-files.ts
```

JSON output:

```bash
bun scripts/check-staged-files.ts --json
```

Implementation mode, for implementation/source-test bundles:

```bash
bun scripts/check-staged-files.ts --mode implementation
```

Explicit root/shared override:

```bash
bun scripts/check-staged-files.ts --allow-root bun.lock:DependencyLaneOwner
```

## Default planning mode

Default mode is `planning`. It allows:

- `packages/pct/RFC-*`
- `packages/pct/PCT-LNK-MSH-HARDENING-*`
- `packages/pct/docs/hardening/*`
- `packages/pct/NATS-INTEGRATION-CLOSEOUT.md`
- `packages/pct/package.json`
- `packages/pct/scripts/*`
- `packages/msh/docs/*`
- `packages/lnk/NATS-BRIDGE.md`

It rejects:

- root `package.json`, `bun.lock`, `.gitmodules` unless explicitly overridden;
- submodule drift;
- runtime/generated state;
- package deletions for `packages/db` or `packages/entity`;
- unrelated source/test paths in planning mode.

## Relationship to implementation mode

`--mode implementation` relaxes the planning-path allowlist so source/test files
can be staged, but it still rejects:

- root/shared files without explicit owner override;
- submodule drift;
- runtime/generated state;
- dedicated package deletions without their own lane.

That means implementation bundles still need a clean owner story. They just do
not have to pretend source files are planning docs.

## Closeout use

Before marking a hardening lane closed:

```bash
git diff --cached --name-status
cd packages/pct
bun run workspace:staged-gate
```

If the command fails, unstage exact paths:

```bash
git restore --staged <exact-path>
```

Do not broad reset unless you know every staged file belongs to you. The point is
surgery, not weather.
