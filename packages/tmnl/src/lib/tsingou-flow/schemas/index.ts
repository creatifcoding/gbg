/**
 * @tmnl/tsingou-flow — Schema Exports
 *
 * All signal schemas, branded IDs, adapter types, and registry types.
 *
 * @module tsingou-flow/schemas
 */

// Base signal + branded IDs
export {
  SignalId,
  SourceId,
  SessionId,
  SignalVersion,
  KnownSignalKind,
  SignalKind,
  SignalMetadata,
  BaseSignal,
} from './base-signal'
export type {
  SignalId as SignalIdType,
  SourceId as SourceIdType,
  SessionId as SessionIdType,
  SignalVersion as SignalVersionType,
  KnownSignalKind as KnownSignalKindType,
  SignalKind as SignalKindType,
  BaseSignal as BaseSignalType,
  BaseSignalEncoded,
} from './base-signal'

// Source-specific signals
export { MidiSignal, MidiPayload, MidiMessageType } from './midi-signal'
export { OscSignal, OscPayload, OscArgument } from './osc-signal'
export { NatsSignal, NatsPayload } from './nats-signal'
export { HttpSignal, HttpPayload, HttpMethod } from './http-signal'
export { SerialSignal, SerialPayload, SerialParserType } from './serial-signal'
export { RssSignal, RssPayload } from './rss-signal'
export { WebSocketSignal, WebSocketPayload, WebSocketMessageType } from './websocket-signal'
export { FileWatchSignal, FileWatchPayload, FileWatchEventType } from './file-watch-signal'

// Discriminated union
export { Signal } from './signal-union'
export type { Signal as SignalType, SignalEncoded } from './signal-union'

// Schema registry
export { SchemaRegistryEntry, SchemaCompatibility } from './registry'

// Adapter operational types
export {
  AdapterStatus,
  AdapterHealth,
  AdapterError,
  AdapterLifecycleEvent,
} from './adapter'
