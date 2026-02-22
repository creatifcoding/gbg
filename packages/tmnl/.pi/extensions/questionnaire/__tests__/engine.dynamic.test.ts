import { describe, it, expect, beforeEach } from 'vitest'
import { Schema } from 'effect'

import { Questionnaire } from '../schema.ts'
import * as Engine from '../engine.ts'
import { get, resetRegistry, stateAtom, subscribe } from '../atoms.ts'

const makeSpec = (hook: Record<string, unknown>) =>
  Schema.decodeUnknownSync(Questionnaire)({
    id: 'dyn-spec',
    title: 'Dynamic Spec',
    startId: 'q1',
    questions: [
      {
        id: 'q1',
        prompt: 'Pick one',
        type: 'select',
        options: [{ value: 'x', label: 'X' }],
        next: 'q2',
        nextHook: hook,
      },
      {
        id: 'q2',
        prompt: 'Static Q2',
        type: 'input',
      },
    ],
  })

describe('engine dynamic next-hook', () => {
  beforeEach(() => {
    resetRegistry()
  })

  it('injects a runtime next question and records audit trace', async () => {
    const spec = makeSpec({
      hookId: 'hook-inject',
      toolName: 'pi-agent.dynamic-next',
      when: 'x',
      mode: 'inject',
    })

    const unsub = subscribe(stateAtom, () => {})
    Engine.start(spec, {
      dynamicResolver: async () => ({
        mode: 'inject',
        question: {
          prompt: 'Injected follow-up',
          type: 'input',
        },
      }),
    })

    await Engine.selectOption('x', 'X')

    const s = get(stateAtom)
    expect(s.status).toBe('active')
    expect(s.current?.prompt).toBe('Injected follow-up')
    expect(s.current?.id.startsWith('dyn_q1_')).toBe(true)
    expect(s.runtimeQuestions.size).toBe(1)
    expect(s.dynamicTrace.length).toBe(1)
    expect(s.dynamicTrace[0]?.appliedMode).toBe('inject')

    unsub()
  })

  it('modifies static next question in-place when policy is modify', async () => {
    const spec = makeSpec({
      hookId: 'hook-modify',
      toolName: 'pi-agent.dynamic-next',
      when: '*',
      mode: 'modify',
      targetId: 'q2',
    })

    const unsub = subscribe(stateAtom, () => {})
    Engine.start(spec, {
      dynamicResolver: async () => ({
        mode: 'modify',
        patch: {
          prompt: 'Modified Q2 prompt',
        },
      }),
    })

    await Engine.selectOption('x', 'X')

    const s = get(stateAtom)
    expect(s.current?.id).toBe('q2')
    expect(s.current?.prompt).toBe('Modified Q2 prompt')
    expect(s.runtimeQuestions.get('q2')?.prompt).toBe('Modified Q2 prompt')
    expect(s.dynamicTrace[0]?.appliedMode).toBe('modify')

    unsub()
  })

  it('rolls back injected runtime node on back navigation', async () => {
    const spec = makeSpec({
      hookId: 'hook-back',
      toolName: 'pi-agent.dynamic-next',
      when: '*',
      mode: 'inject',
    })

    const unsub = subscribe(stateAtom, () => {})
    Engine.start(spec, {
      dynamicResolver: async () => ({
        mode: 'inject',
        question: {
          id: 'temp-node',
          prompt: 'Temporary follow-up',
          type: 'input',
        },
      }),
    })

    await Engine.selectOption('x', 'X')

    let s = get(stateAtom)
    expect(s.current?.prompt).toBe('Temporary follow-up')
    expect(s.runtimeQuestions.size).toBe(1)
    expect(s.history).toEqual(['q1'])

    Engine.back()

    s = get(stateAtom)
    expect(s.current?.id).toBe('q1')
    expect(s.runtimeQuestions.size).toBe(0)
    expect(s.history).toEqual([])
    expect(s.answers.size).toBe(0)

    unsub()
  })

  it('interrupts a pending dynamic hook and falls back to static next', async () => {
    const spec = makeSpec({
      hookId: 'hook-interrupt',
      toolName: 'pi-agent.dynamic-next',
      when: '*',
      mode: 'inject',
    })

    const unsub = subscribe(stateAtom, () => {})
    Engine.start(spec, {
      dynamicResolver: async (_input, controls) => {
        return await new Promise((resolve) => {
          const timer = setTimeout(() => {
            resolve({
              mode: 'inject',
              question: {
                prompt: 'Slow injected question',
                type: 'input',
              },
            })
          }, 5_000)

          controls?.signal?.addEventListener('abort', () => {
            clearTimeout(timer)
            resolve({ mode: 'none', note: 'interrupted' })
          }, { once: true })
        })
      },
    })

    const pending = Engine.selectOption('x', 'X')

    for (let i = 0; i < 20; i++) {
      if (get(stateAtom).dynamicPending) break
      await new Promise((r) => setTimeout(r, 5))
    }

    expect(get(stateAtom).dynamicPending).toBe(true)

    Engine.interruptDynamicPending()
    await pending

    const s = get(stateAtom)
    expect(s.dynamicPending).toBe(false)
    expect(s.dynamicInterruptRequested).toBe(false)
    expect(s.current?.id).toBe('q2')
    expect(s.current?.prompt).toBe('Static Q2')
    expect(s.answers.get('q1')?.[0]?.value).toBe('x')
    expect(s.dynamicTrace[0]?.appliedMode).toBe('none')

    unsub()
  })
})
