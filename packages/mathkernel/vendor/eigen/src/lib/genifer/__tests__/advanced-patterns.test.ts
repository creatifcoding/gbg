/**
 * Advanced Effect patterns tests
 *
 * Tests: Effect.fn tracing, @effect/ai tool bridge, CatalogService spans
 */
import { describe, it, expect } from 'vitest'
import { Effect, Schema, Layer, Cause, Exit } from 'effect'
import { Tool, Toolkit } from '@effect/ai'
import { normalize, normalizeWithMeta, NormalizeError } from '../core/normalize.js'
import { repair } from '../core/repair.js'
import { UITree, UIElement } from '../core/schemas.js'
import { makeGeniferTool } from '../core/tool-bridge.js'
import { getRenderersRecord, getSchemasRecord, getSystemPrompt, CatalogComponents, createCatalogLayer } from '../core/CatalogService.js'
import { HashMap } from 'effect'

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const VALID_NESTED = JSON.stringify({
  type: 'Page',
  key: 'page-1',
  props: { title: 'Test' },
  children: [
    { type: 'Card', key: 'card-1', props: { label: 'A' } },
  ],
})

function makeTestCatalogLayer() {
  return createCatalogLayer({
    name: 'test',
    components: {
      Card: {
        schema: Schema.Struct({ label: Schema.String }),
        renderer: () => null,
        description: 'A card',
        hasChildren: false,
        defaultEntrance: { property: 'opacity', easing: 'out-cubic', duration: 'normal' },
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Effect.fn tracing (Phase 2)
// ---------------------------------------------------------------------------

describe('Effect.fn traced functions', () => {
  it('normalize is an Effect.fn (callable with string arg)', async () => {
    const result = await Effect.runPromise(normalize(VALID_NESTED))
    expect(result).toBeInstanceOf(UITree)
    expect(result.size).toBeGreaterThan(0)
  })

  it('normalizeWithMeta returns metadata with format', async () => {
    const result = await Effect.runPromise(normalizeWithMeta(VALID_NESTED))
    expect(result.format).toBe('nested')
    expect(result.elementCount).toBeGreaterThan(0)
    expect(result.rawLength).toBe(VALID_NESTED.length)
  })

  it('repair is an Effect.fn (callable with UITree arg)', async () => {
    const tree = await Effect.runPromise(normalize(VALID_NESTED))
    const result = await Effect.runPromise(repair(tree))
    expect(result.tree).toBeInstanceOf(UITree)
    expect(result.repairs).toBeDefined()
  })

  it('normalize rejects invalid input', async () => {
    // extractJson uses Effect.sync + throw → defect (die), not typed error.
    // Must use catchAllCause to intercept defects.
    const result = await Effect.runPromise(
      normalize('no json here').pipe(
        Effect.map(() => 'ok' as const),
        Effect.catchAllCause((cause) => {
          // Any failure path (typed or defect) means normalize rejected
          return Effect.succeed('rejected' as const)
        }),
      )
    )
    expect(result).toBe('rejected')
  })
})

// ---------------------------------------------------------------------------
// CatalogService Effect.fn accessors
// ---------------------------------------------------------------------------

describe('CatalogService traced accessors', () => {
  const layer = makeTestCatalogLayer()

  it('getRenderersRecord returns record with component count', async () => {
    const result = await Effect.runPromise(
      getRenderersRecord.pipe(Effect.provide(layer))
    )
    expect(result).toHaveProperty('Card')
    expect(typeof result.Card).toBe('function')
  })

  it('getSchemasRecord returns record', async () => {
    const result = await Effect.runPromise(
      getSchemasRecord.pipe(Effect.provide(layer))
    )
    expect(result).toHaveProperty('Card')
  })

  it('getSystemPrompt returns non-empty prompt', async () => {
    const result = await Effect.runPromise(
      getSystemPrompt.pipe(Effect.provide(layer))
    )
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain('Card')
  })
})

// ---------------------------------------------------------------------------
// @effect/ai Tool Bridge (Phase 3)
// ---------------------------------------------------------------------------

describe('makeGeniferTool', () => {
  it('creates tool with both effectAi and genifer shapes', () => {
    const Search = makeGeniferTool("Search", {
      description: "Search the knowledge base",
      parameters: {
        query: Schema.String,
        limit: Schema.optional(Schema.Number),
      },
      success: Schema.Struct({ results: Schema.Array(Schema.String) }),
    })

    // Name
    expect(Search.name).toBe('Search')

    // Genifer definition
    expect(Search.geniferDef.name).toBe('Search')
    expect(Search.geniferDef.description).toBe('Search the knowledge base')
    expect(typeof Search.geniferDef.handler).toBe('function')

    // @effect/ai Tool
    expect(Search.effectAiTool).toBeDefined()
  })

  it('genifer default handler returns unimplemented', async () => {
    const Calc = makeGeniferTool("Calc", {
      parameters: { x: Schema.Number },
      success: Schema.Number,
    })

    const result = await Calc.geniferDef.handler({ x: 42 })
    expect(result).toContain('unimplemented')
    expect(result).toContain('Calc')
  })

  it('parametersSchema is usable for validation', () => {
    const Calc = makeGeniferTool("Calc", {
      parameters: { x: Schema.Number, y: Schema.Number },
      success: Schema.Number,
    })

    const decoded = Schema.decodeUnknownSync(Calc.parametersSchema)({ x: 1, y: 2 })
    expect(decoded).toEqual({ x: 1, y: 2 })
  })

  it('effectAiTool can be added to Toolkit', () => {
    const Search = makeGeniferTool("Search", {
      description: "Search",
      parameters: { query: Schema.String },
      success: Schema.String,
    })

    // This should compile and create a toolkit
    const toolkit = Toolkit.make(Search.effectAiTool)
    expect(toolkit).toBeDefined()
  })
})
