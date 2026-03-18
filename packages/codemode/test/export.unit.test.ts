/**
 * Export / Import / Profiles — unit tests.
 *
 * §1 Schema validation — Address, KeyGlob, ExportFormat, ImportMode, ProfileName
 * §2 Key-level filtering — keyMatchesGlob, parseAddress, buildAddress
 * §3 JSON export — full, glob, procedures, keys, keyGlob, named
 * §4 Import — merge, replace, key-filtered, named profiles
 * §5 Profiles — list, fromProfile export, since export, removeProfile
 * §6 Round-trip — export → import → export by profile
 * §7 Edge cases — empty store, bad format, schema-validated import
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as Effect from 'effect-v4/Effect'
import * as Layer from 'effect-v4/Layer'
import * as Schema from 'effect-v4/Schema'
import * as FS from 'effect-v4/FileSystem'
import { createStoreApi, type StoreApi } from '../src/store/api.js'
import { layer as sqliteNodeLayer } from '../src/adapters/sqlite-node.js'
import {
  Address, KeyGlob, ExportFormat, ImportMode, ProfileName,
  parseAddress, buildAddress, keyMatchesGlob,
} from '../src/store/export.js'

// ── In-memory FileSystem ─────────────────────────────────────────

function createMemoryFs() {
  const files: Record<string, string> = {}
  const impl = FS.make({
    access: (path) => files[path] !== undefined
      ? Effect.void
      : Effect.fail({ _tag: 'SystemError', reason: 'NotFound', module: 'FileSystem', method: 'access', message: `${path} not found` } as any),
    readFile: (path) => {
      const content = files[path]
      if (content === undefined) return Effect.fail({ _tag: 'SystemError', reason: 'NotFound', module: 'FileSystem', method: 'readFile', message: `${path} not found` } as any)
      return Effect.succeed(new TextEncoder().encode(content))
    },
    writeFile: (path, data) => Effect.sync(() => { files[path] = new TextDecoder().decode(data) }),
    stat: (path) => Effect.succeed({
      type: 'File' as const, size: FS.Size(files[path]?.length ?? 0),
      mtime: new Date(), atime: new Date(), birthtime: new Date(),
      dev: 0, ino: 0, mode: 0o644, nlink: 1, uid: 0, gid: 0, rdev: 0, blksize: 4096, blocks: 0,
    }),
    remove: (path) => Effect.sync(() => { delete files[path] }),
    makeDirectory: () => Effect.void,
    copyFile: (from, to) => Effect.sync(() => { files[to] = files[from] ?? '' }),
    readDirectory: () => Effect.succeed([]),
    rename: (from, to) => Effect.sync(() => { files[to] = files[from] ?? ''; delete files[from] }),
    truncate: () => Effect.void, chmod: () => Effect.void, chown: () => Effect.void,
    utimes: () => Effect.void, link: () => Effect.void, symlink: () => Effect.void,
    readLink: () => Effect.succeed(''), realPath: (p) => Effect.succeed(p),
    makeTempDirectory: () => Effect.succeed('/tmp/test'),
    makeTempFile: () => Effect.succeed('/tmp/test/file'),
    open: () => Effect.fail(new Error('ni')) as any,
    watch: () => { throw new Error('ni') },
  })
  return { layer: Layer.succeed(FS.FileSystem, impl), files }
}

let api: StoreApi
async function setup() {
  const memFs = createMemoryFs()
  api = createStoreApi(sqliteNodeLayer({ filename: ':memory:' }), memFs.layer)
  return memFs
}

// ═════════════════════════════════════════════════════════════════
// §1 Schema Validation
// ═════════════════════════════════════════════════════════════════

describe('§1 Schema validation', () => {
  it('Address — valid', () => {
    expect(() => Schema.decodeUnknownSync(Address)('effect.api/filesystem-v4')).not.toThrow()
    expect(() => Schema.decodeUnknownSync(Address)('_system.procedures/health-check')).not.toThrow()
    expect(() => Schema.decodeUnknownSync(Address)('dpa/intentions')).not.toThrow()
  })
  it('Address — rejects malformed', () => {
    expect(() => Schema.decodeUnknownSync(Address)('no-slash')).toThrow()
    expect(() => Schema.decodeUnknownSync(Address)('/leading')).toThrow()
    expect(() => Schema.decodeUnknownSync(Address)('trailing/')).toThrow()
    expect(() => Schema.decodeUnknownSync(Address)('')).toThrow()
  })
  it('KeyGlob — valid', () => {
    expect(() => Schema.decodeUnknownSync(KeyGlob)('*')).not.toThrow()
    expect(() => Schema.decodeUnknownSync(KeyGlob)('schema*')).not.toThrow()
    expect(() => Schema.decodeUnknownSync(KeyGlob)('*-v4')).not.toThrow()
  })
  it('KeyGlob — rejects invalid', () => {
    expect(() => Schema.decodeUnknownSync(KeyGlob)('')).toThrow()
    expect(() => Schema.decodeUnknownSync(KeyGlob)('has spaces')).toThrow()
  })
  it('ExportFormat — accepts valid', () => {
    expect(Schema.decodeUnknownSync(ExportFormat)('json')).toBe('json')
    expect(Schema.decodeUnknownSync(ExportFormat)('sqlite')).toBe('sqlite')
    expect(Schema.decodeUnknownSync(ExportFormat)('procedures')).toBe('procedures')
  })
  it('ExportFormat — rejects unknown', () => {
    expect(() => Schema.decodeUnknownSync(ExportFormat)('csv')).toThrow()
  })
  it('ImportMode — accepts valid', () => {
    expect(Schema.decodeUnknownSync(ImportMode)('merge')).toBe('merge')
    expect(Schema.decodeUnknownSync(ImportMode)('replace')).toBe('replace')
  })
  it('ImportMode — rejects unknown', () => {
    expect(() => Schema.decodeUnknownSync(ImportMode)('append')).toThrow()
  })
  it('ProfileName — valid kebab', () => {
    expect(() => Schema.decodeUnknownSync(ProfileName)('effect-knowledge')).not.toThrow()
    expect(() => Schema.decodeUnknownSync(ProfileName)('my-procs')).not.toThrow()
  })
  it('ProfileName — rejects invalid', () => {
    expect(() => Schema.decodeUnknownSync(ProfileName)('Has Spaces')).toThrow()
    expect(() => Schema.decodeUnknownSync(ProfileName)('UPPER')).toThrow()
    expect(() => Schema.decodeUnknownSync(ProfileName)('')).toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════
// §2 Key-level filtering
// ═════════════════════════════════════════════════════════════════

describe('§2 Key-level filtering', () => {
  it('parseAddress — splits on first slash', () => {
    expect(parseAddress('effect.api/filesystem-v4')).toEqual({ collection: 'effect.api', key: 'filesystem-v4' })
    expect(parseAddress('_system.procedures/health-check')).toEqual({ collection: '_system.procedures', key: 'health-check' })
  })
  it('parseAddress — null for malformed', () => {
    expect(parseAddress('no-slash')).toBeNull()
    expect(parseAddress('/leading')).toBeNull()
    expect(parseAddress('trailing/')).toBeNull()
  })
  it('buildAddress', () => {
    expect(buildAddress('effect.api', 'filesystem-v4')).toBe('effect.api/filesystem-v4')
  })
  it('keyMatchesGlob — trailing *', () => {
    expect(keyMatchesGlob('schema-v4', 'schema*')).toBe(true)
    expect(keyMatchesGlob('other', 'schema*')).toBe(false)
  })
  it('keyMatchesGlob — leading *', () => {
    expect(keyMatchesGlob('filesystem-v4', '*-v4')).toBe(true)
    expect(keyMatchesGlob('filesystem-v3', '*-v4')).toBe(false)
  })
  it('keyMatchesGlob — both *', () => {
    expect(keyMatchesGlob('some-schema-thing', '*schema*')).toBe(true)
    expect(keyMatchesGlob('no-match', '*schema*')).toBe(false)
  })
  it('keyMatchesGlob — exact + wildcard', () => {
    expect(keyMatchesGlob('exact', 'exact')).toBe(true)
    expect(keyMatchesGlob('anything', '*')).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════
// §3 JSON Export
// ═════════════════════════════════════════════════════════════════

describe('§3 JSON export', () => {
  let memFs: ReturnType<typeof createMemoryFs>
  beforeEach(async () => { memFs = await setup() })
  afterEach(async () => { await api.dispose() })

  it('exports full store', async () => {
    await api.put('research', 'findings', { topic: 'v4' }, ['research'])
    await api.put('notes', 'idea-1', { text: 'hello' }, ['note'])
    const m = await api.exportStore({ path: '/export.json' })
    expect(m.version).toBe(1)
    expect(m.objectCount).toBe(2)
    expect(m.collections).toContain('research')
    expect(JSON.parse(memFs.files['/export.json']).objects).toHaveLength(2)
  })

  it('exports filtered by collection glob', async () => {
    await api.put('effect.api', 'schemas', { v: 4 })
    await api.put('effect.patterns', 'service', { p: 1 })
    await api.put('notes', 'unrelated', { x: 1 })
    const m = await api.exportStore({ path: '/f.json', glob: 'effect.*' })
    expect(m.objectCount).toBe(2)
    expect(m.collections).not.toContain('notes')
  })

  it('exports procedures-only', async () => {
    await api.put('research', 'data', { x: 1 })
    await api.put('_system.procedures', 'my-proc', { name: 'myProc', code: '() => 42', version: 1 })
    const m = await api.exportStore({ path: '/p.json', format: 'procedures' })
    expect(m.objectCount).toBe(1)
    expect(m.collections).toEqual(['_system.procedures'])
  })

  it('exports specific keys by address', async () => {
    await api.put('effect.api', 'fs-v4', { fs: true })
    await api.put('effect.api', 'sql-v4', { sql: true })
    await api.put('dpa', 'intentions', { goals: ['x'] })
    const m = await api.exportStore({ path: '/c.json', keys: ['effect.api/fs-v4', 'dpa/intentions'] })
    expect(m.objectCount).toBe(2)
  })

  it('exports by keyGlob', async () => {
    await api.put('effect.api', 'schema-composites', { c: 1 })
    await api.put('effect.api', 'schema-validation', { v: 1 })
    await api.put('effect.api', 'filesystem-v4', { fs: 1 })
    const m = await api.exportStore({ path: '/k.json', keyGlob: 'schema*' })
    expect(m.objectCount).toBe(2)
    expect(m.objects.map(o => o.key)).not.toContain('filesystem-v4')
  })

  it('exports with profile name embedded in manifest', async () => {
    await api.put('research', 'data', { x: 1 })
    const m = await api.exportStore({ path: '/named.json', profile: 'my-knowledge' })
    expect(m.profile).toBe('my-knowledge')
    const parsed = JSON.parse(memFs.files['/named.json'])
    expect(parsed.profile).toBe('my-knowledge')
  })

  it('exports empty store as valid manifest', async () => {
    const m = await api.exportStore({ path: '/empty.json' })
    expect(m.objectCount).toBe(0)
    expect(m.objects).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════
// §4 Import
// ═════════════════════════════════════════════════════════════════

describe('§4 Import', () => {
  let memFs: ReturnType<typeof createMemoryFs>
  beforeEach(async () => { memFs = await setup() })
  afterEach(async () => { await api.dispose() })

  it('merge mode — upserts', async () => {
    await api.put('research', 'existing', { old: true })
    memFs.files['/i.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['research'], objectCount: 2,
      objects: [
        { collection: 'research', key: 'existing', data: { updated: true }, tags: [] },
        { collection: 'research', key: 'new-item', data: { fresh: true }, tags: [] },
      ],
    })
    const r = await api.importStore({ path: '/i.json' })
    expect(r.mode).toBe('merge')
    expect(r.objectsImported).toBe(2)
    expect((await api.get('research', 'existing') as any).updated).toBe(true)
  })

  it('replace mode — clears then loads', async () => {
    await api.put('research', 'doomed', { x: 1 })
    memFs.files['/r.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['research'], objectCount: 1,
      objects: [{ collection: 'research', key: 'survivor', data: { alive: true }, tags: [] }],
    })
    const r = await api.importStore({ path: '/r.json', mode: 'replace' })
    expect(r.collectionsCleared).toBe(1)
    expect(await api.get('research', 'doomed')).toBeNull()
    expect((await api.get('research', 'survivor') as any).alive).toBe(true)
  })

  it('key-filtered import — only matching keys loaded', async () => {
    memFs.files['/s.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['effect.api'], objectCount: 3,
      objects: [
        { collection: 'effect.api', key: 'fs-v4', data: { fs: true }, tags: [] },
        { collection: 'effect.api', key: 'sql-v4', data: { sql: true }, tags: [] },
        { collection: 'effect.api', key: 'unrelated', data: { x: 1 }, tags: [] },
      ],
    })
    const r = await api.importStore({ path: '/s.json', keys: ['effect.api/fs-v4'] })
    expect(r.objectsImported).toBe(1)
    expect(r.objectsSkipped).toBe(2)
    expect(await api.get('effect.api', 'fs-v4')).toBeTruthy()
    expect(await api.get('effect.api', 'sql-v4')).toBeNull()
  })

  it('named import — tags objects with _meta.profile', async () => {
    memFs.files['/p.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['research'], objectCount: 1,
      objects: [{ collection: 'research', key: 'data', data: { x: 1 }, tags: [] }],
    })
    const r = await api.importStore({ path: '/p.json', profile: 'my-profile' })
    expect(r.profile).toBe('my-profile')
    // Object should have _meta.profile
    const raw = await api.getRaw('research', 'data') as any
    expect(raw._meta.profile).toBe('my-profile')
  })

  it('named import — uses manifest.profile as fallback', async () => {
    memFs.files['/mp.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, profile: 'from-manifest', collections: ['research'], objectCount: 1,
      objects: [{ collection: 'research', key: 'item', data: { x: 1 }, tags: [] }],
    })
    const r = await api.importStore({ path: '/mp.json' })
    expect(r.profile).toBe('from-manifest')
    const raw = await api.getRaw('research', 'item') as any
    expect(raw._meta.profile).toBe('from-manifest')
  })

  it('explicit profile overrides manifest.profile', async () => {
    memFs.files['/o.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, profile: 'old-name', collections: ['research'], objectCount: 1,
      objects: [{ collection: 'research', key: 'item', data: { x: 1 }, tags: [] }],
    })
    const r = await api.importStore({ path: '/o.json', profile: 'new-name' })
    expect(r.profile).toBe('new-name')
  })

  it('anonymous import — no _meta.profile, no ledger entry', async () => {
    memFs.files['/a.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['research'], objectCount: 1,
      objects: [{ collection: 'research', key: 'anon', data: { val: 1 }, tags: [] }],
    })
    const r = await api.importStore({ path: '/a.json' })
    expect(r.profile).toBeNull()
    const raw = await api.getRaw('research', 'anon') as any
    expect(raw._meta).toBeUndefined()
    const profiles = await api.profiles()
    expect(profiles).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════
// §5 Profiles
// ═════════════════════════════════════════════════════════════════

describe('§5 Profiles', () => {
  let memFs: ReturnType<typeof createMemoryFs>
  beforeEach(async () => { memFs = await setup() })
  afterEach(async () => { await api.dispose() })

  it('listProfiles — returns applied profiles', async () => {
    // Apply two profiles
    memFs.files['/a.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['alpha'], objectCount: 1,
      objects: [{ collection: 'alpha', key: 'one', data: { v: 1 }, tags: [] }],
    })
    memFs.files['/b.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['beta'], objectCount: 2,
      objects: [
        { collection: 'beta', key: 'two', data: { v: 2 }, tags: [] },
        { collection: 'beta', key: 'three', data: { v: 3 }, tags: [] },
      ],
    })
    await api.importStore({ path: '/a.json', profile: 'profile-a' })
    await api.importStore({ path: '/b.json', profile: 'profile-b' })

    const profiles = await api.profiles()
    expect(profiles).toHaveLength(2)
    const a = profiles.find(p => p.name === 'profile-a')!
    expect(a.objectCount).toBe(1)
    expect(a.collectionsAffected).toEqual(['alpha'])
    const b = profiles.find(p => p.name === 'profile-b')!
    expect(b.objectCount).toBe(2)
  })

  it('removeProfile — deletes profile objects and ledger entry', async () => {
    memFs.files['/rm.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['research'], objectCount: 2,
      objects: [
        { collection: 'research', key: 'item-a', data: { a: 1 }, tags: [] },
        { collection: 'research', key: 'item-b', data: { b: 2 }, tags: [] },
      ],
    })
    await api.importStore({ path: '/rm.json', profile: 'doomed' })

    // Verify they exist
    expect(await api.get('research', 'item-a')).toBeTruthy()
    expect(await api.get('research', 'item-b')).toBeTruthy()

    // Unapply
    const result = await api.removeProfile('doomed')
    expect(result.removed).toBe(2)
    expect(result.collections).toEqual(['research'])

    // Objects gone
    expect(await api.get('research', 'item-a')).toBeNull()
    expect(await api.get('research', 'item-b')).toBeNull()

    // Profile gone from ledger
    const profiles = await api.profiles()
    expect(profiles.find(p => p.name === 'doomed')).toBeUndefined()
  })

  it('removeProfile — preserves objects overwritten after import', async () => {
    memFs.files['/ow.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['research'], objectCount: 1,
      objects: [{ collection: 'research', key: 'shared', data: { source: 'profile' }, tags: [] }],
    })
    await api.importStore({ path: '/ow.json', profile: 'will-overwrite' })

    // Overwrite the object manually (no profile tag)
    await api.put('research', 'shared', { source: 'manual', overwritten: true })

    // Unapply — should NOT delete because _meta.profile was wiped by the manual put
    const result = await api.removeProfile('will-overwrite')
    expect(result.removed).toBe(0) // object was overwritten, profile tag gone

    // Object still exists with manual data
    const data = await api.get('research', 'shared') as any
    expect(data.overwritten).toBe(true)
  })

  it('exportStore fromProfile — exports only that profile\'s objects', async () => {
    // Import a profile
    memFs.files['/fp.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['research'], objectCount: 1,
      objects: [{ collection: 'research', key: 'profiled', data: { from: 'profile' }, tags: [] }],
    })
    await api.importStore({ path: '/fp.json', profile: 'source-profile' })

    // Add non-profile data
    await api.put('research', 'manual', { from: 'manual' })

    // Export only profile's objects
    const m = await api.exportStore({ path: '/from-p.json', fromProfile: 'source-profile' })
    expect(m.objectCount).toBe(1)
    expect(m.objects[0].key).toBe('profiled')
  })

  it('exportStore since — exports objects newer than profile timestamp', async () => {
    // Import a profile (creates a timestamp)
    memFs.files['/since.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['research'], objectCount: 1,
      objects: [{ collection: 'research', key: 'before', data: { x: 1 }, tags: [] }],
    })
    await api.importStore({ path: '/since.json', profile: 'baseline' })

    // Small delay to ensure timestamp difference
    await new Promise(r => setTimeout(r, 50))

    // Add data after the profile
    await api.put('research', 'after', { y: 2 })

    const m = await api.exportStore({ path: '/diff.json', since: 'baseline' })
    // Should include 'after' but not 'before' (which was imported at the baseline timestamp)
    const keys = m.objects.map(o => o.key)
    expect(keys).toContain('after')
  })
})

// ═════════════════════════════════════════════════════════════════
// §6 Round-trip
// ═════════════════════════════════════════════════════════════════

describe('§6 Round-trip', () => {
  let memFs: ReturnType<typeof createMemoryFs>
  beforeEach(async () => { memFs = await setup() })
  afterEach(async () => { await api.dispose() })

  it('export → import → export by profile preserves data', async () => {
    await api.put('alpha', 'one', { val: 1, nested: { deep: true } }, ['tag1'])
    await api.put('beta', 'two', { val: 2 })

    // Export with profile name
    await api.exportStore({ path: '/rt.json', profile: 'snapshot-a' })

    // Clear
    await api.clear('alpha')
    await api.clear('beta')

    // Import as named profile
    const result = await api.importStore({ path: '/rt.json', profile: 'snapshot-a' })
    expect(result.objectsImported).toBe(2)
    expect(result.profile).toBe('snapshot-a')

    // Re-export by profile name
    const m = await api.exportStore({ path: '/rt2.json', fromProfile: 'snapshot-a' })
    expect(m.objectCount).toBe(2)

    // Data intact
    const one = await api.get('alpha', 'one') as any
    expect(one.val).toBe(1)
    expect(one.nested.deep).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════
// §7 Edge cases
// ═════════════════════════════════════════════════════════════════

describe('§7 Edge cases', () => {
  let memFs: ReturnType<typeof createMemoryFs>
  beforeEach(async () => { memFs = await setup() })
  afterEach(async () => { await api.dispose() })

  it('rejects invalid manifest via Schema decode', async () => {
    memFs.files['/bad.json'] = JSON.stringify({ version: 99, format: 'unknown', objects: [] })
    await expect(api.importStore({ path: '/bad.json' })).rejects.toThrow()
  })

  it('rejects sqlite format at service level', async () => {
    await expect(api.exportStore({ path: '/out.db', format: 'sqlite' })).rejects.toThrow('API layer')
  })

  it('removeProfile — fails for unknown profile', async () => {
    await expect(api.removeProfile('nonexistent')).rejects.toThrow('not found')
  })

  it('exportStore fromProfile — fails for unknown profile', async () => {
    await expect(api.exportStore({ path: '/x.json', fromProfile: 'nope' })).rejects.toThrow('not found')
  })
})

// ═════════════════════════════════════════════════════════════════
// §8 manifest field — profiles own their tool guide contribution
// ═════════════════════════════════════════════════════════════════

describe('§8 manifest field', () => {
  let memFs: ReturnType<typeof createMemoryFs>
  beforeEach(async () => { memFs = await setup() })
  afterEach(async () => { await api.dispose() })

  it('export embeds manifest in manifest file', async () => {
    await api.put('test', 'a', { val: 1 })
    const m = await api.exportStore({
      path: '/m.json',
      profile: 'effect-knowledge',
      manifest: 'Effect v4 API patterns and schema reference',
    })
    const raw = JSON.parse(memFs.files['/m.json'])
    expect(raw.manifest).toBe('Effect v4 API patterns and schema reference')
    expect(raw.profile).toBe('effect-knowledge')
  })

  it('import uses explicit manifest over file manifest', async () => {
    memFs.files['/fm.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, profile: 'from-file', manifest: 'File-level manifest',
      collections: ['test'], objectCount: 1,
      objects: [{ collection: 'test', key: 'a', data: { val: 1 }, tags: [] }],
    })
    await api.importStore({
      path: '/fm.json',
      profile: 'from-file',
      manifest: 'Override manifest entry',
    })
    const profiles = await api.profiles()
    const found = profiles.find(p => p.name === 'from-file')
    expect(found?.manifest).toBe('Override manifest entry')
  })

  it('import falls back to file manifest when no explicit manifest', async () => {
    memFs.files['/fb.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, profile: 'file-prof', manifest: 'From the file',
      collections: ['test'], objectCount: 1,
      objects: [{ collection: 'test', key: 'b', data: { val: 2 }, tags: [] }],
    })
    await api.importStore({ path: '/fb.json' })
    const profiles = await api.profiles()
    const found = profiles.find(p => p.name === 'file-prof')
    expect(found?.manifest).toBe('From the file')
  })

  it('auto-generates manifest for named profiles with no explicit manifest', async () => {
    memFs.files['/auto.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, collections: ['alpha', 'beta'], objectCount: 2,
      objects: [
        { collection: 'alpha', key: 'x', data: { a: 1 }, tags: [] },
        { collection: 'beta', key: 'y', data: { b: 2 }, tags: [] },
      ],
    })
    await api.importStore({ path: '/auto.json', profile: 'auto-prof' })
    const profiles = await api.profiles()
    const found = profiles.find(p => p.name === 'auto-prof')
    expect(found?.manifest).toContain('auto-prof')
    expect(found?.manifest).toContain('2 objects')
  })

  it('profiles() returns manifest for all entries', async () => {
    memFs.files['/p1.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, profile: 'prof-a', manifest: 'Profile A docs',
      collections: ['c'], objectCount: 1,
      objects: [{ collection: 'c', key: 'a', data: {}, tags: [] }],
    })
    memFs.files['/p2.json'] = JSON.stringify({
      version: 1, format: 'rlm-json', exportedAt: new Date().toISOString(),
      glob: null, profile: 'prof-b', manifest: 'Profile B docs',
      collections: ['c'], objectCount: 1,
      objects: [{ collection: 'c', key: 'b', data: {}, tags: [] }],
    })
    await api.importStore({ path: '/p1.json' })
    await api.importStore({ path: '/p2.json' })
    const profiles = await api.profiles()
    expect(profiles).toHaveLength(2)
    expect(profiles.map(p => p.manifest).sort()).toEqual(['Profile A docs', 'Profile B docs'])
  })
})
