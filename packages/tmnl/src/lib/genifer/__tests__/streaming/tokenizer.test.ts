import { describe, it, expect } from 'vitest'
import { createTokenizer, type JSONToken } from '../../streaming/tokenizer.js'

describe('Streaming JSON Tokenizer', () => {
  it('tokenizes a complete simple object', () => {
    const tok = createTokenizer()
    const tokens = tok.feed('{"type":"Grid","columns":3}')

    const tags = tokens.map((t) => t._tag)
    expect(tags).toEqual([
      'ObjectStart',
      'Key', // "type"
      'String', // "Grid"
      'Key', // "columns"
      'Number', // 3
      'ObjectEnd',
    ])

    // Check values
    const keyTokens = tokens.filter((t) => t._tag === 'Key') as Array<
      JSONToken & { _tag: 'Key' }
    >
    expect(keyTokens[0].value).toBe('type')
    expect(keyTokens[1].value).toBe('columns')

    const strTokens = tokens.filter((t) => t._tag === 'String') as Array<
      JSONToken & { _tag: 'String' }
    >
    expect(strTokens[0].value).toBe('Grid')
    expect(strTokens[0].partial).toBe(false)

    const numTokens = tokens.filter((t) => t._tag === 'Number') as Array<
      JSONToken & { _tag: 'Number' }
    >
    expect(numTokens[0].value).toBe(3)
  })

  it('handles chunked input — split mid-string', () => {
    const tok = createTokenizer()
    const tokens1 = tok.feed('{"type":"Gri')
    const tokens2 = tok.feed('d","key":"e1"}')

    // First chunk: ObjectStart, Key("type"), but string not closed yet
    const tags1 = tokens1.map((t) => t._tag)
    expect(tags1).toEqual(['ObjectStart', 'Key'])

    // Second chunk completes the string and adds more
    const tags2 = tokens2.map((t) => t._tag)
    expect(tags2).toEqual([
      'String', // "Grid" (completed)
      'Key', // "key"
      'String', // "e1"
      'ObjectEnd',
    ])

    const str = tokens2.find((t) => t._tag === 'String') as JSONToken & {
      _tag: 'String'
    }
    expect(str.value).toBe('Grid')
  })

  it('handles chunked input — split mid-number', () => {
    const tok = createTokenizer()
    const tokens1 = tok.feed('{"val":12')
    const tokens2 = tok.feed('34}')

    // First chunk: ObjectStart, Key, number not yet flushed
    expect(tokens1.map((t) => t._tag)).toEqual(['ObjectStart', 'Key'])

    // Second chunk: number flushed on }, then ObjectEnd
    expect(tokens2.map((t) => t._tag)).toEqual(['Number', 'ObjectEnd'])
    const num = tokens2.find((t) => t._tag === 'Number') as JSONToken & {
      _tag: 'Number'
    }
    expect(num.value).toBe(1234)
  })

  it('tokenizes boolean and null values', () => {
    const tok = createTokenizer()
    const tokens = tok.feed('{"a":true,"b":false,"c":null}')

    const bools = tokens.filter((t) => t._tag === 'Boolean') as Array<
      JSONToken & { _tag: 'Boolean' }
    >
    expect(bools).toHaveLength(2)
    expect(bools[0].value).toBe(true)
    expect(bools[1].value).toBe(false)

    const nulls = tokens.filter((t) => t._tag === 'Null')
    expect(nulls).toHaveLength(1)
  })

  it('tokenizes nested objects', () => {
    const tok = createTokenizer()
    const tokens = tok.feed('{"props":{"columns":3}}')

    const tags = tokens.map((t) => t._tag)
    expect(tags).toEqual([
      'ObjectStart', // outer {
      'Key', // "props"
      'ObjectStart', // inner {
      'Key', // "columns"
      'Number', // 3
      'ObjectEnd', // inner }
      'ObjectEnd', // outer }
    ])

    // Check depth tracking
    const starts = tokens.filter((t) => t._tag === 'ObjectStart') as Array<
      JSONToken & { _tag: 'ObjectStart' }
    >
    expect(starts[0].depth).toBe(0)
    expect(starts[1].depth).toBe(1)
  })

  it('tokenizes arrays', () => {
    const tok = createTokenizer()
    const tokens = tok.feed('{"items":["a","b"]}')

    const tags = tokens.map((t) => t._tag)
    expect(tags).toEqual([
      'ObjectStart',
      'Key', // "items"
      'ArrayStart',
      'String', // "a"
      'String', // "b"
      'ArrayEnd',
      'ObjectEnd',
    ])
  })

  it('handles escaped characters in strings', () => {
    const tok = createTokenizer()
    const tokens = tok.feed('{"msg":"hello \\"world\\""}')

    const str = tokens.find((t) => t._tag === 'String') as JSONToken & {
      _tag: 'String'
    }
    expect(str.value).toBe('hello \\"world\\"')
  })

  it('flush emits partial string token', () => {
    const tok = createTokenizer()
    tok.feed('{"content":"hello wor')
    const flushed = tok.flush()

    expect(flushed).toHaveLength(1)
    const partial = flushed[0] as JSONToken & { _tag: 'String' }
    expect(partial._tag).toBe('String')
    expect(partial.value).toBe('hello wor')
    expect(partial.partial).toBe(true)
  })

  it('reset clears all state', () => {
    const tok = createTokenizer()
    tok.feed('{"broken":')
    tok.reset()
    const tokens = tok.feed('{"fresh":1}')

    expect(tokens.map((t) => t._tag)).toEqual([
      'ObjectStart',
      'Key',
      'Number',
      'ObjectEnd',
    ])
  })
})
