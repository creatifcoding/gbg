# AVA Redrive Metrics Contract

Status: Phase-1 canonical contract  
Owner: AVA runtime operators

## Purpose

Define the telemetry contract emitted by `mix ava.outbox.redrive` so dashboards, alerts, and runbooks can rely on stable event names and payload shape.

## Event contract

### 1) Redrive selection

- **Event name:** `[:ava_elixir, :outbox, :redrive, :selection]`
- **When emitted:** once per task invocation, immediately after selection query
- **Measurements:**
  - `count` (`non_neg_integer`) — number of outbox rows selected for potential redrive
- **Metadata:**
  - `dry_run` (`boolean`) — whether enqueue will be skipped
  - `all` (`boolean`) — whether selection widened to all unpublished rows

---

### 2) Redrive enqueue attempt

- **Event name:** `[:ava_elixir, :outbox, :redrive, :enqueue]`
- **When emitted:** once per enqueue attempt in non-dry-run mode
- **Measurements:**
  - `count` (`1`) — single enqueue attempt unit
- **Metadata:**
  - `status` (`:ok | :error`) — enqueue result
  - `outbox_id` (`string`) — targeted outbox row id

---

### 3) Redrive summary

- **Event name:** `[:ava_elixir, :outbox, :redrive, :summary]`
- **When emitted:** once per task invocation after dry-run simulation or enqueue pass
- **Measurements:**
  - `selected` (`non_neg_integer`) — total selected rows
  - `enqueued` (`non_neg_integer`) — jobs successfully enqueued
  - `failed` (`non_neg_integer`) — enqueue failures (`selected - enqueued` in non-dry-run)
- **Metadata:**
  - `dry_run` (`boolean`) — distinguishes simulation vs real enqueue execution

## SLO mapping

This contract supports `docs/AVA_SLO_ALERTS.md`:

### SLO-2 Outbox publish freshness (`p95 < 5s`)

Use redrive events as **operator recovery telemetry**:

- Rising `selection.count` over repeated dry-runs indicates backlog accumulation.
- `summary.failed > 0` or degraded `enqueue.status=:ok` ratio indicates inability to drain backlog.
- Correlate with queue depth / backlog panels to determine if freshness violation is clearing.

### SLO-4 Recovery safety

Redrive is a recovery path. Verify safety by checking:

- Redrive invocations emit `selection` and `summary` consistently.
- Non-dry-run invocations produce `enqueue` events with expected success ratio.
- Dry-run drills still produce auditable `summary` with `dry_run=true`.

## Derived alert guidance (recommended)

- **P2 warning:** `enqueue error ratio > 5%` over a redrive execution window.
- **P2 warning:** `summary.enqueued = 0` with `summary.selected > 0` in non-dry-run.
- **P3 warning:** repeated dry-run selections above normal backlog threshold.

## Compatibility notes

- Treat event names and keys above as a stable interface.
- Additive metadata is allowed; key removals/renames require contract revision.
- `outbox_id` is operational metadata and should not contain payload-level PII.
