/**
 * STX ↔ Entity Integration Spike
 *
 * stx() detects Entity class instances via constructor.fieldMeta
 * and produces constrained focus atoms:
 *
 *   H0: stx(entityInstance) — basic creation works
 *   H1: Entity-aware instance exposes fieldMeta on the stx result
 *   H2: readonly fields → focus atoms have no setter (read-only)
 *   H3: computed fields → focus atoms have no setter
 *   H4: generated fields → excluded from set() patches
 *   H5: sensitive fields → redacted in debug snapshot
 *   H6: set() validates through update schema — rejects invalid state
 *   H7: setAt() on writable field works normally
 *   H8: setAt() on readonly field throws/no-ops
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { Entity } from '@tmnl/entity'
import { stx } from '../src/stx.js'

// ─── Test Entity ─────────────────────────────────────────────

class Task extends Entity('Task')({
  id:          Entity.generated(Schema.Number),
  title:       Schema.NonEmptyString,
  description: Schema.String,
  status:      Schema.Literals(['todo', 'doing', 'done'] as const),
  score:       Entity.readonly(Schema.Number),
  apiKey:      Entity.sensitive(Schema.String),
  createdAt:   Entity.timestamp(),
}) {}

const seed = new Task({
  id: 1,
  title: 'Build STX',
  description: 'Integrate Entity with STX',
  status: 'doing',
  score: 42,
  apiKey: 'secret-123',
  createdAt: Date.now(),
})

// ─── H0: Basic creation ─────────────────────────────────────

describe('H0: stx(entityInstance) works', () => {
  it('creates an StxInstance', () => {
    const store = stx(seed)
    expect(store.atom).toBeDefined()
    expect(store.lens).toBeDefined()
    expect(store.get()).toBe(seed)
    expect(store.get()).toBeInstanceOf(Task)
  })

  it('preserves class identity after set', () => {
    const store = stx(seed)
    const updated = new Task({ ...seed, title: 'Updated' })
    store.set(updated)
    expect(store.get()).toBeInstanceOf(Task)
    expect(store.get().title).toBe('Updated')
  })
})

// ─── H1: Entity metadata exposed ────────────────────────────

describe('H1: Entity metadata on stx result', () => {
  it('stx instance exposes entityMeta when created from Entity', () => {
    const store = stx(seed)
    expect(store.entityMeta).toBeDefined()
    expect(store.entityMeta!.tag).toBe('Task')
    expect(store.entityMeta!.fieldMeta).toEqual(Task.fieldMeta)
  })

  it('stx instance has no entityMeta for plain objects', () => {
    const store = stx({ count: 0 })
    expect(store.entityMeta).toBeUndefined()
  })
})

// ─── H2-H3: Readonly / computed → read-only focus ───────────

describe('H2: readonly fields have read-only focus', () => {
  it('focus on readonly field returns value', () => {
    const store = stx(seed)
    const scoreFocus = store.focus(store.lens.score)
    expect(store.registry.get(scoreFocus)).toBe(42)
  })

  it('setAt on readonly field throws', () => {
    const store = stx(seed)
    expect(() => {
      store.setAt(store.lens.score, 999)
    }).toThrow(/readonly/)
  })
})

// ─── H4: Generated fields excluded from patches ─────────────

describe('H4: generated fields excluded from patches', () => {
  it('setAt on generated field throws', () => {
    const store = stx(seed)
    expect(() => {
      store.setAt(store.lens.id, 999)
    }).toThrow(/generated|readonly/)
  })
})

// ─── H5: Sensitive fields redacted in debug ──────────────────

describe('H5: sensitive field redaction', () => {
  it('debugSnapshot redacts sensitive fields', () => {
    const store = stx(seed)
    const snapshot = store.debugSnapshot?.()
    expect(snapshot).toBeDefined()
    expect(snapshot!.apiKey).toBe('[REDACTED]')
    expect(snapshot!.title).toBe('Build STX')
  })
})

// ─── H6: set() validates via update schema ───────────────────

describe('H6: set() validates through update schema', () => {
  it('accepts valid state', () => {
    const store = stx(seed)
    const valid = new Task({ ...seed, title: 'Valid' })
    store.set(valid) // should not throw
    expect(store.get().title).toBe('Valid')
  })

  it('rejects invalid state (empty title → NonEmptyString violation)', () => {
    const store = stx(seed)
    // Construct with raw to bypass constructor validation
    const invalid = Object.assign(Object.create(Task.prototype), { ...seed, title: '' })
    expect(() => store.set(invalid)).toThrow()
  })
})

// ─── H7: setAt on writable field works ───────────────────────

describe('H7: writable field mutations work', () => {
  it('setAt on data field works', () => {
    const store = stx(seed)
    store.setAt(store.lens.title, 'New Title')
    expect(store.get().title).toBe('New Title')
  })

  it('setAt on timestamp field works', () => {
    const store = stx(seed)
    const now = Date.now()
    store.setAt(store.lens.createdAt, now)
    expect(store.get().createdAt).toBe(now)
  })

  it('modify on data field works', () => {
    const store = stx(seed)
    store.modify(store.lens.description, d => d + '!!!')
    expect(store.get().description).toBe('Integrate Entity with STX!!!')
  })
})

// ─── H8: setAt on readonly field no-ops or throws ────────────

describe('H8: readonly field protection', () => {
  it('setAt on readonly field throws', () => {
    const store = stx(seed)
    expect(() => store.setAt(store.lens.score, 0)).toThrow(/readonly/)
  })

  it('modify on readonly field throws', () => {
    const store = stx(seed)
    expect(() => store.modify(store.lens.score, n => n + 1)).toThrow(/readonly/)
  })
})
