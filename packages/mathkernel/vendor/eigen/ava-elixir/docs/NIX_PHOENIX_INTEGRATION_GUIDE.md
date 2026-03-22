# Nix + Phoenix Integration Guide (TMNL)

## Goal

Add Phoenix/LiveView development support without fragmenting existing TMNL shells.

## Current Baseline

- `tmnl-elixir` shell already exists and is project-scoped.
- Bun/NX commands already drive Elixir scripts.

## Recommended Additions

1. Extend `nix/modules/elixir.nix` with Phoenix-friendly tooling:
   - Node.js (assets)
   - optional inotify/watch tools
   - optional local Postgres helpers for Phoenix dev

2. Add mission-control scripts:
   - `phoenix-init` (scaffold endpoint/socket/liveview)
   - `phoenix-dev` (`mix phx.server`)
   - `phoenix-test`

3. Add Bun/NX parity commands:
   - `bun run phoenix:init|dev|test`
   - matching Nx targets in `project.json`

## Why not a separate shell now?

Because questionnaire alignment selected reuse of existing nixpkgs BEAM strategy and the current shell already supports Rustler + Mix workflows.

## CI expectations

- Keep OTP matrix jobs.
- Add Phoenix compile and channel/liveview integration tests.
- Keep NIF scheduler and artifact checksum checks in same lane.

## Guardrails

- Do not introduce npm/yarn script paths; keep Bun and Nix discipline.
- Keep generated Phoenix files under `ava-elixir/` only.
- Ensure channel auth and topic contracts are tested before TMNL wiring.
