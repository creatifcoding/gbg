# Runtime Contracts (Effect TS ↔ Elixir/Jido)

This directory is the **cross-runtime contract fabric** for Maiden integrations.

## Why this layout?

- **`domains/contracts/*`**: bounded domain contracts (order today, others tomorrow).
- **`core/contracts/*`**: reusable cross-domain contract tooling (JSON Schema interop normalizers, FSM helpers).
- **TS canonical source**: Effect Schema under each domain `ts/` folder.
- **Co-located artifacts**: generated JSON Schema + Mermaid under each domain `schemas/` folder.
- **Elixir runtime gate**: JSON Schema validation + FSM adjacency guard + Jido-facing integration under each domain `elixir/` folder.

## Structure

```text
src/lib/maidens/
├── core/
│   └── contracts/
│       ├── fsm.ts
│       └── json-schema.codegen.ts
└── domains/
    └── contracts/
        └── order/
            ├── ts/
            │   ├── order.contract.ts
            │   └── order.contract.test.ts
            ├── scripts/
            │   └── gen-order-schemas.ts
            ├── schemas/
            │   ├── order.schema.json
            │   ├── order_transition.schema.json
            │   ├── order_agent_state.schema.json
            │   └── order_transition.mmd
            └── elixir/
                ├── mix.exs
                ├── lib/maiden/order_runtime/validators/order_validator.ex
                ├── lib/maiden/order_runtime/fsm.ex
                ├── lib/maiden/order_runtime/agent.ex
                └── test/order_validator_test.exs
```

## Provenance boundaries

- **Effect Schema (TS)**: domain typing + TS runtime decode/validation + JSON Schema generation.
- **JSON Schema**: language-neutral contract artifact only (`default` remains annotation semantics).
- **Elixir validators (ex_json_schema, Exonerate-ready)**: payload validation against generated schemas (order, transition, agent-state).
- **Jido**: agent schema contract + `cmd/2` execution model + FSM strategy semantics; preflight gates run before transition-driven command dispatch.
