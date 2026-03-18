/**
 * @tmnl/db — Hook Factory Tests
 *
 * @vitest-environment jsdom
 *
 * Prove createEntityHooks produces working React hooks:
 *   H0: Hook factory creates all hooks
 *   H1: useItems returns initial data
 *   H2: useCount reflects length
 *   H3: useItem returns individual items
 *   H4: useInsert validates and mutates
 *   H5: useUpdate modifies in place
 *   H6: useRemove deletes items
 *   H7: Hooks react to mutations (re-render on insert/update/remove)
 */

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import * as Schema from 'effect-v4/Schema'
import { Entity } from '@tmnl/entity'
import { createEntityHooks } from '../src/hooks.js'

// ─── Entity ──────────────────────────────────────────────────

class Todo extends Entity('Todo')({
  id:        Entity.generated(Schema.Number),
  text:      Schema.NonEmptyString,
  completed: Schema.Boolean,
  priority:  Schema.Literals(['low', 'medium', 'high'] as const),
  createdAt: Entity.timestamp(),
}) {}

function makeTodo(id: number, text: string, extra?: Partial<{
  completed: boolean; priority: 'low' | 'medium' | 'high'; createdAt: number
}>) {
  return {
    id,
    text,
    completed: extra?.completed ?? false,
    priority: extra?.priority ?? 'medium',
    createdAt: extra?.createdAt ?? Date.now(),
  }
}

// ─── Fixtures ────────────────────────────────────────────────

const INITIAL = [
  makeTodo(1, 'Alpha'),
  makeTodo(2, 'Bravo', { completed: true }),
  makeTodo(3, 'Charlie', { priority: 'high' }),
]

let hooks: ReturnType<typeof createEntityHooks<any, number>>

function setup() {
  hooks = createEntityHooks(Todo, {
    getId: (t: any) => t.id,
    initialData: [...INITIAL],
  })
}

afterEach(() => {
  hooks?.dispose()
})

// ─── H0: Factory creates all hooks ──────────────────────────

describe('H0: Factory produces complete hook set', () => {
  it('all hooks are functions', () => {
    setup()
    expect(typeof hooks.useItems).toBe('function')
    expect(typeof hooks.useItem).toBe('function')
    expect(typeof hooks.useCount).toBe('function')
    expect(typeof hooks.useInsert).toBe('function')
    expect(typeof hooks.useUpdate).toBe('function')
    expect(typeof hooks.useRemove).toBe('function')
    expect(typeof hooks.dispose).toBe('function')
    expect(hooks.rx).toBeDefined()
    expect(hooks.adapted).toBeDefined()
    expect(hooks.registry).toBeDefined()
  })
})

// ─── H1: useItems ────────────────────────────────────────────

describe('H1: useItems returns initial data', () => {
  it('returns all items', () => {
    setup()
    const { result } = renderHook(() => hooks.useItems())
    expect(result.current).toHaveLength(3)
    expect(result.current[0].text).toBe('Alpha')
  })
})

// ─── H2: useCount ────────────────────────────────────────────

describe('H2: useCount reflects length', () => {
  it('returns 3 for initial data', () => {
    setup()
    const { result } = renderHook(() => hooks.useCount())
    expect(result.current).toBe(3)
  })
})

// ─── H3: useItem ─────────────────────────────────────────────

describe('H3: useItem returns individual items', () => {
  it('returns item by key', () => {
    setup()
    const { result } = renderHook(() => hooks.useItem(2))
    expect(result.current).toBeDefined()
    expect(result.current.text).toBe('Bravo')
  })

  it('returns undefined for missing key', () => {
    setup()
    const { result } = renderHook(() => hooks.useItem(999))
    expect(result.current).toBeUndefined()
  })
})

// ─── H4: useInsert ───────────────────────────────────────────

describe('H4: useInsert validates and mutates', () => {
  it('inserts valid data', () => {
    setup()
    const { result: insertResult } = renderHook(() => hooks.useInsert())
    const { result: countResult } = renderHook(() => hooks.useCount())

    act(() => {
      const res = insertResult.current(makeTodo(4, 'Delta'))
      expect(res._tag).toBe('Success')
    })

    expect(countResult.current).toBe(4)
  })

  it('rejects invalid data', () => {
    setup()
    const { result: insertResult } = renderHook(() => hooks.useInsert())
    const { result: countResult } = renderHook(() => hooks.useCount())

    act(() => {
      const res = insertResult.current({ id: 4, text: '', completed: false, priority: 'medium', createdAt: 1 } as any)
      expect(res._tag).toBe('Failure')
    })

    // Count should NOT change
    expect(countResult.current).toBe(3)
  })
})

// ─── H5: useUpdate ───────────────────────────────────────────

describe('H5: useUpdate modifies in place', () => {
  it('updates item text', () => {
    setup()
    const { result: updateFn } = renderHook(() => hooks.useUpdate())
    const { result: itemResult } = renderHook(() => hooks.useItem(1))

    act(() => {
      updateFn.current(1, (d: any) => { d.text = 'Updated Alpha' })
    })

    expect(itemResult.current.text).toBe('Updated Alpha')
  })
})

// ─── H6: useRemove ───────────────────────────────────────────

describe('H6: useRemove deletes items', () => {
  it('removes item', () => {
    setup()
    const { result: removeFn } = renderHook(() => hooks.useRemove())
    const { result: countResult } = renderHook(() => hooks.useCount())

    act(() => {
      removeFn.current(2)
    })

    expect(countResult.current).toBe(2)
  })
})

// ─── H7: Hooks react to mutations ───────────────────────────

describe('H7: Hooks react to mutations', () => {
  it('useItems updates after insert', () => {
    setup()
    const { result: items } = renderHook(() => hooks.useItems())
    const { result: insertFn } = renderHook(() => hooks.useInsert())

    expect(items.current).toHaveLength(3)

    act(() => {
      insertFn.current(makeTodo(4, 'Delta'))
    })

    expect(items.current).toHaveLength(4)
    expect(items.current.find((i: any) => i.id === 4)?.text).toBe('Delta')
  })

  it('useItem updates after update', () => {
    setup()
    const { result: item } = renderHook(() => hooks.useItem(1))
    const { result: updateFn } = renderHook(() => hooks.useUpdate())

    expect(item.current.text).toBe('Alpha')

    act(() => {
      updateFn.current(1, (d: any) => { d.text = 'Modified' })
    })

    expect(item.current.text).toBe('Modified')
  })

  it('useCount updates after remove', () => {
    setup()
    const { result: count } = renderHook(() => hooks.useCount())
    const { result: removeFn } = renderHook(() => hooks.useRemove())

    expect(count.current).toBe(3)

    act(() => {
      removeFn.current(3)
    })

    expect(count.current).toBe(2)
  })
})
