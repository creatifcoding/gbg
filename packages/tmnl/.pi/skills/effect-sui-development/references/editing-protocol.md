---
up: INDEX.md
prereqs: grounding.md, testing-release.md
provides: safe-editing, git-hygiene, validation-discipline, dirty-root-protection
children: none
update-strategy: refresh when @tmnl/effect-sui package, Sui SDK, Move tooling, or Nix mission-control patterns change
update-status: current
---

# Editing and Commit Protocol

> up: INDEX.md
> prereqs: grounding.md, testing-release.md
> provides: safe-editing, git-hygiene, validation-discipline, dirty-root-protection
> children: none

## Before Editing

```bash
cd <repo-root>
ls -l .git/index.lock 2>/dev/null || true
git diff --cached --name-status
git status --short -- packages/effect-sui package.json bun.lock
```

If `.git/index.lock` exists, inspect for active git processes before removing. A stale zero-byte lock with no owner may be removed; do not delete a live lock.

## Dirty Root Files

Root `package.json` and root `bun.lock` are often externally dirty in this workspace. Treat them as radioactive unless the user explicitly asks to modify root dependencies. Use scoped status and explicit staging.

## Editing Rules

- Use `read` before editing; grep/audit imports before cutting them.
- Use `edit` for precise changes, `write` for new files or intentional rewrites.
- Use Bun: `bun run`, `bunx`, `bun add` inside the owning package. No npm/yarn/pnpm.
- Preserve namespace barrels and package exports.
- Do not import `src/testing` from production source.
- Do not introduce production `throw new`, `Promise.reject`, `new Promise`, or `async function` regressions; boundary audit catches these.
- Keep ManagedRuntime creation/disposal explicit at edges.

## Staging Pattern

```bash
git add packages/effect-sui/path/one.ts packages/effect-sui/path/two.md
git diff --cached --name-status
git diff --cached -- packages/effect-sui/path/one.ts
```

Never:

```bash
git add -A
git add .
git add packages/effect-sui/**
```

Prime will know. Val will sigh.

## Validation Discipline

State proof in observed terms:

- Good: `bun run quality:localnet` passed.
- Good: `sui-move bytecode counter` produced JSON with `modules` and `dependencies` arrays.
- Bad: "This should work."

If validation fails, identify the mechanism before retrying. Same-family retries without new evidence are banned.

## Commit Readiness Checklist

- Scoped status only shows intended Effect-Sui paths.
- Cached diff contains explicit intended files only.
- Generated Move `build/`, `Move.lock`, `.direnv`, logs, temp files are absent or intentionally ignored.
- Appropriate gate passed and is named in the commit/update.
- Root `package.json` and `bun.lock` are not staged accidentally.
