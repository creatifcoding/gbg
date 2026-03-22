/**
 * Inline UI section — teaches the harness agent to emit ```ui NDJSON fences.
 *
 * Static behavioral rules only: format, wire protocol, when to use.
 * The component catalog is injected dynamically per-session via
 * injectGeniferCatalog() into the prompt registry.
 *
 * Key: 'inline-ui', Priority: 250 (after guidelines, before project-context)
 *
 * @module harness/prompt/sections/inline-ui
 */

import type { PromptEntry } from '../types'
import type { PromptRegistryShape } from '../PromptRegistry'
import type { CatalogTier, CatalogDomain } from '@/lib/genifer/core/CatalogService'
import { Effect } from 'effect'

// =============================================================================
// Static Section — format rules, decision heuristics (always in prompt)
// =============================================================================

export const makeInlineUISection = (): PromptEntry => {
  const content = `# Inline UI Generation (\`\`\`ui fence)

You can render live, interactive UI components directly inline in your responses.
Wrap NDJSON (one JSON object per line) in a \`\`\`ui code fence.
Elements render progressively — the user sees UI building in real-time as you emit each line.

## Wire Format

\`\`\`ui
{"root":"dashboard"}
{"key":"dashboard","type":"VStack","props":{"gap":16},"children":["title","cards"]}
{"key":"title","type":"Heading","props":{"text":"System Status","level":2}}
{"key":"cards","type":"Grid","props":{"template":"1fr 1fr","gap":12},"children":["card-a","card-b"]}
{"key":"card-a","type":"Card","props":{"title":"Latency"},"children":["val-a"]}
{"key":"val-a","type":"Text","props":{"text":"247ms"}}
{"key":"card-b","type":"Card","props":{"title":"Throughput"},"children":["val-b"]}
{"key":"val-b","type":"Text","props":{"text":"2,847 req/min"}}
\`\`\`

## Format Rules

1. First line: \`{"root":"<root-key>"}\` — declares the root element.
2. Each subsequent line: one element as \`{"key":"<id>","type":"<Component>","props":{...},"children":[...]}\`
3. Each line MUST be valid, self-contained JSON. One element per line.
4. \`children\` is an array of key strings referencing other elements. Omit for leaf components.
5. \`type\` must be a component from the **Genifer Component Catalog** section (injected per-session).
6. Every key referenced in \`children\` must have its own element line.
7. The \`root\` key must reference an element that exists.

## Element Shape

\`\`\`json
{
  "key": "unique-id",
  "type": "ComponentName",
  "props": { "label": "Click me", "variant": "primary" },
  "children": ["child-key-1", "child-key-2"],
  "className": "mt-4 px-6"
}
\`\`\`

- \`key\`: Unique string identifier (required)
- \`type\`: Component name from catalog (required)
- \`props\`: Component-specific properties (required, can be \`{}\`)
- \`children\`: Array of child keys (optional, containers only)
- \`className\`: Tailwind utility classes for styling (optional)

## When to Use \`\`\`ui

- Showing UI mockups, forms, dashboards, data displays, status panels
- Presenting interactive controls the user can see rendered
- Rendering structured data (cards, tables, metric grids)
- Any time a visual is more useful than describing UI in text

Prefer \`\`\`ui fences over describing UI in prose. The user sees real rendered components.

## Composition Rules

- **Containers** (VStack, HStack, Grid, Card, Box, Flex) can hold any component as children.
- **Leaf components** (Text, Heading, Button, Input, Badge, etc.) cannot have children.
- Nest containers freely: Grid inside Card, VStack inside HStack, etc.
- Use \`className\` for Tailwind layout tweaks (margins, padding, sizing, borders).
- Use component \`props\` for semantic behavior (text, variant, level).`

  const sizeBytes = new TextEncoder().encode(content).byteLength

  return {
    key: 'inline-ui',
    priority: 250,
    content,
    sizeBytes,
  }
}

// =============================================================================
// Dynamic Catalog Injection — scoped component brief (per-session/per-turn)
// =============================================================================

export interface CatalogInjectionOptions {
  /** Visibility tier cutoff. Default: 'core' */
  readonly tier?: CatalogTier
  /** Domain filter. Default: ['ui'] */
  readonly domains?: ReadonlyArray<CatalogDomain>
}

/**
 * Inject the genifer component catalog into a session's prompt registry.
 *
 * Writes an agent-owned entry 'genifer-catalog' at priority 260
 * (after inline-ui format rules at 250, before project-context at 300).
 *
 * Call this at session creation. Can be re-called per-turn with different
 * tier/domain scoping to narrow or widen the available component set.
 */
export const injectGeniferCatalog = (
  registry: PromptRegistryShape,
  options?: CatalogInjectionOptions,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    // Dynamic import to avoid pulling the full catalog into the prompt module at import time
    const { coreDomainCatalog } = yield* Effect.promise(() => import('@/lib/genifer/catalog'))
    const { makeCatalogComponents } = yield* Effect.promise(() => import('@/lib/genifer/core/CatalogService'))

    const catalog = makeCatalogComponents()
    catalog.register(coreDomainCatalog)

    const tier = options?.tier ?? 'core'
    const domains = options?.domains ?? ['ui']
    const prompt = catalog.generateScopedPrompt({ tier, domains })

    yield* registry.set('genifer-catalog', prompt, { priority: 260 })
  }).pipe(
    Effect.catchAll(() => Effect.void), // Graceful fallback — harness works without catalog
    Effect.withSpan('tmnl.harness.prompt.inject-genifer-catalog'),
  )
