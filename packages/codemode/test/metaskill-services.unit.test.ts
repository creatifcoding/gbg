/**
 * @module test/metaskill-services.unit
 *
 * Tests for the Effect v4 ServiceMap.Service decomposition.
 * Validates each service independently + composed layer.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import {
  makeMetaskillLayer,
  makeSkillConfigLayer,
  SkillConfig,
  SkillDiscovery, SkillDiscoveryLive,
  SkillInspector,
  FrontmatterService,
  ProtocolService,
  UtilService,
  SkillMutations,
  FreshnessService,
  profile, each, where,
} from '../src/plugins/metaskill-services/index.js'
import { NodeFileSystemLayer } from './_node-fs-layer.js'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ── Test Fixtures ────────────────────────────────────────────────

function setupTestWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ms-svc-test-'))
  const skillsDir = join(dir, '.pi', 'skills')

  // Create a governed skill
  const alphaDir = join(skillsDir, 'alpha')
  mkdirSync(alphaDir, { recursive: true })
  writeFileSync(join(alphaDir, 'SKILL.md'), [
    '---',
    'governed-by: metaskill',
    'description: Alpha skill',
    'update-strategy: manual',
    'update-trigger: content-change',
    'update-status: current',
    '---',
    '',
    '# alpha',
    '',
    'Test skill.',
  ].join('\n'))
  writeFileSync(join(alphaDir, 'CHANGELOG.md'), [
    '---',
    'up: SKILL.md',
    '---',
    '',
    '# alpha Changelog',
    '',
    '## 2025-01-01',
    '- Initial',
  ].join('\n'))

  // Create an ungoverned skill
  const betaDir = join(skillsDir, 'beta')
  mkdirSync(betaDir, { recursive: true })
  writeFileSync(join(betaDir, 'SKILL.md'), [
    '# beta',
    '',
    'Ungoverned skill.',
  ].join('\n'))

  // Create metaskill dir with protocols
  const msDir = join(skillsDir, 'metaskill')
  mkdirSync(msDir, { recursive: true })
  writeFileSync(join(msDir, 'SKILL.md'), [
    '---',
    'governed-by: metaskill',
    '---',
    '',
    '# metaskill',
    '',
    '## § skill:inspect',
    '',
    'Run ms.inspect(name) for a full health check.',
    '',
    '## § skill:update',
    '',
    'Update a skill document.',
  ].join('\n'))

  return dir
}

// ── Tests ────────────────────────────────────────────────────────

describe('Metaskill Effect v4 Services', () => {
  let tmpDir: string
  let runtime: ReturnType<typeof ManagedRuntime.make>

  beforeAll(() => {
    tmpDir = setupTestWorkspace()
    const layer = makeMetaskillLayer(tmpDir).pipe(
      Layer.provide(NodeFileSystemLayer),
    )
    runtime = ManagedRuntime.make(layer)
  })

  afterAll(async () => {
    await runtime.dispose()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  const run = <A>(effect: Effect.Effect<A, any, any>) => runtime.runPromise(effect)

  // ── SkillConfig ────────────────────────────────────────

  describe('SkillConfig', () => {
    it('provides resolved paths', async () => {
      const config = await run(Effect.gen(function*() {
        return yield* SkillConfig
      }))
      expect(config.cwd).toBe(tmpDir)
      expect(config.skillsDir).toContain('.pi/skills')
    })
  })

  // ── SkillDiscovery ─────────────────────────────────────

  describe('SkillDiscovery', () => {
    it('discovers skills sorted alphabetically', async () => {
      const skills = await run(Effect.gen(function*() {
        const svc = yield* SkillDiscovery
        return yield* svc.discover
      }))
      expect(skills.length).toBe(3) // alpha, beta, metaskill
      expect(skills[0].name).toBe('alpha')
      expect(skills[1].name).toBe('beta')
      expect(skills[2].name).toBe('metaskill')
    })

    it('classifies governed vs ungoverned', async () => {
      const skills = await run(Effect.gen(function*() {
        const svc = yield* SkillDiscovery
        return yield* svc.discover
      }))
      expect(skills.find(s => s.name === 'alpha')!.governed).toBe(true)
      expect(skills.find(s => s.name === 'beta')!.governed).toBe(false)
    })

    it('info returns single skill', async () => {
      const skill = await run(Effect.gen(function*() {
        const svc = yield* SkillDiscovery
        return yield* svc.info('alpha')
      }))
      expect(skill.name).toBe('alpha')
      expect(skill.governed).toBe(true)
      expect(skill.hasChangelog).toBe(true)
    })
  })

  // ── SkillInspector ─────────────────────────────────────

  describe('SkillInspector', () => {
    it('inspect returns health report', async () => {
      const report = await run(Effect.gen(function*() {
        const svc = yield* SkillInspector
        return yield* svc.inspect('alpha')
      }))
      expect(report.skill).toBe('alpha')
      expect(report.checks.length).toBeGreaterThan(0)
      expect(report.checks.find(c => c.name === 'governance')!.pass).toBe(true)
    })

    it('audit returns workspace rows', async () => {
      const rows = await run(Effect.gen(function*() {
        const svc = yield* SkillInspector
        return yield* svc.audit
      }))
      expect(rows.length).toBe(3)
      expect(rows.find(r => r.name === 'alpha')!.governed).toBe(true)
    })

    it('conformance returns level', async () => {
      const result = await run(Effect.gen(function*() {
        const svc = yield* SkillInspector
        return yield* svc.conformance('alpha')
      }))
      expect(result.name).toBe('alpha')
      expect(result.level).toBeGreaterThanOrEqual(0)
    })

    it('conformanceAudit returns all skills', async () => {
      const results = await run(Effect.gen(function*() {
        const svc = yield* SkillInspector
        return yield* svc.conformanceAudit
      }))
      expect(results.length).toBe(3)
    })
  })

  // ── ProtocolService ────────────────────────────────────

  describe('ProtocolService', () => {
    it('lists protocols from SKILL.md', async () => {
      const keys = await run(Effect.gen(function*() {
        const svc = yield* ProtocolService
        return yield* svc.protocols
      }))
      expect(keys).toContain('§ skill:inspect')
      expect(keys).toContain('§ skill:update')
    })

    it('retrieves protocol body', async () => {
      const body = await run(Effect.gen(function*() {
        const svc = yield* ProtocolService
        return yield* svc.protocol('§ skill:inspect')
      }))
      expect(body).toContain('ms.inspect')
    })
  })

  // ── FrontmatterService ─────────────────────────────────

  describe('FrontmatterService', () => {
    it('reads frontmatter from skill docs', async () => {
      const fm = await run(Effect.gen(function*() {
        const svc = yield* FrontmatterService
        return yield* svc.frontmatter('alpha')
      }))
      expect(fm['SKILL.md']).toBeDefined()
      expect(fm['SKILL.md']['governed-by']).toBe('metaskill')
    })
  })

  // ── SkillMutations ─────────────────────────────────────

  describe('SkillMutations', () => {
    it('scaffold creates new skill', async () => {
      const files = await run(Effect.gen(function*() {
        const svc = yield* SkillMutations
        return yield* svc.scaffold('gamma', { refs: true })
      }))
      expect(files).toContain('SKILL.md')
      expect(files).toContain('CHANGELOG.md')
      expect(files).toContain('references/INDEX.md')
    })

    it('adopt adds governance to ungoverned skill', async () => {
      const result = await run(Effect.gen(function*() {
        const svc = yield* SkillMutations
        return yield* svc.adopt('beta')
      }))
      expect(result).toContain('governance')

      // Verify it's now governed
      const skill = await run(Effect.gen(function*() {
        const svc = yield* SkillDiscovery
        return yield* svc.info('beta')
      }))
      expect(skill.governed).toBe(true)
    })
  })

  // ── FreshnessService ───────────────────────────────────

  describe('FreshnessService', () => {
    it('returns freshness report for a skill', async () => {
      const report = await run(Effect.gen(function*() {
        const svc = yield* FreshnessService
        return yield* svc.freshness('alpha')
      }))
      expect(report.skill).toBe('alpha')
      expect(report.total).toBeGreaterThanOrEqual(0)
    })

    it('freshnessAll aggregates across all skills', async () => {
      const result = await run(Effect.gen(function*() {
        const svc = yield* FreshnessService
        return yield* svc.freshnessAll
      }))
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('current')
      expect(result).toHaveProperty('stale')
      expect(result).toHaveProperty('untracked')
    })
  })

  // ── Composed Helpers ───────────────────────────────────

  describe('Composed Helpers', () => {
    it('profile combines inspect + conformance + freshness', async () => {
      const result = await run(profile('alpha'))
      expect(result.name).toBe('alpha')
      expect(result).toHaveProperty('health')
      expect(result).toHaveProperty('level')
      expect(result).toHaveProperty('label')
      expect(result).toHaveProperty('stale')
      expect(result).toHaveProperty('clean')
    })

    it('each maps over all skills', async () => {
      const names = await run(each(s => s.name))
      expect(names.length).toBeGreaterThanOrEqual(3)
      expect(names).toContain('alpha')
    })

    it('where filters + maps', async () => {
      const governed = await run(where(s => s.governed, s => s.name))
      expect(governed).toContain('alpha')
      // beta was adopted above, so it should also be governed now
    })
  })
})
