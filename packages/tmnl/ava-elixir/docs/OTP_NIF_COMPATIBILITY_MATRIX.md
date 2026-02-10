# OTP/NIF Compatibility Policy & Rustler Matrix

## Scope

Defines support policy for AVA Elixir control-plane NIF builds and runtime compatibility.

## Compatibility Targets

| Layer | Supported | Notes |
| --- | --- | --- |
| Elixir | `~> 1.18` | pinned in `mix.exs` |
| Erlang/OTP | 26.x / 27.x | baseline for current Nix shell; CI must cover both |
| Rustler | `~> 0.37` | NIF binding layer |
| Rust toolchain | stable (from Nix shell) | must match CI lockstep |

## Policy

1. **Additive support only** in patch/minor releases.
2. **No silent ABI assumptions**: each release validates NIF load + smoke tests on each OTP lane.
3. **Scheduler safety gate** must pass (`mix lint.nif`).
4. **Fallback guarantee**: `AVA_RUNTIME_MODE=sidecar` must remain available for rollback.
5. **Version telemetry**: `AvaElixir.nif_version/0` must be bumped on boundary shape changes.

## CI Matrix Requirements

- Lane A: OTP 26 + Elixir 1.18 + NIF tests
- Lane B: OTP 27 + Elixir 1.18 + NIF tests
- Lane C: sidecar mode functional tests (no NIF assumptions)

## Release Blocking Conditions

- NIF compilation failure on any supported OTP lane
- Contract tests failing (`contracts_test.exs`)
- Scheduler policy failure (`mix lint.nif`)
- Precompiled checksum mismatch (when artifacts enabled)
