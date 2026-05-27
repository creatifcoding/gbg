# Effect-Sui Release Notes

## 0.0.1 — release candidate

Status: release-ready after `bun run quality:localnet`.

### Public API freeze

Stable package exports:

- `@tmnl/effect-sui`
- `@tmnl/effect-sui/schema`
- `@tmnl/effect-sui/effectable`
- `@tmnl/effect-sui/services`
- `@tmnl/effect-sui/ptb`
- `@tmnl/effect-sui/query`
- `@tmnl/effect-sui/flow`
- `@tmnl/effect-sui/diagnostics`
- `@tmnl/effect-sui/reservation`
- `@tmnl/effect-sui/package`
- `@tmnl/effect-sui/adapter`
- `@tmnl/effect-sui/testing`

### Highlights

- Schema-backed Sui domain nouns and rich typed error topology.
- Effectable `SuiObject`, `SuiPTB`, `SuiTx`, `SuiPackage`, and `SuiModule` facades.
- Effect service ecosystem for BCS, query, PTB, gas/payment/auth, execution, finality, reservations, diagnostics, and package registry.
- ManagedRuntime-backed Flow, Query, adapter, and testing edges with explicit disposal.
- STM reservation state with optional snapshot persistence hooks.
- Finality watcher fibers with interrupt/dispose handles.
- Diagnostics classification and retry hints that annotate/record without changing execution semantics.
- Move package publish helper with localnet `PackageWrite` extraction and registry handoff.
- Wallet callback auth bridge with explicit adapter run handles and AbortSignal cancellation.
- Fixture/runtime helper scopes for explicit memo sharing and fixture-level disposal.

### Validation gate

Run before publishing:

```bash
bun run quality:localnet
NX_DAEMON=false NX_NO_CLOUD=true NX_CLOUD=false bunx nx run @tmnl/effect-sui:quality:localnet
```

Latest roadmap validation passed the package-local fast quality gate, NX quality gate, and real Docker/localnet e2e suite after each post-realization feature slice.

### Publish notes

- Keep `effect-v4` pinned to `npm:effect@4.0.0-beta.59` until the consumer migration plan changes.
- Keep `@mysten/sui` and `@mysten/bcs` peer behavior validated through package-local localnet before version bumps.
- Publish from `packages/effect-sui` only after verifying `dist/`, README, and `docs/` are the only intended package files.
