# AvaElixir

AVA Elixir control-plane subapp for `packages/tmnl`.

This app provides a typed Elixir API over a Rustler NIF boundary (`native/ava_bridge`) and supports dual runtime routing:

- `:nif` mode (default): execute control-plane calls via Rustler
- `:sidecar` mode: execute equivalent control-plane semantics in-BEAM (`AvaElixir.SidecarClient`)

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

## Phoenix Surface

- Endpoint health: `GET /`
- LiveView ops page: `GET /ops/:workspace_id`
- Channel topic pattern: `ava:workspace:<workspace_id>:events`

TMNL should connect through `AvaElixirWeb.UserSocket` using short-lived channel token auth.

## Development

From `packages/tmnl`:

```bash
bun run elixir:deps
bun run elixir:test
bun run elixir:build
bun run phoenix:init
bun run phoenix:test
bun run phoenix:dev
cd ava-elixir && mix sidecar.test
cd ava-elixir && mix hex.repair
```

Or directly with mission control:

```bash
tmnl elixir-deps
tmnl elixir-test
tmnl elixir-build
tmnl phoenix-init
tmnl phoenix-test
tmnl phoenix-dev
```

## Troubleshooting: Hex archive corruption

If `mix deps.get` fails with `Error loading module 'Elixir.Hex': corrupt atom table`, run:

```bash
cd ava-elixir
mix hex.repair
env -u ERL_LIBS mix deps.get
```

`mix hex.repair` clears stale local Hex archives under project-scoped `MIX_HOME/HEX_HOME`, unsets conflicting `ERL_LIBS`, and reinstalls Hex/Rebar.
