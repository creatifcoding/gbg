# AVA SLO + Alerting Spec (Phase 1)

Status: Operational baseline
Owner: AVA runtime operators

## Canonical artifacts (Task #2792)

- Metrics contract: `docs/AVA_REDRIVE_METRICS_CONTRACT.md` (`AVA_REDRIVE_METRICS_CONTRACT`)
- Dashboard JSON: `docs/dashboards/ava_redrive_projection_dashboard.json`
- Alert rules: `docs/dashboards/ava_alert_rules.yaml`

## Service objectives

### SLO-1 Command ingestion reliability
- **Objective:** 99.5% successful command ingestion over rolling 1h
- **Signals:** `[:ava_elixir, :bridge, :ingress]` with `status`
- **Alert threshold:** error ratio > 2% for 5m
- **Severity:** P1 if sustained > 10m, else P2

### SLO-2 Outbox publish freshness
- **Objective:** p95 outbox publish latency < 5s
- **Signals:** outbox backlog + Oban queue depth (`ava_outbox`)
- **Alert threshold:** backlog > 200 OR p95 > 5s for 5m
- **Severity:** P2

### SLO-3 Dual-run parity drift
- **Objective:** parity mismatches < 1% in sampled cohort
- **Signals:** `[:ava_elixir, :bridge, :dual_run, :parity]` with `parity_status`
- **Alert threshold:** mismatch ratio > 1% for 5m
- **Severity:** P1

### SLO-4 Recovery safety
- **Objective:** rollback path remains runnable on-demand
- **Signals:** rollback drill result (`AVA_RUNTIME_MODE=phoenix_fallback` test lane)
- **Alert threshold:** any rollback drill failure
- **Severity:** P1

---

## Alert routes

| Severity | Trigger class | Route | Expectation |
|---|---|---|---|
| P1 | command failures sustained, parity drift, rollback failure | Pager + incident channel | immediate response |
| P2 | backlog growth, transient publish degradation | team channel + on-call ack | response < 15m |
| P3 | warning-only config drift | ticket queue | response < 24h |

Alert rule artifact: `docs/dashboards/ava_alert_rules.yaml`

---

## Dashboard panels (minimum)

Dashboard artifact: `docs/dashboards/ava_redrive_projection_dashboard.json`

1. Ingress OK vs ERROR count/time window
2. Ingress error ratio
3. Outbox queue depth + age histogram
4. DLQ/redrive candidate count
5. Dual-run parity mismatch ratio
6. Rollback drill latest status

---

## Correlated rollback conditions

Rollback to `phoenix_fallback` when one or more hold for 5m:
- command failure rate > 2%
- parity mismatch > 1%
- outbox freshness SLO violated + rising backlog

See: `AVA_ASH_OBAN_RUNBOOK.md` + `scripts/chaos_drill.sh`.
