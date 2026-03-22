# Changelog

All notable changes to TMNL will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Connection Ports Architecture (6-Phase Initiative)

A comprehensive network abstraction layer enabling reactive data streaming from AVA through NATS and Durable Streams, with server-driven rendering for embeddable blocks.

**Phase 1: Modal Focus for Embeddables** (`tmnl-okut`)
- `BlockStateService` — Effect.Service for SQLite state persistence
- Focus atoms (`focusedBlockIdAtom`, `isFocusModeAtom`)
- `FocusOverlay` — Full-viewport focus container
- Sibling unmount logic with state persistence/restore

**Phase 2: Connection Ports Substrate** (`tmnl-f0g8`)
- `NatsPort` — Effect.Service wrapping NatsKVService
- `DurableStreamsPort` — Effect.Service for HTTP replay
- `ConnectionBus` — Orchestrator combining ports
- Schema definitions: `ConnectionConfig`, `PortStatus`, `ViewArtifact`
- `Atom.family` for per-view reactive state
- Hooks: `useConnectionPort`, `useStreamSubscription`

**Phase 3: AVA Rust Integration** (`tmnl-4tj9`)
- `NatsAdapter` struct in ava-adapters
- ReconcilerV2 NATS publishing (`publish_artifact`, `publish_delta`)
- NATS event triggers for reactive invalidation
- Subject patterns: `tmnl.ava.artifacts.{view_id}`, `tmnl.ava.deltas.{view_id}`

**Phase 4: Durable Streams Integration** (`tmnl-rdmu`)
- Docker compose for durable-streams server
- NATS→Durable Streams bridge service (Rust)
- Offset tracking and persistence
- Catch-up and live tail logic

**Phase 5: Block Integration** (`tmnl-awgy`)
- Stream binding config for EmbeddedBlockWrapper
- MapBlock and Scene3DBlock stream bindings
- Derived atoms for deck.gl layers from `renderSpec`
- `RenderSpec → Layer` builder

**Phase 6: Kori Entity Integration** (`tmnl-y7fp`)
- Traits: `Renderable3D`, `ViewData`, `ViewMeta`, `ViewStatus`
- `StreamToWorld` bridge service
- Dynamic pipeline assembly from streamed specs
- Trait imparting from `traitSpec`

#### Server-Driven Rendering Model

AVA artifacts now encode rendering instructions as structured specs:

```typescript
interface ViewArtifact {
  viewId: string
  payload: unknown           // Arrow/DataFusion result
  renderSpec: RenderSpec     // deck.gl layer configurations
  traitSpec: TraitSpec       // kori traits to impart
  pipelineSpec: PipelineSpec // Effect pipeline assembly
}
```

The client reacts to these specs, dynamically assembling Effect programs and materializing entities in the kori World.

### Infrastructure

- Added `persistence/` directory to EmbeddedBlockWrapper for BlockStateService

---

## Prior Work (Pre-Changelog)

For historical context, see:
- `.agents/index.md` — Session journals
- `.edin/` — Architecture decision records
- `assets/documents/` — Design documents
