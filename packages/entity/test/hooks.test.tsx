/**
 * Entity.createHooks() Integration Test
 *
 * @vitest-environment happy-dom
 *
 *   H0: Todo.createHooks() returns hooks object
 *   H1: useItems() reads all items
 *   H2: useItem(key) reads single item
 *   H3: useCount() reads count
 *   H4: useInsert() validates and inserts
 *   H5: useInsert() rejects invalid data
 *   H6: useUpdate() patches item
 *   H7: useRemove() deletes item
 *   H8: fieldMeta available on hooks result
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as Schema from 'effect-v4/Schema'
import { Entity } from '../src/entity.js'

// ─── Test Entity ─────────────────────────────────────────────

class Todo extends Entity('Todo')({
  id:        Schema.Number,
  text:      Schema.NonEmptyString,
  completed: Schema.Boolean,
  score:     Entity.readonly(Schema.Number),
}) {}

const seed = [
  new Todo({ id: 1, text: 'Buy milk', completed: false, score: 10 }),
  new Todo({ id: 2, text: 'Build STX', completed: true, score: 42 }),
]

// ─── H0: Factory ─────────────────────────────────────────────

describe('H0: Todo.createHooks()', () => {
  it('returns hooks object', () => {
    const hooks = Todo.createHooks({ getId: (t: any) => t.id, initialData: seed })
    expect(hooks.useItems).toBeTypeOf('function')
    expect(hooks.useItem).toBeTypeOf('function')
    expect(hooks.useCount).toBeTypeOf('function')
    expect(hooks.useInsert).toBeTypeOf('function')
    expect(hooks.useUpdate).toBeTypeOf('function')
    expect(hooks.useRemove).toBeTypeOf('function')
    expect(hooks.fieldMeta).toEqual(Todo.fieldMeta)
    hooks.dispose()
  })
})

// ─── H1: useItems ────────────────────────────────────────────

describe('H1: useItems()', () => {
  it('reads all items', () => {
    const hooks = Todo.createHooks({ getId: (t: any) => t.id, initialData: seed })
    const { result } = renderHook(() => hooks.useItems())
    expect(result.current).toHaveLength(2)
    expect(result.current[0].text).toBe('Buy milk')
    hooks.dispose()
  })
})

// ─── H2: useItem ─────────────────────────────────────────────

describe('H2: useItem(key)', () => {
  it('reads single item', () => {
    const hooks = Todo.createHooks({ getId: (t: any) => t.id, initialData: seed })
    const { result } = renderHook(() => hooks.useItem(2))
    expect(result.current?.text).toBe('Build STX')
    hooks.dispose()
  })

  it('returns undefined for missing key', () => {
    const hooks = Todo.createHooks({ getId: (t: any) => t.id, initialData: seed })
    const { result } = renderHook(() => hooks.useItem(999))
    expect(result.current).toBeUndefined()
    hooks.dispose()
  })
})

// ─── H3: useCount ────────────────────────────────────────────

describe('H3: useCount()', () => {
  it('reads count', () => {
    const hooks = Todo.createHooks({ getId: (t: any) => t.id, initialData: seed })
    const { result } = renderHook(() => hooks.useCount())
    expect(result.current).toBe(2)
    hooks.dispose()
  })
})

// ─── H4-H5: useInsert ───────────────────────────────────────

describe('H4: useInsert() validated insert', () => {
  it('inserts valid data and updates items', () => {
    const hooks = Todo.createHooks({ getId: (t: any) => t.id, initialData: [...seed] })
    const { result: insertResult } = renderHook(() => hooks.useInsert())
    const { result: countResult } = renderHook(() => hooks.useCount())

    act(() => {
      const res = insertResult.current({ id: 3, text: 'New task', completed: false, score: 0 })
      expect(res._tag).toBe('Success')
    })
    expect(countResult.current).toBe(3)
    hooks.dispose()
  })
})

describe('H5: useInsert() rejects invalid', () => {
  it('rejects empty text', () => {
    const hooks = Todo.createHooks({ getId: (t: any) => t.id, initialData: [...seed] })
    const { result: insertResult } = renderHook(() => hooks.useInsert())
    const { result: countResult } = renderHook(() => hooks.useCount())

    act(() => {
      const res = insertResult.current({ id: 3, text: '', completed: false, score: 0 })
      expect(res._tag).toBe('Failure')
    })
    // Count unchanged
    expect(countResult.current).toBe(2)
    hooks.dispose()
  })
})

// ─── H6: useUpdate ───────────────────────────────────────────

describe('H6: useUpdate()', () => {
  it('patches item', () => {
    const hooks = Todo.createHooks({ getId: (t: any) => t.id, initialData: [...seed] })
    const { result: updateResult } = renderHook(() => hooks.useUpdate())
    const { result: itemResult } = renderHook(() => hooks.useItem(1))

    act(() => {
      updateResult.current(1, { text: 'Updated milk' })
    })
    expect(itemResult.current?.text).toBe('Updated milk')
    hooks.dispose()
  })
})

// ─── H7: useRemove ───────────────────────────────────────────

describe('H7: useRemove()', () => {
  it('deletes item', () => {
    const hooks = Todo.createHooks({ getId: (t: any) => t.id, initialData: [...seed] })
    const { result: removeResult } = renderHook(() => hooks.useRemove())
    const { result: countResult } = renderHook(() => hooks.useCount())

    act(() => {
      removeResult.current(1)
    })
    expect(countResult.current).toBe(1)
    hooks.dispose()
  })
})

// ─── H8: fieldMeta ───────────────────────────────────────────

describe('H8: fieldMeta on hooks', () => {
  it('exposes field metadata', () => {
    const hooks = Todo.createHooks({ getId: (t: any) => t.id, initialData: seed })
    expect(hooks.fieldMeta.id).toBe('data')
    expect(hooks.fieldMeta.score).toBe('readonly')
    hooks.dispose()
  })
})
