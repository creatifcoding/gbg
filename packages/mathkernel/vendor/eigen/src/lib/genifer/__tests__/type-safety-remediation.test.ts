/**
 * Type Safety Remediation Tests
 *
 * Validates fixes from REVIEW-type-safety-audit.md:
 * - Registry isolation (no global mutable state leaks)
 * - Prompt compiler hardening (replaceAll, slot types, unresolved detection)
 * - Thread.turns() interleaved message handling
 * - Atomic setFields (validate-all-then-commit)
 *
 * @module genifer/__tests__/type-safety-remediation
 */
import { describe, it, expect } from 'vitest'
import { List } from 'effect'
import * as Registry from '@effect-atom/atom/Registry'

// =============================================================================
// Registry Isolation Tests
// =============================================================================

describe('Registry Isolation — toolHandlers scoped per instance', () => {
  it('two ToolRegistryService instances do NOT share handlers', async () => {
    const { createToolRegistryService, registeredToolsAtom } = await import(
      '../react/tool-registry.js'
    )
    const { GeniferToolDefinition } = await import('../core/tools.js')

    const registry1 = Registry.make()
    const registry2 = Registry.make()
    const service1 = createToolRegistryService(registry1)
    const service2 = createToolRegistryService(registry2)

    const tool = new GeniferToolDefinition({ name: 'test-tool', description: 'Test' })

    // Register on instance 1 only
    service1.register(tool, async (_id, _args) => ({ content: 'ok' }))

    // Instance 1 has the tool
    expect(service1.list()).toHaveLength(1)

    // Instance 2 should NOT have it
    expect(service2.list()).toHaveLength(0)

    // Executing on instance 2 should fail
    const result = await service2.execute('test-tool', {})
    expect(result.isError).toBe(true)
    expect(result.content).toContain('not found')
  })

  it('resetting one service does not affect another', async () => {
    const { createToolRegistryService } = await import('../react/tool-registry.js')
    const { GeniferToolDefinition } = await import('../core/tools.js')

    const service1 = createToolRegistryService(Registry.make())
    const service2 = createToolRegistryService(Registry.make())

    const tool = new GeniferToolDefinition({ name: 'shared-name', description: 'X' })
    service1.register(tool, async () => ({ content: 'from-1' }))
    service2.register(tool, async () => ({ content: 'from-2' }))

    service1.reset()

    // Service 1 cleared
    expect(service1.list()).toHaveLength(0)
    // Service 2 intact
    expect(service2.list()).toHaveLength(1)

    const result = await service2.execute('shared-name', {})
    expect(result.content).toBe('from-2')
  })
})

describe('Registry Isolation — elementSchemas scoped per instance', () => {
  it('two StateSyncService instances do NOT share schemas', async () => {
    const { createStateSyncService } = await import('../react/state-sync.js')

    const service1 = createStateSyncService(Registry.make())
    const service2 = createStateSyncService(Registry.make())

    // Init an element on service 1
    service1.initElement({
      key: 'el-1',
      type: 'slider',
      isInteractable: true,
      stateSchema: { value: { type: 'number' as const, default: 50, min: 0, max: 100 } },
      defaultState: { value: 50 },
      validateField: () => null,
    } as any)

    // Service 1 has state
    expect(service1.getState('el-1')).toBeDefined()
    // Service 2 should NOT
    expect(service2.getState('el-1')).toBeUndefined()
  })

  it('resetting one service does not affect another', async () => {
    const { createStateSyncService } = await import('../react/state-sync.js')

    const service1 = createStateSyncService(Registry.make())
    const service2 = createStateSyncService(Registry.make())

    const element = {
      key: 'el-shared',
      type: 'input',
      isInteractable: true,
      stateSchema: { text: { type: 'string' as const, default: '' } },
      defaultState: { text: '' },
      validateField: () => null,
    } as any

    service1.initElement(element)
    service2.initElement(element)

    service1.reset()

    expect(service1.getState('el-shared')).toBeUndefined()
    expect(service2.getState('el-shared')).toBeDefined()
  })
})

// =============================================================================
// Prompt Compiler Hardening
// =============================================================================

describe('Prompt Compiler — Hardened', () => {
  it('replaces ALL occurrences of a placeholder (not just first)', async () => {
    const { PromptTemplate, PromptSlot } = await import('../core/prompts.js')

    const tmpl = new PromptTemplate({
      name: 'test-repeat',
      template: 'Start {{name}}, middle {{name}}, end {{name}}.',
      slots: [new PromptSlot({ name: 'name', type: 'string', required: true })],
    })

    const result = tmpl.compile({ name: 'Alice' })
    expect(result).toBe('Start Alice, middle Alice, end Alice.')
    // Old code would leave "Start Alice, middle {{name}}, end {{name}}."
  })

  it('validates slot types at runtime', async () => {
    const { PromptTemplate, PromptSlot, PromptCompileError } = await import('../core/prompts.js')

    const tmpl = new PromptTemplate({
      name: 'type-check',
      template: 'Count: {{count}}',
      slots: [new PromptSlot({ name: 'count', type: 'number', required: true })],
    })

    // Passing string where number expected
    expect(() => tmpl.compile({ count: 'not-a-number' })).toThrow(PromptCompileError)
  })

  it('detects unresolved placeholders', async () => {
    const { PromptTemplate, PromptSlot, PromptCompileError } = await import('../core/prompts.js')

    const tmpl = new PromptTemplate({
      name: 'unresolved',
      template: 'Hello {{name}}, your role is {{role}}.',
      slots: [
        new PromptSlot({ name: 'name', type: 'string', required: true }),
        // 'role' is NOT declared as a slot — it will remain unresolved
      ],
    })

    // name is provided, but {{role}} has no slot and no value
    expect(() => tmpl.compile({ name: 'Bob' })).toThrow(PromptCompileError)
    expect(() => tmpl.compile({ name: 'Bob' })).toThrow(/Unresolved/)
  })

  it('throws PromptCompileError (tagged, not generic Error)', async () => {
    const { PromptTemplate, PromptSlot, PromptCompileError } = await import('../core/prompts.js')

    const tmpl = new PromptTemplate({
      name: 'tagged-error',
      template: 'Required: {{x}}',
      slots: [new PromptSlot({ name: 'x', type: 'string', required: true })],
    })

    try {
      tmpl.compile({})
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(PromptCompileError)
      expect((err as PromptCompileError)._tag).toBe('PromptCompileError')
      expect((err as PromptCompileError).templateName).toBe('tagged-error')
    }
  })

  it('allows json slot type with object values', async () => {
    const { PromptTemplate, PromptSlot } = await import('../core/prompts.js')

    const tmpl = new PromptTemplate({
      name: 'json-slot',
      template: 'Config: {{config}}',
      slots: [new PromptSlot({ name: 'config', type: 'json', required: true })],
    })

    const result = tmpl.compile({ config: { a: 1, b: 2 } })
    expect(result).toContain('"a":1')
  })
})

// =============================================================================
// Thread.turns() Interleaving
// =============================================================================

describe('Thread.turns() — Interleaved Messages', () => {
  it('collects tool messages as intermediate between user→assistant', async () => {
    const { Thread, ThreadMessage, Turn } = await import('../core/threads.js')

    const thread = new Thread({
      id: 't1',
      messages: List.fromIterable([
        new ThreadMessage({ id: 'm1', role: 'user', content: [{ _tag: 'text', text: 'hi' }], timestamp: '2026-01-01' }),
        new ThreadMessage({ id: 'm2', role: 'tool', content: [{ _tag: 'tool-result', toolCallId: 'tc1', toolName: 'search', content: 'found', isError: false }], timestamp: '2026-01-01' }),
        new ThreadMessage({ id: 'm3', role: 'assistant', content: [{ _tag: 'text', text: 'done' }], timestamp: '2026-01-01' }),
      ]),
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    })

    const turns = thread.turns
    expect(turns).toHaveLength(1)
    expect(turns[0].userMessage.id).toBe('m1')
    expect(turns[0].assistantMessage?.id).toBe('m3')
    expect(turns[0].intermediate).toHaveLength(1)
    expect(turns[0].intermediate[0].id).toBe('m2')
  })

  it('handles trailing user without assistant response', async () => {
    const { Thread, ThreadMessage } = await import('../core/threads.js')

    const thread = new Thread({
      id: 't2',
      messages: List.fromIterable([
        new ThreadMessage({ id: 'm1', role: 'user', content: [{ _tag: 'text', text: 'hello' }], timestamp: '2026-01-01' }),
      ]),
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    })

    const turns = thread.turns
    expect(turns).toHaveLength(1)
    expect(turns[0].userMessage.id).toBe('m1')
    expect(turns[0].assistantMessage).toBeUndefined()
    expect(turns[0].intermediate).toHaveLength(0)
  })

  it('skips system preamble before first user message', async () => {
    const { Thread, ThreadMessage } = await import('../core/threads.js')

    const thread = new Thread({
      id: 't3',
      messages: List.fromIterable([
        new ThreadMessage({ id: 's1', role: 'system', content: [{ _tag: 'text', text: 'You are helpful' }], timestamp: '2026-01-01' }),
        new ThreadMessage({ id: 'm1', role: 'user', content: [{ _tag: 'text', text: 'hi' }], timestamp: '2026-01-01' }),
        new ThreadMessage({ id: 'm2', role: 'assistant', content: [{ _tag: 'text', text: 'hello' }], timestamp: '2026-01-01' }),
      ]),
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    })

    const turns = thread.turns
    expect(turns).toHaveLength(1)
    // System message should not be in the turn
    expect(turns[0].userMessage.id).toBe('m1')
    expect(turns[0].intermediate).toHaveLength(0)
  })

  it('handles multiple tool calls between user and assistant', async () => {
    const { Thread, ThreadMessage } = await import('../core/threads.js')

    const thread = new Thread({
      id: 't4',
      messages: List.fromIterable([
        new ThreadMessage({ id: 'm1', role: 'user', content: [{ _tag: 'text', text: 'search' }], timestamp: '2026-01-01' }),
        new ThreadMessage({ id: 't1', role: 'tool', content: [{ _tag: 'tool-result', toolCallId: 'tc1', toolName: 'a', content: 'r1', isError: false }], timestamp: '2026-01-01' }),
        new ThreadMessage({ id: 's1', role: 'system', content: [{ _tag: 'text', text: 'context update' }], timestamp: '2026-01-01' }),
        new ThreadMessage({ id: 't2', role: 'tool', content: [{ _tag: 'tool-result', toolCallId: 'tc2', toolName: 'b', content: 'r2', isError: false }], timestamp: '2026-01-01' }),
        new ThreadMessage({ id: 'm2', role: 'assistant', content: [{ _tag: 'text', text: 'done' }], timestamp: '2026-01-01' }),
      ]),
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    })

    const turns = thread.turns
    expect(turns).toHaveLength(1)
    expect(turns[0].intermediate).toHaveLength(3) // tool, system, tool
    expect(turns[0].assistantMessage?.id).toBe('m2')
  })

  it('handles consecutive user messages (no assistant between)', async () => {
    const { Thread, ThreadMessage } = await import('../core/threads.js')

    const thread = new Thread({
      id: 't5',
      messages: List.fromIterable([
        new ThreadMessage({ id: 'm1', role: 'user', content: [{ _tag: 'text', text: 'first' }], timestamp: '2026-01-01' }),
        new ThreadMessage({ id: 'm2', role: 'user', content: [{ _tag: 'text', text: 'second' }], timestamp: '2026-01-01' }),
        new ThreadMessage({ id: 'm3', role: 'assistant', content: [{ _tag: 'text', text: 'response' }], timestamp: '2026-01-01' }),
      ]),
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    })

    const turns = thread.turns
    expect(turns).toHaveLength(2)
    // First turn: user m1, no assistant
    expect(turns[0].userMessage.id).toBe('m1')
    expect(turns[0].assistantMessage).toBeUndefined()
    // Second turn: user m2, assistant m3
    expect(turns[1].userMessage.id).toBe('m2')
    expect(turns[1].assistantMessage?.id).toBe('m3')
  })
})

// =============================================================================
// Atomic setFields
// =============================================================================

describe('StateSyncService — Atomic setFields', () => {
  it('commits all fields on success', async () => {
    const { createStateSyncService, elementStatesAtom } = await import('../react/state-sync.js')
    const registry = Registry.make()
    const service = createStateSyncService(registry)

    service.initElement({
      key: 'el-1',
      type: 'widget',
      isInteractable: true,
      stateSchema: {},
      defaultState: { a: 1, b: 2, c: 3 },
      validateField: () => null,
    } as any)

    const error = service.setFields('el-1', { a: 10, b: 20, c: 30 })
    expect(error).toBeNull()

    const state = registry.get(elementStatesAtom).get('el-1')
    expect(state).toEqual({ a: 10, b: 20, c: 30 })
  })

  it('rejects ALL fields if ANY validation fails (no partial writes)', async () => {
    const { createStateSyncService, elementStatesAtom } = await import('../react/state-sync.js')
    const registry = Registry.make()
    const service = createStateSyncService(registry)

    let callCount = 0
    service.initElement({
      key: 'el-2',
      type: 'widget',
      isInteractable: true,
      stateSchema: {},
      defaultState: { a: 1, b: 2 },
      validateField: (field: string, value: unknown) => {
        callCount++
        if (field === 'b' && value === 'invalid') return 'b must be number'
        return null
      },
    } as any)

    const error = service.setFields('el-2', { a: 10, b: 'invalid' })
    expect(error).toContain('b must be number')

    // 'a' should NOT have been updated (atomic rollback)
    const state = registry.get(elementStatesAtom).get('el-2')
    expect(state).toEqual({ a: 1, b: 2 }) // unchanged
  })
})
