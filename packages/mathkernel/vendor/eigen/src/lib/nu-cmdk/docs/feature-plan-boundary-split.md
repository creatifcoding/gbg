# Feature Plan — NuCmdk Boundary Split

## Objective

Physically separate NuCmdk from the command domain so ownership is explicit:

- `commands` owns command registry, decorators, keybindings, execution.
- `nu-cmdk` owns shell UI, ranking/runtime orchestration, provider bridge wiring.
- `overlays` owns modal lifecycle.

## Target Topology

```txt
src/lib/commands/
  CommandProvider.ts
  service.ts
  defaults.ts
  wire.ts
  useCommandWire.tsx
  ...

src/lib/nu-cmdk/
  index.ts
  runtime/*
  shell/*
  wire/useNuCmdkWire.ts
  integrate/nu-cmdk.tsx
  docs/feature-plan-boundary-split.md
```

## Migration Steps

1. Move NuCmdk runtime module from commands to `src/lib/nu-cmdk/runtime`.
2. Move NuCmdk shell module from commands to `src/lib/nu-cmdk/shell`.
3. Move NuCmdk wiring hook to `src/lib/nu-cmdk/wire/useNuCmdkWire.ts`.
4. Move integration spike/demo to `src/lib/nu-cmdk/integrate/nu-cmdk.tsx`.
5. Create `src/lib/nu-cmdk/index.ts` barrel exports.
6. Rewire app imports to consume `@/lib/nu-cmdk` directly.
7. Remove NuCmdk exports from `@/lib/commands` barrel.
8. Validate with targeted tests + typecheck.

## Execution Status

- [x] Runtime moved
- [x] Shell moved
- [x] Wire hook moved
- [x] Integration file moved
- [x] NuCmdk barrel created
- [x] Header and persistent overlay imports rewired to `@/lib/nu-cmdk`
- [x] Commands barrel boundary cleaned (NuCmdk exports removed)
- [ ] Follow-up docs migration from `src/lib/commands/docs/*nu-cmdk*` to `src/lib/nu-cmdk/docs/*`

## Validation Plan

- `bun run test:run src/lib/nu-cmdk/runtime/__tests__/laneAdapters.slice.test.ts src/lib/nu-cmdk/shell/__tests__/ResultsBand.test.tsx src/lib/nu-cmdk/shell/__tests__/item-contract.test.ts`
- `bunx tsc --noEmit --pretty false`

## Rollback

- Revert move commits for `src/lib/nu-cmdk/*`.
- Restore prior imports in `HeaderContent.tsx` and `PersistentOverlays.tsx`.
- Restore NuCmdk exports in `src/lib/commands/index.ts`.
