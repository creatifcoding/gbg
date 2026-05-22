# Effect-Sui Quality Gates

Effect-Sui ships only after the package-local gates pass. Chain semantics require localnet proof; fast fake/unit tests are supplemental contract checks.

## Fast CI gate

```bash
bun run quality
# or
NX_DAEMON=false NX_NO_CLOUD=true NX_CLOUD=false bunx nx run @tmnl/effect-sui:quality
```

This runs:

1. `bun run audit:boundaries`
2. `bun run typecheck`
3. `bun run test:run`
4. `bun run test:property`
5. `EFFECT_SUI_E2E_MODE=skip bun run test:e2e`
6. `bun run build`

## Localnet release gate

```bash
bun run quality:localnet
# or
NX_DAEMON=false NX_NO_CLOUD=true NX_CLOUD=false bunx nx run @tmnl/effect-sui:quality:localnet
```

This runs the fast CI gate and then the real Docker/localnet e2e suite. Allow a generous timeout (7+ minutes in automation) because Docker localnet startup is intentionally outside the fast gate.

## Boundary audit

`bun run audit:boundaries` fails when production source regresses into:

- imperative error leakage: `throw new`, `Promise.reject`, `new Promise`, `async function`;
- forbidden source imports into test/outside package paths;
- non-testing source importing `src/testing` helpers.

Prime directive: commit gates must still stage explicit paths only. No `git add -A`; no wildcard staging.
