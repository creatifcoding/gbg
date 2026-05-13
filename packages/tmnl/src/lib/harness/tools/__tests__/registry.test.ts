/**
 * Tests for the declarative tool registry.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Context, Effect, Layer, Option } from 'effect'
import { defineTool, collectTools, clearRegistry, getRegisteredTools, optional } from '../registry'
import type { ToolContribution } from '../types'

// ── Test service tags ──────────────────────────────────────

class TestServiceA extends Context.Tag('test/ServiceA')<
  TestServiceA,
  { readonly getValue: () => string }
>() {}

class TestServiceB extends Context.Tag('test/ServiceB')<
  TestServiceB,
  { readonly getNumber: () => number }
>() {}

const TestServiceALive = Layer.succeed(TestServiceA, { getValue: () => 'hello' })
const TestServiceBLive = Layer.succeed(TestServiceB, { getNumber: () => 42 })

// ── Tests ──────────────────────────────────────────────────

describe('defineTool', () => {
  beforeEach(() => {
    clearRegistry()
  })

  it('registers a tool in the global registry', () => {
    defineTool({
      name: 'test_tool',
      description: 'A test tool',
      parameters: {},
      execute: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    })

    const tools = getRegisteredTools()
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('test_tool')
  })

  it('returns the def for direct reference', () => {
    const def = defineTool({
      name: 'ref_tool',
      description: 'Returns self',
      parameters: {},
      execute: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    })

    expect(def.name).toBe('ref_tool')
    expect(def.description).toBe('Returns self')
  })
})

describe('collectTools', () => {
  beforeEach(() => {
    clearRegistry()
  })

  it('collects tools with no deps', async () => {
    defineTool({
      name: 'simple_tool',
      description: 'No deps',
      parameters: {},
      execute: async () => ({ content: [{ type: 'text', text: 'simple' }] }),
    })

    const result = await Effect.runPromise(collectTools())
    expect(result.tools).toHaveLength(1)
    expect(result.tools[0].name).toBe('simple_tool')
  })

  it('resolves required deps from context', async () => {
    defineTool({
      name: 'dep_tool',
      description: 'Has required dep',
      parameters: {},
      requires: {
        svcA: TestServiceA,
      },
      execute: async (_id, _params, { svcA }) => ({
        content: [{ type: 'text', text: svcA.getValue() }],
      }),
    })

    const result = await Effect.runPromise(
      collectTools().pipe(Effect.provide(TestServiceALive)),
    )

    expect(result.tools).toHaveLength(1)
    // Execute and verify dep injection
    const execResult = await result.tools[0].execute('call-1', {})
    expect(execResult.content[0].text).toBe('hello')
  })

  it('skips tools with missing required deps', async () => {
    defineTool({
      name: 'missing_dep_tool',
      description: 'Needs ServiceA',
      parameters: {},
      requires: {
        svcA: TestServiceA,
      },
      execute: async () => ({ content: [{ type: 'text', text: 'unreachable' }] }),
    })

    // Run WITHOUT providing TestServiceA
    const result = await Effect.runPromise(collectTools())
    expect(result.tools).toHaveLength(0)
  })

  it('resolves optional deps as null when missing', async () => {
    let capturedDep: any = 'sentinel'

    defineTool({
      name: 'opt_dep_tool',
      description: 'Has optional dep',
      parameters: {},
      requires: {
        svcB: optional(TestServiceB),
      },
      execute: async (_id, _params, { svcB }) => {
        capturedDep = svcB
        return { content: [{ type: 'text', text: 'ok' }] }
      },
    })

    // Run WITHOUT providing TestServiceB
    const result = await Effect.runPromise(collectTools())
    expect(result.tools).toHaveLength(1) // tool is registered (optional dep)

    await result.tools[0].execute('call-1', {})
    expect(capturedDep).toBeNull()
  })

  it('resolves optional deps when available', async () => {
    let capturedDep: any = null

    defineTool({
      name: 'opt_available_tool',
      description: 'Optional dep available',
      parameters: {},
      requires: {
        svcB: optional(TestServiceB),
      },
      execute: async (_id, _params, { svcB }) => {
        capturedDep = svcB
        return { content: [{ type: 'text', text: 'ok' }] }
      },
    })

    const result = await Effect.runPromise(
      collectTools().pipe(Effect.provide(TestServiceBLive)),
    )
    expect(result.tools).toHaveLength(1)

    await result.tools[0].execute('call-1', {})
    expect(capturedDep).not.toBeNull()
    expect(capturedDep.getNumber()).toBe(42)
  })

  it('tracks concurrentFriendly tools', async () => {
    defineTool({
      name: 'fast_tool',
      description: 'Concurrent OK',
      parameters: {},
      concurrentFriendly: true,
      execute: async () => ({ content: [{ type: 'text', text: 'fast' }] }),
    })

    defineTool({
      name: 'slow_tool',
      description: 'Sequential only',
      parameters: {},
      concurrentFriendly: false,
      execute: async () => ({ content: [{ type: 'text', text: 'slow' }] }),
    })

    const result = await Effect.runPromise(collectTools())
    expect(result.concurrentFriendly).toEqual(['fast_tool'])
  })

  it('collects systemPromptSections', async () => {
    defineTool({
      name: 'prompt_tool',
      description: 'Has prompt section',
      parameters: {},
      systemPromptSection: {
        title: 'My Tool Usage',
        priority: 150,
        content: '## Usage\nDo this, not that.',
      },
      execute: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    })

    const result = await Effect.runPromise(collectTools())
    expect(result.promptSections).toHaveLength(1)
    expect(result.promptSections[0].title).toBe('My Tool Usage')
    expect(result.promptSections[0].priority).toBe(150)
  })

  it('handles mixed required/optional deps', async () => {
    defineTool({
      name: 'mixed_tool',
      description: 'Mixed deps',
      parameters: {},
      requires: {
        required: TestServiceA,
        optional: optional(TestServiceB),
      },
      execute: async (_id, _params, { required, optional: opt }) => ({
        content: [{ type: 'text', text: `${required.getValue()}-${opt?.getNumber() ?? 'null'}` }],
      }),
    })

    // Provide only the required dep
    const result = await Effect.runPromise(
      collectTools().pipe(Effect.provide(TestServiceALive)),
    )
    expect(result.tools).toHaveLength(1)

    const execResult = await result.tools[0].execute('call-1', {})
    expect(execResult.content[0].text).toBe('hello-null')
  })

  it('resolves multiple tools in parallel', async () => {
    defineTool({
      name: 'tool_a',
      description: 'A',
      parameters: {},
      execute: async () => ({ content: [{ type: 'text', text: 'a' }] }),
    })

    defineTool({
      name: 'tool_b',
      description: 'B',
      parameters: {},
      requires: { svc: TestServiceA },
      execute: async (_id, _params, { svc }) => ({
        content: [{ type: 'text', text: svc.getValue() }],
      }),
    })

    defineTool({
      name: 'tool_c',
      description: 'C (will fail)',
      parameters: {},
      requires: { svc: TestServiceB }, // Not provided
      execute: async () => ({ content: [{ type: 'text', text: 'c' }] }),
    })

    const result = await Effect.runPromise(
      collectTools().pipe(Effect.provide(TestServiceALive)),
    )

    // tool_a (no deps) + tool_b (ServiceA provided) — tool_c skipped
    expect(result.tools).toHaveLength(2)
    expect(result.tools.map(t => t.name)).toEqual(['tool_a', 'tool_b'])
  })
})
