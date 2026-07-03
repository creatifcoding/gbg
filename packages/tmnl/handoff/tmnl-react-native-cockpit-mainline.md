# TMNL React Native / Cockpit Mainline Return Point

> up: none
> prereqs: docs/architecture/tmnl-react-native-migration-rfc.md, handoff/ui-surface-stx-context.md
> provides: cockpit-mainline-return-point, tmnl-rn-migration-continuity
> children: none

## Status

Mainline before the Effectify/metagrill tangent: **TMNL React Native Migration Architecture**, focused on the package-first cockpit vertical slice.

Primary Tasker feature:

```txt
#F1297 TMNL React Native Migration Architecture
```

Active cockpit tasks:

```txt
#4827 [in_progress] Define @tmnl/cockpit package boundary and first vertical slice tree
#4828 [in_progress] Scaffold @tmnl/cockpit package shell
#4829 [todo] Add cockpit loop unit test: SurfaceActor → access decision → UI branch
```

## Target Slice

```txt
SurfaceActor
→ access decision
→ UI branch / approval / proxy / degrade / deny
→ session/runtime action
```

Current package root:

```txt
packages/cockpit
```

Important files:

```txt
packages/cockpit/src/access.ts
packages/cockpit/src/surface.ts
packages/cockpit/src/index.ts
packages/cockpit/test/cockpit-loop.test.ts
packages/cockpit/package.json
packages/cockpit/project.json
packages/cockpit/tsconfig.json
packages/cockpit/vitest.config.ts
```

## Decisions Already Made

- Start with `@tmnl/cockpit`, not `@tmnl/capability-access`.
- Defer extraction of `@tmnl/capability-access` and `@tmnl/surfaces` until the cockpit loop proves the boundary.
- Keep `CapabilityAccessRuntime.resolveAccess(...)` as the public conceptual mechanism.
- Preserve access decision outcomes:
  - `allow`
  - `deny`
  - `degrade`
  - `proxy`
  - `requires-approval`
  - `unavailable`
- Use canonical `@tmnl/stx` from `packages/stx`.
- In TMNL app/package code, use `effect-v4` alias.
- Package-first: avoid adding more `packages/tmnl/src/lib/*` gravity wells.

## Observed Validation State

Already observed:

```txt
cd packages/cockpit && bunx vitest run
# passed once directly: 3 tests

bunx nx show project @tmnl/cockpit --json
# Nx recognizes package

bunx nx run @tmnl/cockpit:test
# initially failed on unresolved effect-v4
# passed after temporary ignored node_modules symlinks under packages/cockpit
```

Known unresolved issue:

```txt
bunx nx run @tmnl/cockpit:typecheck
# failed with XState action typing errors in packages/cockpit/src/surface.ts
```

Representative error theme:

```txt
Types of property 'actions' are incompatible
Property 'reason' is missing in type 'EventObject'
```

## Immediate Return Steps

1. Inspect `packages/cockpit/src/surface.ts` before editing; previous XState refactor was interrupted.
2. Finish moving XState `assign(...)` actions into `setup({ actions })` with correctly typed events.
3. Run:

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg
bunx nx run @tmnl/cockpit:typecheck
bunx nx run @tmnl/cockpit:build
bunx nx run @tmnl/cockpit:test
```

4. Remove or eliminate reliance on temporary `packages/cockpit/node_modules` symlinks.
5. Finish Tasker tasks `#4827`, `#4828`, `#4829` only after Nx validation works without ad hoc dependency hacks.

## Caution

The working tree was already dirty before this tangent. Do **not** stage broad changes. No `git add -A`. Stage explicit paths only if/when Prime asks for a commit.
