/**
 * Tsingou Flow Adapters — barrel export.
 *
 * Architecture:
 *   - All adapters are Effect.Service instances (scoped lifecycle)
 *   - Shared contract: SourceAdapterShape (types.ts)
 *   - Shared errors: Tagged error hierarchy (errors.ts)
 *   - Shared push: SignalQueueTag → bounded Effect.Queue<BaseSignal>
 *
 * Real adapters:
 *   - NatsSourceAdapter (Holonet NatsPubSubService + NatsStreamService)
 *   - HttpSourceAdapter (@effect/platform HttpClient, 4 modes)
 *   - WebSocketSourceAdapter (@effect/platform Socket)
 *   - RssSourceAdapter (HttpClient + fast-xml-parser, with RssFeedManagerService)
 *   - HolonetBridgeAdapter (generic sidecar→NATS subscriber)
 *     ├── FileWatch (sidecar: @effect/platform FileSystem.watch)
 *     ├── Serial (sidecar: tauri-plugin-serialplugin or serialport npm)
 *     └── OSC (sidecar: osc.js UDP)
 *
 * Stubs (correct service shape, swap later):
 *   - MidiSourceAdapter
 *   - OscSourceAdapter
 *
 * @module tsingou-flow/adapters
 */

// ─── Contract & Primitives ──────────────────────────────────────────────────
export {
  type SourceAdapterShape,
  type AdapterInternals,
  makeAdapterInternals,
  generateSignalId,
  SignalQueueTag,
} from './types'

// ─── Tagged Errors ──────────────────────────────────────────────────────────
export * from './errors'

// ─── XML Parser (Effect boundary) ───────────────────────────────────────────
export {
  parseXml,
  parseRssFeed,
  extractItemId,
  XmlParseError,
  XmlValidationError,
  RssItemSchema,
  AtomEntrySchema,
  type RssItem,
  type AtomEntry,
} from './xml'

// ─── Real Adapters ──────────────────────────────────────────────────────────
export { NatsSourceAdapter, NatsAdapterConfig, NatsAdapterConfigTag } from './NatsAdapter'
export { HttpSourceAdapter, HttpAdapterConfig, HttpAdapterConfigTag } from './HttpAdapter'
export { WebSocketSourceAdapter, WsAdapterConfig, WsAdapterConfigTag, type WsSourceAdapterShape } from './WebSocketAdapter'
export {
  RssSourceAdapter,
  RssAdapterConfig,
  RssAdapterConfigTag,
  RssFeedManagerService,
  feedManagerStateAtom,
  type RssFeedManagerShape,
  type RssFeedManagerState,
} from './RssAdapter'

// ─── Holonet Bridge (sidecar pattern) ───────────────────────────────────────
export {
  HolonetBridgeAdapter,
  HolonetBridgeConfig,
  HolonetBridgeConfigTag,
  makeFileWatchBridgeConfig,
  makeSerialBridgeConfig,
  makeOscBridgeConfig,
} from './HolonetBridgeAdapter'

// ─── Stubs ──────────────────────────────────────────────────────────────────
export { MidiSourceAdapter, MidiAdapterConfig, MidiAdapterConfigTag } from './MidiAdapter'
export { OscSourceAdapter, OscAdapterConfig, OscAdapterConfigTag } from './OscAdapter'
