---
name: maidens-effect-jido-contracts
description: Build and evolve cross-runtime contracts where Effect Schema is canonical in TypeScript, JSON Schema is the interchange artifact, Elixir validates payloads, and Jido FSM transitions are preflighted before cmd/2.
---

# Maidens: Effect ↔ Jido Runtime Contracts

Use this skill when implementing or extending a domain contract that spans:

- Effect Schema (TypeScript)
- JSON Schema artifacts
- Elixir validation
- Jido agent/FSM execution boundaries

## Core Contract Doctrine

1. **Effect Schema is canonical** (domain typing + TS runtime validation).
2. **JSON Schema is the wire artifact** (cross-language interchange only).
3. **Elixir validator enforces payload shape/types** before command execution.
4. **FSM adjacency legality is enforced in code** (JSON Schema alone cannot cleanly encode adjacency).
5. **Jido handles agent runtime behavior** (`cmd/2`, strategy transitions, directives) after preflight gates.

## Required Research Path (before changes)

### 1) Jido context (DeepWiki + Context7)

- Query DeepWiki: `agentjido/jido`
  - Ask for: `cmd/2 contract`, `validate/2`, `FSM strategy transitions`, `core loop`.
- Query Context7:
  - resolve library: `/agentjido/jido`
  - ask for: preflight pattern before `cmd/2`, strategy transition wiring.

### 2) Effect context

- Use Effect docs for `JSONSchema.make` targets and annotation semantics.
- Canonical repo query string: `Effect-TS/effect`.

### 3) JSON Schema semantics

- Reconfirm `default` is annotation-only (not validation).

### 4) Elixir validator compatibility

- Check Exonerate + ex_json_schema draft/ref behavior against generated output.

## Directory Pattern

```text
src/lib/maidens/
├── core/contracts/                # reusable tooling
└── domains/contracts/<domain>/
    ├── ts/                        # canonical Effect schemas + tests
    ├── scripts/                   # domain artifact generation entrypoints
    ├── schemas/                   # generated JSON schema + mermaid
    └── elixir/                    # validator + fsm + jido-facing modules + tests
```

## Implementation Checklist

- [ ] Define domain schema in Effect Schema.
- [ ] Define transition event schema + transition map in TS.
- [ ] Define Jido agent-state schema contract in TS (canonical).
- [ ] Generate JSON Schema artifacts with stable metadata.
- [ ] Normalize schema if validator compatibility requires it.
- [ ] Implement Elixir validator façade (`order_validate`, `transition_event_validate`, `agent_state_validate`).
- [ ] Implement FSM legality guard (`allowed?/2`, preflight function).
- [ ] Add Jido-facing agent module showing strategy transitions.
- [ ] For heavy-signal lanes, use strategy wrappers that emit boundary directives (persistence/job), not inline side effects.
- [ ] (When persistence lane active) add `checkpoint/2` + `restore/2` callbacks and snapshot/thaw wrappers.
- [ ] Add one-command E2E harness with deterministic schema fingerprint checks.
- [ ] When emitting rejection envelopes from sensors, route them to an explicit observer action.
- [ ] Include explicit negative-gate assertions in E2E harness (`--only negative_gate`).
- [ ] Introduce constructor helpers on both sides for ID/payload creation before tightening regex constraints.
- [ ] Keep provenance comments in code.
- [ ] Test TS and Elixir with same sample payloads.

## Provenance Tags (use in comments)

- `Effect Schema feature`
- `JSON Schema contract semantics`
- `Elixir validator behavior`
- `Jido agent behavior/strategy`

## References

Use these as primary references (read directly, not summaries):

- Effect Schema JSON Schema generation:
  - https://effect.website/docs/schema/json-schema/
- JSON Schema annotation semantics (`default` is annotation-only):
  - https://json-schema.org/understanding-json-schema/reference/annotations
- Jido Agent behavior (`cmd/2`, `validate/2`, schema formats):
  - https://hexdocs.pm/jido/Jido.Agent.html
- Jido guides (agents + strategies + core loop):
  - https://hexdocs.pm/jido/agents.html
  - https://hexdocs.pm/jido/strategies.html
  - https://hexdocs.pm/jido/core-loop.html
- Jido repository (strategy/FSM examples):
  - https://github.com/agentjido/jido
- Elixir validator docs:
  - https://hexdocs.pm/exonerate/Exonerate.html
  - https://hexdocs.pm/ex_json_schema/readme.html

## Evolving Notes

Append new compatibility findings to:

- `.pi/skills/maidens-effect-jido-contracts/LEARNINGS.md`
