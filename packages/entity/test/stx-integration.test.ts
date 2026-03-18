/**
 * Entity ↔ STX Integration Spike
 *
 * Prove:
 *   H0: Entity field wrappers carry metadata (kind: generated/timestamp/sensitive/readonly/computed)
 *   H1: Entity class exposes field metadata map (fieldMeta)
 *   H2: STX can read field metadata to constrain focus behavior
 *   H3: Entity.reactive() delegates to STX atoms
 *   H4: Entity.createHooks() produces typed React hooks
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { Atom, AtomRegistry } from 'effect-v4/unstable/reactivity'
import { Entity, type FieldKind } from '../src/entity.js'

// ─── Entity with annotated fields ────────────────────────────

class Task extends Entity('Task')({
  id:          Entity.generated(Schema.Number),
  title:       Schema.NonEmptyString,
  description: Schema.String,
  status:      Schema.Literals(['todo', 'doing', 'done'] as const),
  score:       Entity.readonly(Schema.Number),
  wordCount:   Entity.computed(Schema.Number),
  apiKey:      Entity.sensitive(Schema.String),
  createdAt:   Entity.timestamp(),
  updatedAt:   Entity.timestamp(),
}) {}

// ─── H0: Field wrappers carry metadata ──────────────────────

describe('H0: Field wrappers carry metadata', () => {
  it('Entity.fieldMeta exists on class', () => {
    expect(Task.fieldMeta).toBeDefined()
    expect(typeof Task.fieldMeta).toBe('object')
  })

  it('generated field tagged as "generated"', () => {
    expect(Task.fieldMeta.id).toBe('generated')
  })

  it('plain Schema field tagged as "data"', () => {
    expect(Task.fieldMeta.title).toBe('data')
    expect(Task.fieldMeta.description).toBe('data')
    expect(Task.fieldMeta.status).toBe('data')
  })

  it('readonly field tagged as "readonly"', () => {
    expect(Task.fieldMeta.score).toBe('readonly')
  })

  it('computed field tagged as "computed"', () => {
    expect(Task.fieldMeta.wordCount).toBe('computed')
  })

  it('sensitive field tagged as "sensitive"', () => {
    expect(Task.fieldMeta.apiKey).toBe('sensitive')
  })

  it('timestamp field tagged as "timestamp"', () => {
    expect(Task.fieldMeta.createdAt).toBe('timestamp')
    expect(Task.fieldMeta.updatedAt).toBe('timestamp')
  })
})

// ─── H1: fieldMeta is a complete map ─────────────────────────

describe('H1: fieldMeta is complete', () => {
  it('has entry for every field', () => {
    const keys = Object.keys(Task.fieldMeta)
    expect(keys).toContain('id')
    expect(keys).toContain('title')
    expect(keys).toContain('description')
    expect(keys).toContain('status')
    expect(keys).toContain('score')
    expect(keys).toContain('wordCount')
    expect(keys).toContain('apiKey')
    expect(keys).toContain('createdAt')
    expect(keys).toContain('updatedAt')
    expect(keys.length).toBe(9)
  })

  it('all values are valid FieldKind', () => {
    const validKinds: FieldKind[] = ['data', 'generated', 'timestamp', 'sensitive', 'readonly', 'computed']
    for (const kind of Object.values(Task.fieldMeta)) {
      expect(validKinds).toContain(kind)
    }
  })
})

// ─── H2: STX can read metadata for constraints ──────────────

describe('H2: STX reads metadata for focus constraints', () => {
  it('can determine which fields are writable', () => {
    const writable = Object.entries(Task.fieldMeta)
      .filter(([_, kind]) => kind === 'data' || kind === 'timestamp')
      .map(([name]) => name)
    expect(writable).toContain('title')
    expect(writable).toContain('description')
    expect(writable).toContain('status')
    expect(writable).toContain('createdAt')
    expect(writable).toContain('updatedAt')
    expect(writable).not.toContain('id')        // generated
    expect(writable).not.toContain('score')      // readonly
    expect(writable).not.toContain('wordCount')  // computed
    expect(writable).not.toContain('apiKey')     // sensitive (writable server-side, but STX excludes from client patches)
  })

  it('can determine which fields to redact in debug', () => {
    const redacted = Object.entries(Task.fieldMeta)
      .filter(([_, kind]) => kind === 'sensitive')
      .map(([name]) => name)
    expect(redacted).toEqual(['apiKey'])
  })

  it('can determine which fields are derived (no set)', () => {
    const derived = Object.entries(Task.fieldMeta)
      .filter(([_, kind]) => kind === 'computed' || kind === 'readonly')
      .map(([name]) => name)
    expect(derived).toContain('score')
    expect(derived).toContain('wordCount')
  })

  it('can determine which fields to exclude from mutation patches', () => {
    const excluded = Object.entries(Task.fieldMeta)
      .filter(([_, kind]) => kind === 'generated' || kind === 'computed' || kind === 'readonly')
      .map(([name]) => name)
    expect(excluded).toContain('id')
    expect(excluded).toContain('score')
    expect(excluded).toContain('wordCount')
  })
})
