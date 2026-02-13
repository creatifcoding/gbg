# RFC-HPX Portfolio Charter

```text
Program:       Holonet / AVA Elixir Client Library RFC Portfolio
Owner:         #F184 (child of #F179)
Status:        ACTIVE
Created:       2026-02-10
Mode:          Research-first, RFC-driven
```

## Purpose

Define and evaluate architecture variants for:

1. `holonet-phoenix` client extraction,
2. broader Elixir application interoperability, and
3. AVA-specific high-performance runtime integration.

This portfolio is design governance, not implementation code.

## Portfolio RFC Map

- **RFC-HPX-000**: Research Baseline (`RESEARCH.md`)
- **RFC-HPX-001**: Implementation Contract (`IMPLEMENTATION_CONTRACT.md`)
- **RFC-HPX-002**: Replay and Session Protocol (`PROTOCOL_SPEC.md`)
- **RFC-HPX-003**: Transport SDK Family
- **RFC-HPX-004**: AVA Vertical SDK
- **RFC-HPX-005**: Protocol-First Codegen Track
- **RFC-HPX-006**: Dual-Plane Client Model
- **RFC-HPX-007**: Offline / Resilient Sync Client
- **RFC-HPX-008**: Pluggable Elixir Bridge
- **RFC-HPX-009**: AVA Edge Gateway (Rustler-aware)
- **RFC-HPX-010**: Architecture Selection Matrix + Phased Recommendation

## Execution Discipline

- Research MUST precede each draft RFC.
- Canonical Phoenix references are normative:
  - `https://hexdocs.pm/phoenix/js/`
  - `https://hexdocs.pm/phoenix/writing_a_channels_client.html`
  - `https://hexdocs.pm/phoenix/channels.html`
  - Phoenix upstream `socket.js` / `channel.js`
- Effect service/layer guidance is normative for runtime boundaries.

## Agent/Worker Rule

Codex workers are **read-only** in this program:

- allowed: repo reading, source analysis, citation collection, risk reports,
- forbidden: mutating files, changing tasks directly, writing code/docs.

All writes are performed by the primary implementation agent.

## Global Constraints (Apply to ALL RFCs)

1. React-consumed state is atom-backed (`Atom.make` / `Atom.family` / `Atom.runtime`).
2. High-volume ingress uses `Stream`/`Queue`/`PubSub` with explicit overflow policy.
3. No raw ingress event stream mirrored 1:1 into React-facing atoms.
4. Replay-required paths enforce no-live-before-ack invariant.
5. `holonet/phoenix` runtime boundary must not depend on `pi-orchestrator` internals.

## Deliverables

Each variant RFC MUST include:

- goals / non-goals,
- architecture + boundaries,
- state model + stream/backpressure model,
- protocol/replay implications,
- observability requirements,
- migration strategy,
- risk register,
- acceptance and conformance checks.

## Exit Condition

Portfolio closes when RFC-HPX-003..010 are drafted, validated, and synthesis RFC (010) defines a phased AVA recommendation with kill criteria and fallback path.
