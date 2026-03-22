/**
 * Signal Union — Discriminated union of all known signal types.
 *
 * This is the compile-time type-safe union. Runtime-registered signal types
 * (via schema registry) are validated dynamically against BaseSignal.
 *
 * @module tsingou-flow/schemas/signal-union
 */

import { Schema } from 'effect'
import { MidiSignal } from './midi-signal'
import { OscSignal } from './osc-signal'
import { NatsSignal } from './nats-signal'
import { HttpSignal } from './http-signal'
import { SerialSignal } from './serial-signal'
import { RssSignal } from './rss-signal'
import { WebSocketSignal } from './websocket-signal'
import { FileWatchSignal } from './file-watch-signal'

// =============================================================================
// Known Signal Union
// =============================================================================

/**
 * Discriminated union of all 8 known signal types.
 * Discriminant: `kind` field.
 *
 * @example Pattern matching
 * ```typescript
 * const handle = (signal: Signal) => {
 *   switch (signal.kind) {
 *     case 'midi':      return processMidi(signal)
 *     case 'osc':       return processOsc(signal)
 *     case 'nats':      return processNats(signal)
 *     case 'http':      return processHttp(signal)
 *     case 'serial':    return processSerial(signal)
 *     case 'rss':       return processRss(signal)
 *     case 'websocket': return processWebSocket(signal)
 *     case 'file-watch': return processFileWatch(signal)
 *   }
 * }
 * ```
 */
export const Signal = Schema.Union(
  MidiSignal,
  OscSignal,
  NatsSignal,
  HttpSignal,
  SerialSignal,
  RssSignal,
  WebSocketSignal,
  FileWatchSignal,
)
export type Signal = typeof Signal.Type
export type SignalEncoded = typeof Signal.Encoded
