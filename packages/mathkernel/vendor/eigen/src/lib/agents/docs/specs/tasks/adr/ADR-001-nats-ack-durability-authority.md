# ADR-001: NATS JetStream Ack is Durability Authority

Status: Accepted (v1)  
Date: 2026-02-17  
Context: Persisted task log archival + hydration

---

## Decision

A task log entry is considered durable only after successful JetStream publish acknowledgement.

Local archival to browser storage is downstream and must be ack-gated.

---

## Why

1. NATS JetStream is the shared system-of-record for log durability in our architecture.
2. Browser storage is best-effort and quota-constrained.
3. Ack-gating ensures we do not treat local convenience persistence as canonical durability.

---

## Consequences

### Positive

- clear durability semantics
- easier failure classification (publish/ack vs local archive)
- safer replay integrity

### Negative

- local archive can lag under ack latency
- introduces retry/degraded pathways that require observability and tests

---

## Implementation Implications

1. introduce `AgentTaskLogDurabilityService.publishAndAwaitAck`
2. expose durability receipt schema
3. prevent spill before receipt
4. surface durability pending/error atom states

---

## Rejected Alternatives

1. local-first then async NATS publish
   - rejected: can mark non-durable entries as effectively persisted

2. dual-write with no ack gating
   - rejected: ambiguous authority and potential divergence

3. local-only durability in browser
   - rejected: not authoritative and quota fragile

---

## Validation

Must satisfy acceptance matrix gate B rows:

- B-01 through B-06

---

## References

- `../persisted-log-archive-hydration-spec.md`
- `../persisted-log-archive-hydration-implementation-details.md`
- `../../../persisted-logs-research.md`

---

End ADR-001.
