/**
 * JSONL Codec + CodecService tests.
 *
 * Uses @effect/vitest for Effect-based test helpers.
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Layer, Stream, Chunk, DateTime } from 'effect'
import {
  parseLine,
  serializeLine,
  parseLines,
  serializeLines,
  JsonlParseError,
} from '../jsonl-codec'
import { AgentTaskLogEntry } from '../../schemas/log-entry'
import {
  CodecService,
  CodecServiceLive,
} from '../../services/CodecService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeEntry = (overrides: Partial<{
  id: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
  source: string
  message: string
}> = {}) =>
  new AgentTaskLogEntry({
    id: overrides.id ?? 'test-001',
    timestamp: DateTime.unsafeNow(),
    level: overrides.level ?? 'INFO',
    source: overrides.source ?? 'test-source',
    message: overrides.message ?? 'Test message',
  })

// ---------------------------------------------------------------------------
// Raw codec primitives
// ---------------------------------------------------------------------------

describe('jsonl-codec primitives', () => {
  it.effect('round-trips a valid entry', () =>
    Effect.gen(function* () {
      const entry = makeEntry()
      const line = serializeLine(entry)
      const decoded = yield* parseLine(line)

      expect(decoded).toBeInstanceOf(AgentTaskLogEntry)
      expect(decoded._tag).toBe('AgentTaskLogEntry')
      expect(decoded.id).toBe('test-001')
      expect(decoded.level).toBe('INFO')
      expect(decoded.source).toBe('test-source')
      expect(decoded.message).toBe('Test message')
    }),
  )

  it.effect('round-trips entry with all optional fields', () =>
    Effect.gen(function* () {
      const entry = new AgentTaskLogEntry({
        id: 'full-001',
        timestamp: DateTime.unsafeNow(),
        level: 'ERROR',
        source: 'circuit-agent',
        message: 'Connection refused',
        spanId: 'span-abc',
        traceId: 'trace-xyz',
        parentTaskId: 'rm-001',
        toolCallId: 'tc-001',
        metadata: { latency: 120, node: 'us-east-1' },
        payload: { errorCode: 'E_CONN_REFUSED' },
      })
      const line = serializeLine(entry)
      const decoded = yield* parseLine(line)

      expect(decoded.spanId).toBe('span-abc')
      expect(decoded.traceId).toBe('trace-xyz')
      expect(decoded.parentTaskId).toBe('rm-001')
      expect(decoded.toolCallId).toBe('tc-001')
      expect(decoded.metadata).toEqual({ latency: 120, node: 'us-east-1' })
      expect(decoded.payload).toEqual({ errorCode: 'E_CONN_REFUSED' })
    }),
  )

  it.effect('fails on empty line', () =>
    Effect.gen(function* () {
      const result = yield* parseLine('').pipe(Effect.either)
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(JsonlParseError)
        expect(result.left.reason).toContain('Empty line')
      }
    }),
  )

  it.effect('fails on invalid JSON', () =>
    Effect.gen(function* () {
      const result = yield* parseLine('not valid json {{{').pipe(Effect.either)
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left.reason).toContain('Invalid JSON')
      }
    }),
  )

  it.effect('fails on valid JSON missing required fields', () =>
    Effect.gen(function* () {
      const result = yield* parseLine('{"id":"x"}').pipe(Effect.either)
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left.reason).toContain('Schema validation failed')
      }
    }),
  )

  it.effect('batch parse handles mixed valid/invalid', () =>
    Effect.gen(function* () {
      const valid = serializeLine(makeEntry({ id: 'v1' }))
      const invalid = 'not json at all'
      const valid2 = serializeLine(makeEntry({ id: 'v2' }))
      const content = [valid, invalid, valid2, '', '{}'].join('\n')

      const entries = yield* parseLines(content)
      expect(entries).toHaveLength(2)
      expect(entries[0].id).toBe('v1')
      expect(entries[1].id).toBe('v2')
    }),
  )

  it('serializeLines produces newline-delimited output', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })]
    const output = serializeLines(entries)
    const lines = output.split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).id).toBe('a')
    expect(JSON.parse(lines[1]).id).toBe('b')
  })
})

// ---------------------------------------------------------------------------
// CodecService (assembly context)
// ---------------------------------------------------------------------------

describe('CodecService', () => {
  const run = <A, E>(
    effect: Effect.Effect<A, E, CodecService>,
  ) => Effect.runPromise(effect.pipe(Effect.provide(CodecServiceLive)))

  it.effect('assembleLine enriches with display fields', () =>
    Effect.gen(function* () {
      const codec = yield* CodecService
      const line = serializeLine(makeEntry({ level: 'WARN' }))
      const assembled = yield* codec.assembleLine(line)

      expect(assembled.entry).toBeInstanceOf(AgentTaskLogEntry)
      expect(assembled.severityOrd).toBe(2) // WARN = 2
      expect(assembled.levelAttr).toBe('warn')
      expect(assembled.key).toBe('test-001')
      expect(assembled.timestampDisplay).toBeTruthy()
      expect(assembled.relativeTime).toBeTruthy()
    }).pipe(Effect.provide(CodecServiceLive)),
  )

  it.effect('assembleLinesBatch deduplicates by ID', () =>
    Effect.gen(function* () {
      const codec = yield* CodecService
      const e1 = serializeLine(makeEntry({ id: 'dup-1', message: 'first' }))
      const e2 = serializeLine(makeEntry({ id: 'dup-1', message: 'second' }))
      const e3 = serializeLine(makeEntry({ id: 'unique' }))
      const content = [e1, e2, e3].join('\n')

      const assembled = yield* codec.assembleLinesBatch(content)
      expect(assembled).toHaveLength(2)
      const keys = assembled.map((a) => a.key)
      expect(keys).toContain('dup-1')
      expect(keys).toContain('unique')
    }).pipe(Effect.provide(CodecServiceLive)),
  )

  it.effect('mergeInto rejects duplicate, accepts new', () =>
    Effect.gen(function* () {
      const codec = yield* CodecService
      const line = serializeLine(makeEntry({ id: 'merge-test' }))
      const assembled = yield* codec.assembleLine(line)
      const buffer = [assembled]

      // Dup rejected
      const merged1 = codec.mergeInto(buffer, assembled)
      expect(merged1).toHaveLength(1)

      // New accepted
      const line2 = serializeLine(makeEntry({ id: 'merge-new' }))
      const assembled2 = yield* codec.assembleLine(line2)
      const merged2 = codec.mergeInto(buffer, assembled2)
      expect(merged2).toHaveLength(2)
    }).pipe(Effect.provide(CodecServiceLive)),
  )

  it.effect('assembleStream transforms raw lines to assembled entries', () =>
    Effect.gen(function* () {
      const codec = yield* CodecService
      const entries = [
        makeEntry({ id: 's1', level: 'INFO' }),
        makeEntry({ id: 's2', level: 'ERROR' }),
      ]
      const rawStream = Stream.fromIterable(entries.map(serializeLine))
      const assembledStream = codec.assembleStream(rawStream)
      const collected = yield* Stream.runCollect(assembledStream)
      const arr = Chunk.toReadonlyArray(collected)

      expect(arr).toHaveLength(2)
      expect(arr[0].key).toBe('s1')
      expect(arr[1].key).toBe('s2')
      expect(arr[1].severityOrd).toBe(3) // ERROR = 3
    }).pipe(Effect.provide(CodecServiceLive)),
  )

  it.effect('mergeMany deduplicates across buffer + incoming', () =>
    Effect.gen(function* () {
      const codec = yield* CodecService
      const line1 = serializeLine(makeEntry({ id: 'mm-1' }))
      const line2 = serializeLine(makeEntry({ id: 'mm-2' }))
      const line3 = serializeLine(makeEntry({ id: 'mm-1' })) // dup of mm-1
      const line4 = serializeLine(makeEntry({ id: 'mm-3' }))

      const buffer = yield* codec.assembleLinesBatch([line1, line2].join('\n'))
      const incoming = yield* codec.assembleLinesBatch([line3, line4].join('\n'))

      const merged = codec.mergeMany(buffer, incoming)
      expect(merged).toHaveLength(3) // mm-1, mm-2, mm-3
    }).pipe(Effect.provide(CodecServiceLive)),
  )
})
