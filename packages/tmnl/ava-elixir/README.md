# AvaElixir

AVA Elixir control-plane subapp for `packages/tmnl`.

This app provides a typed Elixir API over a Rustler NIF boundary (`native/ava_bridge`) and is designed for phased rollout:

- `:nif` mode (default): execute control-plane calls via Rustler
- `:sidecar` mode: safe rollback path (currently explicit not-implemented)

## Runtime configuration

Set runtime mode with environment variable:

```bash
AVA_RUNTIME_MODE=nif      # default
AVA_RUNTIME_MODE=sidecar  # rollback path
```

Configuration is loaded in `config/runtime.exs`.

## Public API

- `AvaElixir.nif_version/0`
- `AvaElixir.ping/1`
- `AvaElixir.register_spec_json/1`
- `AvaElixir.get_spec_json/1`
- `AvaElixir.list_specs/0`
- `AvaElixir.invalidate_view/1`
- `AvaElixir.subscribe/2`
- `AvaElixir.unsubscribe/1`
- `AvaElixir.list_subscriptions/0`

Subscription events arrive in BEAM mailboxes as:

```elixir
{:ava_artifact, subscription_id, %{view_id: view_id, sequence: seq}}
```

See `docs/BOUNDARY_CONTRACT.md` for full contract semantics and error normalization.

## Development

From `packages/tmnl`:

```bash
bun run elixir:deps
bun run elixir:test
bun run elixir:build
```

Or directly with mission control:

```bash
tmnl elixir-deps
tmnl elixir-test
tmnl elixir-build
```
