# Phoenix + LiveView Research Brief (TMNL / AVA)

Date: 2026-02-10

## Alignment Decisions (Questionnaire)

- Phoenix placement: **inside `ava-elixir`** (single BEAM app)
- TMNL realtime transport: **Phoenix Channels**
- Auth: **short-lived `Phoenix.Token` channel token**
- Nix strategy: **reuse nixpkgs BEAM approach** (extend current `tmnl-elixir` shell)
- Delivery mode: **scaffold Phoenix + Channels + LiveView now**

## Primary Findings

1. **Channels are the correct transport for TMNL desktop clients**
   - Use Phoenix socket endpoint + topic-based channels.
   - Desktop client can use `new Socket(url, { authToken })` and join topics.

2. **LiveView coexists cleanly when PubSub is the shared event spine**
   - Channels and LiveViews should consume the same internal PubSub topics.
   - LiveView updates via `handle_info` + `push_event/3` or assign/stream updates.

3. **Auth should be token-based at socket connect**
   - `Phoenix.Token.verify/4` in `UserSocket.connect/3`.
   - Prefer short-lived channel token + explicit refresh flow.

4. **Nix can remain incremental**
   - Keep current `tmnl-elixir` shell as base.
   - Add Phoenix needs (Node/assets tooling, optional Postgres service) without introducing a parallel shell model unless necessary.

## Design Constraints for TMNL

- Keep TMNL (Tauri/React) as primary operator UI.
- Add Phoenix/LiveView as web/operator surface and channel authority.
- Keep one canonical event envelope shared by Channels + LiveView + TMNL.

## Reference Sources

- Phoenix Channels: https://hexdocs.pm/phoenix/channels.html
- Phoenix Endpoint socket/auth_token: https://hexdocs.pm/phoenix/Phoenix.Endpoint.html
- Phoenix Token: https://hexdocs.pm/phoenix/Phoenix.Token.html
- Phoenix PubSub: https://hexdocs.pm/phoenix_pubsub/Phoenix.PubSub.html
- Phoenix Presence: https://hexdocs.pm/phoenix/presence.html
- LiveView JS interop/hooks: https://hexdocs.pm/phoenix_live_view/js-interop.html
- LiveView 1.1 release notes: https://www.phoenixframework.org/blog/phoenix-liveview-1-1-released
- Tauri security capabilities: https://v2.tauri.app/security/capabilities/
- Tauri security lifecycle: https://v2.tauri.app/security/lifecycle/
- Tauri websocket plugin docs: https://v2.tauri.app/plugin/websocket/
