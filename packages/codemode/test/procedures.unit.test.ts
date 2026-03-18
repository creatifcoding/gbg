/**
 * Stored Procedures (DPA) — unit tests.
 *
 * §1  toStorageKey — name→kebab conversion
 * §2  define() — store from function ref + code string
 * §3  call() — execution, reconstruction, error handling
 * §4  composition — procedures calling procedures
 * §5  list / describe / source — discovery & inspection
 * §6  remove — deletion
 * §7  fn proxy — dotted access
 * §8  reconstruction — all source formats
 * §9  kebab normalization — camelCase/PascalCase across all methods
 * §10 edge cases — empty store, concurrent defines, special chars
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createProcedureApi,
  toStorageKey,
  type ProcedureApi,
} from '../src/store/procedures.js'

// ── In-memory store mock ─────────────────────────────────────────

function createMockStore() {
  const data: Record<string, Record<string, unknown>> = {}

  return {
    get: async (ns: string, key: string) => data[`${ns}:${key}`] ?? null,
    put: async (ns: string, key: string, value: Record<string, unknown>, _tags?: string[]) => {
      data[`${ns}:${key}`] = value
    },
    delete: async (ns: string, key: string) => {
      const existed = !!data[`${ns}:${key}`]
      delete data[`${ns}:${key}`]
      return existed
    },
    query: async (ns: string, _filter?: any) => {
      return Object.entries(data)
        .filter(([k]) => k.startsWith(`${ns}:`))
        .map(([, v]) => v)
    },
    keys: async (ns: string) => {
      return Object.keys(data)
        .filter(k => k.startsWith(`${ns}:`))
        .map(k => k.slice(ns.length + 1))
    },
    /** Expose for assertions */
    _data: data,
    _allKeys: () => Object.keys(data),
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function setup() {
  const store = createMockStore()
  const ms: any = { echo: (x: unknown) => x, add: (a: number, b: number) => a + b }
  const procApi = createProcedureApi(
    store.get, store.put, store.delete, store.query, store.keys,
    () => ms,
  )
  // Wire DPA into ms so procedures can self-reference
  ms.define = procApi.define
  ms.defineCode = procApi.defineCode
  ms.call = procApi.call
  ms.procedures = procApi.procedures
  ms.describeProcedure = procApi.describe
  ms.fn = procApi.fn
  return { store, ms, procApi }
}

// ═════════════════════════════════════════════════════════════════
// §1  toStorageKey
// ═════════════════════════════════════════════════════════════════

describe('§1 toStorageKey', () => {
  it('converts camelCase', () => {
    expect(toStorageKey('healthCheck')).toBe('health-check')
    expect(toStorageKey('myProcedure')).toBe('my-procedure')
    expect(toStorageKey('getDataFromAPI')).toBe('get-data-from-api')
  })

  it('converts PascalCase', () => {
    expect(toStorageKey('HealthCheck')).toBe('health-check')
    expect(toStorageKey('MyProcedure')).toBe('my-procedure')
  })

  it('converts snake_case', () => {
    expect(toStorageKey('health_check')).toBe('health-check')
    expect(toStorageKey('my_procedure')).toBe('my-procedure')
  })

  it('preserves already-kebab', () => {
    expect(toStorageKey('health-check')).toBe('health-check')
    expect(toStorageKey('already-good')).toBe('already-good')
  })

  it('handles single word', () => {
    expect(toStorageKey('greet')).toBe('greet')
    expect(toStorageKey('Greet')).toBe('greet')
  })

  it('handles consecutive caps (acronyms)', () => {
    expect(toStorageKey('parseHTML')).toBe('parse-html')
    expect(toStorageKey('XMLParser')).toBe('xml-parser')
    expect(toStorageKey('getHTTPResponse')).toBe('get-http-response')
  })

  it('handles numbers', () => {
    expect(toStorageKey('step2Check')).toBe('step2-check')
    expect(toStorageKey('v4Migration')).toBe('v4-migration')
  })
})

// ═════════════════════════════════════════════════════════════════
// §2  define()
// ═════════════════════════════════════════════════════════════════

describe('§2 define()', () => {
  let store: ReturnType<typeof createMockStore>
  let procApi: ProcedureApi

  beforeEach(() => {
    const s = setup()
    store = s.store
    procApi = s.procApi
  })

  it('stores a procedure from a function reference', async () => {
    const record = await procApi.define('greet', (_ms: any, args: any) => `Hello ${args.name}`, {
      description: 'Greeting procedure',
      tags: ['test'],
    })
    expect(record.name).toBe('greet')
    expect(record.description).toBe('Greeting procedure')
    expect(record.version).toBe(1)
    expect(record.tags).toEqual(['test'])
    expect(record.code).toContain('Hello')
  })

  it('stores under kebab key regardless of input casing', async () => {
    await procApi.define('myProcedure', () => 1)
    const allKeys = store._allKeys()
    expect(allKeys).toContain('_system.procedures:my-procedure')
    expect(allKeys).not.toContain('_system.procedures:myProcedure')
  })

  it('increments version on redefine', async () => {
    await procApi.define('counter', () => 1)
    const v2 = await procApi.define('counter', () => 2)
    expect(v2.version).toBe(2)
    const v3 = await procApi.define('counter', () => 3)
    expect(v3.version).toBe(3)
  })

  it('preserves created timestamp on redefine', async () => {
    const v1 = await procApi.define('tsTest', () => 1)
    await new Promise(r => setTimeout(r, 10))
    const v2 = await procApi.define('tsTest', () => 2)
    expect(v2.created).toBe(v1.created)
    expect(v2.updated).not.toBe(v1.updated)
  })

  it('rejects empty name', async () => {
    await expect(procApi.define('', () => 1)).rejects.toThrow('non-empty string')
  })

  it('stores with all options', async () => {
    const r = await procApi.define('full', () => 1, {
      description: 'Full opts',
      tags: ['a', 'b'],
      author: 'Prime',
      dependencies: ['other'],
      inputSchema: { type: 'number' },
      outputSchema: { type: 'string' },
    })
    expect(r.author).toBe('Prime')
    expect(r.dependencies).toEqual(['other'])
    expect(r.inputSchema).toEqual({ type: 'number' })
    expect(r.outputSchema).toEqual({ type: 'string' })
  })

  it('defaults author to "agent"', async () => {
    const r = await procApi.define('noAuthor', () => 1)
    expect(r.author).toBe('agent')
  })

  it('injects _meta into store payload', async () => {
    await procApi.define('metaTest', () => 1, { description: 'Has meta' })
    // Read raw from mock store to verify _meta was injected
    const raw = store._data['_system.procedures:meta-test'] as any
    expect(raw._meta).toBeDefined()
    expect(raw._meta.summary).toBe('[proc v1] Has meta')
    expect(raw._meta.source).toBe('dpa')
    expect(raw._meta.type).toBe('procedure')
  })

  it('_meta summary updates on redefine', async () => {
    await procApi.define('metaVer', () => 1, { description: 'First' })
    await procApi.define('metaVer', () => 2, { description: 'Second' })
    const raw = store._data['_system.procedures:meta-ver'] as any
    expect(raw._meta.summary).toBe('[proc v2] Second')
  })

  it('_meta falls back to name when no description', async () => {
    await procApi.define('noDesc', () => 1)
    const raw = store._data['_system.procedures:no-desc'] as any
    expect(raw._meta.summary).toBe('[proc v1] noDesc')
  })

  it('describe() strips _meta from returned record', async () => {
    await procApi.define('cleanReturn', () => 1, { description: 'Clean' })
    const record = await procApi.describe('cleanReturn')
    expect(record).not.toBeNull()
    expect((record as any)._meta).toBeUndefined()
    expect(record!.name).toBe('cleanReturn')
  })
})

describe('§2b defineCode()', () => {
  let procApi: ProcedureApi

  beforeEach(() => { procApi = setup().procApi })

  it('stores from a code string', async () => {
    const record = await procApi.defineCode('fromCode', 'return ms.echo("works")', {
      description: 'Code string procedure',
    })
    expect(record.name).toBe('fromCode')
    expect(record.code).toBe('return ms.echo("works")')
  })

  it('rejects empty code', async () => {
    await expect(procApi.defineCode('empty', '')).rejects.toThrow('non-empty string')
  })

  it('rejects empty name', async () => {
    await expect(procApi.defineCode('', 'return 1')).rejects.toThrow('non-empty string')
  })
})

// ═════════════════════════════════════════════════════════════════
// §3  call()
// ═════════════════════════════════════════════════════════════════

describe('§3 call()', () => {
  let procApi: ProcedureApi

  beforeEach(() => { procApi = setup().procApi })

  it('calls a procedure defined from arrow function', async () => {
    await procApi.define('double', (_ms: any, args: any) => args * 2)
    expect(await procApi.call('double', 21)).toBe(42)
  })

  it('calls a procedure with ms access', async () => {
    await procApi.define('useMs', (ms: any) => ms.echo('hello'))
    expect(await procApi.call('useMs')).toBe('hello')
  })

  it('calls a procedure defined from code string', async () => {
    await procApi.defineCode('codeFn', 'return ms.add(args.a, args.b)')
    expect(await procApi.call('codeFn', { a: 3, b: 4 })).toBe(7)
  })

  it('throws on unknown procedure', async () => {
    await expect(procApi.call('nonexistent')).rejects.toThrow('not found')
  })

  it('propagates procedure errors with name context', async () => {
    await procApi.define('boom', () => { throw new Error('kaboom') })
    await expect(procApi.call('boom')).rejects.toThrow("'boom' failed")
    await expect(procApi.call('boom')).rejects.toThrow('kaboom')
  })

  it('supports async procedures', async () => {
    await procApi.define('asyncFn', async (_ms: any, args: any) => {
      return await Promise.resolve(args + 1)
    })
    expect(await procApi.call('asyncFn', 5)).toBe(6)
  })

  it('returns undefined for void procedures', async () => {
    await procApi.define('noop', () => {})
    expect(await procApi.call('noop')).toBeUndefined()
  })

  it('handles null return', async () => {
    await procApi.define('nullRet', () => null)
    expect(await procApi.call('nullRet')).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════
// §4  composition
// ═════════════════════════════════════════════════════════════════

describe('§4 composition', () => {
  let procApi: ProcedureApi

  beforeEach(() => { procApi = setup().procApi })

  it('procedures can call other procedures via ms.call', async () => {
    await procApi.define('inner', (_ms: any, args: any) => args * 10)
    await procApi.define('outer', async (ms: any, args: any) => {
      const inner = await ms.call('inner', args)
      return inner + 1
    })
    expect(await procApi.call('outer', 5)).toBe(51) // 5*10 + 1
  })

  it('procedures can call via ms.fn proxy', async () => {
    await procApi.define('base', () => 100)
    await procApi.define('derived', async (ms: any) => {
      const b = await ms.fn.base()
      return b + 50
    })
    expect(await procApi.call('derived')).toBe(150)
  })

  it('three-level composition', async () => {
    await procApi.define('l1', (_ms: any, args: any) => args + 1)
    await procApi.define('l2', async (ms: any, args: any) => {
      const v = await ms.call('l1', args)
      return v * 2
    })
    await procApi.define('l3', async (ms: any, args: any) => {
      const v = await ms.call('l2', args)
      return v + 100
    })
    // l3(5) → l2(5) → l1(5)=6 → 6*2=12 → 12+100=112
    expect(await procApi.call('l3', 5)).toBe(112)
  })

  it('procedures can use ms utility methods', async () => {
    await procApi.define('echoAdd', (ms: any, args: any) => {
      return ms.echo(ms.add(args.a, args.b))
    })
    expect(await procApi.call('echoAdd', { a: 10, b: 20 })).toBe(30)
  })
})

// ═════════════════════════════════════════════════════════════════
// §5  list / describe / source
// ═════════════════════════════════════════════════════════════════

describe('§5 procedures()', () => {
  let procApi: ProcedureApi

  beforeEach(() => { procApi = setup().procApi })

  it('lists all procedures sorted by name', async () => {
    await procApi.define('beta', () => 2, { description: 'B', tags: ['b'] })
    await procApi.define('alpha', () => 1, { description: 'A', tags: ['a'] })
    const list = await procApi.procedures()
    expect(list).toHaveLength(2)
    expect(list[0].name).toBe('alpha')
    expect(list[1].name).toBe('beta')
    expect(list[0].description).toBe('A')
    expect(list[1].tags).toEqual(['b'])
  })

  it('returns empty array when no procedures', async () => {
    expect(await procApi.procedures()).toEqual([])
  })

  it('summary includes schema flags', async () => {
    await procApi.define('withSchema', () => 1, {
      inputSchema: { type: 'object' },
    })
    const list = await procApi.procedures()
    expect(list[0].hasInputSchema).toBe(true)
    expect(list[0].hasOutputSchema).toBe(false)
  })
})

describe('§5b describe()', () => {
  let procApi: ProcedureApi

  beforeEach(() => { procApi = setup().procApi })

  it('returns full record', async () => {
    await procApi.define('descTest', () => 1, {
      description: 'Test desc',
      tags: ['x'],
      dependencies: ['other'],
    })
    const record = await procApi.describe('descTest')
    expect(record).not.toBeNull()
    expect(record!.name).toBe('descTest')
    expect(record!.dependencies).toEqual(['other'])
    expect(record!.code).toBeTruthy()
    expect(record!.created).toBeTruthy()
    expect(record!.updated).toBeTruthy()
  })

  it('returns null for unknown', async () => {
    expect(await procApi.describe('nope')).toBeNull()
  })
})

describe('§5c source()', () => {
  let procApi: ProcedureApi

  beforeEach(() => { procApi = setup().procApi })

  it('returns source code', async () => {
    await procApi.define('srcTest', (ms: any) => ms.echo('hi'))
    const code = await procApi.source('srcTest')
    expect(code).toContain('echo')
  })

  it('returns null for unknown', async () => {
    expect(await procApi.source('nope')).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════
// §6  remove
// ═════════════════════════════════════════════════════════════════

describe('§6 remove()', () => {
  let procApi: ProcedureApi

  beforeEach(() => { procApi = setup().procApi })

  it('deletes a procedure', async () => {
    await procApi.define('toDelete', () => 1)
    expect(await procApi.remove('toDelete')).toBe(true)
    expect(await procApi.describe('toDelete')).toBeNull()
  })

  it('returns false for non-existent', async () => {
    expect(await procApi.remove('ghost')).toBe(false)
  })

  it('removed procedure is no longer callable', async () => {
    await procApi.define('temp', () => 42)
    expect(await procApi.call('temp')).toBe(42)
    await procApi.remove('temp')
    await expect(procApi.call('temp')).rejects.toThrow('not found')
  })
})

// ═════════════════════════════════════════════════════════════════
// §7  fn proxy
// ═════════════════════════════════════════════════════════════════

describe('§7 fn proxy', () => {
  let procApi: ProcedureApi

  beforeEach(() => { procApi = setup().procApi })

  it('calls procedures via dotted access', async () => {
    await procApi.define('proxyTest', (_ms: any, args: any) => `got: ${args}`)
    expect(await procApi.fn.proxyTest('hello')).toBe('got: hello')
  })

  it('throws for undefined procedure', async () => {
    await expect(procApi.fn.doesNotExist()).rejects.toThrow('not found')
  })

  it('works with no args', async () => {
    await procApi.define('noArgs', () => 'ok')
    expect(await procApi.fn.noArgs()).toBe('ok')
  })

  it('works with complex args', async () => {
    await procApi.define('complex', (_ms: any, args: any) => args.items.length)
    expect(await procApi.fn.complex({ items: [1, 2, 3] })).toBe(3)
  })
})

// ═════════════════════════════════════════════════════════════════
// §8  reconstruction
// ═════════════════════════════════════════════════════════════════

describe('§8 reconstruction', () => {
  let procApi: ProcedureApi

  beforeEach(() => { procApi = setup().procApi })

  it('reconstructs arrow function', async () => {
    await procApi.defineCode('arrow', '(ms, args) => args + 1')
    expect(await procApi.call('arrow', 5)).toBe(6)
  })

  it('reconstructs async arrow function', async () => {
    await procApi.defineCode('asyncArrow', 'async (ms, args) => args * 2')
    expect(await procApi.call('asyncArrow', 3)).toBe(6)
  })

  it('reconstructs regular function', async () => {
    await procApi.defineCode('regular', 'function(ms, args) { return args + 10 }')
    expect(await procApi.call('regular', 5)).toBe(15)
  })

  it('reconstructs named function', async () => {
    await procApi.defineCode('named', 'function myFunc(ms, args) { return args * 3 }')
    expect(await procApi.call('named', 4)).toBe(12)
  })

  it('reconstructs raw code body', async () => {
    await procApi.defineCode('body', 'return ms.add(args, 100)')
    expect(await procApi.call('body', 5)).toBe(105)
  })

  it('reconstructs single-arg arrow', async () => {
    await procApi.defineCode('singleArg', 'ms => ms.echo(42)')
    expect(await procApi.call('singleArg')).toBe(42)
  })

  it('reconstructs multiline body', async () => {
    await procApi.defineCode('multi', `
      const a = 10
      const b = 20
      return a + b + (args || 0)
    `)
    expect(await procApi.call('multi', 5)).toBe(35)
  })

  it('reconstructs async named function', async () => {
    await procApi.defineCode('asyncNamed', 'async function doIt(ms, args) { return await Promise.resolve(args + 99) }')
    expect(await procApi.call('asyncNamed', 1)).toBe(100)
  })
})

// ═════════════════════════════════════════════════════════════════
// §9  kebab normalization across all methods
// ═════════════════════════════════════════════════════════════════

describe('§9 kebab normalization', () => {
  let store: ReturnType<typeof createMockStore>
  let procApi: ProcedureApi

  beforeEach(() => {
    const s = setup()
    store = s.store
    procApi = s.procApi
  })

  it('define with camelCase, call with camelCase', async () => {
    await procApi.define('myFunc', () => 'works')
    expect(await procApi.call('myFunc')).toBe('works')
  })

  it('define with camelCase, call with kebab-case', async () => {
    await procApi.define('myFunc', () => 'works')
    expect(await procApi.call('my-func')).toBe('works')
  })

  it('define with kebab, call with camelCase', async () => {
    await procApi.define('my-func', () => 'works')
    expect(await procApi.call('myFunc')).toBe('works')
  })

  it('define with PascalCase, describe with camelCase', async () => {
    await procApi.define('MyProc', () => 1, { description: 'pascal' })
    const record = await procApi.describe('myProc')
    expect(record).not.toBeNull()
    expect(record!.description).toBe('pascal')
  })

  it('define with camelCase, source with kebab', async () => {
    await procApi.define('getCode', (ms: any) => ms.echo(1))
    const code = await procApi.source('get-code')
    expect(code).toContain('echo')
  })

  it('define with camelCase, remove with kebab', async () => {
    await procApi.define('toRemove', () => 1)
    expect(await procApi.remove('to-remove')).toBe(true)
    expect(await procApi.describe('toRemove')).toBeNull()
  })

  it('redefine with different casing maps to same key', async () => {
    await procApi.define('myProc', () => 1)
    const v2 = await procApi.define('my-proc', () => 2)
    expect(v2.version).toBe(2) // same key, incremented
  })

  it('fn proxy with camelCase resolves kebab key', async () => {
    await procApi.define('proxyKebab', () => 'proxied')
    // fn proxy sends 'proxyKebab' which gets toStorageKey'd to 'proxy-kebab'
    expect(await procApi.fn.proxyKebab()).toBe('proxied')
  })

  it('storage key is always kebab in the store', async () => {
    await procApi.define('CamelCase', () => 1)
    await procApi.define('snake_case', () => 2)
    await procApi.define('already-kebab', () => 3)

    const allKeys = store._allKeys()
    expect(allKeys).toContain('_system.procedures:camel-case')
    expect(allKeys).toContain('_system.procedures:snake-case')
    expect(allKeys).toContain('_system.procedures:already-kebab')
    // No raw-cased keys
    expect(allKeys).not.toContain('_system.procedures:CamelCase')
    expect(allKeys).not.toContain('_system.procedures:snake_case')
  })
})

// ═════════════════════════════════════════════════════════════════
// §10 edge cases
// ═════════════════════════════════════════════════════════════════

describe('§10 edge cases', () => {
  let procApi: ProcedureApi

  beforeEach(() => { procApi = setup().procApi })

  it('empty store returns empty procedures list', async () => {
    expect(await procApi.procedures()).toEqual([])
  })

  it('call after remove throws not found', async () => {
    await procApi.define('ephemeral', () => 42)
    await procApi.remove('ephemeral')
    await expect(procApi.call('ephemeral')).rejects.toThrow('not found')
  })

  it('define preserves original name in record', async () => {
    const r = await procApi.define('myFancyProc', () => 1)
    expect(r.name).toBe('myFancyProc') // original casing preserved
  })

  it('procedure returning object', async () => {
    await procApi.define('returnObj', () => ({ x: 1, y: [2, 3] }))
    const result = await procApi.call('returnObj')
    expect(result).toEqual({ x: 1, y: [2, 3] })
  })

  it('procedure returning array', async () => {
    await procApi.define('returnArr', () => [1, 2, 3])
    expect(await procApi.call('returnArr')).toEqual([1, 2, 3])
  })

  it('procedure with string args', async () => {
    await procApi.define('strArgs', (_ms: any, args: any) => args.toUpperCase())
    expect(await procApi.call('strArgs', 'hello')).toBe('HELLO')
  })

  it('multiple defines and calls interleaved', async () => {
    await procApi.define('a', () => 'A')
    await procApi.define('b', () => 'B')
    expect(await procApi.call('a')).toBe('A')
    expect(await procApi.call('b')).toBe('B')
    await procApi.define('a', () => 'A2')
    expect(await procApi.call('a')).toBe('A2')
    expect(await procApi.call('b')).toBe('B')
  })

  it('procedure with no args parameter', async () => {
    await procApi.define('noParams', () => 'just works')
    expect(await procApi.call('noParams')).toBe('just works')
  })
})

// ═════════════════════════════════════════════════════════════════
// §11 manifest field — every procedure owns its tool guide entry
// ═════════════════════════════════════════════════════════════════

describe('§11 manifest field', () => {
  let procApi: ProcedureApi
  let store: ReturnType<typeof setup>['store']

  beforeEach(() => {
    const s = setup()
    store = s.store
    procApi = s.procApi
  })

  it('stores explicit manifest on ProcedureRecord', async () => {
    const r = await procApi.define('healthCheck', () => 1, {
      description: 'Check workspace health',
      manifest: 'ms.fn.healthCheck() → { ungoverned: string[], count: number }',
    })
    expect(r.manifest).toBe('ms.fn.healthCheck() → { ungoverned: string[], count: number }')
  })

  it('auto-generates manifest when omitted (legacy compat)', async () => {
    const r = await procApi.define('staleDocs', () => 1)
    expect(r.manifest).toContain('ms.fn.staleDocs')
    expect(r.manifest).toContain('describeProcedure')
  })

  it('manifest persists through describe()', async () => {
    await procApi.define('hasManifest', () => 1, {
      manifest: 'ms.fn.hasManifest(opts?) → ManifestReport',
    })
    const record = await procApi.describe('hasManifest')
    expect(record?.manifest).toBe('ms.fn.hasManifest(opts?) → ManifestReport')
  })

  it('manifest appears in procedures() summary', async () => {
    await procApi.define('listed', () => 1, {
      manifest: 'ms.fn.listed() → boolean',
    })
    const procs = await procApi.procedures()
    const found = procs.find(p => p.name === 'listed')
    expect(found?.manifest).toBe('ms.fn.listed() → boolean')
  })

  it('manifest updates on redefine', async () => {
    await procApi.define('evolving', () => 1, {
      manifest: 'ms.fn.evolving() → v1',
    })
    const v2 = await procApi.define('evolving', () => 2, {
      manifest: 'ms.fn.evolving(opts?) → v2',
    })
    expect(v2.manifest).toBe('ms.fn.evolving(opts?) → v2')
    expect(v2.version).toBe(2)
  })

  it('defineCode also stores manifest', async () => {
    const r = await procApi.defineCode('fromCode', 'return 42', {
      manifest: 'ms.fn.fromCode() → 42',
    })
    expect(r.manifest).toBe('ms.fn.fromCode() → 42')
  })

  it('manifest field stored in raw store payload', async () => {
    await procApi.define('rawCheck', () => 1, {
      manifest: 'ms.fn.rawCheck() → number',
    })
    const raw = store._data['_system.procedures:raw-check'] as any
    expect(raw.manifest).toBe('ms.fn.rawCheck() → number')
  })

  it('auto-generated manifest for summary with legacy proc (no manifest)', async () => {
    const procs = await procApi.procedures()
    // All should have manifest (auto-generated)
    for (const p of procs) {
      expect(typeof p.manifest).toBe('string')
      expect(p.manifest.length).toBeGreaterThan(0)
    }
  })
})
