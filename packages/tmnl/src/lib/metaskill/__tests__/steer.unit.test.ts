/**
 * Unit tests for steering annotations.
 *
 * Tests shape recognition and annotation generation for each result type.
 */

import { describe, it, expect } from 'vitest'
import { steer } from '../../../../.pi/extensions/metaskill/steer.ts'

// ─── Profile shape ───────────────────────────────────────

describe('steer: profile shape', () => {
  it('suggests inspect when not clean', () => {
    const data = { name: 'bad', health: '8/10', level: 1, label: 'governed', type: 'leaf', policies: 0, stale: 0, pending: 0, clean: false, checks: 10 }
    const annotations = steer(data, "ms.profile('bad')")
    expect(annotations.some(a => a.icon === '🔧' && a.command?.includes('inspect'))).toBe(true)
  })

  it('suggests conformance upgrade when level < 3', () => {
    const data = { name: 'mid', health: '10/10 CLEAN', level: 2, label: 'clean', type: 'reference', policies: 3, stale: 0, pending: 0, clean: true, checks: 10 }
    const annotations = steer(data, "ms.profile('mid')")
    expect(annotations.some(a => a.icon === '📈' && a.command?.includes('conformance'))).toBe(true)
  })

  it('suggests freshness check when stale', () => {
    const data = { name: 'stale', health: '9/10', level: 2, label: 'clean', type: 'reference', policies: 5, stale: 2, pending: 0, clean: false, checks: 10 }
    const annotations = steer(data, "ms.profile('stale')")
    expect(annotations.some(a => a.icon === '🔄' && a.command?.includes('freshness'))).toBe(true)
  })

  it('confirms clean+complete+fresh', () => {
    const data = { name: 'perfect', health: '10/10 CLEAN', level: 3, label: 'complete', type: 'operational', policies: 5, stale: 0, pending: 0, clean: true, checks: 10 }
    const annotations = steer(data, "ms.profile('perfect')")
    expect(annotations.some(a => a.icon === '✅' && a.message.includes('clean, complete, fresh'))).toBe(true)
  })
})

// ─── freshnessAll shape ──────────────────────────────────

describe('steer: freshnessAll shape', () => {
  it('reports stale docs workspace-wide', () => {
    const data = { total: 72, current: 69, stale: 3, pending: 0, untracked: 143 }
    const annotations = steer(data, 'ms.freshnessAll()')
    expect(annotations.some(a => a.icon === '🔄' && a.message.includes('3 stale'))).toBe(true)
    expect(annotations.some(a => a.command?.includes('staleAll'))).toBe(true)
  })

  it('reports untracked files', () => {
    const data = { total: 72, current: 72, stale: 0, pending: 0, untracked: 143 }
    const annotations = steer(data, 'ms.freshnessAll()')
    expect(annotations.some(a => a.icon === '📋' && a.message.includes('143'))).toBe(true)
  })

  it('confirms all current when no stale', () => {
    const data = { total: 72, current: 72, stale: 0, pending: 0, untracked: 0 }
    const annotations = steer(data, 'ms.freshnessAll()')
    expect(annotations.some(a => a.icon === '✅' && a.message.includes('current'))).toBe(true)
  })

  it('does not fire for zero total', () => {
    const data = { total: 0, current: 0, stale: 0, pending: 0, untracked: 200 }
    const annotations = steer(data, 'ms.freshnessAll()')
    // Should still report untracked
    expect(annotations.some(a => a.icon === '📋')).toBe(true)
    // But no "all current" — nothing is tracked
    expect(annotations.some(a => a.icon === '✅')).toBe(false)
  })
})

// ─── FreshnessReport shape ───────────────────────────────

describe('steer: FreshnessReport shape', () => {
  it('reports stale documents', () => {
    const data = { skill: 'test', total: 5, current: 3, stale: 2, pending: 0, policies: [{ file: 'a.md', status: 'stale' }] }
    const annotations = steer(data, "ms.freshness('test')")
    expect(annotations.some(a => a.icon === '🔄' && a.message.includes('2 stale'))).toBe(true)
  })

  it('reports pending updates', () => {
    const data = { skill: 'test', total: 5, current: 4, stale: 0, pending: 1, policies: [] }
    const annotations = steer(data, "ms.freshness('test')")
    expect(annotations.some(a => a.icon === '⏳')).toBe(true)
  })

  it('confirms all current', () => {
    const data = { skill: 'test', total: 5, current: 5, stale: 0, pending: 0, policies: [] }
    const annotations = steer(data, "ms.freshness('test')")
    expect(annotations.some(a => a.icon === '✅' && a.message.includes('current'))).toBe(true)
  })
})

// ─── HealthReport shape ──────────────────────────────────

describe('steer: HealthReport shape', () => {
  it('suggests conformance on clean', () => {
    const data = { skill: 'good', clean: true, checks: [{ name: 'governance', pass: true }], summary: '10/10 CLEAN' }
    const annotations = steer(data, "ms.inspect('good')")
    expect(annotations.some(a => a.icon === '✅')).toBe(true)
    expect(annotations.some(a => a.icon === '📈' && a.command?.includes('conformance'))).toBe(true)
  })

  it('lists failing checks', () => {
    const data = { skill: 'bad', clean: false, checks: [{ name: 'governance', pass: false }, { name: 'changelog', pass: false }], summary: '8/10' }
    const annotations = steer(data, "ms.inspect('bad')")
    expect(annotations.some(a => a.icon === '❌' && a.message.includes('governance'))).toBe(true)
  })
})

// ─── Conformance shape ───────────────────────────────────

describe('steer: Conformance shape', () => {
  it('suggests inspect for low level', () => {
    const data = { level: 1, label: 'governed', type: 'reference', detail: ['no GRAPH.md'] }
    const annotations = steer(data, "ms.conformance('x')")
    expect(annotations.some(a => a.icon === '🔧' && a.command?.includes('inspect'))).toBe(true)
  })

  it('suggests GRAPH.md for level 2 reference', () => {
    const data = { level: 2, label: 'clean', type: 'reference', detail: [] }
    const annotations = steer(data, "ms.conformance('x')")
    expect(annotations.some(a => a.icon === '📈' && a.message.includes('GRAPH.md'))).toBe(true)
  })
})
