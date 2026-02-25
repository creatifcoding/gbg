# AVA Ash/Oban Runbook (Phase 1)

Status: Draft v1  
Audience: AVA operators, on-call engineers, merge-track implementers

---

## 1) Purpose

This runbook defines the operational baseline for running AVA async work through **Oban**, with clear guidance for:
- queue topology and policy
- retry/backoff behavior
- dead-letter handling (DLQ)
- redrive strategy
- rollback during dual-run (NATS primary / Phoenix fallback)

This is intentionally conservative for Phase 1.

---

## 2) Assumptions + environment variables

### Assumptions

1. Canonical NATS namespace is `tmnl.ava.*`.
2. Canonical command payload key is `view_id` (snake_case only).
3. Dual-run is available (`nats_primary` + fallback path).
4. Oban metrics are visible in ops dashboards (queue depth, latency, retries, DLQ).

### Environment variables (recommended)

| Variable | Example | Purpose |
|---|---|---|
| `AVA_RUNTIME_MODE` | `nats_primary` | Runtime path selector (`nats_primary` / `phoenix_fallback`) |
| `AVA_NATS_PREFIX` | `tmnl.ava` | Subject namespace prefix |
| `AVA_OBAN_MAX_ATTEMPTS` | `10` | Retry ceiling for command/projection workers |
| `AVA_OBAN_COMMAND_CONCURRENCY` | `20` | Concurrency for command ingest queue |
| `AVA_OBAN_PROJECTION_CONCURRENCY` | `12` | Concurrency for artifact/delta projection queue |
| `AVA_OBAN_STATUS_CONCURRENCY` | `8` | Concurrency for status fanout queue |
| `AVA_OBAN_REPAIR_CONCURRENCY` | `4` | Concurrency for compensation/reconciliation queue |
| `AVA_OBAN_DLQ_CONCURRENCY` | `2` | Concurrency for DLQ triage queue |

---

## 3) Queue policy table

| Queue | Purpose | Concurrency | Priority | Retry posture | DLQ routing |
|---|---|---:|---:|---|---|
| `ava_commands` | ingest `invalidate/subscribe/unsubscribe` keyed by `view_id` | 20 | high | exponential+jitter, max 10 | terminal -> `ava_dlq` |
| `ava_projection` | artifact/delta projection + envelope mapping | 12 | medium | exponential+jitter, max 10 | terminal -> `ava_dlq` |
| `ava_status` | lifecycle/status fanout | 8 | medium | bounded retry (short) | terminal -> `ava_dlq` |
| `ava_repair` | compensation/reconciliation | 4 | low | bounded retry (longer intervals) | terminal -> `ava_dlq` |
| `ava_dlq` | manual triage + controlled redrive intake | 2 | lowest | no auto-retry by default | n/a |

Operational rule: command ingress and projection stay isolated so slow projection does not starve command handling.

---

## 4) Retry policy

Default retry profile:
- `max_attempts`: 10
- Backoff: exponential + jitter (bounded)
- Classification:
  - transient infra errors -> retry
  - schema/contract violations (`view_id` missing, malformed envelope) -> non-retryable

Suggested attempt windows:
- attempts 1–4: aggressive retry (seconds)
- attempts 5–8: moderate retry (tens of seconds)
- attempts 9–10: conservative retry (minutes)

Hard rule: never retry malformed payload classes indefinitely.

---

## 5) DLQ policy

DLQ entry criteria:
- attempts exhausted
- explicitly non-retryable contract errors
- repeated bridge translation failures for same `view_id`

Minimum DLQ payload fields:
- `job_id`
- `queue`
- `view_id` (if resolvable)
- `subject`
- `error_class`
- `error_message`
- `attempt`
- `first_seen_at`
- `last_seen_at`

Operational targets:
- DLQ backlog SLO: investigate within 15 minutes
- DLQ growth alert: page if slope indicates sustained failure

---

## 6) Redrive procedure

Use this sequence:

1. **Triage class**
   - infra/transient
   - contract/schema
   - code bug
2. **Fix root cause first**
   - do not redrive blindly
3. **Select scope**
   - single `job_id`
   - `view_id` cohort
   - bounded time window
4. **Redrive with cap**
   - start small batch
   - confirm success rate before broad replay
5. **Observe**
   - error rate
   - queue latency
   - downstream stream parity (`tmnl.ava.artifacts.*`, `tmnl.ava.status.*`)

Abort redrive if failure class repeats after fix.

---

## 7) Rollback (dual-run)

When Phase 1 runs dual-path:
- primary: NATS-first
- fallback: Phoenix path

### Rollback trigger thresholds

Trigger rollback to `phoenix_fallback` if **any** condition holds for 5 consecutive minutes:

| Signal | Threshold |
|---|---|
| Command failure rate | `> 2%` on `tmnl.ava.invalidate.*`, `tmnl.ava.subscribe.*`, `tmnl.ava.unsubscribe.*` |
| DLQ growth | `> 50` new DLQ jobs in 10 minutes |
| Queue latency | p95 command queue latency `> 5s` |
| Stream parity drift | artifact/status mismatch for `> 1%` sampled `view_id` cohort |

Rollback steps:
1. Flip runtime mode to fallback (`AVA_RUNTIME_MODE=phoenix_fallback`)
2. Stop new NATS-primary ingest workers (drain in-flight)
3. Keep observability on both paths for drift analysis
4. Open incident + capture failed `view_id` cohorts
5. After stabilization, run controlled redrive for affected cohort

Rollback exit criteria:
- fallback path stable
- DLQ trend flat/declining
- no new contract violations

---

## 8) Local validation script

Canonical executable script:

```bash
./ava-elixir/scripts/track_a_canary.sh
```

If needed, copy/paste equivalent inline form:

```bash
#!/usr/bin/env bash
set -euo pipefail

export AVA_RUNTIME_MODE="${AVA_RUNTIME_MODE:-nats_primary}"
export AVA_NATS_PREFIX="${AVA_NATS_PREFIX:-tmnl.ava}"
export AVA_OBAN_MAX_ATTEMPTS="${AVA_OBAN_MAX_ATTEMPTS:-10}"

bunx tsc --noEmit
bunx vitest run src/lib/ava/__tests__/ava-v2-services.test.ts

cd ava-elixir
mix test test/ava_elixir/bridge/nats_ingress_test.exs
mix test test/ava_elixir/workers/ava_command_worker_test.exs test/ava_elixir/workers/ava_outbox_worker_test.exs
mix test
```

---

## 9) Operator checklist

Daily:
- queue depth by queue
- retry distribution
- DLQ count and trend
- top failing `view_id` / subject

Incident:
- identify failure class
- enforce rollback if required
- apply minimal redrive
- document root cause and prevention gate

---

## 10) Guardrails

- Enforce `view_id` as canonical command key.
- Reject mixed-case payload forms at boundary (`viewId` should fail).
- Keep queue concurrency bounded to avoid cascading retries.
- Favor explicit compensation jobs over ad-hoc manual mutation.

---

## 11) Parity + ingress telemetry metric names

For dual-run observability and low-risk ingress health monitoring, the bridge emits:

- `[:ava_elixir, :bridge, :ingress]`
  - measurements: `%{count: 1}`
  - metadata: `%{subject, status, runtime_mode, view_id}`
  - `status`: `:ok | :error`

- `[:ava_elixir, :bridge, :dual_run, :parity]`
  - measurements: `%{count: 1}`
  - metadata: `%{view_id, parity_status, expected_hash, actual_hash}`
  - `parity_status`: `:match | :mismatch | :missing_expected | :missing_actual | :error`

These names are the canonical Phase-1 metrics to wire into dashboards/alerts for ingress failures and sampled dual-run parity drift.

---

## 12) SLO + failure drill references

- SLO and alert matrix: `docs/AVA_SLO_ALERTS.md`
- Deterministic failure drill runner: `scripts/chaos_drill.sh`

Run the drill pack:

```bash
./ava-elixir/scripts/chaos_drill.sh
```

This validates three critical failure paths:
1. malformed ingress rejection,
2. outbox publish failure handling,
3. rollback alias smoke (`AVA_RUNTIME_MODE=phoenix_fallback`).
