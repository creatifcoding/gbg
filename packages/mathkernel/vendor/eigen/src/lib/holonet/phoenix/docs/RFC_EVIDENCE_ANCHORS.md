# RFC Evidence Anchors (HPX-003..009)

This register captures citation anchors gathered during the read-only finalization pass.

## RFC-HPX-003 — Transport SDK Family

- Package split, overflow policy, replay gate, migration/rollback documented:  
  `RFC-HPX-003_TRANSPORT_SDK_FAMILY.md:23-26,48-50,61-69,96-104`
- Legacy migration targets are explicit in contract and repo:  
  `IMPLEMENTATION_CONTRACT.md:239-244`  
  `src/lib/pi-orchestrator/client/PhoenixChannelClient.ts:1-7,51-59,88-104,140-148`  
  `src/lib/pi-orchestrator/client/PhoenixChannelAuth.ts:24-30`  
  `src/lib/pi-orchestrator/services/PhoenixEventDispatcher.ts:10-25`

## RFC-HPX-004 — AVA Vertical SDK

- AVA atom projection and replay error paths documented:  
  `RFC-HPX-004_AVA_VERTICAL_SDK.md:34-41,49-56,74-79,82-103`
- Atom-first precedent (family/keepAlive/runtime):  
  `src/components/testbed/conductor/agent-chat-stx.ts:34-55,197-200,314-315`

## RFC-HPX-005 — Protocol-First Codegen

- Codegen metadata + replay contract + CI rollout documented:  
  `RFC-HPX-005_PROTOCOL_FIRST_CODEGEN.md:44-50,54-65,75-83`
- Schema/runtime substrate and integration tests exist:  
  `src/lib/holonet/core/schema/SchemaRegistry.ts:30,59,134-177,225,335-341`  
  `src/lib/holonet/durable-streams/services/StreamCodecService.ts:26-27,241-242,260-265`  
  `src/lib/holonet/durable-streams/__tests__/integration.test.ts:205-218,263,296,352-353`

## RFC-HPX-006 — Dual-Plane Client Model

- Control/data split + replay gating explicitly defined:  
  `RFC-HPX-006_DUAL_PLANE_CLIENT_MODEL.md:34-43,61-72`
- Control-plane precedent in current Phoenix client:  
  `src/lib/pi-orchestrator/client/PhoenixChannelClient.ts:51-59,88-104,140-148`
- Data-plane precedent in stream transport stack:  
  `src/lib/holonet/nats/stream.ts:50-56,92-98,277-281,415-431,482,511`

## RFC-HPX-007 — Offline / Resilient Sync

- Offline lifecycle + bounded durability + ack gate documented:  
  `RFC-HPX-007_OFFLINE_RESILIENT_SYNC.md:34-41,45-56,57-68`
- Recovery/cursor behavior evidence:  
  `src/lib/holonet/durable-streams/__tests__/recovery.test.ts:107,169,201,212-218`

## RFC-HPX-008 — Pluggable Elixir Bridge

- Capability profile and replay support declaration documented:  
  `RFC-HPX-008_PLUGGABLE_ELIXIR_BRIDGE.md:33-47,67-76`
- Existing capability-style bridge precedent + tests:  
  `src/lib/iiot/realtime/holonet-bridge.ts:34-81,203-211`  
  `src/lib/iiot/realtime/holonet-bridge-stub.ts:20,26,38`  
  `src/lib/iiot/realtime/__tests__/holonet-bridge.test.ts:122,167,364`

## RFC-HPX-009 — AVA Edge Gateway

- Control/hot-path split + fallback + replay gate documented:  
  `RFC-HPX-009_AVA_EDGE_GATEWAY.md:34-42,63-69,97-104`
- Phoenix server auth/session ownership evidence:  
  `ava-elixir/lib/ava_elixir_web/user_socket.ex:7-9`  
  `ava-elixir/lib/ava_elixir_web/channels/ava_event_channel.ex:5,19,24,39`

## Cross-cutting protocol/test anchors

- Required replay/ack conformance suite baseline:  
  `PROTOCOL_SPEC.md:281-294`
- High-volume + atom boundary obligations in implementation contract:  
  `IMPLEMENTATION_CONTRACT.md:280-289`
