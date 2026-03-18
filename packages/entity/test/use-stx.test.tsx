/**
 * Entity useStx(key) — Per-item surgical reactivity
 *
 * @vitest-environment happy-dom
 *
 *   H0: todoHooks.useStx(key) returns StxInstance
 *   H1: StxInstance has lens, focus, get, getAt
 *   H2: StxInstance.setAt writes to item AND updates collection
 *   H3: StxInstance.modify writes to item AND updates collection
 *   H4: Readonly field protection carries through
 *   H5: Entity validation on set()
 *   H6: debugSnapshot redacts sensitive fields
 *   H7: Collection-level stx store exists with lens into items
 *   H8: Collection stx.lens access works for aggregate views
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as Schema from 'effect-v4/Schema'
import { Entity } from '../src/entity.js'

// ─── Test Entity ─────────────────────────────────────────────

class Task extends Entity('Task')({
  id:     Schema.Number,
  title:  Schema.NonEmptyString,
  status: Schema.Literals(['todo', 'doing', 'done'] as const),
  score:  Entity.readonly(Schema.Number),
  secret: Entity.sensitive(Schema.String),
}) {}

const seed = [
  new Task({ id: 1, title: 'Alpha', status: 'todo', score: 10, secret: 'abc' }),
  new Task({ id: 2, title: 'Beta', status: 'doing', score: 20, secret: 'def' }),
]

// ─── H0: useStx returns StxInstance ──────────────────────────

describe('H0: useStx(key) returns StxInstance', () => {
  it('returns an object with lens, get, setAt, modify', () => {
    const hooks = Task.createHooks({ getId: (t: any) => t.id, initialData: seed })
    const { result } = renderHook(() => hooks.useStx(1))
    expect(result.current).toBeDefined()
    expect(result.current!.lens).toBeDefined()
    expect(result.current!.get).toBeTypeOf('function')
    expect(result.current!.setAt).toBeTypeOf('function')
    expect(result.current!.modify).toBeTypeOf('function')
    hooks.dispose()
  })

  it('returns undefined for missing key', () => {
    const hooks = Task.createHooks({ getId: (t: any) => t.id, initialData: seed })
    const { result } = renderHook(() => hooks.useStx(999))
    expect(result.current).toBeUndefined()
    hooks.dispose()
  })
})

// ─── H1: StxInstance has lens access ─────────────────────────

describe('H1: StxInstance lens access', () => {
  it('can read via lens', () => {
    const hooks = Task.createHooks({ getId: (t: any) => t.id, initialData: seed })
    const { result } = renderHook(() => hooks.useStx(1))
    expect(result.current!.getAt(result.current!.lens.title)).toBe('Alpha')
    expect(result.current!.getAt(result.current!.lens.status)).toBe('todo')
    hooks.dispose()
  })
})

// ─── H2: Bidirectional setAt ─────────────────────────────────

describe('H2: setAt writes back to collection', () => {
  it('setAt updates item AND collection sees change', () => {
    const hooks = Task.createHooks({ getId: (t: any) => t.id, initialData: [...seed] })
    const { result: stxResult } = renderHook(() => hooks.useStx(1))
    const { result: itemResult } = renderHook(() => hooks.useItem(1))

    act(() => {
      stxResult.current!.setAt(stxResult.current!.lens.title, 'Updated Alpha')
    })

    // Both the stx instance and the collection hook should reflect the change
    expect(stxResult.current!.get().title).toBe('Updated Alpha')
    expect(itemResult.current?.title).toBe('Updated Alpha')
    hooks.dispose()
  })
})

// ─── H3: Bidirectional modify ────────────────────────────────

describe('H3: modify writes back to collection', () => {
  it('modify updates item AND collection', () => {
    const hooks = Task.createHooks({ getId: (t: any) => t.id, initialData: [...seed] })
    const { result: stxResult } = renderHook(() => hooks.useStx(1))
    const { result: itemResult } = renderHook(() => hooks.useItem(1))

    act(() => {
      stxResult.current!.modify(stxResult.current!.lens.title, (t: string) => t + '!!!')
    })

    expect(stxResult.current!.get().title).toBe('Alpha!!!')
    expect(itemResult.current?.title).toBe('Alpha!!!')
    hooks.dispose()
  })
})

// ─── H4: Readonly protection ─────────────────────────────────

describe('H4: readonly protection carries through', () => {
  it('setAt on readonly field throws', () => {
    const hooks = Task.createHooks({ getId: (t: any) => t.id, initialData: seed })
    const { result } = renderHook(() => hooks.useStx(1))

    expect(() => {
      result.current!.setAt(result.current!.lens.score, 999)
    }).toThrow(/readonly/)
    hooks.dispose()
  })
})

// ─── H5: Validation on set ───────────────────────────────────

describe('H5: Entity validation on set()', () => {
  it('rejects invalid state', () => {
    const hooks = Task.createHooks({ getId: (t: any) => t.id, initialData: seed })
    const { result } = renderHook(() => hooks.useStx(1))

    const invalid = Object.assign(Object.create(Task.prototype), { ...seed[0], title: '' })
    expect(() => result.current!.set(invalid)).toThrow()
    hooks.dispose()
  })
})

// ─── H6: Debug redaction ─────────────────────────────────────

describe('H6: debugSnapshot redacts sensitive', () => {
  it('redacts secret field', () => {
    const hooks = Task.createHooks({ getId: (t: any) => t.id, initialData: seed })
    const { result } = renderHook(() => hooks.useStx(1))
    const snapshot = result.current!.debugSnapshot?.()
    expect(snapshot?.secret).toBe('[REDACTED]')
    expect(snapshot?.title).toBe('Alpha')
    hooks.dispose()
  })
})

// ─── H7-H8: Collection-level stx ────────────────────────────

describe('H7: collection-level stx store', () => {
  it('hooks exposes a collection stx store', () => {
    const hooks = Task.createHooks({ getId: (t: any) => t.id, initialData: seed })
    expect(hooks.store).toBeDefined()
    expect(hooks.store.get).toBeTypeOf('function')
    expect(hooks.store.lens).toBeDefined()
    hooks.dispose()
  })
})

describe('H8: collection stx lens for aggregate', () => {
  it('can read items count via collection store', () => {
    const hooks = Task.createHooks({ getId: (t: any) => t.id, initialData: seed })
    const items = hooks.store.get()
    expect(items).toHaveLength(2)
    hooks.dispose()
  })
})
