/**
 * Manifest Coverage — bidirectional enforcement between API surface and guide.
 *
 * Direction 1: API → Manifest
 *   Every method in API_SURFACE must appear in the compiled manifest.
 *   Add a new ms.foo() but forget to document it → this test fails.
 *
 * Direction 2: Manifest → API
 *   Every `ms.xxx(` pattern in the compiled guide must map to a declared method.
 *   Remove ms.foo() but leave it in the guide → this test fails.
 *
 * Direction 3: API ↔ index.ts sandbox
 *   Every method in API_SURFACE must actually be wired on the ms object in index.ts.
 *   Declare a method in the surface but forget to wire it → this test fails.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ToolManifest } from '../../../../.pi/extensions/metaskill/manifest.ts'
import { ALL_SECTIONS } from '../../../../.pi/extensions/metaskill/manifest-sections.ts'
import { API_SURFACE, API_METHOD_NAMES } from '../../../../.pi/extensions/metaskill/api-surface.ts'

// ── Helpers ──────────────────────────────────────────────

/** Compile a full manifest from all built-in sections */
function compileFullManifest(): string {
  const m = new ToolManifest()
  for (const s of ALL_SECTIONS) m.register(s)
  return m.compile()
}

/** Extract all `ms.xxx` method references from text */
function extractMsReferences(text: string): Set<string> {
  const refs = new Set<string>()
  // Match ms.xxx( or ms.xxx) or ms.xxx → or ms.xxx — or ms.xxx, or ms.xxx\n or ms.xxx(space)
  const pattern = /ms\.([a-zA-Z_][a-zA-Z0-9_]*)/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    refs.add(match[1])
  }
  return refs
}

/** Read the ms sandbox object literal from index.ts */
function readSandboxWiring(): Set<string> {
  const extRoot = join(__dirname, '..', '..', '..', '..', '.pi', 'extensions', 'metaskill')
  const indexSrc = readFileSync(join(extRoot, 'index.ts'), 'utf-8')
  const evalChildPath = join(extRoot, 'eval-child.ts')
  const evalChildSrc = existsSync(evalChildPath) ? readFileSync(evalChildPath, 'utf-8') : ''
  const sandboxSrc = `${indexSrc}\n${evalChildSrc}`

  // Find the ms object literal: `const ms = { ... }`
  // Extract property names (keys before colons). The sandbox may live in
  // index.ts or in eval-child.ts when evaluation is isolated off the pi host.
  const msStart = sandboxSrc.indexOf('const ms = {')
  if (msStart === -1) throw new Error('Could not find `const ms = {` in metaskill sandbox sources')

  // Find matching closing brace
  let depth = 0
  let i = sandboxSrc.indexOf('{', msStart)
  const start = i
  for (; i < sandboxSrc.length; i++) {
    if (sandboxSrc[i] === '{') depth++
    if (sandboxSrc[i] === '}') depth--
    if (depth === 0) break
  }
  const block = sandboxSrc.slice(start, i + 1)

  // Extract top-level property names
  const wired = new Set<string>()
  const propPattern = /^\s+(?:get\s+)?([a-zA-Z_][a-zA-Z0-9_]*)[\s:]/gm
  let propMatch
  while ((propMatch = propPattern.exec(block)) !== null) {
    wired.add(propMatch[1])
  }

  // Filter out non-API noise (comments parsed as code, etc.)
  // Keep only things that look like real property names
  return wired
}

// ── Tests ────────────────────────────────────────────────

describe('Manifest Coverage: API → Manifest', () => {
  const compiled = compileFullManifest()

  it('every API method is mentioned in the compiled guide', () => {
    const missing: string[] = []
    for (const method of API_SURFACE) {
      // Check for ms.methodName in the compiled text
      if (!compiled.includes(`ms.${method.name}`)) {
        missing.push(`ms.${method.name} (section: ${method.section})`)
      }
    }
    expect(missing, `Undocumented API methods:\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('every section referenced by API_SURFACE exists in ALL_SECTIONS', () => {
    const sectionIds = new Set(ALL_SECTIONS.map(s => s.id))
    const missing: string[] = []
    for (const method of API_SURFACE) {
      if (!sectionIds.has(method.section)) {
        missing.push(`ms.${method.name} references section "${method.section}" which doesn't exist`)
      }
    }
    expect(missing, `Orphan section refs:\n  ${missing.join('\n  ')}`).toEqual([])
  })
})

describe('Manifest Coverage: Manifest → API', () => {
  const compiled = compileFullManifest()
  const guideRefs = extractMsReferences(compiled)

  // Some ms.xxx references are examples, not actual API methods.
  // These are allowed in the guide without being in API_SURFACE.
  const EXAMPLE_REFS = new Set([
    // Chained calls on return values (not direct ms methods)
    'profile', // ms.profile is in API but also used as example pattern
  ])

  it('every ms.xxx in the guide maps to a declared API method', () => {
    const undeclared: string[] = []
    for (const ref of guideRefs) {
      if (!API_METHOD_NAMES.has(ref) && !EXAMPLE_REFS.has(ref)) {
        undeclared.push(`ms.${ref}`)
      }
    }
    expect(undeclared, `Guide mentions undeclared methods:\n  ${undeclared.join('\n  ')}`).toEqual([])
  })
})

describe('Manifest Coverage: API ↔ index.ts wiring', () => {
  const wired = readSandboxWiring()

  it('every API_SURFACE method is wired on the ms object in index.ts', () => {
    const unwired: string[] = []
    for (const method of API_SURFACE) {
      if (!wired.has(method.name)) {
        unwired.push(`ms.${method.name} (source: ${method.source})`)
      }
    }
    expect(unwired, `Declared but not wired:\n  ${unwired.join('\n  ')}`).toEqual([])
  })

  it('every wired method on ms object is declared in API_SURFACE', () => {
    // Some internal properties are fine to skip
    const INTERNAL = new Set(['context']) // getter, handled specially
    const undeclared: string[] = []
    for (const name of wired) {
      if (!API_METHOD_NAMES.has(name) && !INTERNAL.has(name)) {
        undeclared.push(`ms.${name}`)
      }
    }
    expect(undeclared, `Wired but not declared in API_SURFACE:\n  ${undeclared.join('\n  ')}`).toEqual([])
  })
})

describe('Manifest Coverage: structural', () => {
  it('every slot has at least one section', () => {
    const m = new ToolManifest()
    for (const s of ALL_SECTIONS) m.register(s)
    const inv = m.inventory()
    for (const [slot, sections] of Object.entries(inv)) {
      expect(sections.length, `Slot "${slot}" is empty`).toBeGreaterThan(0)
    }
  })

  it('no duplicate section IDs in ALL_SECTIONS', () => {
    const ids = ALL_SECTIONS.map(s => s.id)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dupes, `Duplicate section IDs: ${dupes.join(', ')}`).toEqual([])
  })

  it('API_SURFACE has no duplicate method names', () => {
    const names = API_SURFACE.map(m => m.name)
    const dupes = names.filter((n, i) => names.indexOf(n) !== i)
    expect(dupes, `Duplicate API methods: ${dupes.join(', ')}`).toEqual([])
  })
})
