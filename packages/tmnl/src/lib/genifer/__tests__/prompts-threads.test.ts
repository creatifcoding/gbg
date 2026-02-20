/**
 * Prompt Templating + Thread Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { List } from 'effect'
import * as Registry from '@effect-atom/atom/Registry'
import { PromptTemplate, PromptSlot } from '../core/prompts.js'
import {
  createThreadService,
  activeThreadAtom,
  threadHistoryAtom,
  type ThreadServiceShape,
} from '../react/thread-service.js'

// =============================================================================
// Prompt Templating
// =============================================================================

describe('PromptTemplate', () => {
  const template = new PromptTemplate({
    name: 'dashboard',
    template: 'Generate a {{style}} dashboard with {{count}} widgets. Context: {{catalog}}',
    slots: [
      new PromptSlot({ name: 'style', type: 'string', required: true }),
      new PromptSlot({ name: 'count', type: 'number', required: true, defaultValue: 4 }),
      new PromptSlot({ name: 'catalog', type: 'catalog', required: false }),
    ],
  })

  it('extracts slot names from template string', () => {
    expect(template.slotNames).toEqual(['style', 'count', 'catalog'])
  })

  it('compiles with all slots filled', () => {
    const result = template.compile({ style: 'minimal', count: 6 }, 'Grid, Card, Text')
    expect(result).toBe('Generate a minimal dashboard with 6 widgets. Context: Grid, Card, Text')
  })

  it('uses default values for unfilled slots', () => {
    const result = template.compile({ style: 'dark' })
    expect(result).toContain('dark')
    expect(result).toContain('4') // default count
  })

  it('validates required slots', () => {
    const error = template.validateSlots({}) // missing 'style'
    expect(error).toContain("'style'")
  })

  it('throws on compile with missing required slot', () => {
    expect(() => template.compile({})).toThrow("'style'")
  })

  it('removes unfilled optional placeholders', () => {
    const result = template.compile({ style: 'clean', count: 2 })
    expect(result).not.toContain('{{catalog}}')
  })
})

// =============================================================================
// Thread Service
// =============================================================================

describe('ThreadService', () => {
  let service: ThreadServiceShape
  let r: Registry.Registry

  beforeEach(() => {
    r = Registry.make()
    service = createThreadService(r)
    service.reset()
  })

  it('creates a thread and sets it active', () => {
    const thread = service.createThread('Test Thread')
    expect(thread.title).toBe('Test Thread')
    expect(service.getActiveThread()?.id).toBe(thread.id)
  })

  it('adds messages to active thread', () => {
    service.createThread()
    service.addMessage('user', [{ _tag: 'text', text: 'Hello' }])
    service.addMessage('assistant', [{ _tag: 'text', text: 'Hi!' }], 'claude-4')

    const active = service.getActiveThread()!
    expect(active.messageCount).toBe(2)
    const msgs = active.toArray()
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
    expect(msgs[1].model).toBe('claude-4')
  })

  it('extracts flat text from messages', () => {
    service.createThread()
    const msg = service.addMessage('user', [
      { _tag: 'text', text: 'Hello ' },
      { _tag: 'text', text: 'world' },
    ])
    expect(msg.textContent).toBe('Hello world')
  })

  it('detects UI tree content', () => {
    service.createThread()
    const msg = service.addMessage('assistant', [
      { _tag: 'text', text: 'Here is your dashboard:' },
      { _tag: 'ui-tree', treeJson: '{}', componentCount: 5 },
    ])
    expect(msg.hasUITree).toBe(true)
  })

  it('computes turns from messages', () => {
    service.createThread()
    service.addMessage('user', [{ _tag: 'text', text: 'Q1' }])
    service.addMessage('assistant', [{ _tag: 'text', text: 'A1' }])
    service.addMessage('user', [{ _tag: 'text', text: 'Q2' }])
    service.addMessage('assistant', [{ _tag: 'text', text: 'A2' }])

    const active = service.getActiveThread()!
    const turns = active.turns
    expect(turns).toHaveLength(2)
    expect(turns[0].userMessage.textContent).toBe('Q1')
    expect(turns[0].assistantMessage?.textContent).toBe('A1')
    expect(turns[1].index).toBe(1)
  })

  it('switches between threads', () => {
    const t1 = service.createThread('Thread 1')
    const t2 = service.createThread('Thread 2')
    expect(service.getActiveThread()?.id).toBe(t2.id)

    service.setActiveThread(t1.id)
    expect(service.getActiveThread()?.id).toBe(t1.id)
  })

  it('forks a thread at a message index', () => {
    service.createThread('Original')
    service.addMessage('user', [{ _tag: 'text', text: 'Q1' }])
    service.addMessage('assistant', [{ _tag: 'text', text: 'A1' }])
    service.addMessage('user', [{ _tag: 'text', text: 'Q2' }])

    const original = service.getActiveThread()!
    const fork = service.forkThread(1) // Fork after A1

    expect(fork.parentThreadId).toBe(original.id)
    expect(fork.forkAtIndex).toBe(1)
    expect(fork.messageCount).toBe(2) // Q1 + A1
    expect(service.getActiveThread()?.id).toBe(fork.id)
  })

  it('lists all threads', () => {
    service.createThread('A')
    service.createThread('B')
    service.createThread('C')
    expect(service.listThreads()).toHaveLength(3)
  })

  it('throws when adding message with no active thread', () => {
    expect(() => service.addMessage('user', [{ _tag: 'text', text: 'hello' }])).toThrow('No active thread')
  })

  it('reset clears everything', () => {
    service.createThread()
    service.addMessage('user', [{ _tag: 'text', text: 'hi' }])
    service.reset()
    expect(service.getActiveThread()).toBeNull()
    expect(service.listThreads()).toHaveLength(0)
  })
})
