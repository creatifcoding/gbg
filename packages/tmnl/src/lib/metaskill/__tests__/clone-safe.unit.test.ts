import { describe, expect, it } from 'vitest'
import { ensureCloneSafeDetails, sanitizeForToolPayload, stringifyForToolContent } from '../../../../.pi/extensions/metaskill/clone-safe.ts'

describe('clone-safe metaskill payloads', () => {
  it('resolves nested unawaited Promises before details reach structuredClone', async () => {
    const { value, warnings } = await sanitizeForToolPayload({
      existing: Promise.resolve([{ name: 'agent-browser', governed: true }]),
      metaskillProfile: Promise.resolve({ clean: true }),
    })

    expect(value).toEqual({
      existing: [{ name: 'agent-browser', governed: true }],
      metaskillProfile: { clean: true },
    })
    expect(warnings).toHaveLength(2)
    expect(() => structuredClone({ code: 'repro', result: value, sanitizerWarnings: warnings })).not.toThrow()
  })

  it('sanitizes primitive payloads with Promise fields', async () => {
    const { value } = await sanitizeForToolPayload({
      _v: 'kv',
      d: { answer: Promise.resolve(42) },
    })

    expect(value).toEqual({ _v: 'kv', d: { answer: 42 } })
    expect(() => structuredClone({ primitive: value })).not.toThrow()
  })

  it('replaces functions and cycles with explicit summaries', async () => {
    const input: any = { fn: function helper() {} }
    input.self = input

    const { value, warnings } = await sanitizeForToolPayload(input)

    expect(value).toEqual({ fn: '[Function helper]', self: '[Circular $]' })
    expect(warnings.some(w => w.includes('circular'))).toBe(true)
    expect(() => structuredClone({ result: value })).not.toThrow()
  })

  it('times out never-settling nested Promises instead of hanging forever', async () => {
    const { value, warnings } = await sanitizeForToolPayload(
      { slow: new Promise(() => {}) },
      { promiseTimeoutMs: 5 },
    )

    expect(value).toEqual({ slow: { _tag: 'UnresolvedPromise', path: '$.slow', timeoutMs: 5 } })
    expect(warnings.some(w => w.includes('did not settle'))).toBe(true)
    expect(() => structuredClone({ result: value, sanitizerWarnings: warnings })).not.toThrow()
  })

  it('falls back if details are somehow still not cloneable', () => {
    const details = ensureCloneSafeDetails({ code: 'bad', result: Promise.resolve('nope') })

    expect(details).toEqual({
      code: 'bad',
      error: expect.stringContaining('Internal metaskill sanitizer fallback'),
      result: '[details omitted: not structured-clone safe]',
    })
    expect(() => structuredClone(details)).not.toThrow()
  })

  it('stringifies sanitized BigInt and non-finite numbers for LLM content', async () => {
    const { value } = await sanitizeForToolPayload({ n: 10n, inf: Infinity })
    const text = stringifyForToolContent(value)

    expect(text).toContain('10n')
    expect(text).toContain('NonFiniteNumber')
  })
})
