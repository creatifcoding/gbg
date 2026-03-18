/**
 * @module test/metaskill-plugin.unit
 *
 * Tests for the metaskill domain plugin.
 * Validates method extraction, plugin shape, and manifest section.
 */

import { describe, it, expect, afterAll } from 'vitest'
import { metaskillPlugin } from '../src/plugins/metaskill.js'
import { NodeFileSystemLayer } from './_node-fs-layer.js'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Set up a minimal workspace so discovery doesn't error
const cwd = mkdtempSync(join(tmpdir(), 'metaskill-plugin-test-'))
const skillsDir = join(cwd, '.pi', 'skills', 'test-skill')
mkdirSync(skillsDir, { recursive: true })
writeFileSync(join(skillsDir, 'SKILL.md'), '---\ngoverned-by: metaskill\n---\n# test-skill\n')

afterAll(() => rmSync(cwd, { recursive: true, force: true }))

describe('metaskillPlugin', () => {
  const plugin = metaskillPlugin(cwd, NodeFileSystemLayer)

  it('has correct id and name', () => {
    expect(plugin.id).toBe('metaskill')
    expect(plugin.name).toBe('Skill Governance')
  })

  it('exposes 21 domain methods', () => {
    const methods = Object.keys(plugin.methods)
    expect(methods).toHaveLength(21)
  })

  it('includes all discovery methods', () => {
    expect(plugin.methods.discover).toBeDefined()
    expect(plugin.methods.info).toBeDefined()
  })

  it('includes all inspection methods', () => {
    expect(plugin.methods.inspect).toBeDefined()
    expect(plugin.methods.audit).toBeDefined()
    expect(plugin.methods.conformance).toBeDefined()
    expect(plugin.methods.conformanceAudit).toBeDefined()
  })

  it('includes all freshness methods', () => {
    expect(plugin.methods.freshness).toBeDefined()
    expect(plugin.methods.setUpdateStatus).toBeDefined()
    expect(plugin.methods.freshnessAll).toBeDefined()
    expect(plugin.methods.staleAll).toBeDefined()
  })

  it('includes all composed methods', () => {
    expect(plugin.methods.profile).toBeDefined()
    expect(plugin.methods.each).toBeDefined()
    expect(plugin.methods.where).toBeDefined()
  })

  it('includes all frontmatter methods', () => {
    expect(plugin.methods.frontmatter).toBeDefined()
    expect(plugin.methods.setFrontmatter).toBeDefined()
  })

  it('includes all protocol methods', () => {
    expect(plugin.methods.protocol).toBeDefined()
    expect(plugin.methods.protocols).toBeDefined()
  })

  it('includes all util methods', () => {
    expect(plugin.methods.utils).toBeDefined()
    expect(plugin.methods.runUtil).toBeDefined()
  })

  it('includes all mutation methods', () => {
    expect(plugin.methods.adopt).toBeDefined()
    expect(plugin.methods.scaffold).toBeDefined()
  })

  it('does NOT expose read/write/sh (those are core primitives)', () => {
    expect(plugin.methods.read).toBeUndefined()
    expect(plugin.methods.write).toBeUndefined()
    expect(plugin.methods.sh).toBeUndefined()
  })

  it('has guide sections', () => {
    expect(plugin.guide).toBeDefined()
    expect(plugin.guide!.sections).toHaveLength(1)
    expect(plugin.guide!.sections[0].id).toBe('metaskill-ops')
    expect(plugin.guide!.sections[0].slot).toBe('api')
  })

  it('guide content includes all method groups', () => {
    const section = plugin.guide!.sections[0]
    const content = typeof section.content === 'function'
      ? section.content()
      : section.content
    const text = typeof content === 'string' ? content : String(content)

    expect(text).toContain('cm.discover()')
    expect(text).toContain('cm.inspect(')
    expect(text).toContain('cm.conformance(')
    expect(text).toContain('cm.freshness(')
    expect(text).toContain('cm.profile(')
    expect(text).toContain('cm.frontmatter(')
    expect(text).toContain('cm.protocol(')
    expect(text).toContain('cm.utils()')
    expect(text).toContain('cm.adopt(')
    expect(text).toContain('cm.scaffold(')
  })

  it('methods are callable functions', () => {
    for (const [name, fn] of Object.entries(plugin.methods)) {
      expect(typeof fn).toBe('function', `${name} should be a function`)
    }
  })

  it('discover returns an array (async, Effect-backed)', async () => {
    const result = await plugin.methods.discover()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(1) // we created test-skill
    expect(result[0].name).toBe('test-skill')
  })

  it('has dispose hook', () => {
    expect(plugin.dispose).toBeDefined()
    expect(typeof plugin.dispose).toBe('function')
  })
})
