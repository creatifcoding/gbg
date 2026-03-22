# RFC Conformance Test Plan (HPX-003..009)

Suggested initial test scaffold paths and case names.

## RFC-HPX-003

**File:** `src/lib/holonet/phoenix/__tests__/rfc-hpx-003.transport-sdk-family.conformance.test.ts`

- `it('enforces no-live-before-ack across replay-required joins')`
- `it('applies declared overflow policy for control and event lanes')`
- `it('supports manual reconnect after replay ack failure')`
- `it('guards against runtime dependency leaks to pi-orchestrator modules')`

## RFC-HPX-004

**File:** `src/lib/holonet/phoenix/__tests__/rfc-hpx-004.ava-vertical-sdk.conformance.test.ts`

- `it('exposes required AVA projection atoms only')`
- `it('keeps UI projection bounded under burst traffic')`
- `it('enforces deterministic + idempotent replay reducers')`
- `it('blocks raw frame mirroring into UI atoms')`

## RFC-HPX-005

**File:** `src/lib/holonet/phoenix/__tests__/rfc-hpx-005.codegen-drift.conformance.test.ts`

- `it('includes join/replay/ack fields in generated contracts')`
- `it('includes typed error unions for replay ack failures')`
- `it('emits overflow metadata in generated runtime config')`
- `it('fails drift gate when generated artifacts are stale')`

## RFC-HPX-006

**File:** `src/lib/holonet/phoenix/__tests__/rfc-hpx-006.dual-plane.conformance.test.ts`

- `it('blocks data-plane dispatch until control-plane replay ack')`
- `it('fails session on cross-plane coherence faults')`
- `it('preserves cursor continuity across reconnects')`
- `it('recovers to control-plane-only mode when data plane degrades')`

## RFC-HPX-007

**File:** `src/lib/holonet/phoenix/__tests__/rfc-hpx-007.offline-sync.conformance.test.ts`

- `it('tracks offline -> resyncing -> live with bounded append log')`
- `it('treats local buffered events as uncommitted before replay ack')`
- `it('handles stale cursor via explicit reset/recovery path')`
- `it('fails session when persistence cap is exceeded')`

## RFC-HPX-008

**File:** `src/lib/holonet/phoenix/__tests__/rfc-hpx-008.bridge-capability-profile.conformance.test.ts`

- `it('validates adapter capability profile contract')`
- `it('rejects replay-required channels for replay-unsupported adapters')`
- `it('enforces adapter-declared overflow mode under stress')`
- `it('proves Phoenix adapter parity with baseline transport behavior')`

## RFC-HPX-009

**File:** `src/lib/holonet/phoenix/__tests__/rfc-hpx-009.edge-gateway.conformance.test.ts`

- `it('blocks hot-path output until control replay ack success')`
- `it('falls back without cursor discontinuity')`
- `it('emits execution_mode observability fields')`
- `it('forces replay recovery when hot-path ordering guarantee breaks')`

## Phase Gate Mapping (RFC-010)

Each phase advancement check requires at least one passing test from:

1. replay ack invariant,
2. overflow policy behavior,
3. observability contract emission,
4. rollback/fallback behavior.
