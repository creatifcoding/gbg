/**
 * MIDI Signal Schema
 *
 * Source: Web MIDI API (Electron renderer) or node-midi (main process)
 * Covers: Note on/off, CC, program change, pitch bend, sysex
 *
 * @module tsingou-flow/schemas/midi-signal
 */

import { Schema } from 'effect'
import { BaseSignal } from './base-signal'

// =============================================================================
// MIDI Payload
// =============================================================================

export const MidiMessageType = Schema.Literal(
  'note-on',
  'note-off',
  'cc',
  'program-change',
  'pitch-bend',
  'aftertouch',
  'channel-pressure',
  'sysex',
)
export type MidiMessageType = typeof MidiMessageType.Type

/** Standard 7-bit MIDI value (0–127) */
const Midi7Bit = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 127),
)

/** MIDI channel (0–15) */
const MidiChannel = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 15),
)

/** 14-bit MIDI value for pitch bend (-8192 to 8191) */
const Midi14Bit = Schema.Number.pipe(
  Schema.int(),
  Schema.between(-8192, 8191),
)

export const MidiPayload = Schema.Struct({
  channel: MidiChannel,
  type: MidiMessageType,

  // Note events
  note: Schema.optional(Midi7Bit),
  velocity: Schema.optional(Midi7Bit),

  // CC events
  cc: Schema.optional(Midi7Bit),
  value: Schema.optional(Midi7Bit),

  // Program change
  program: Schema.optional(Midi7Bit),

  // Pitch bend
  pitchBend: Schema.optional(Midi14Bit),

  // Aftertouch
  pressure: Schema.optional(Midi7Bit),

  // Raw bytes (for sysex or unrecognized messages)
  raw: Schema.optional(Schema.Array(Schema.Number)),

  // Device identification
  deviceName: Schema.optional(Schema.String),
  deviceId: Schema.optional(Schema.String),
})
export type MidiPayload = typeof MidiPayload.Type

// =============================================================================
// MidiSignal
// =============================================================================

export const MidiSignal = Schema.extend(
  BaseSignal,
  Schema.Struct({
    kind: Schema.Literal('midi'),
    payload: MidiPayload,
  }),
)
export type MidiSignal = typeof MidiSignal.Type
