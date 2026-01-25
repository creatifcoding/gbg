/**
 * PTY Schemas — Effect Schema definitions for PTY messages
 *
 * All PTY protocol messages are Schema-backed for:
 * - Runtime validation
 * - Type inference
 * - WebSocket message parsing
 */

import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Session Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const SessionId = Schema.String.pipe(
  Schema.brand('SessionId'),
  Schema.minLength(1)
)
export type SessionId = typeof SessionId.Type

export const PtyConfig = Schema.Struct({
  shell: Schema.optional(Schema.String),
  args: Schema.optional(Schema.Array(Schema.String)),
  cwd: Schema.optional(Schema.String),
  env: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  cols: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  rows: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  name: Schema.optional(Schema.String),
})
export type PtyConfig = typeof PtyConfig.Type

// ─────────────────────────────────────────────────────────────────────────────
// Client → Server Messages
// ─────────────────────────────────────────────────────────────────────────────

export const ClientData = Schema.TaggedStruct('ClientData', {
  data: Schema.String,
})
export type ClientData = typeof ClientData.Type

export const ClientResize = Schema.TaggedStruct('ClientResize', {
  cols: Schema.Number.pipe(Schema.int(), Schema.positive()),
  rows: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type ClientResize = typeof ClientResize.Type

export const ClientPing = Schema.TaggedStruct('ClientPing', {
  timestamp: Schema.Number,
})
export type ClientPing = typeof ClientPing.Type

export const ClientMessage = Schema.Union(ClientData, ClientResize, ClientPing)
export type ClientMessage = typeof ClientMessage.Type

// ─────────────────────────────────────────────────────────────────────────────
// Server → Client Messages
// ─────────────────────────────────────────────────────────────────────────────

export const ServerData = Schema.TaggedStruct('ServerData', {
  data: Schema.String,
})
export type ServerData = typeof ServerData.Type

export const ServerReady = Schema.TaggedStruct('ServerReady', {
  sessionId: Schema.String,
  pid: Schema.Number,
  cols: Schema.Number,
  rows: Schema.Number,
})
export type ServerReady = typeof ServerReady.Type

export const ServerExit = Schema.TaggedStruct('ServerExit', {
  exitCode: Schema.Number,
  signal: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
})
export type ServerExit = typeof ServerExit.Type

export const ServerError = Schema.TaggedStruct('ServerError', {
  message: Schema.String,
  code: Schema.optional(Schema.String),
})
export type ServerError = typeof ServerError.Type

export const ServerPong = Schema.TaggedStruct('ServerPong', {
  timestamp: Schema.Number,
  serverTime: Schema.Number,
})
export type ServerPong = typeof ServerPong.Type

export const ServerMessage = Schema.Union(
  ServerData,
  ServerReady,
  ServerExit,
  ServerError,
  ServerPong
)
export type ServerMessage = typeof ServerMessage.Type

// ─────────────────────────────────────────────────────────────────────────────
// Session State
// ─────────────────────────────────────────────────────────────────────────────

export const SessionStatus = Schema.Literal('starting', 'running', 'exited', 'error')
export type SessionStatus = typeof SessionStatus.Type

export const SessionInfo = Schema.Struct({
  id: Schema.String,
  pid: Schema.Number,
  status: SessionStatus,
  cols: Schema.Number,
  rows: Schema.Number,
  shell: Schema.String,
  createdAt: Schema.DateFromSelf,
  exitCode: Schema.optional(Schema.Number),
})
export type SessionInfo = typeof SessionInfo.Type
