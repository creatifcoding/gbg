/**
 * Unit tests for tool-guide transactional system prompt injection.
 *
 * Tests the bounded, ephemeral guide injection lifecycle:
 *   - Bounds enforcement (maxLines, maxChars)
 *   - Injection/stripping via before_agent_start (system prompt)
 *   - TTL behavior
 *   - Background agent guide updates via message_end
 *   - Dispose
 *   - Stats tracking
 *   - Multiple guides coexisting
 *   - Performance benchmarks
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createToolGuide, boundGuide, type ToolGuideHandle } from '../../../../.pi/extensions/metaskill/tool-guide.ts'

// ─── Mock ExtensionAPI ───────────────────────────────────

type Handler = (event: any, ctx?: any) => Promise<any>

class MockExtensionAPI {
  private handlers: Map<string, Handler[]> = new Map()

  on(event: string, handler: Handler) {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
  }

  /** Fire tool_call event */
  async fireToolCall(toolName: string) {
    for (const h of this.handlers.get('tool_call') ?? []) {
      await h({ toolName, toolCallId: 'tc-1', input: {} })
    }
  }

  /**
   * Fire before_agent_start event. Chains handlers like pi runtime:
   * each handler sees the previous handler's modified systemPrompt.
   */
  async fireBeforeAgentStart(systemPrompt: string): Promise<string> {
    let current = systemPrompt
    for (const h of this.handlers.get('before_agent_start') ?? []) {
      const result = await h({ systemPrompt: current })
      if (result?.systemPrompt != null) current = result.systemPrompt
    }
    return current
  }

  /** Fire message_end for guide update from background agent */
  async fireMessageEnd(customType: string, content: string, details?: any) {
    for (const h of this.handlers.get('message_end') ?? []) {
      await h({
        message: { customType, content, details, role: 'custom', display: false, timestamp: Date.now() },
      })
    }
  }

  /**
   * Simulate a full turn cycle: tool_call → before_agent_start (next turn).
   * Returns the system prompt the LLM would see.
   */
  async simulateTurn(toolName: string | null, basePrompt: string): Promise<string> {
    if (toolName) await this.fireToolCall(toolName)
    return this.fireBeforeAgentStart(basePrompt)
  }
}

// ─── boundGuide (pure function) ──────────────────────────

describe('boundGuide', () => {
  it('passes through short text unchanged', () => {
    expect(boundGuide('hello', 30, 2000)).toBe('hello')
  })

  it('truncates by line count', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`)
    const result = boundGuide(lines.join('\n'), 10, 99999)
    expect(result.split('\n').length).toBeLessThanOrEqual(11)
    expect(result).toContain('…')
    expect(result).not.toContain('line 10')
  })

  it('truncates by char count', () => {
    const long = 'x'.repeat(3000)
    const result = boundGuide(long, 999, 100)
    expect(result.length).toBeLessThanOrEqual(100)
    expect(result).toContain('…')
  })

  it('applies line bound before char bound', () => {
    const lines = Array.from({ length: 5 }, () => 'a'.repeat(100))
    const result = boundGuide(lines.join('\n'), 3, 2000)
    expect(result.split('\n').length).toBeLessThanOrEqual(4)
  })
})

// ─── Injection lifecycle ─────────────────────────────────

describe('createToolGuide: injection lifecycle', () => {
  let pi: MockExtensionAPI
  let guide: ToolGuideHandle
  const BASE = 'You are an assistant.'

  beforeEach(() => {
    pi = new MockExtensionAPI()
    guide = createToolGuide(pi as any, {
      toolName: 'ms',
      guide: 'Use ms.profile() instead of separate calls.',
    })
  })

  it('does not inject when no tool_call has fired', async () => {
    const prompt = await pi.fireBeforeAgentStart(BASE)
    expect(prompt).toBe(BASE)
  })

  it('injects guide into system prompt after tool_call fires', async () => {
    await pi.fireToolCall('ms')
    const prompt = await pi.fireBeforeAgentStart(BASE)

    expect(prompt).toContain('[TOOL GUIDE: ms]')
    expect(prompt).toContain('ms.profile()')
    expect(prompt).toContain('[/TOOL GUIDE]')
    expect(prompt.startsWith(BASE)).toBe(true)
  })

  it('strips guide after TTL expires (default TTL=1)', async () => {
    await pi.fireToolCall('ms')

    // Turn 1: guide present (turnsRemaining = 1 → 0)
    const turn1 = await pi.fireBeforeAgentStart(BASE)
    expect(turn1).toContain('[TOOL GUIDE: ms]')

    // Turn 2: guide stripped (turnsRemaining was 0)
    const turn2 = await pi.fireBeforeAgentStart(turn1)
    expect(turn2).not.toContain('[TOOL GUIDE: ms]')
    expect(turn2).toBe(BASE)
  })

  it('does not inject for non-matching tool', async () => {
    await pi.fireToolCall('bash')
    const prompt = await pi.fireBeforeAgentStart(BASE)
    expect(prompt).toBe(BASE)
  })

  it('re-injects on subsequent tool_call', async () => {
    await pi.fireToolCall('ms')
    await pi.fireBeforeAgentStart(BASE) // consume TTL
    const stripped = await pi.fireBeforeAgentStart(BASE) // stripped
    expect(stripped).not.toContain('[TOOL GUIDE: ms]')

    // Fire tool again
    await pi.fireToolCall('ms')
    const reinjected = await pi.fireBeforeAgentStart(BASE)
    expect(reinjected).toContain('[TOOL GUIDE: ms]')
  })

  it('prevents duplicate guide in system prompt on rapid tool calls', async () => {
    await pi.fireToolCall('ms')
    await pi.fireToolCall('ms') // double fire

    const prompt = await pi.fireBeforeAgentStart(BASE)
    const matches = prompt.match(/\[TOOL GUIDE: ms\]/g)
    expect(matches).toHaveLength(1) // exactly one, not two
  })

  it('preserves base system prompt content', async () => {
    const rich = 'You are Val, the architectural conscience. Schema discipline. Bun only.'
    await pi.fireToolCall('ms')
    const prompt = await pi.fireBeforeAgentStart(rich)
    expect(prompt.startsWith(rich)).toBe(true)
    expect(prompt).toContain('[TOOL GUIDE: ms]')
  })
})

// ─── Custom TTL ──────────────────────────────────────────

describe('createToolGuide: custom TTL', () => {
  const BASE = 'system prompt'

  it('TTL=0: guide not injected at all (zero turns)', async () => {
    const pi = new MockExtensionAPI()
    createToolGuide(pi as any, { toolName: 'ms', guide: 'ephemeral', ttl: 0 })

    await pi.fireToolCall('ms')
    const prompt = await pi.fireBeforeAgentStart(BASE)
    // TTL=0 means turnsRemaining=0, so no injection
    expect(prompt).toBe(BASE)
  })

  it('TTL=3: guide persists for 3 turns', async () => {
    const pi = new MockExtensionAPI()
    createToolGuide(pi as any, { toolName: 'ms', guide: 'long lived', ttl: 3 })

    await pi.fireToolCall('ms')

    for (let i = 0; i < 3; i++) {
      const prompt = await pi.fireBeforeAgentStart(BASE)
      expect(prompt).toContain('[TOOL GUIDE: ms]')
    }
    // Turn 4: stripped
    const stripped = await pi.fireBeforeAgentStart(BASE)
    expect(stripped).not.toContain('[TOOL GUIDE: ms]')
  })

  it('TTL resets on new tool_call', async () => {
    const pi = new MockExtensionAPI()
    createToolGuide(pi as any, { toolName: 'ms', guide: 'resettable', ttl: 1 })

    await pi.fireToolCall('ms')
    await pi.fireBeforeAgentStart(BASE) // consume

    // Before TTL expires, fire again
    await pi.fireToolCall('ms')
    const prompt = await pi.fireBeforeAgentStart(BASE)
    expect(prompt).toContain('[TOOL GUIDE: ms]') // reset, still active
  })
})

// ─── Bounds enforcement ──────────────────────────────────

describe('createToolGuide: bounds', () => {
  it('truncates guide at registration', () => {
    const pi = new MockExtensionAPI()
    const long = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n')
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: long, maxLines: 5 })
    expect(guide.getGuide().split('\n').length).toBeLessThanOrEqual(6)
    expect(guide.getGuide()).toContain('…')
  })

  it('truncates on setGuide', () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'short', maxChars: 50 })
    guide.setGuide('x'.repeat(200))
    expect(guide.getGuide().length).toBeLessThanOrEqual(50)
  })

  it('enforces char bound', () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'x'.repeat(5000), maxChars: 100 })
    expect(guide.getGuide().length).toBeLessThanOrEqual(100)
  })

  it('bounded guide appears in system prompt within bounds', async () => {
    const pi = new MockExtensionAPI()
    const long = Array.from({ length: 100 }, (_, i) => `rule ${i}`).join('\n')
    createToolGuide(pi as any, { toolName: 'ms', guide: long, maxLines: 10, maxChars: 500 })

    await pi.fireToolCall('ms')
    const prompt = await pi.fireBeforeAgentStart('base')

    // The guide portion should be bounded
    const guideStart = prompt.indexOf('[TOOL GUIDE: ms]')
    const guideEnd = prompt.indexOf('[/TOOL GUIDE]')
    const guideContent = prompt.slice(guideStart, guideEnd + '[/TOOL GUIDE]'.length)
    expect(guideContent.split('\n').length).toBeLessThanOrEqual(15) // guide + wrapper lines
  })
})

// ─── Background agent update ─────────────────────────────

describe('createToolGuide: background agent update', () => {
  it('updates guide via message_end event', async () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'original guide' })
    expect(guide.getGuide()).toBe('original guide')

    await pi.fireMessageEnd('tool-guide-update', 'new guide from subagent', { toolName: 'ms' })
    expect(guide.getGuide()).toBe('new guide from subagent')
  })

  it('ignores updates for wrong tool', async () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'original' })

    await pi.fireMessageEnd('tool-guide-update', 'wrong tool', { toolName: 'other' })
    expect(guide.getGuide()).toBe('original')
  })

  it('ignores non-guide messages', async () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'original' })

    await pi.fireMessageEnd('some-other-type', 'not a guide', { toolName: 'ms' })
    expect(guide.getGuide()).toBe('original')
  })

  it('enforces bounds on background update', async () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'original', maxChars: 50 })

    await pi.fireMessageEnd('tool-guide-update', 'x'.repeat(200), { toolName: 'ms' })
    expect(guide.getGuide().length).toBeLessThanOrEqual(50)
  })

  it('updated guide appears in next injection', async () => {
    const pi = new MockExtensionAPI()
    createToolGuide(pi as any, { toolName: 'ms', guide: 'original' })

    await pi.fireMessageEnd('tool-guide-update', 'UPDATED GUIDE TEXT', { toolName: 'ms' })

    await pi.fireToolCall('ms')
    const prompt = await pi.fireBeforeAgentStart('base')
    expect(prompt).toContain('UPDATED GUIDE TEXT')
    expect(prompt).not.toContain('original')
  })
})

// ─── Dispose ─────────────────────────────────────────────

describe('createToolGuide: dispose', () => {
  const BASE = 'system'

  it('stops injection after dispose', async () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'disposable' })

    await pi.fireToolCall('ms')
    guide.dispose()

    const prompt = await pi.fireBeforeAgentStart(BASE)
    expect(prompt).not.toContain('[TOOL GUIDE: ms]')
  })

  it('strips existing guide on dispose', async () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'will be stripped' })

    await pi.fireToolCall('ms')
    const withGuide = await pi.fireBeforeAgentStart(BASE)
    expect(withGuide).toContain('[TOOL GUIDE: ms]')

    guide.dispose()
    // Next turn should strip it
    const afterDispose = await pi.fireBeforeAgentStart(withGuide)
    expect(afterDispose).not.toContain('[TOOL GUIDE: ms]')
    expect(afterDispose).toBe(BASE)
  })

  it('stops listening for updates after dispose', async () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'original' })

    guide.dispose()
    await pi.fireMessageEnd('tool-guide-update', 'should be ignored', { toolName: 'ms' })
    expect(guide.getGuide()).toBe('original')
  })

  it('reports inactive after dispose', () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'x' })
    guide.dispose()
    expect(guide.isActive()).toBe(false)
  })
})

// ─── Stats ───────────────────────────────────────────────

describe('createToolGuide: stats', () => {
  const BASE = 'sys'

  it('tracks injections', async () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'guide text' })

    expect(guide.stats().injections).toBe(0)

    await pi.fireToolCall('ms')
    await pi.fireBeforeAgentStart(BASE)
    expect(guide.stats().injections).toBe(1)
  })

  it('tracks strippings', async () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'guide text' })

    await pi.fireToolCall('ms')
    const withGuide = await pi.fireBeforeAgentStart(BASE) // inject
    await pi.fireBeforeAgentStart(withGuide) // strip (guide still in prompt from last turn)

    expect(guide.stats().strippings).toBe(1)
  })

  it('reports guide dimensions', () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'line 1\nline 2\nline 3' })
    expect(guide.stats().guideLines).toBe(3)
    expect(guide.stats().guideChars).toBe('line 1\nline 2\nline 3'.length)
  })

  it('updates lastUpdated on setGuide', () => {
    const pi = new MockExtensionAPI()
    const guide = createToolGuide(pi as any, { toolName: 'ms', guide: 'original' })
    const t1 = guide.stats().lastUpdated
    guide.setGuide('updated')
    expect(guide.stats().lastUpdated).toBeGreaterThanOrEqual(t1)
  })
})

// ─── Multiple guides coexist ─────────────────────────────

describe('createToolGuide: multiple guides', () => {
  const BASE = 'system prompt'

  it('two guides for different tools coexist', async () => {
    const pi = new MockExtensionAPI()
    createToolGuide(pi as any, { toolName: 'ms', guide: 'ms guide' })
    createToolGuide(pi as any, { toolName: 'bash', guide: 'bash guide' })

    await pi.fireToolCall('ms')
    const prompt = await pi.fireBeforeAgentStart(BASE)

    expect(prompt).toContain('[TOOL GUIDE: ms]')
    expect(prompt).not.toContain('[TOOL GUIDE: bash]')
  })

  it('both guides inject when both tools fire', async () => {
    const pi = new MockExtensionAPI()
    createToolGuide(pi as any, { toolName: 'ms', guide: 'ms guide' })
    createToolGuide(pi as any, { toolName: 'bash', guide: 'bash guide' })

    await pi.fireToolCall('ms')
    await pi.fireToolCall('bash')

    const prompt = await pi.fireBeforeAgentStart(BASE)
    expect(prompt).toContain('[TOOL GUIDE: ms]')
    expect(prompt).toContain('[TOOL GUIDE: bash]')
  })

  it('guides strip independently', async () => {
    const pi = new MockExtensionAPI()
    createToolGuide(pi as any, { toolName: 'ms', guide: 'ms', ttl: 1 })
    createToolGuide(pi as any, { toolName: 'bash', guide: 'bash', ttl: 2 })

    await pi.fireToolCall('ms')
    await pi.fireToolCall('bash')

    const turn1 = await pi.fireBeforeAgentStart(BASE)
    expect(turn1).toContain('[TOOL GUIDE: ms]')
    expect(turn1).toContain('[TOOL GUIDE: bash]')

    const turn2 = await pi.fireBeforeAgentStart(turn1)
    expect(turn2).not.toContain('[TOOL GUIDE: ms]') // ms TTL expired
    expect(turn2).toContain('[TOOL GUIDE: bash]') // bash still has 1 turn

    const turn3 = await pi.fireBeforeAgentStart(turn2)
    expect(turn3).not.toContain('[TOOL GUIDE: ms]')
    expect(turn3).not.toContain('[TOOL GUIDE: bash]') // both gone
  })
})

// ─── Sentinel hygiene ────────────────────────────────────

describe('createToolGuide: sentinel markers', () => {
  const BASE = 'You are helpful.'

  it('uses HTML comment sentinels for clean stripping', async () => {
    const pi = new MockExtensionAPI()
    createToolGuide(pi as any, { toolName: 'ms', guide: 'guide' })

    await pi.fireToolCall('ms')
    const prompt = await pi.fireBeforeAgentStart(BASE)

    expect(prompt).toContain('<!-- TOOL-GUIDE:ms -->')
    expect(prompt).toContain('<!-- /TOOL-GUIDE:ms -->')
  })

  it('fully restores original prompt after strip', async () => {
    const pi = new MockExtensionAPI()
    createToolGuide(pi as any, { toolName: 'ms', guide: 'temporary' })

    await pi.fireToolCall('ms')
    const withGuide = await pi.fireBeforeAgentStart(BASE)
    expect(withGuide).not.toBe(BASE)

    const restored = await pi.fireBeforeAgentStart(withGuide)
    expect(restored).toBe(BASE)
  })
})

// ─── Benchmarks ──────────────────────────────────────────

describe('createToolGuide: performance', () => {
  const BASE = 'You are an assistant with many capabilities.'

  it('injection cycle completes in < 1ms', async () => {
    const pi = new MockExtensionAPI()
    createToolGuide(pi as any, {
      toolName: 'ms',
      guide: Array.from({ length: 30 }, (_, i) => `Line ${i}: Use ms.profile() for combined ops.`).join('\n'),
    })

    // Warm up
    await pi.simulateTurn('ms', BASE)

    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      await pi.simulateTurn('ms', BASE)
    }
    const elapsed = performance.now() - start
    const perCycle = elapsed / 100

    console.log(`  tool-guide cycle: ${perCycle.toFixed(3)}ms avg (${elapsed.toFixed(1)}ms / 100 cycles)`)
    expect(perCycle).toBeLessThan(1)
  })

  it('before_agent_start with large system prompt completes in < 1ms', async () => {
    const pi = new MockExtensionAPI()
    createToolGuide(pi as any, { toolName: 'ms', guide: 'compact guide' })

    // Simulate a large system prompt (like AGENTS.md)
    const largePrompt = 'x'.repeat(50_000)
    await pi.fireToolCall('ms')

    const start = performance.now()
    for (let i = 0; i < 50; i++) {
      await pi.fireBeforeAgentStart(largePrompt)
    }
    const elapsed = performance.now() - start
    const perCall = elapsed / 50

    console.log(`  before_agent_start (50KB prompt): ${perCall.toFixed(3)}ms avg`)
    expect(perCall).toBeLessThan(1)
  })

  it('boundGuide with max-size input completes in < 0.1ms', () => {
    const huge = Array.from({ length: 1000 }, (_, i) => `line ${i}: ${'x'.repeat(200)}`).join('\n')

    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      boundGuide(huge, 30, 2000)
    }
    const elapsed = performance.now() - start
    const perCall = elapsed / 1000

    console.log(`  boundGuide: ${perCall.toFixed(4)}ms avg (${elapsed.toFixed(1)}ms / 1000 calls)`)
    expect(perCall).toBeLessThan(0.1)
  })
})
