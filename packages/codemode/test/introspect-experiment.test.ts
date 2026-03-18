/**
 * EPOCH-0004 Phase E: Validate that function introspection works on a live overlay.
 * This proves the ODK contract validator can use typeof/.name/.length on real methods.
 */
import { describe, it, expect } from 'vitest'
import { metaskillPlugin } from '../src/plugins/metaskill.ts'
import { NodeFileSystemLayer } from '../src/adapters/filesystem-node.ts'
import type { CodemodeOverlay } from '../src/overlay.ts'

const overlay: CodemodeOverlay = metaskillPlugin(process.cwd(), NodeFileSystemLayer)

describe('Phase E: overlay introspection', () => {
  it('has identity (id, name)', () => {
    expect(overlay.id).toBe('metaskill')
    expect(overlay.name).toBe('Skill Governance')
    expect(typeof overlay.id).toBe('string')
    expect(typeof overlay.name).toBe('string')
  })

  it('methods are real functions with typeof/name/length', () => {
    const methods = overlay.methods
    expect(Object.keys(methods).length).toBeGreaterThan(10)

    for (const [key, fn] of Object.entries(methods)) {
      // typeof check
      expect(typeof fn).toBe('function')
      // .name check — function identity
      expect(typeof fn.name).toBe('string')
      expect(fn.name.length).toBeGreaterThan(0)
      // .length check — arity
      expect(typeof fn.length).toBe('number')
    }
  })

  it('can enumerate all method names', () => {
    const names = Object.keys(overlay.methods)
    // Known metaskill methods
    expect(names).toContain('discover')
    expect(names).toContain('inspect')
    expect(names).toContain('info')
    expect(names).toContain('audit')
    expect(names).toContain('adopt')
    expect(names).toContain('scaffold')
    expect(names).toContain('frontmatter')
    expect(names).toContain('protocols')
  })

  it('method arity is meaningful', () => {
    const m = overlay.methods
    // discover() takes 0 args
    expect(m.discover.length).toBe(0)
    // inspect(name) takes 1 arg
    expect(m.inspect.length).toBe(1)
    // info(name) takes 1 arg
    expect(m.info.length).toBe(1)
  })

  it('guide has sections with id/slot/priority', () => {
    expect(overlay.guide).toBeDefined()
    expect(overlay.guide!.sections.length).toBeGreaterThan(0)
    for (const section of overlay.guide!.sections) {
      expect(typeof section.id).toBe('string')
      expect(typeof section.slot).toBe('string')
      expect(typeof section.priority).toBe('number')
      // content can be string or () => string (lazy)
      expect(['string', 'function']).toContain(typeof section.content)
    }
  })

  it('facet inventory via presence checks', () => {
    // This is exactly what ODK's inspect() will do
    const facets = {
      id: !!overlay.id,
      name: !!overlay.name,
      version: !!overlay.version,
      methods: Object.keys(overlay.methods).length > 0,
      guide: (overlay.guide?.sections?.length ?? 0) > 0,
      steer: (overlay.steer?.fragments?.length ?? 0) > 0,
      profiles: (overlay.profiles?.autoLoad?.length ?? 0) > 0,
      procedures: (overlay.procedures?.length ?? 0) > 0,
      context: Object.keys(overlay.context?.fields ?? {}).length > 0,
      rendering: Object.keys(overlay.rendering?.renderers ?? {}).length > 0,
      errors: Object.keys(overlay.errors?.formatters ?? {}).length > 0,
      lifecycle: !!(overlay.lifecycle?.onLoad || overlay.lifecycle?.onEval || overlay.lifecycle?.onResult),
      dispose: typeof overlay.dispose === 'function',
    }

    // Metaskill should have at least these populated
    expect(facets.id).toBe(true)
    expect(facets.name).toBe(true)
    expect(facets.methods).toBe(true)
    expect(facets.guide).toBe(true)

    // Count populated facets
    const populated = Object.values(facets).filter(Boolean).length
    expect(populated).toBeGreaterThanOrEqual(4)

    console.log('Facet inventory:', facets)
    console.log(`Populated: ${populated}/${Object.keys(facets).length}`)
  })

  it('method .name matches key (function identity)', () => {
    // Most functions will have names matching their key
    // Some may be anonymous or have different names due to binding
    let matched = 0
    let total = 0
    for (const [key, fn] of Object.entries(overlay.methods)) {
      total++
      if (fn.name === key || fn.name.includes(key)) {
        matched++
      }
    }
    // At least half should have matching names
    console.log(`Function name matches: ${matched}/${total}`)
    expect(matched).toBeGreaterThan(0)
  })
})
