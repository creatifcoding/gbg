# AVA Elixir ↔ Rustler Boundary Contract (Phase 1)

## Scope

This document defines the initial contract between Elixir control-plane modules and the Rustler NIF crate (`native/ava_bridge`).

Phase 1 intentionally keeps surface area small and scheduler-safe.

## NIF API Surface

Module: `AvaElixir.Native`

| Function | Scheduler | Input | Output |
| --- | --- | --- | --- |
| `nif_version/0` | Normal | none | string |
| `runtime_ping/1` | DirtyCpu | payload string | string (`"ava-runtime:<payload>"`) |
| `register_spec_json/1` | DirtyCpu | JSON string | `{:ok, "registered:<view_id>"}` or `{:error, reason}` |
| `invalidate_view/1` | Normal | view id string | `{:ok, "invalidated:<view_id>"}` or `{:error, "view_not_found:<view_id>"}` |

## Event Tuple Contract (Elixir-side canonical)

Constructed via `AvaElixir.Contracts`:

- `{:ava_artifact, sub_ref, artifact_map}`
- `{:ava_error, sub_ref, code, reason}`
- `{:ava_lagged, sub_ref, dropped_count}`

`sub_ref` is currently `reference() | String.t()`.

## View Spec Baseline Contract

`AvaElixir.Contracts.validate_view_spec/1` currently requires the following keys:

- `id`
- `name`
- `assemblage_id`
- `version`
- `channels`

This is a phase-1 compatibility gate before full AVA Schema-backed validation is introduced.

## Error Semantics

### Native (`AvaElixir.Native`)

Native functions return:

- Success: `{:ok, value}`
- Failure: `{:error, reason}`

Current native reason strings include:

- `invalid_json:<decode_error>`
- `missing_id`
- `view_not_found:<view_id>`
- `registry_lock_poisoned`

### Public API (`AvaElixir`)

`AvaElixir` normalizes native reasons into match-friendly terms:

- `{:invalid_json, detail}`
- `:missing_id`
- `{:view_not_found, view_id}`
- `:native_registry_unavailable`
- `{:native_error, raw}` (fallback)
- `:sidecar_not_implemented` (runtime mode fallback)

## Upgrade Rules

1. Additive only within minor versions.
2. Existing tuple shapes must remain stable.
3. Any breaking tuple or payload change requires:
   - fixture update (`test/fixtures/*`)
   - test updates (`contracts_test.exs`)
   - contract doc update in this file.

## Next-phase Extensions

- Replace ad-hoc JSON validation with AVA domain-level schema checks.
- Wire real runtime operations (`register_spec`, `invalidate`) into Rust-backed AVA orchestrator.
- Add subscription bridge (`subscribe/unsubscribe`) and lag telemetry.
