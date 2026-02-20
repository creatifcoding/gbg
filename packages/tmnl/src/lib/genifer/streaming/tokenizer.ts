/**
 * Streaming JSON Tokenizer
 *
 * Converts chunked string input into a stream of JSON tokens.
 * Handles partial tokens across chunk boundaries.
 *
 * @module genifer/streaming/tokenizer
 */
import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Token schemas (Effect.Schema — no raw types)
// ---------------------------------------------------------------------------

export const ObjectStart = Schema.TaggedStruct('ObjectStart', {
  offset: Schema.Number,
  depth: Schema.Number,
})

export const ObjectEnd = Schema.TaggedStruct('ObjectEnd', {
  offset: Schema.Number,
  depth: Schema.Number,
})

export const ArrayStart = Schema.TaggedStruct('ArrayStart', {
  offset: Schema.Number,
  depth: Schema.Number,
})

export const ArrayEnd = Schema.TaggedStruct('ArrayEnd', {
  offset: Schema.Number,
  depth: Schema.Number,
})

export const KeyToken = Schema.TaggedStruct('Key', {
  value: Schema.String,
  offset: Schema.Number,
  depth: Schema.Number,
})

export const StringToken = Schema.TaggedStruct('String', {
  value: Schema.String,
  offset: Schema.Number,
  depth: Schema.Number,
  partial: Schema.Boolean,
})

export const NumberToken = Schema.TaggedStruct('Number', {
  value: Schema.Number,
  offset: Schema.Number,
  depth: Schema.Number,
})

export const BooleanToken = Schema.TaggedStruct('Boolean', {
  value: Schema.Boolean,
  offset: Schema.Number,
  depth: Schema.Number,
})

export const NullToken = Schema.TaggedStruct('Null', {
  offset: Schema.Number,
  depth: Schema.Number,
})

export const JSONToken = Schema.Union(
  ObjectStart,
  ObjectEnd,
  ArrayStart,
  ArrayEnd,
  KeyToken,
  StringToken,
  NumberToken,
  BooleanToken,
  NullToken,
)

export type JSONToken = typeof JSONToken.Type

// ---------------------------------------------------------------------------
// Tokenizer state
// ---------------------------------------------------------------------------

type TokenizerState = {
  offset: number
  depth: number
  /** Accumulates chars when inside a string */
  inString: boolean
  stringBuf: string
  stringEscaped: boolean
  /** After a key string + colon, next value is a value, not a key */
  expectingValue: boolean
  /** Stack: 'object' | 'array' at each depth */
  containerStack: ('object' | 'array')[]
  /** Track if we just finished a key (waiting for colon) */
  afterKey: boolean
  /** Accumulates number/bool/null literals */
  literalBuf: string
}

const initialState = (): TokenizerState => ({
  offset: 0,
  depth: 0,
  inString: false,
  stringBuf: '',
  stringEscaped: false,
  expectingValue: false,
  containerStack: [],
  afterKey: false,
  literalBuf: '',
})

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Stateful JSON tokenizer. Feed it chunks, it emits tokens.
 *
 * Usage:
 * ```ts
 * const tok = createTokenizer()
 * const tokens1 = tok.feed('{"type":"Gri')
 * const tokens2 = tok.feed('d","columns":3}')
 * ```
 */
export type TokenizerOptions = {
  /** Called when tokenizer encounters an invalid literal or structural error */
  onError?: (message: string) => void
}

export function createTokenizer(options?: TokenizerOptions) {
  let state = initialState()
  const onError = options?.onError

  function flushLiteral(): JSONToken | null {
    const lit = state.literalBuf.trim()
    if (!lit) return null
    state.literalBuf = ''

    if (lit === 'true' || lit === 'false') {
      return {
        _tag: 'Boolean' as const,
        value: lit === 'true',
        offset: state.offset - lit.length,
        depth: state.depth,
      }
    }
    if (lit === 'null') {
      return {
        _tag: 'Null' as const,
        offset: state.offset - lit.length,
        depth: state.depth,
      }
    }
    const num = Number(lit)
    if (!Number.isNaN(num)) {
      return {
        _tag: 'Number' as const,
        value: num,
        offset: state.offset - lit.length,
        depth: state.depth,
      }
    }
    // Invalid literal — surface via onError callback instead of silently dropping
    if (onError) {
      onError(`Invalid literal: '${lit}' at offset ${state.offset - lit.length}`)
    }
    return null
  }

  function feed(chunk: string): ReadonlyArray<JSONToken> {
    const tokens: JSONToken[] = []

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i]
      state.offset++

      // Inside a string
      if (state.inString) {
        if (state.stringEscaped) {
          state.stringBuf += ch
          state.stringEscaped = false
          continue
        }
        if (ch === '\\') {
          state.stringEscaped = true
          state.stringBuf += ch
          continue
        }
        if (ch === '"') {
          // String complete
          state.inString = false
          const value = state.stringBuf
          state.stringBuf = ''

          // Determine: is this a key or a value?
          const container = state.containerStack[state.containerStack.length - 1]
          if (container === 'object' && !state.expectingValue) {
            // This is a key — wait for colon
            tokens.push({
              _tag: 'Key' as const,
              value,
              offset: state.offset,
              depth: state.depth,
            })
            state.afterKey = true
          } else {
            // This is a value
            tokens.push({
              _tag: 'String' as const,
              value,
              offset: state.offset,
              depth: state.depth,
              partial: false,
            })
            state.expectingValue = false
          }
          continue
        }
        state.stringBuf += ch
        continue
      }

      // Outside a string — skip whitespace
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        continue
      }

      // Colon after key
      if (ch === ':') {
        state.afterKey = false
        state.expectingValue = true
        continue
      }

      // Comma (separator)
      if (ch === ',') {
        // Flush any pending literal
        const litToken = flushLiteral()
        if (litToken) tokens.push(litToken)
        // After comma in object, next is a key; in array, next is a value
        const container = state.containerStack[state.containerStack.length - 1]
        state.expectingValue = container === 'array'
        continue
      }

      // Structural tokens
      if (ch === '{') {
        const litToken = flushLiteral()
        if (litToken) tokens.push(litToken)
        tokens.push({
          _tag: 'ObjectStart' as const,
          offset: state.offset,
          depth: state.depth,
        })
        state.depth++
        state.containerStack.push('object')
        state.expectingValue = false
        continue
      }

      if (ch === '}') {
        const litToken = flushLiteral()
        if (litToken) tokens.push(litToken)
        if (state.depth <= 0 || state.containerStack.length === 0) {
          onError?.(`Structural underflow: stray '}' at offset ${state.offset}`)
          continue
        }
        state.depth--
        state.containerStack.pop()
        tokens.push({
          _tag: 'ObjectEnd' as const,
          offset: state.offset,
          depth: state.depth,
        })
        state.expectingValue = false
        continue
      }

      if (ch === '[') {
        const litToken = flushLiteral()
        if (litToken) tokens.push(litToken)
        tokens.push({
          _tag: 'ArrayStart' as const,
          offset: state.offset,
          depth: state.depth,
        })
        state.depth++
        state.containerStack.push('array')
        state.expectingValue = true
        continue
      }

      if (ch === ']') {
        const litToken = flushLiteral()
        if (litToken) tokens.push(litToken)
        if (state.depth <= 0 || state.containerStack.length === 0) {
          onError?.(`Structural underflow: stray ']' at offset ${state.offset}`)
          continue
        }
        state.depth--
        state.containerStack.pop()
        tokens.push({
          _tag: 'ArrayEnd' as const,
          offset: state.offset,
          depth: state.depth,
        })
        state.expectingValue = false
        continue
      }

      // Start of string
      if (ch === '"') {
        const litToken = flushLiteral()
        if (litToken) tokens.push(litToken)
        state.inString = true
        state.stringBuf = ''
        continue
      }

      // Accumulate literal (number, boolean, null)
      state.literalBuf += ch
    }

    return tokens
  }

  /**
   * Flush any partial string still in progress (for streaming).
   * Returns a partial StringToken if we're mid-string.
   */
  function flush(): ReadonlyArray<JSONToken> {
    const tokens: JSONToken[] = []

    // Flush pending literal
    const litToken = flushLiteral()
    if (litToken) tokens.push(litToken)

    // If mid-string, emit partial
    if (state.inString && state.stringBuf.length > 0) {
      tokens.push({
        _tag: 'String' as const,
        value: state.stringBuf,
        offset: state.offset,
        depth: state.depth,
        partial: true,
      })
    }

    return tokens
  }

  function reset() {
    state = initialState()
  }

  return { feed, flush, reset }
}
