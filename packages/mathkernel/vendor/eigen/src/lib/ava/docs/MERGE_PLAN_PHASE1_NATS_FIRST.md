# AVA Merge Plan — Phase 1 (NATS-first, fast integration)

Status: Draft v1  
Mode: Experiment → Design → Implement → Validate  
Primary objective: unify TS AVA v2 and Elixir AVA via NATS-first bridge with minimal churn.

---

## 0) Target outcome

After Phase 1:
- TS AVA v2 clients (`AvaClientV2` + v2 atoms/hooks) run against NATS subjects as canonical runtime path.
- Elixir AVA can consume command subjects and publish artifact/delta/status subjects.
- Payload casing is stable (`view_id`) and enforced.
- Phoenix paths continue to work (bridge-compatible), but are no longer the primary runtime contract for TS AVA v2.

---

## 1) Scope boundaries

### In scope
- NATS command and stream contract alignment.
- Elixir bridge seams for command ingest + stream emit.
- Contract tests for subject + payload + envelope parity.

### Out of scope (Phase 1)
- Full extraction to `@ava-fusion/contracts` generation pipeline.
- Re-architecture of legacy TS AVA REST/session clients.
- Comprehensive Phoenix deprecation.

---

## 2) Work packages

## WP1 — Contract freeze (1 day)

Deliverables:
- `src/lib/ava/docs/CONTRACT_MATRIX.md` finalized.
- Explicit command payload schema (`view_id`) and subject map signed off.

Touchpoints:
- `src/lib/ava/services/AvaClientV2.ts`
- `src/lib/ava/services/NatsClient.ts`
- `ava-elixir/lib/ava_elixir/channel_topics.ex`
- `ava-elixir/lib/ava_elixir/event_envelope.ex`

Acceptance:
- Matrix reviewed and accepted as canonical merge reference.

---

## WP2 — Elixir NATS bridge spike (2–3 days)

Deliverables:
- Bridge module/process that:
  - subscribes to `tmnl.ava.invalidate.*`, `tmnl.ava.subscribe.*`, `tmnl.ava.unsubscribe.*`
  - dispatches runtime operations keyed by `view_id`
  - publishes runtime updates on `tmnl.ava.artifacts.*`, `tmnl.ava.deltas.*`, `tmnl.ava.status.*`

Likely touchpoints (Elixir):
- `ava-elixir/lib/ava_elixir.ex`
- `ava-elixir/lib/ava_elixir/event_bus.ex`
- `ava-elixir/lib/ava_elixir_web/channels/ava_event_channel.ex`
- new bridge module under `ava-elixir/lib/ava_elixir/` (e.g., `nats_bridge.ex`)

Acceptance:
- End-to-end smoke passes for one view ID across all three command types.

---

## WP3 — TS parity hardening (1 day)

Deliverables:
- Ensure TS command schemas and runtime payloads are snake_case aligned.
- Add/expand tests proving payload keys and subjects.

Touchpoints:
- `src/lib/ava/schemas/v2/status.ts`
- `src/lib/ava/services/AvaClientV2.ts`
- `src/lib/ava/__tests__/ava-v2-services.test.ts`

Acceptance:
- Tests assert `view_id` in all command payloads.
- No camelCase command payload accepted by runtime tests.

---

## WP4 — Dual-run toggle and rollback guard (1–2 days)

Deliverables:
- Feature flag to control path selection (`nats_primary`, optional `phoenix_fallback`).
- Operational fallback documented.

Touchpoints:
- `src/lib/ava/components/AvaProvider.tsx`
- `src/lib/ava/hooks/v2/index.ts`
- runtime config entry points in app shell

Acceptance:
- Can switch between paths without code redeploy.
- Rollback procedure documented and tested.

---

## 3) Validation plan

## TESTING_MATRIX (dual-run + failure injection)

| Lane | Mode | Scenario | Expected |
|---|---|---|---|
| T1 Subject parity | `nats_primary` | publish/subscribe on `tmnl.ava.invalidate.*`, `tmnl.ava.subscribe.*`, `tmnl.ava.unsubscribe.*` | bridge subscriptions match TS subjects exactly |
| T2 Payload casing | `nats_primary` | send command payloads with `view_id` and with `viewId` (negative) | `view_id` accepted, `viewId` rejected |
| T3 Dual-run parity | `nats_primary` + observer on fallback | run same command sequence for sampled `view_id` cohort | status/artifact parity within tolerance |
| T4 Failure injection: bridge crash/restart | dual-run | restart bridge during active command flow | no data loss after recovery window; replay catches up |
| T5 Failure injection: malformed envelope | `nats_primary` | inject missing required envelope keys | validation failure + no downstream corruption |
| T6 Failure injection: queue pressure | `nats_primary` | throttle projection workers and burst commands | command queue remains bounded; rollback threshold not exceeded |
| T7 Rollback drill | switch to `phoenix_fallback` | trigger rollback criteria and flip runtime mode | service continuity maintained; incident playbook validated |

## Gate V1 — Subject parity
- Assert every TS command subject has matching Elixir bridge subscription.

## Gate V2 — Payload parity
- Assert command payloads use `view_id` only.

## Gate V3 — Envelope conformance
- Assert Elixir envelope validation still enforces required keys at Phoenix boundary.

## Gate V4 — End-to-end flow
- Scenario: invalidate → subscribe → unsubscribe round-trip
- Observe TS receives status/artifact events through canonical NATS path.

## Gate V5 — Regression
- Existing Phoenix channel contract tests still pass.

---

## 4) Risks and mitigations

1. **Transport ambiguity** (legacy WS/Phoenix path accidentally used)
   - Mitigation: explicit runtime flag + startup logging of selected transport.

2. **Payload casing drift** (`viewId` sneaks back)
   - Mitigation: schema + test gate + bridge reject rule for wrong casing.

3. **Event shape drift between Phoenix and NATS consumers**
   - Mitigation: bridge translation layer with strict projection tests.

4. **Operational cutover risk**
   - Mitigation: dual-run phase + rollback toggle.

---

## 5) Exit criteria for Phase 1

Phase 1 is complete when:
- NATS-first path is default for TS AVA v2 runtime.
- Elixir bridge supports all three command subjects and emits artifact/delta/status streams.
- Contract and regression gates are green in CI.
- Rollback toggle is documented and verified.

---

## 6) Phase 2 preview (contract durability)

Phase 2 should introduce `@ava-fusion/contracts` as generated contract spine:
- Rust/Elixir contract source (as agreed)
- TS package generation
- Drift CI gate across generated artifacts and runtime usage

This prevents future hand-authored schema drift and keeps merge debt from reappearing.
