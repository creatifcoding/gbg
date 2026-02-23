# Runtime Contracts (Effect TS ↔ Elixir/Jido)

This directory is the **cross-runtime contract fabric** for maiden integrations.

## Why this layout?

- **Extensible by domain**: add new domains under `domains/<name>/`.
- **Single source of truth in TS**: Effect Schema lives in `domains/<name>/ts/`.
- **Generated artifacts co-located**: JSON Schema + Mermaid live in `domains/<name>/schemas/`.
- **Runtime enforcement in Elixir**: validator + FSM legality checks live in `domains/<name>/elixir/`.

## Structure

```text
src/lib/maidens/runtime-contracts/
├── scripts/
│   └── gen-order-schemas.ts
└── domains/
    └── order/
        ├── ts/
        │   ├── order.contract.ts
        │   └── order.contract.test.ts
        ├── schemas/
        │   ├── order.schema.json
        │   ├── order_transition.schema.json
        │   └── order_transition.mmd
        └── elixir/
            ├── mix.exs
            ├── lib/my_app/validators/order_validator.ex
            ├── lib/my_app/order_fsm.ex
            └── test/order_validator_test.exs
```

## Provenance boundaries

- **Effect Schema (TS)**: domain typing + runtime TS decoding/validation + JSON Schema generation.
- **JSON Schema**: interchange contract format only.
- **Elixir validators (Exonerate / ex_json_schema)**: JSON payload validation against generated schema.
- **Jido FSM semantics**: transition legality model mirrored by `order_fsm.ex` before handing payloads to `cmd/2`.
