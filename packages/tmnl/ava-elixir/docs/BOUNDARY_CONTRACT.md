# AVA Elixir ↔ Rustler Boundary Contract (Phase 1)

## Scope

This document defines the initial contract between Elixir control-plane modules and the Rustler NIF crate (`native/ava_bridge`).

Phase 1 intentionally keeps surface area small and scheduler-safe.

`AvaElixir` routes all control-plane calls through one of two runtime clients:

- `AvaElixir.Native` (`:nif` mode)
- `AvaElixir.SidecarClient` (`:sidecar` mode)

Both clients are required to preserve tuple/error semantics.
## NIF API Surface

Module: `AvaElixir.Native`

| Function | Scheduler | Input | Output |
| --- | --- | --- | --- |
| `nif_version/0` | Normal | none | string |
| `runtime_ping/1` | Normal | payload string | string (`"ava-runtime:<payload>"`) |
| `register_spec_json/1` | DirtyCpu | JSON string | `{:ok, "registered:<view_id>"}` or `{:error, reason}` |
| `get_spec_json/1` | Normal | view id string | `{:ok, spec_json}` or `{:error, "view_not_found:<view_id>"}` |
| `list_specs/0` | Normal | none | `{:ok, [view_id]}` |
| `invalidate_view/1` | DirtyCpu | view id string | `{:ok, "invalidated:<view_id>"}` or `{:error, "view_not_found:<view_id>"}` |
| `subscribe_view/3` | Normal | view id, interval ms, pid | `{:ok, subscription_id}` or `{:error, reason}` |
| `unsubscribe/1` | Normal | subscription id | `{:ok, "unsubscribed:<id>"}` or `{:error, "subscription_not_found:<id>"}` |
| `list_subscriptions/0` | Normal | none | `{:ok, [subscription_id]}` |

## Event Tuple Contract (Elixir-side canonical)

Constructed via `AvaElixir.Contracts`:

- `{:ava_artifact, sub_ref, artifact_map}`
- `{:ava_error, sub_ref, code, reason}`
- `{:ava_lagged, sub_ref, dropped_count}`

`sub_ref` is currently `reference() | String.t()`.

NIF subscription bridge currently emits mailbox events as:

- `{:ava_artifact, subscription_id, %{view_id: String.t(), sequence: non_neg_integer()}}`

## View Spec Baseline Contract

`AvaElixir.Contracts.validate_view_spec/1` enforces both presence and baseline type/value checks:

Required fields:

- `id` (non-empty string)
- `name` (non-empty string)
- `assemblage_id` (non-empty string)
- `version` (positive integer)
- `channels` (list)

Error shapes:

- `{:missing_keys, [atom()]}`
- `{:invalid_type, field, expected}`
- `{:invalid_value, field, rule}`

This remains a phase-1 compatibility gate before full AVA Schema-backed validation is introduced.
## Error Semantics

### Native (`AvaElixir.Native`)

Native functions return:

- Success: `{:ok, value}`
- Failure: `{:error, reason}`

Current native reason strings include:

- `invalid_json:<decode_error>`
- `missing_id`
- `view_not_found:<view_id>`
- `subscription_not_found:<subscription_id>`
- `registry_lock_poisoned`
- `subscriptions_lock_poisoned`

### Public API (`AvaElixir`)

`AvaElixir` normalizes runtime-client reasons into match-friendly terms:

- `{:invalid_json, detail}`
- `:missing_id`
- `{:view_not_found, view_id}`
- `{:subscription_not_found, subscription_id}`
- `:native_registry_unavailable`
- `:native_subscriptions_unavailable`
- `:runtime_client_unavailable`
- `{:native_error, raw}` (fallback)

## Upgrade Rules

1. Additive only within minor versions.
2. Existing tuple shapes must remain stable.
3. Any breaking tuple or payload change requires:
   - fixture update (`test/fixtures/*`)
   - test updates (`contracts_test.exs`)
   - contract doc update in this file.

## Next-phase Extensions

- Replace baseline Elixir validation with AVA domain-level schema checks.
- Wire real runtime operations (`register_spec`, `invalidate`) into Rust-backed AVA orchestrator.
- Expand sidecar client from in-memory fallback to remote sidecar transport adapter.
