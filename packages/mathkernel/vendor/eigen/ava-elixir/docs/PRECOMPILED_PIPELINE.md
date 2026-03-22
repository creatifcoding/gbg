# rustler_precompiled Artifact Pipeline (Design)

This document defines the phase-1 precompiled NIF release workflow for
`ava_elixir/native/ava_bridge`.

## Goals

- Build target-specific NIF bundles.
- Publish deterministic artifacts with checksum sidecars.
- Verify checksums before consumption.

## Build

```bash
# compile NIF first
mix compile

# package tarball + checksum
bash scripts/precompile_artifact.sh
```

Outputs in `dist/nif/`:

- `ava_bridge-<version>-<target>.tar.gz`
- `ava_bridge-<version>-<target>.sha256`

## Verify

```bash
bash scripts/verify_artifact.sh
```

## CI Matrix (current)

`ava-elixir-ci` executes:

1. Build Elixir + Rustler NIF (`mix compile`)
2. Run Phoenix tests (`mix phoenix.test`)
3. Run full tests (`mix test`)
4. Run scheduler policy gate (`mix lint.nif`)
5. Build + verify artifacts (`mix artifact.build`, `mix artifact.verify`)
6. Run sidecar functional lane (`mix sidecar.test` with `AVA_RUNTIME_MODE=sidecar`)

## Consumption policy

- Only accept artifacts with valid `.sha256` verification.
- Reject unsigned/unverified artifacts in automated deploy pipelines.
- Keep `AVA_RUNTIME_MODE=sidecar` rollback path available if precompiled NIF
  is unavailable for a target.
