/**
 * Tool Schema Tests
 *
 * Unit tests for AI SDK tool parameter and result schemas.
 * Validates Effect.Schema encoding/decoding, refinements, and edge cases.
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import {
  InsertTextParams,
  ReplaceSelectionParams,
  FocusEditorParams,
  GetContentRangeParams,
  SetSelectionParams,
  EmptyParams,
  ToolSuccess,
  InsertTextToolResult,
  ReadSelectionResult,
  GetContextResult,
  ListEditorsToolResult,
  ContentRangeResult,
} from '../tools'

// -----------------------------------------------------------------------------
// Parameter Schema Tests
// -----------------------------------------------------------------------------

describe('Tool Parameter Schemas', () => {
  describe('InsertTextParams', () => {
    it.effect('decodes valid params with content only', () =>
      Effect.gen(function* () {
        const input = { content: 'Hello, world!' }
        const decoded = yield* Schema.decodeUnknown(InsertTextParams)(input)
        expect(decoded.content).toBe('Hello, world!')
        expect(decoded.moveCursor).toBeUndefined()
      })
    )

    it.effect('decodes valid params with moveCursor', () =>
      Effect.gen(function* () {
        const input = { content: 'text', moveCursor: false }
        const decoded = yield* Schema.decodeUnknown(InsertTextParams)(input)
        expect(decoded.content).toBe('text')
        expect(decoded.moveCursor).toBe(false)
      })
    )

    it.effect('encodes and decodes roundtrip', () =>
      Effect.gen(function* () {
        const original = { content: 'test content', moveCursor: true }
        const encoded = yield* Schema.encode(InsertTextParams)(original)
        const decoded = yield* Schema.decode(InsertTextParams)(encoded)
        expect(decoded).toEqual(original)
      })
    )

    it.effect('rejects missing content', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(InsertTextParams)({}).pipe(
          Effect.either
        )
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('ReplaceSelectionParams', () => {
    it.effect('decodes valid params', () =>
      Effect.gen(function* () {
        const input = { content: 'replacement text' }
        const decoded = yield* Schema.decodeUnknown(ReplaceSelectionParams)(input)
        expect(decoded.content).toBe('replacement text')
      })
    )

    it.effect('accepts empty string content', () =>
      Effect.gen(function* () {
        const input = { content: '' }
        const decoded = yield* Schema.decodeUnknown(ReplaceSelectionParams)(input)
        expect(decoded.content).toBe('')
      })
    )
  })

  describe('FocusEditorParams', () => {
    it.effect('decodes valid editor ID', () =>
      Effect.gen(function* () {
        const input = { editorId: 'editor-panel-123' }
        const decoded = yield* Schema.decodeUnknown(FocusEditorParams)(input)
        expect(decoded.editorId).toBe('editor-panel-123')
      })
    )

    it.effect('rejects missing editorId', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(FocusEditorParams)({}).pipe(
          Effect.either
        )
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('GetContentRangeParams', () => {
    it.effect('decodes valid range', () =>
      Effect.gen(function* () {
        const input = { from: 0, to: 100 }
        const decoded = yield* Schema.decodeUnknown(GetContentRangeParams)(input)
        expect(decoded.from).toBe(0)
        expect(decoded.to).toBe(100)
      })
    )

    it.effect('accepts same from and to (empty range)', () =>
      Effect.gen(function* () {
        const input = { from: 50, to: 50 }
        const decoded = yield* Schema.decodeUnknown(GetContentRangeParams)(input)
        expect(decoded.from).toBe(50)
        expect(decoded.to).toBe(50)
      })
    )

    it.effect('rejects negative from', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(GetContentRangeParams)({
          from: -1,
          to: 10,
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('rejects negative to', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(GetContentRangeParams)({
          from: 0,
          to: -5,
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('rejects non-integer from', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(GetContentRangeParams)({
          from: 0.5,
          to: 10,
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('SetSelectionParams', () => {
    it.effect('decodes valid selection range', () =>
      Effect.gen(function* () {
        const input = { from: 10, to: 20 }
        const decoded = yield* Schema.decodeUnknown(SetSelectionParams)(input)
        expect(decoded.from).toBe(10)
        expect(decoded.to).toBe(20)
      })
    )

    it.effect('accepts zero positions', () =>
      Effect.gen(function* () {
        const input = { from: 0, to: 0 }
        const decoded = yield* Schema.decodeUnknown(SetSelectionParams)(input)
        expect(decoded.from).toBe(0)
        expect(decoded.to).toBe(0)
      })
    )
  })

  describe('EmptyParams', () => {
    it.effect('decodes empty object', () =>
      Effect.gen(function* () {
        const input = {}
        const decoded = yield* Schema.decodeUnknown(EmptyParams)(input)
        expect(decoded).toEqual({})
      })
    )

    it.effect('accepts object with extra properties', () =>
      Effect.gen(function* () {
        // Effect.Schema preserves extra properties by default (unlike Zod)
        // This is expected behavior - use Schema.Struct with { strict: true } to strip
        const input = { extra: 'preserved', another: 123 }
        const decoded = yield* Schema.decodeUnknown(EmptyParams)(input)
        // The decode succeeds - extra properties are preserved
        expect(decoded).toBeDefined()
      })
    )
  })
})

// -----------------------------------------------------------------------------
// Result Schema Tests
// -----------------------------------------------------------------------------

describe('Tool Result Schemas', () => {
  describe('ToolSuccess', () => {
    it.effect('decodes success true', () =>
      Effect.gen(function* () {
        const input = { success: true }
        const decoded = yield* Schema.decodeUnknown(ToolSuccess)(input)
        expect(decoded.success).toBe(true)
      })
    )

    it.effect('rejects success false', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(ToolSuccess)({
          success: false,
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('InsertTextToolResult', () => {
    it.effect('decodes valid result', () =>
      Effect.gen(function* () {
        const input = { success: true, charsInserted: 10, newPosition: 25 }
        const decoded = yield* Schema.decodeUnknown(InsertTextToolResult)(input)
        expect(decoded.success).toBe(true)
        expect(decoded.charsInserted).toBe(10)
        expect(decoded.newPosition).toBe(25)
      })
    )

    it.effect('accepts zero charsInserted', () =>
      Effect.gen(function* () {
        const input = { success: true, charsInserted: 0, newPosition: 0 }
        const decoded = yield* Schema.decodeUnknown(InsertTextToolResult)(input)
        expect(decoded.charsInserted).toBe(0)
      })
    )

    it.effect('rejects negative charsInserted', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(InsertTextToolResult)({
          success: true,
          charsInserted: -1,
          newPosition: 0,
        }).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('ReadSelectionResult', () => {
    it.effect('decodes result with selection', () =>
      Effect.gen(function* () {
        const input = {
          selection: { from: 0, to: 10, empty: false },
          text: 'selected text',
        }
        const decoded = yield* Schema.decodeUnknown(ReadSelectionResult)(input)
        expect(decoded.selection).toEqual({ from: 0, to: 10, empty: false })
        expect(decoded.text).toBe('selected text')
      })
    )

    it.effect('decodes result with null selection', () =>
      Effect.gen(function* () {
        const input = { selection: null, text: null }
        const decoded = yield* Schema.decodeUnknown(ReadSelectionResult)(input)
        expect(decoded.selection).toBeNull()
        expect(decoded.text).toBeNull()
      })
    )
  })

  describe('GetContextResult', () => {
    it.effect('decodes full context', () =>
      Effect.gen(function* () {
        const input = {
          editorId: 'editor-1',
          title: 'Document Title',
          selection: { from: 5, to: 15, empty: false },
          selectedText: 'some text',
          surroundingContext: 'prefix some text suffix',
          wordCount: 100,
          cursorPosition: 5,
        }
        const decoded = yield* Schema.decodeUnknown(GetContextResult)(input)
        expect(decoded.editorId).toBe('editor-1')
        expect(decoded.title).toBe('Document Title')
        expect(decoded.wordCount).toBe(100)
      })
    )

    it.effect('decodes context with nulls', () =>
      Effect.gen(function* () {
        const input = {
          editorId: 'editor-1',
          title: null,
          selection: null,
          selectedText: null,
          surroundingContext: null,
          wordCount: 0,
          cursorPosition: 0,
        }
        const decoded = yield* Schema.decodeUnknown(GetContextResult)(input)
        expect(decoded.title).toBeNull()
        expect(decoded.selection).toBeNull()
      })
    )
  })

  describe('ListEditorsToolResult', () => {
    it.effect('decodes with editors', () =>
      Effect.gen(function* () {
        const input = {
          editors: ['editor-1', 'editor-2', 'editor-3'],
          focused: 'editor-2',
          count: 3,
        }
        const decoded = yield* Schema.decodeUnknown(ListEditorsToolResult)(input)
        expect(decoded.editors).toHaveLength(3)
        expect(decoded.focused).toBe('editor-2')
        expect(decoded.count).toBe(3)
      })
    )

    it.effect('decodes with no focused editor', () =>
      Effect.gen(function* () {
        const input = {
          editors: [],
          focused: null,
          count: 0,
        }
        const decoded = yield* Schema.decodeUnknown(ListEditorsToolResult)(input)
        expect(decoded.editors).toHaveLength(0)
        expect(decoded.focused).toBeNull()
        expect(decoded.count).toBe(0)
      })
    )
  })

  describe('ContentRangeResult', () => {
    it.effect('decodes valid range result', () =>
      Effect.gen(function* () {
        const input = { content: 'extracted content', from: 10, to: 27 }
        const decoded = yield* Schema.decodeUnknown(ContentRangeResult)(input)
        expect(decoded.content).toBe('extracted content')
        expect(decoded.from).toBe(10)
        expect(decoded.to).toBe(27)
      })
    )

    it.effect('accepts empty content', () =>
      Effect.gen(function* () {
        const input = { content: '', from: 5, to: 5 }
        const decoded = yield* Schema.decodeUnknown(ContentRangeResult)(input)
        expect(decoded.content).toBe('')
      })
    )
  })
})
