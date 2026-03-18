/**
 * RLM Sub-LM Dispatch — Unit Tests
 *
 * Tests the pure functions in llm-bridge.ts (prompt construction, args, guard).
 * Actual pi CLI spawn is NOT tested here — that needs integration testing.
 */

import { describe, it, expect } from 'vitest'
import {
  buildInjectedPrompt,
  buildArgs,
  createLlmBridge,
  type LlmBridge,
} from '../src/llm-bridge.js'
import type { StoreApi } from '../src/store/index.js'

// ─── Mock Store (v2 async interface) ─────────────────────────

function mockStore(data: Record<string, Record<string, any>> = {}): StoreApi {
  return {
    put: async () => {},
    putNow: async () => ({ ns: '', key: '' }),
    get: async (col: string, key: string) => data[col]?.[key] ?? null,
    getRaw: async () => null,
    describe: async () => null,
    query: async () => [],
    keys: async () => [],
    delete: async () => false,
    collections: async () => [],
    clear: async () => 0,
    vars: async () => [],
    catalog: async () => [],
    search: async () => [],
    domain: async () => {},
    domains: async () => [],
    from: () => ({ tagged: () => ({} as any), search: () => ({} as any), limit: () => ({} as any), where: () => ({} as any), keys: async () => [], entries: async () => [], summaries: async () => [], count: async () => 0 }) as any,
    into: () => ({ key: () => ({} as any), timestamped: () => ({} as any), data: () => ({} as any), meta: () => ({} as any), tags: () => ({} as any), put: async () => ({ ns: '', key: '' }) }) as any,
    store: async () => {},
    dispose: async () => {},
  } as StoreApi
}

// ─── buildInjectedPrompt ─────────────────────────────────────

describe('buildInjectedPrompt', () => {
  it('returns prompt unchanged when no inject', async () => {
    const store = mockStore()
    expect(await buildInjectedPrompt('hello', undefined, store)).toBe('hello')
    expect(await buildInjectedPrompt('hello', [], store)).toBe('hello')
  })

  it('prepends context blocks for found objects', async () => {
    const store = mockStore({
      research: { findings: { schema: 'v4', breaking: true } },
    })
    const result = await buildInjectedPrompt('Analyze this', ['research:findings'], store)
    expect(result).toContain('<context name="research:findings">')
    expect(result).toContain('"schema": "v4"')
    expect(result).toContain('</context>')
    expect(result).toContain('Analyze this')
    expect(result.indexOf('<context')).toBeLessThan(result.indexOf('Analyze this'))
  })

  it('skips missing objects silently', async () => {
    const store = mockStore({
      research: { findings: { ok: true } },
    })
    const result = await buildInjectedPrompt('test', ['research:findings', 'research:missing'], store)
    expect(result).toContain('<context name="research:findings">')
    expect(result).not.toContain('research:missing')
  })

  it('handles multiple inject refs', async () => {
    const store = mockStore({
      research: { a: { val: 1 } },
      decisions: { b: { val: 2 } },
    })
    const result = await buildInjectedPrompt('go', ['research:a', 'decisions:b'], store)
    expect(result).toContain('<context name="research:a">')
    expect(result).toContain('<context name="decisions:b">')
  })

  it('returns plain prompt when all refs miss', async () => {
    const store = mockStore()
    expect(await buildInjectedPrompt('hello', ['nope:nah'], store)).toBe('hello')
  })

  it('handles malformed refs (no colon)', async () => {
    const store = mockStore()
    expect(await buildInjectedPrompt('hello', ['nocolon'], store)).toBe('hello')
  })

  it('handles refs with multiple colons', async () => {
    const store = mockStore({
      research: { 'key:with:colons': { deep: true } },
    })
    const result = await buildInjectedPrompt('go', ['research:key:with:colons'], store)
    expect(result).toContain('<context name="research:key:with:colons">')
    expect(result).toContain('"deep": true')
  })
})

// ─── buildArgs ───────────────────────────────────────────────

describe('buildArgs', () => {
  it('includes all isolation flags', () => {
    const args = buildArgs('hello')
    expect(args).toContain('-p')
    expect(args).toContain('--no-session')
    expect(args).toContain('--no-tools')
    expect(args).toContain('--no-extensions')
    expect(args).toContain('--no-skills')
    expect(args).toContain('--no-themes')
  })

  it('prompt is always last argument', () => {
    const args = buildArgs('my prompt', 'test/model')
    expect(args[args.length - 1]).toBe('my prompt')
  })

  it('adds --model when specified', () => {
    const args = buildArgs('test', 'anthropic/claude-haiku-4-5')
    const idx = args.indexOf('--model')
    expect(idx).toBeGreaterThan(-1)
    expect(args[idx + 1]).toBe('anthropic/claude-haiku-4-5')
  })

  it('omits --model when not specified', () => {
    const args = buildArgs('test')
    expect(args).not.toContain('--model')
  })
})

// ─── createLlmBridge (call guard) ────────────────────────────

describe('createLlmBridge call guard', () => {
  it('rejects when single call exceeds limit', async () => {
    const bridge = createLlmBridge(mockStore(), { maxCalls: 0 })
    await expect(bridge.llm('test')).rejects.toThrow(/call limit exceeded/)
  })

  it('rejects when batch exceeds limit', async () => {
    const bridge = createLlmBridge(mockStore(), { maxCalls: 2 })
    await expect(
      bridge.llm_batch(['a', 'b', 'c'])
    ).rejects.toThrow(/call limit exceeded/)
  })

  it('rejects batch of exact limit + 1', async () => {
    const bridge = createLlmBridge(mockStore(), { maxCalls: 3 })
    await expect(
      bridge.llm_batch(['a', 'b', 'c', 'd'])
    ).rejects.toThrow(/call limit exceeded/)
  })

  it('allows batch within limit (guard passes, spawn fails)', async () => {
    // Use 100ms timeout so spawn fails fast instead of hanging
    const bridge = createLlmBridge(mockStore(), { maxCalls: 5, defaultTimeout: 100 })
    const result = await bridge.llm_batch(['a', 'b'])
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('[error:')
    expect(result[1]).toContain('[error:')
  }, 10_000)

  it('accumulates count across calls', async () => {
    const bridge = createLlmBridge(mockStore(), { maxCalls: 3, defaultTimeout: 100 })
    // Batch of 2 uses up 2 slots (guard passes, spawn fails with timeout)
    await bridge.llm_batch(['a', 'b'])
    // Batch of 2 more would need 4 total — exceeds limit of 3
    await expect(bridge.llm_batch(['c', 'd'])).rejects.toThrow(/call limit exceeded/)
  }, 10_000)
})
