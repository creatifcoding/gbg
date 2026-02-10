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

## CI Matrix (proposed)

For each supported target lane:

1. Build Elixir + Rustler NIF
2. Run `mix test`
3. Run `mix lint.nif`
4. Run artifact packaging script
5. Upload tarball + checksum as release artifacts

## Consumption policy

- Only accept artifacts with valid `.sha256` verification.
- Reject unsigned/unverified artifacts in automated deploy pipelines.
- Keep `AVA_RUNTIME_MODE=sidecar` rollback path available if precompiled NIF
  is unavailable for a target.
