# Rustler Scheduler Policy (AVA Elixir)

This policy constrains scheduler usage for NIF entrypoints in
`native/ava_bridge/src/lib.rs`.

## Rules

### DirtyCpu-required

Use `#[rustler::nif(schedule = "DirtyCpu")]` when the function performs work
that may exceed a fast scheduler slice (JSON decoding, multi-structure mutation).

- `register_spec_json/1`
- `invalidate_view/1`

### Normal scheduler fast-path

Keep these as `#[rustler::nif]` (normal scheduler) because they perform short,
non-blocking control-plane actions:

- `runtime_ping/1`
- `get_spec_json/1`
- `list_specs/0`
- `subscribe_view/3`
- `unsubscribe/1`
- `list_subscriptions/0`

## Why

- Prevent scheduler starvation for potentially expensive parsing/mutation paths.
- Avoid overusing dirty schedulers for trivial control operations.
- Keep policy explicit, testable, and reviewable.

## Enforcement

Run:

```bash
bash scripts/check_nif_schedule.sh
```

or via Mix alias:

```bash
mix lint.nif
```
