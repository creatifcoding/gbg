/**
 * Phase 4 tests — Prompt Engineering Layer
 *
 * Tests: catalog compiler, format spec, model profiles, few-shot generator,
 * full prompt builder, Effect accessor.
 */
import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import * as Schema from 'effect/Schema'
import {
  compileComponentSchema,
  compileCatalog,
  formatSpecSection,
  generateFewShotExample,
  buildSystemPrompt,
  buildPromptEffect,
  detectModelFamily,
  resolveProfile,
  PROFILES,
  type CompiledComponentSchema,
} from '../core/prompt-engineering.js'
import {
  CatalogComponents,
  makeCatalogComponents,
  createCatalogLayer,
  type SchemaEntry,
  type DomainCatalog,
} from '../core/CatalogService.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CardSchema = Schema.Struct({
  title: Schema.String,
  color: Schema.optional(Schema.String),
})

const MetricSchema = Schema.Struct({
  label: Schema.String,
  value: Schema.Number,
  unit: Schema.optional(Schema.String),
})

const PageSchema = Schema.Struct({
  title: Schema.optional(Schema.String),
})

function mockSchemas(): ReadonlyMap<string, SchemaEntry> {
  return new Map<string, SchemaEntry>([
    ['Card', { schema: CardSchema, description: 'A card component', hasChildren: false, defaultEntrance: { property: 'opacity', easing: 'out-cubic', duration: 'normal' } }],
    ['MetricCard', { schema: MetricSchema, description: 'Displays a metric value', hasChildren: false, defaultEntrance: { property: 'opacity', easing: 'out-cubic', duration: 'fast' } }],
    ['Page', { schema: PageSchema, description: 'Root page container', hasChildren: true, defaultEntrance: { property: 'opacity', easing: 'out-cubic', duration: 'normal' } }],
  ])
}

function mockCatalog(): DomainCatalog {
  return {
    name: 'test',
    components: {
      Card: { schema: CardSchema, description: 'A card', hasChildren: false, renderer: () => null, defaultEntrance: { property: 'opacity', easing: 'out-cubic', duration: 'normal' } },
      MetricCard: { schema: MetricSchema, description: 'A metric', hasChildren: false, renderer: () => null, defaultEntrance: { property: 'opacity', easing: 'out-cubic', duration: 'fast' } },
      Page: { schema: PageSchema, description: 'Root page', hasChildren: true, renderer: () => null, defaultEntrance: { property: 'opacity', easing: 'out-cubic', duration: 'normal' } },
    },
  }
}

// ---------------------------------------------------------------------------
// Catalog → JSON Schema Compiler (#1895)
// ---------------------------------------------------------------------------

describe('compileComponentSchema', () => {
  it('compiles a schema entry with JSON Schema', () => {
    const entry: SchemaEntry = {
      schema: CardSchema,
      description: 'A card',
      hasChildren: false,
      defaultEntrance: { property: 'opacity', easing: 'out-cubic', duration: 'normal' },
    }

    const compiled = compileComponentSchema('Card', entry)
    expect(compiled.name).toBe('Card')
    expect(compiled.description).toBe('A card')
    expect(compiled.hasChildren).toBe(false)
    expect(compiled.jsonSchema).not.toBeNull()
    expect(compiled.propSummary).toContain('title')
  })

  it('handles complex schemas gracefully', () => {
    // A recursive or very complex schema might fail JSONSchema.make
    const entry: SchemaEntry = {
      schema: Schema.Unknown,
      description: 'Complex thing',
      hasChildren: true,
      defaultEntrance: { property: 'opacity', easing: 'out-cubic', duration: 'normal' },
    }

    const compiled = compileComponentSchema('Complex', entry)
    expect(compiled.name).toBe('Complex')
    // Should not throw, even if jsonSchema is weird
    expect(compiled).toBeDefined()
  })
})

describe('compileCatalog', () => {
  it('compiles all entries', () => {
    const schemas = mockSchemas()
    const compiled = compileCatalog(schemas)
    expect(compiled).toHaveLength(3)
    expect(compiled.map(c => c.name).sort()).toEqual(['Card', 'MetricCard', 'Page'])
  })
})

// ---------------------------------------------------------------------------
// Format Specification Template (#1896)
// ---------------------------------------------------------------------------

describe('formatSpecSection', () => {
  it('produces nested-preferred format spec', () => {
    const spec = formatSpecSection(true)
    expect(spec).toContain('# Response Format')
    expect(spec).toContain('"type": "Page"')
    expect(spec).toContain('"key": "page-1"')
    expect(spec).toContain('Nested (preferred)')
    expect(spec).toContain('Flat (alternative)')
  })

  it('produces flat-preferred format spec', () => {
    const spec = formatSpecSection(false)
    expect(spec).toContain('Flat (preferred)')
    expect(spec).toContain('Nested (alternative)')
  })

  it('includes all required rules', () => {
    const spec = formatSpecSection(true)
    expect(spec).toContain('"type" and "key"')
    expect(spec).toContain('unique string identifier')
    expect(spec).toContain('Do NOT include markdown fences')
  })
})

// ---------------------------------------------------------------------------
// Model Profiles (#1897)
// ---------------------------------------------------------------------------

describe('detectModelFamily', () => {
  it('detects OpenAI models', () => {
    expect(detectModelFamily('gpt-4o-mini')).toBe('openai')
    expect(detectModelFamily('gpt-3.5-turbo')).toBe('openai')
    expect(detectModelFamily('o1-preview')).toBe('openai')
    expect(detectModelFamily('o3-mini')).toBe('openai')
  })

  it('detects Anthropic models', () => {
    expect(detectModelFamily('claude-3-opus-20240229')).toBe('anthropic')
    expect(detectModelFamily('claude-3.5-sonnet')).toBe('anthropic')
    expect(detectModelFamily('claude-3-haiku')).toBe('anthropic')
  })

  it('detects local models', () => {
    expect(detectModelFamily('llama-3-70b')).toBe('local')
    expect(detectModelFamily('mistral-7b')).toBe('local')
    expect(detectModelFamily('phi-3-mini')).toBe('local')
    expect(detectModelFamily('qwen-72b')).toBe('local')
    expect(detectModelFamily('deepseek-coder')).toBe('local')
  })

  it('returns unknown for unrecognized models', () => {
    expect(detectModelFamily('my-custom-model')).toBe('unknown')
  })
})

describe('resolveProfile', () => {
  it('returns openai profile for gpt models', () => {
    const profile = resolveProfile({ model: 'gpt-4o' })
    expect(profile.family).toBe('openai')
    expect(profile.useJsonSchema).toBe(true)
    expect(profile.maxFewShotExamples).toBe(3)
  })

  it('returns local profile with reduced features', () => {
    const profile = resolveProfile({ model: 'llama-3-8b' })
    expect(profile.family).toBe('local')
    expect(profile.useJsonSchema).toBe(false)
    expect(profile.maxFewShotExamples).toBe(1)
  })

  it('allows profile overrides', () => {
    const profile = resolveProfile({
      model: 'gpt-4o',
      profile: { maxFewShotExamples: 10 },
    })
    expect(profile.family).toBe('openai')
    expect(profile.maxFewShotExamples).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// Few-Shot Generator (#1898)
// ---------------------------------------------------------------------------

describe('generateFewShotExample', () => {
  it('generates example from catalog with container + leaves', () => {
    const compiled = compileCatalog(mockSchemas())
    const example = generateFewShotExample(compiled, 2)

    expect(example).not.toBeNull()
    const parsed = JSON.parse(example!)
    expect(parsed.type).toBe('Page') // first container
    expect(parsed.children).toHaveLength(2)
    expect(parsed.children[0].type).toBe('Card')
    expect(parsed.children[1].type).toBe('MetricCard')
  })

  it('returns null when no containers exist', () => {
    const leaves: CompiledComponentSchema[] = [
      { name: 'Text', description: 'text', hasChildren: false, jsonSchema: null, propSummary: 'text: string' },
    ]
    expect(generateFewShotExample(leaves)).toBeNull()
  })

  it('returns null when no leaves exist', () => {
    const containers: CompiledComponentSchema[] = [
      { name: 'Page', description: 'page', hasChildren: true, jsonSchema: null, propSummary: '' },
    ]
    expect(generateFewShotExample(containers)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Full Prompt Builder
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  it('includes all sections for openai profile', () => {
    const prompt = buildSystemPrompt(mockSchemas(), { model: 'gpt-4o' })

    expect(prompt).toContain('Output ONLY valid JSON')
    expect(prompt).toContain('# Response Format')
    expect(prompt).toContain('# Available Components')
    expect(prompt).toContain('Card')
    expect(prompt).toContain('MetricCard')
    expect(prompt).toContain('Page')
    expect(prompt).toContain('# Example Output')
  })

  it('omits JSON Schema for local models', () => {
    const prompt = buildSystemPrompt(mockSchemas(), { model: 'llama-3-8b' })
    expect(prompt).toContain('Props:') // summary, not schema block
    expect(prompt).not.toContain('"$schema"')
  })

  it('respects maxCatalogEntries', () => {
    const prompt = buildSystemPrompt(mockSchemas(), {
      maxCatalogEntries: 1,
      model: 'gpt-4o',
      includeFewShot: false, // Avoid few-shot adding extra component references
    })
    // Count component headings between "# Available Components" and next "#" section
    const catalogSection = prompt.split('# Available Components')[1]?.split(/^# /m)[0] ?? ''
    const componentHeadings = catalogSection.match(/^## [A-Z]\w+/gm) ?? []
    expect(componentHeadings.length).toBe(1)
  })

  it('can disable format spec and few-shot', () => {
    const prompt = buildSystemPrompt(mockSchemas(), {
      includeFormatSpec: false,
      includeFewShot: false,
    })
    expect(prompt).not.toContain('# Response Format')
    expect(prompt).not.toContain('# Example Output')
    expect(prompt).toContain('# Available Components')
  })
})

// ---------------------------------------------------------------------------
// Effect accessor
// ---------------------------------------------------------------------------

describe('buildPromptEffect', () => {
  it('builds prompt from CatalogComponents service', () => {
    const catalog = mockCatalog()
    const layer = createCatalogLayer(catalog)

    const result = Effect.runSync(
      buildPromptEffect({ model: 'gpt-4o' }).pipe(Effect.provide(layer)),
    )

    expect(result).toContain('Card')
    expect(result).toContain('Page')
    expect(result).toContain('# Response Format')
  })
})
