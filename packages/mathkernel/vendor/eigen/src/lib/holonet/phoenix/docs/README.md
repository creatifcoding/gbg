# Holonet Phoenix RFC Index

Core baseline:

- `RESEARCH.md` — RFC-HPX-000
- `IMPLEMENTATION_CONTRACT.md` — RFC-HPX-001
- `PROTOCOL_SPEC.md` — RFC-HPX-002

Portfolio governance:

- `RFC_PORTFOLIO_CHARTER.md`
- `RFC_CONFORMANCE_CHECKLIST.md`
- `RFC_VALIDATION_MATRIX.md`
- `RFC_EVIDENCE_ANCHORS.md`
- `RFC_CONFORMANCE_TEST_PLAN.md`

Variant RFC tracks:

- `RFC-HPX-003_TRANSPORT_SDK_FAMILY.md`
- `RFC-HPX-004_AVA_VERTICAL_SDK.md`
- `RFC-HPX-005_PROTOCOL_FIRST_CODEGEN.md`
- `RFC-HPX-006_DUAL_PLANE_CLIENT_MODEL.md`
- `RFC-HPX-007_OFFLINE_RESILIENT_SYNC.md`
- `RFC-HPX-008_PLUGGABLE_ELIXIR_BRIDGE.md`
- `RFC-HPX-009_AVA_EDGE_GATEWAY.md`
- `RFC-HPX-010_SELECTION_MATRIX.md`

## Program Constraints (applies to all tracks)

1. React-consumed state is atom-backed.
2. High-volume ingress uses stream/queue/pubsub with explicit overflow policy.
3. Replay-required paths enforce no-live-before-ack.
4. Canonical Phoenix docs + upstream client sources are normative.

## Unstub Validation Runbook (hard-cut readiness)

Run from `packages/tmnl`:

```bash
# Type + focused holonet phoenix conformance slice
bunx tsc --noEmit
bunx vitest run \
  src/lib/holonet/phoenix/__tests__/NoLegacyPhoenixImports.test.ts \
  src/lib/holonet/phoenix/__tests__/PhoenixAuthTokenProvider.test.ts \
  src/lib/holonet/phoenix/__tests__/PhoenixReplayCoordinator.test.ts \
  src/lib/holonet/phoenix/__tests__/PhoenixChannelSession.test.ts

# Pi-orchestrator guard slice (post hard-cut)
bunx vitest run \
  src/lib/pi-orchestrator/__tests__/config-resolver.test.ts \
  src/lib/pi-orchestrator/__tests__/runtime-boundary.test.ts
```

Pass criteria:

- `NoLegacyPhoenixImports.test.ts` has zero violations.
- Replay ack + reconnect scenarios are green in `PhoenixChannelSession.test.ts`.
- Failure modes (`replay_ack_timeout`, `join_rejected`) are green.
- Legacy Phoenix client/auth/dispatcher artifacts are removed from `pi-orchestrator` exports.
