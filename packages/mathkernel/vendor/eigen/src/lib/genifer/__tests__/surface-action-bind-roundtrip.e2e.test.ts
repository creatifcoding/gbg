import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'

import { normalize } from '../core/normalize'
import type { BehaviorBlock } from '../decorators/generation-schema'
import { interpretBehaviorBlock, resolveProps } from '../decorators/interpreter'

describe('Genifer surface action/bind roundtrip (generated tree)', () => {
  it('materializes behavior + bind + @action flow end-to-end', async () => {
    const raw = JSON.stringify({
      key: 'root',
      type: 'VStack',
      behavior: {
        name: 'search-surface',
        state: [
          { field: 'query', initial: '' },
          { field: 'submitted', initial: false },
        ],
        actions: {
          submit: {
            _tag: 'sequence',
            actions: [
              { _tag: 'setState', values: { submitted: true } },
              { _tag: 'setState', values: { query: '{{@state:query}} submitted' } },
            ],
          },
        },
        subscriptions: [],
        emits: [],
        requires: [],
      },
      children: ['queryInput', 'submitButton'],
      queryInput: {
        type: 'Input',
        props: {
          value: 'bind:query',
          placeholder: 'Search flights',
        },
      },
      submitButton: {
        type: 'Button',
        props: {
          onClick: '@action:submit',
          label: 'Search',
        },
      },
    })

    const tree = Effect.runSync(normalize(raw))
    const root = tree.getElementUnsafe('root')
    const input = tree.getElementUnsafe('queryInput')
    const button = tree.getElementUnsafe('submitButton')

    expect(root?.behavior).toBeTruthy()
    expect(input?.props.value).toBe('bind:query')
    expect(button?.props.onClick).toBe('@action:submit')

    const instance = interpretBehaviorBlock(root?.behavior as BehaviorBlock)

    const inputResolved = resolveProps(input!.props as Record<string, unknown>, instance)
    expect(inputResolved.resolved.value).toBe('')
    expect(typeof inputResolved.handlers.onChange).toBe('function')

    inputResolved.handlers.onChange?.({ target: { value: 'saturn' } })

    const queryAtom = instance.atoms.get('query')!
    const submittedAtom = instance.atoms.get('submitted')!
    expect(instance.registry.get(queryAtom)).toBe('saturn')

    const actionResolved = resolveProps(button!.props as Record<string, unknown>, instance)
    expect(typeof actionResolved.handlers.onClick).toBe('function')

    let dispatchedTag: string | undefined
    let dispatchedPayload: unknown
    const originalDispatch = instance.dispatch
    ;(instance as any).dispatch = (tag: string, payload?: unknown) => {
      dispatchedTag = tag
      dispatchedPayload = payload
      return Effect.void
    }

    actionResolved.handlers.onClick?.({ target: { value: 'evt' } })
    expect(dispatchedTag).toBe('submit')
    expect(dispatchedPayload).toEqual({ target: { value: 'evt' } })

    ;(instance as any).dispatch = originalDispatch
    Effect.runSync(instance.dispatch('submit'))

    expect(instance.registry.get(submittedAtom)).toBe(true)
    expect(instance.registry.get(queryAtom)).toBe('saturn submitted')
  })
})
