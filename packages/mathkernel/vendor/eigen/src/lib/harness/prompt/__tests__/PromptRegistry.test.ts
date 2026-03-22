/**
 * EPOCH-0003: PromptRegistry unit tests
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { makePromptRegistry, type PromptRegistryShape } from '../PromptRegistry'
import { isReservedKey, DEFAULT_AGENT_BUDGET_BYTES, DEFAULT_AGENT_PRIORITY } from '../types'

// ── Helpers ─────────────────────────────────────────────────

const run = <A>(effect: Effect.Effect<A, any, never>): A =>
  Effect.runSync(effect)

const entry = (key: string, content: string, priority = 500) => ({
  key,
  priority,
  content,
  sizeBytes: new TextEncoder().encode(content).byteLength,
})

// ── Tests ───────────────────────────────────────────────────

describe('PromptRegistry', () => {
  describe('basic operations', () => {
    it('starts empty (no initial entries)', () => {
      const reg = makePromptRegistry()
      const keys = run(reg.keys())
      expect(keys).toEqual([])
    })

    it('set/get/has/delete agent entries', () => {
      const reg = makePromptRegistry()
      run(reg.set('task-focus', 'Fix the bug in auth module'))

      expect(run(reg.has('task-focus'))).toBe(true)
      const got = run(reg.get('task-focus'))
      expect(got).not.toBeNull()
      expect(got!.key).toBe('task-focus')
      expect(got!.content).toBe('Fix the bug in auth module')
      expect(got!.priority).toBe(DEFAULT_AGENT_PRIORITY)

      const deleted = run(reg.delete('task-focus'))
      expect(deleted).toBe(true)
      expect(run(reg.has('task-focus'))).toBe(false)
    })

    it('set overwrites existing entry', () => {
      const reg = makePromptRegistry()
      run(reg.set('notes', 'v1'))
      run(reg.set('notes', 'v2'))
      expect(run(reg.get('notes'))!.content).toBe('v2')
    })

    it('set with custom priority', () => {
      const reg = makePromptRegistry()
      run(reg.set('important', 'critical context', { priority: 550 }))
      expect(run(reg.get('important'))!.priority).toBe(550)
    })

    it('delete returns false for nonexistent key', () => {
      const reg = makePromptRegistry()
      const deleted = run(reg.delete('ghost'))
      expect(deleted).toBe(false)
    })

    it('keys() returns only agent-owned keys', () => {
      const reg = makePromptRegistry(undefined, [
        entry('identity', 'I am a bot', 0),
      ])
      run(reg.set('my-entry', 'hello'))
      const keys = run(reg.keys())
      expect(keys).toEqual(['my-entry'])
    })
  })

  describe('reserved key protection', () => {
    it('rejects set on reserved key', () => {
      const reg = makePromptRegistry()
      const result = Effect.runSyncExit(reg.set('identity', 'hacked'))
      expect(result._tag).toBe('Failure')
    })

    it('rejects delete on reserved key', () => {
      const reg = makePromptRegistry(undefined, [
        entry('identity', 'system identity', 0),
      ])
      const result = Effect.runSyncExit(reg.delete('identity'))
      expect(result._tag).toBe('Failure')
    })

    it('all reserved keys are protected', () => {
      const reg = makePromptRegistry()
      const reservedKeys = ['identity', 'tool-manifest', 'guidelines', 'project-context', 'runtime-stamp']
      for (const key of reservedKeys) {
        expect(isReservedKey(key)).toBe(true)
        const result = Effect.runSyncExit(reg.set(key, 'nope'))
        expect(result._tag).toBe('Failure')
      }
    })

    it('non-reserved keys are allowed', () => {
      const reg = makePromptRegistry()
      expect(isReservedKey('task-focus')).toBe(false)
      expect(isReservedKey('working-memory')).toBe(false)
      run(reg.set('task-focus', 'test'))
      expect(run(reg.has('task-focus'))).toBe(true)
    })
  })

  describe('budget enforcement', () => {
    it('tracks budget correctly', () => {
      const reg = makePromptRegistry({ agentBudgetBytes: 100 })
      run(reg.set('small', 'hi'))

      const budget = run(reg.budget())
      expect(budget.limitBytes).toBe(100)
      expect(budget.usedBytes).toBe(new TextEncoder().encode('hi').byteLength)
      expect(budget.entryCount).toBe(1)
      expect(budget.remainingBytes).toBe(100 - budget.usedBytes)
    })

    it('rejects write that exceeds budget', () => {
      const reg = makePromptRegistry({ agentBudgetBytes: 10 })
      const bigContent = 'x'.repeat(20) // 20 bytes > 10 limit
      const result = Effect.runSyncExit(reg.set('big', bigContent))
      expect(result._tag).toBe('Failure')
    })

    it('allows overwrite within budget (accounts for existing size)', () => {
      const reg = makePromptRegistry({ agentBudgetBytes: 50 })
      run(reg.set('entry', 'x'.repeat(30))) // 30 bytes
      // Overwrite with same size — should fit (delta = 0)
      run(reg.set('entry', 'y'.repeat(30)))
      expect(run(reg.get('entry'))!.content).toBe('y'.repeat(30))
    })

    it('budget excludes system entries', () => {
      const systemEntry = entry('identity', 'x'.repeat(1000), 0)
      const reg = makePromptRegistry({ agentBudgetBytes: 50 }, [systemEntry])

      const budget = run(reg.budget())
      expect(budget.usedBytes).toBe(0) // system entries don't count
      expect(budget.limitBytes).toBe(50)
    })

    it('default budget is 16KB', () => {
      const reg = makePromptRegistry()
      const budget = run(reg.budget())
      expect(budget.limitBytes).toBe(DEFAULT_AGENT_BUDGET_BYTES)
      expect(budget.limitBytes).toBe(16 * 1024)
    })
  })

  describe('build()', () => {
    it('concatenates entries sorted by priority', () => {
      const reg = makePromptRegistry(undefined, [
        entry('identity', 'IDENTITY', 0),
        entry('runtime-stamp', 'STAMP', 900),
      ])
      run(reg.set('middle', 'AGENT', { priority: 500 }))

      const built = run(reg.build())
      const parts = built.split('\n\n')
      expect(parts[0]).toBe('IDENTITY')
      expect(parts[1]).toBe('AGENT')
      expect(parts[2]).toBe('STAMP')
    })

    it('empty registry builds empty string', () => {
      const reg = makePromptRegistry()
      expect(run(reg.build())).toBe('')
    })
  })

  describe('fork()', () => {
    it('fork copies system entries, drops agent entries', () => {
      const reg = makePromptRegistry(undefined, [
        entry('identity', 'system', 0),
      ])
      run(reg.set('agent-note', 'should not carry over'))

      const forked = run(reg.fork())
      expect(run(forked.has('identity'))).toBe(true) // system carried over
      expect(run(forked.has('agent-note'))).toBe(false) // agent dropped
    })

    it('forked registry has independent state', () => {
      const reg = makePromptRegistry(undefined, [
        entry('identity', 'original', 0),
      ])
      const forked = run(reg.fork())
      run(forked.set('new-entry', 'only in fork'))

      expect(run(forked.has('new-entry'))).toBe(true)
      expect(run(reg.has('new-entry'))).toBe(false) // original unaffected
    })
  })

  describe('list()', () => {
    it('returns metadata for all entries', () => {
      const reg = makePromptRegistry(undefined, [
        entry('identity', 'sys', 0),
      ])
      run(reg.set('agent-note', 'hello'))

      const list = run(reg.list())
      expect(list).toHaveLength(2)
      expect(list.find((e) => e.key === 'identity')).toBeDefined()
      expect(list.find((e) => e.key === 'agent-note')).toBeDefined()
      // list returns meta (no content field)
      for (const item of list) {
        expect(item).toHaveProperty('key')
        expect(item).toHaveProperty('priority')
        expect(item).toHaveProperty('sizeBytes')
        expect(item).not.toHaveProperty('content')
      }
    })
  })
})
