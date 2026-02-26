/**
 * EPOCH-0003: prompt_context code-eval tool tests
 */

import { describe, it, expect } from 'vitest'
import { Effect, Exit } from 'effect'
import { makePromptRegistry } from '../PromptRegistry'
import { executePromptContextCode } from '../tools/prompt-context-tool'
import type { PromptEntry } from '../types'

const run = <A>(effect: Effect.Effect<A, any, never>): A =>
  Effect.runSync(effect)

const entry = (key: string, content: string, priority = 500): PromptEntry => ({
  key,
  priority,
  content,
  sizeBytes: new TextEncoder().encode(content).byteLength,
})

describe('prompt_context code-eval tool', () => {
  describe('read operations', () => {
    it('list() returns entry metadata', () => {
      const reg = makePromptRegistry(undefined, [entry('identity', 'sys', 0)])
      run(reg.set('my-note', 'hello'))

      const result = run(executePromptContextCode(reg, `
        return promptContext.list()
      `))
      expect(result).toHaveLength(2)
    })

    it('get() returns full entry', () => {
      const reg = makePromptRegistry()
      run(reg.set('focus', 'debugging auth'))

      const result = run(executePromptContextCode(reg, `
        return promptContext.get('focus')
      `))
      expect(result).toMatchObject({
        key: 'focus',
        content: 'debugging auth',
      })
    })

    it('has() checks existence', () => {
      const reg = makePromptRegistry()
      run(reg.set('exists', 'yes'))

      const result = run(executePromptContextCode(reg, `
        return { exists: promptContext.has('exists'), missing: promptContext.has('nope') }
      `))
      expect(result).toEqual({ exists: true, missing: false })
    })

    it('keys() returns agent keys only', () => {
      const reg = makePromptRegistry(undefined, [entry('identity', 'sys', 0)])
      run(reg.set('agent-key', 'val'))

      const result = run(executePromptContextCode(reg, `
        return promptContext.keys()
      `))
      expect(result).toEqual(['agent-key'])
    })

    it('budget() returns correct budget', () => {
      const reg = makePromptRegistry({ agentBudgetBytes: 1000 })
      run(reg.set('entry', 'x'.repeat(100)))

      const result = run(executePromptContextCode(reg, `
        return promptContext.budget()
      `)) as any
      expect(result.limitBytes).toBe(1000)
      expect(result.usedBytes).toBe(100)
      expect(result.entryCount).toBe(1)
    })
  })

  describe('write operations', () => {
    it('set() creates an entry', () => {
      const reg = makePromptRegistry()

      run(executePromptContextCode(reg, `
        promptContext.set('task', 'Fix the login bug')
      `))

      expect(run(reg.has('task'))).toBe(true)
      expect(run(reg.get('task'))!.content).toBe('Fix the login bug')
    })

    it('set() with priority', () => {
      const reg = makePromptRegistry()

      run(executePromptContextCode(reg, `
        promptContext.set('high-priority', 'urgent', { priority: 700 })
      `))

      expect(run(reg.get('high-priority'))!.priority).toBe(700)
    })

    it('delete() removes an entry', () => {
      const reg = makePromptRegistry()
      run(reg.set('temp', 'disposable'))

      const result = run(executePromptContextCode(reg, `
        return promptContext.delete('temp')
      `))
      expect(result).toBe(true)
      expect(run(reg.has('temp'))).toBe(false)
    })

    it('batch operations work', () => {
      const reg = makePromptRegistry()

      run(executePromptContextCode(reg, `
        promptContext.set('a', 'first')
        promptContext.set('b', 'second')
        promptContext.set('c', 'third')
        promptContext.delete('b')
      `))

      expect(run(reg.has('a'))).toBe(true)
      expect(run(reg.has('b'))).toBe(false)
      expect(run(reg.has('c'))).toBe(true)
    })
  })

  describe('error handling', () => {
    it('reserved key write returns error object', () => {
      const reg = makePromptRegistry()

      const result = run(executePromptContextCode(reg, `
        promptContext.set('identity', 'hacked')
      `)) as any
      expect(result.error).toBe(true)
    })

    it('syntax error returns error object', () => {
      const reg = makePromptRegistry()

      const result = run(executePromptContextCode(reg, `
        this is not valid javascript ///
      `)) as any
      expect(result.error).toBe(true)
      expect(result.message).toContain('prompt_context code execution failed')
    })

    it('budget exceeded returns error object', () => {
      const reg = makePromptRegistry({ agentBudgetBytes: 10 })

      const result = run(executePromptContextCode(reg, `
        promptContext.set('big', '${'x'.repeat(100)}')
      `)) as any
      expect(result.error).toBe(true)
    })
  })

  describe('complex patterns', () => {
    it('conditional logic based on budget', () => {
      const reg = makePromptRegistry({ agentBudgetBytes: 200 })

      run(executePromptContextCode(reg, `
        const budget = promptContext.budget()
        if (budget.remainingBytes > 50) {
          promptContext.set('status', 'plenty of room')
        } else {
          promptContext.set('status', 'running low')
        }
      `))

      expect(run(reg.get('status'))!.content).toBe('plenty of room')
    })

    it('iterating and consolidating entries', () => {
      const reg = makePromptRegistry()
      run(reg.set('note-1', 'first note'))
      run(reg.set('note-2', 'second note'))

      run(executePromptContextCode(reg, `
        const keys = promptContext.keys()
        const notes = keys
          .filter(k => k.startsWith('note-'))
          .map(k => promptContext.get(k).content)
        
        // Consolidate into single entry
        promptContext.set('all-notes', notes.join('; '))
        
        // Clean up originals
        for (const k of keys.filter(k => k.startsWith('note-'))) {
          promptContext.delete(k)
        }
      `))

      expect(run(reg.has('note-1'))).toBe(false)
      expect(run(reg.has('note-2'))).toBe(false)
      expect(run(reg.get('all-notes'))!.content).toBe('first note; second note')
    })

    it('return value is serialized to caller', () => {
      const reg = makePromptRegistry()

      const result = run(executePromptContextCode(reg, `
        promptContext.set('counter', '0')
        return { created: true, key: 'counter' }
      `))
      expect(result).toEqual({ created: true, key: 'counter' })
    })
  })
})
