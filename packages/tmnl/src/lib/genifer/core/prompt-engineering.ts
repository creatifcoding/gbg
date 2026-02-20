/**
 * Prompt Engineering Layer — catalog-aware prompt construction
 *
 * Builds LLM system prompts from the registered catalog with:
 *  1. Catalog → JSON Schema compiler (per-component structured schemas)
 *  2. Format specification template (explicit 3-node example)
 *  3. Model-specific prompt profiles (openai, anthropic, local)
 *  4. Few-shot example generator (synthetic from catalog definitions)
 *
 * @module genifer/core/prompt-engineering
 */
import { Effect, JSONSchema } from 'effect'
import * as Schema from 'effect/Schema'
import { CatalogComponents, type SchemaEntry } from './CatalogService.js'

// =============================================================================
// Types
// =============================================================================

export type ModelFamily = 'openai' | 'anthropic' | 'local' | 'unknown'

export type ModelProfile = {
  readonly family: ModelFamily
  /** Whether the model needs explicit JSON-only instruction */
  readonly needsJsonInstruction: boolean
  /** Whether to include full JSON Schema or just prop descriptions */
  readonly useJsonSchema: boolean
  /** Max example components in few-shot section */
  readonly maxFewShotExamples: number
  /** Whether to emphasize nested format over flat */
  readonly preferNestedFormat: boolean
  /** Additional system prompt prefix */
  readonly systemPrefix: string
}

export type PromptEngineeringOptions = {
  /** Model family for profile selection */
  readonly model?: ModelFamily | string
  /** Override the profile entirely */
  readonly profile?: Partial<ModelProfile>
  /** Max components to include in the catalog section */
  readonly maxCatalogEntries?: number
  /** Include format specification section */
  readonly includeFormatSpec?: boolean
  /** Include few-shot examples section */
  readonly includeFewShot?: boolean
}

// =============================================================================
// Model Profiles
// =============================================================================

export const PROFILES: Record<ModelFamily, ModelProfile> = {
  openai: {
    family: 'openai',
    needsJsonInstruction: true,
    useJsonSchema: true,
    maxFewShotExamples: 3,
    preferNestedFormat: true,
    systemPrefix: 'You are a UI generator. Output ONLY valid JSON. No markdown, no explanation.',
  },
  anthropic: {
    family: 'anthropic',
    needsJsonInstruction: true,
    useJsonSchema: true,
    maxFewShotExamples: 2,
    preferNestedFormat: true,
    systemPrefix: 'You generate UI component trees as JSON. Return only the JSON object.',
  },
  local: {
    family: 'local',
    needsJsonInstruction: true,
    useJsonSchema: false, // Local models often choke on verbose schemas
    maxFewShotExamples: 1,
    preferNestedFormat: true,
    systemPrefix: 'Output JSON only. No text before or after the JSON.',
  },
  unknown: {
    family: 'unknown',
    needsJsonInstruction: true,
    useJsonSchema: true,
    maxFewShotExamples: 2,
    preferNestedFormat: true,
    systemPrefix: 'You are a UI generator. Output ONLY valid JSON.',
  },
}

/**
 * Detect model family from model name string.
 */
export function detectModelFamily(model: string): ModelFamily {
  const lower = model.toLowerCase()
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('openai')) return 'openai'
  if (lower.includes('claude') || lower.includes('anthropic') || lower.includes('haiku') || lower.includes('sonnet') || lower.includes('opus')) return 'anthropic'
  if (lower.includes('llama') || lower.includes('mistral') || lower.includes('phi') || lower.includes('qwen') || lower.includes('gemma') || lower.includes('deepseek') || lower.includes('local')) return 'local'
  return 'unknown'
}

/**
 * Resolve a model profile from options.
 */
export function resolveProfile(opts: PromptEngineeringOptions = {}): ModelProfile {
  const family: ModelFamily = opts.model
    ? (opts.model === 'openai' || opts.model === 'anthropic' || opts.model === 'local' || opts.model === 'unknown'
        ? opts.model
        : detectModelFamily(opts.model))
    : 'unknown'

  const base = PROFILES[family]
  return opts.profile ? { ...base, ...opts.profile } : base
}

// =============================================================================
// Catalog → JSON Schema Compiler (#1895)
// =============================================================================

export type CompiledComponentSchema = {
  readonly name: string
  readonly description: string | undefined
  readonly hasChildren: boolean
  readonly jsonSchema: Record<string, unknown> | null
  readonly propSummary: string
}

/**
 * Compile a single catalog entry into a structured component schema.
 */
export function compileComponentSchema(name: string, entry: SchemaEntry): CompiledComponentSchema {
  let jsonSchema: Record<string, unknown> | null = null
  let propSummary = ''

  try {
    const raw = JSONSchema.make(entry.schema)
    jsonSchema = raw as Record<string, unknown>

    // Extract prop summary from schema properties
    const props = (raw as any)?.properties
    if (props && typeof props === 'object') {
      propSummary = Object.entries(props)
        .map(([k, v]: [string, any]) => `${k}: ${v?.type ?? 'unknown'}`)
        .join(', ')
    }
  } catch {
    propSummary = '(complex schema)'
  }

  return {
    name,
    description: entry.description,
    hasChildren: entry.hasChildren ?? false,
    jsonSchema,
    propSummary,
  }
}

/**
 * Compile all catalog entries into structured schemas.
 */
export function compileCatalog(
  schemas: ReadonlyMap<string, SchemaEntry>,
): CompiledComponentSchema[] {
  const result: CompiledComponentSchema[] = []
  for (const [name, entry] of schemas) {
    result.push(compileComponentSchema(name, entry))
  }
  return result
}

// =============================================================================
// Format Specification Template (#1896)
// =============================================================================

/**
 * Generate the format specification section of the prompt.
 * Shows both nested and flat formats with a concrete 3-node example.
 */
export function formatSpecSection(preferNested: boolean): string {
  const nested = `{
  "type": "Page",
  "key": "page-1",
  "props": { "title": "Dashboard" },
  "children": [
    {
      "type": "MetricCard",
      "key": "metric-1",
      "props": { "label": "CPU", "value": 42, "unit": "%" }
    },
    {
      "type": "MetricCard",
      "key": "metric-2",
      "props": { "label": "Memory", "value": 87, "unit": "%" }
    }
  ]
}`

  const flat = `{
  "root": "page-1",
  "elements": {
    "page-1": {
      "type": "Page",
      "props": { "title": "Dashboard" },
      "children": ["metric-1", "metric-2"]
    },
    "metric-1": {
      "type": "MetricCard",
      "props": { "label": "CPU", "value": 42, "unit": "%" }
    },
    "metric-2": {
      "type": "MetricCard",
      "props": { "label": "Memory", "value": 87, "unit": "%" }
    }
  }
}`

  const lines: string[] = [
    '# Response Format',
    '',
    'Return a JSON object representing a UI component tree.',
    '',
    '## Rules',
    '- Every component MUST have "type" and "key" fields',
    '- "key" must be a unique string identifier',
    '- "props" contains component-specific properties',
    '- "children" is an array of child components (nested) or child key strings (flat)',
    '- Do NOT include markdown fences, explanation, or commentary',
    '',
  ]

  if (preferNested) {
    lines.push('## Format: Nested (preferred)', '', '```json', nested, '```', '')
    lines.push('## Format: Flat (alternative)', '', '```json', flat, '```', '')
  } else {
    lines.push('## Format: Flat (preferred)', '', '```json', flat, '```', '')
    lines.push('## Format: Nested (alternative)', '', '```json', nested, '```', '')
  }

  return lines.join('\n')
}

// =============================================================================
// Few-Shot Example Generator (#1898)
// =============================================================================

/**
 * Generate a synthetic few-shot example from catalog definitions.
 * Picks a container + N leaf components and assembles a realistic tree.
 */
export function generateFewShotExample(
  compiled: CompiledComponentSchema[],
  maxLeaves: number = 2,
): string | null {
  const containers = compiled.filter(c => c.hasChildren)
  const leaves = compiled.filter(c => !c.hasChildren)

  if (containers.length === 0 || leaves.length === 0) return null

  const container = containers[0]
  const selectedLeaves = leaves.slice(0, maxLeaves)

  const children = selectedLeaves.map((leaf, i) => {
    // Generate props from the summary
    const props = generatePropsFromSummary(leaf.propSummary, i)
    return `    { "type": "${leaf.name}", "key": "${leaf.name.toLowerCase()}-${i + 1}", "props": ${JSON.stringify(props)} }`
  })

  return `{
  "type": "${container.name}",
  "key": "${container.name.toLowerCase()}-1",
  "props": ${JSON.stringify(generatePropsFromSummary(container.propSummary, 0))},
  "children": [
${children.join(',\n')}
  ]
}`
}

/** Generate plausible prop values from a prop summary string */
function generatePropsFromSummary(summary: string, seed: number): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  if (!summary || summary === '(complex schema)') return props

  const pairs = summary.split(',').map(s => s.trim())
  for (const pair of pairs) {
    const [key, type] = pair.split(':').map(s => s.trim())
    if (!key) continue

    switch (type) {
      case 'string': props[key] = `example-${key}-${seed}`; break
      case 'number': props[key] = 42 + seed * 10; break
      case 'boolean': props[key] = seed % 2 === 0; break
      case 'integer': props[key] = seed + 1; break
      default: props[key] = `value-${seed}`
    }
  }
  return props
}

// =============================================================================
// Full Prompt Builder
// =============================================================================

/**
 * Build a complete system prompt from catalog and options.
 *
 * Sections (in order):
 *  1. Model-specific prefix
 *  2. Format specification (with 3-node example)
 *  3. Component catalog (JSON schemas or summaries)
 *  4. Few-shot examples (synthetic from catalog)
 */
export function buildSystemPrompt(
  schemas: ReadonlyMap<string, SchemaEntry>,
  opts: PromptEngineeringOptions = {},
): string {
  const profile = resolveProfile(opts)
  const compiled = compileCatalog(schemas)
  const maxEntries = opts.maxCatalogEntries ?? compiled.length

  const sections: string[] = []

  // 1. Model prefix
  sections.push(profile.systemPrefix)

  // 2. Format specification
  if (opts.includeFormatSpec !== false) {
    sections.push(formatSpecSection(profile.preferNestedFormat))
  }

  // 3. Component catalog
  sections.push('# Available Components\n')
  for (const comp of compiled.slice(0, maxEntries)) {
    sections.push(`## ${comp.name}`)
    if (comp.description) sections.push(comp.description)
    sections.push(`Container: ${comp.hasChildren ? 'yes (can have children)' : 'no (leaf)'}`)

    if (profile.useJsonSchema && comp.jsonSchema) {
      sections.push('Props schema:')
      sections.push('```json')
      sections.push(JSON.stringify(comp.jsonSchema, null, 2))
      sections.push('```')
    } else if (comp.propSummary) {
      sections.push(`Props: ${comp.propSummary}`)
    }
    sections.push('')
  }

  // 4. Few-shot examples
  if (opts.includeFewShot !== false && profile.maxFewShotExamples > 0) {
    const example = generateFewShotExample(compiled, 2)
    if (example) {
      sections.push('# Example Output\n')
      sections.push('```json')
      sections.push(example)
      sections.push('```')
      sections.push('')
    }
  }

  return sections.join('\n')
}

/**
 * Effect accessor: build system prompt from CatalogComponents service.
 */
export const buildPromptEffect = (
  opts?: PromptEngineeringOptions,
): Effect.Effect<string, never, CatalogComponents> =>
  Effect.map(
    CatalogComponents,
    (catalog) => buildSystemPrompt(catalog.schemas, opts),
  )
