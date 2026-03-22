# AVA Rollout CI Checklist (F762 / Phase A)

Status: Active gate for rollout validation

This checklist is CI-facing and intentionally command-first. Every command below must exit `0`.

---

## 1) Subject drift gate (TS canonical contract parity)

Validates TS mirror/templates against `src/lib/ava/contracts/ava_contract_v1.json`.

```bash
bunx vitest run src/lib/ava/__tests__/ava-contract-drift.test.ts
```

---

## 2) Casing rejection gate (TS command payload aliases)

Validates command payload schemas reject camelCase `viewId` alias and require canonical `view_id`.

```bash
bunx vitest run src/lib/ava/__tests__/ava-v2-services.test.ts
```

---

## 3) TS parity lane (Phase A required run)

Run the exact Phase A TS command set used for rollout evidence.

```bash
bunx vitest run src/lib/ava/__tests__/ava-contract-drift.test.ts src/lib/ava/__tests__/ava-v2-services.test.ts
```

---

## 4) Elixir lane (subject + casing rejection)

Validates command subject parsing, payload casing rejection, and ingress contract drift.

```bash
cd ava-elixir && mix test test/ava_elixir/contract_drift_test.exs test/ava_elixir/bridge/nats_ingress_test.exs
```

---

## 5) Compile gate (Elixir)

Ensures the bridge/runtime compiles cleanly before rollout.

```bash
cd ava-elixir && mix compile
```

---

## Pass criteria

- Subject drift tests are green.
- `viewId` alias rejection assertions are green in both TS and Elixir lanes.
- TS parity lane command is green.
- Elixir compile is clean.
- Evidence captured in `ava-elixir/reports/ROLL_OUT_EVIDENCE_F762.md`.
