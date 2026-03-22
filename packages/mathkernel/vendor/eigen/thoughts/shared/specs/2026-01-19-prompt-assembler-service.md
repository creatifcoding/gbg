# PromptAssemblerService Specification

> **Status**: APPROVED
> **Date**: 2026-01-19
> **Author**: Val (via Discovery Interview)
> **Location**: `src/lib/ai-core/`

---

## Executive Summary

PromptAssemblerService is an Effect-native prompt assembly pipeline that uses progressive disclosure to dramatically reduce token usage while maintaining prompt quality. It analyzes incoming requests via a Haiku micro-agent, resolves only relevant prompt sections from a hot-reloadable registry, and assembles optimized prompts with full observability.

**Target**: 80% token reduction on average (measure first, then validate).

---

## Problem Statement

### Current Pain Points

1. **Token Waste**: The current 250-line `buildUIGenerationPrompt()` includes all sections regardless of request type. A simple "create a button" request receives CHART PANEL OPTIONS, MORPHCARD SIZING, GENERATIVECONTAINER RULES - all irrelevant.

2. **Maintainability**: Prompt logic is monolithic and scattered. Updating a section requires editing a massive function. No clear ownership of sections.

3. **No Observability**: Cannot see what prompt was sent, which sections were included, or measure token efficiency.

4. **Parity Issues**: CardEntityHandlers has a truncated prompt (tmnl-n74j8) because maintaining two copies is impractical.

### Why Now

The parity audit revealed 80% of server.ts prompt content is missing from cluster handlers. Rather than copy-paste, we should build infrastructure that:
- Assembles prompts dynamically based on intent
- Maintains sections in one place
- Provides observability for optimization

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Token reduction | 80% average | `(fullTokens - assembledTokens) / fullTokens` |
| Latency overhead | <500ms | Time from request to assembled prompt |
| Section coverage | 100% | All current prompt content migrated to sections |
| Observability | Full | Every assembled prompt has metadata |

---

## User Personas

### Primary: CardEntityHandlers

Effect Cluster handlers that need optimized prompts for UI generation, chart styling, etc.

### Secondary: Cursor Server

HTTP endpoints in `server.ts` that currently use `buildUIGenerationPrompt()`.

### Future: Any AI-powered feature

Morph agents, terminal chat, any feature that sends system prompts to LLMs.

---

## Architecture

### Pipeline Flow

```
Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ IntentClassifier (Haiku, <500ms)                            │
│   Input: prompt text + optional hints                       │
│   Output: StructuredIntent                                  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ IntentCache (mockable dependency)                           │
│   MVP: AlwaysMissCache (no caching)                         │
│   Future: Semantic similarity or pattern-based caching      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ RelevanceScorer                                             │
│   - Scores each section [0, 1] based on intent match        │
│   - Domain boost (+0.2), capability match (+0.1 each)       │
│   - Complexity alignment (+0.1)                             │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ PromptSectionRegistry (RedBlackTree + LayerMap)             │
│   - Map: O(1) lookup by section ID                          │
│   - RedBlackTree: O(log n) relevance-ordered selection      │
│   - Range query: greaterThanEqualForwards(threshold)        │
│   - Hot-reloadable via LayerMap.invalidate()                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ TokenBudgetManager                                          │
│   - Tiered budgets by complexity                            │
│   - Sections already ordered by relevance (tree property)   │
│   - Soft enforcement with warnings                          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ PromptAssembler                                             │
│   - Template interpolation                                  │
│   - Section ordering (by relevance, descending)             │
│   - Observability span                                      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
AssembledPrompt
```

### High-Throughput Stream + Sink Control (Effect)

All streaming pipelines are Effect-native and must be **ordered** and **lossless**.
Backpressure uses `suspend` so no events are dropped. Batching uses a heuristic
to reduce overhead without sacrificing step-level determinism.

**Batch heuristic**:
- `maxItems = 50` events per batch
- `maxDelay = 200ms` between batches

These defaults are safe for UI/agent workflows and can be tuned later.

**Guidelines**:
- Use `Stream.async` with `bufferSize` + `strategy: "suspend"`
- Use `Stream.aggregateWithin` with `Sink.foldUntilEffect` and `Schedule.spaced`
- Use ordered processing (`Stream.mapEffect` with `concurrency: 1`)
- Use `Stream.runForEachChunk` for sink efficiency

**Batching example (sink-side, ordered + lossless)**:

```typescript
const batched = stream.pipe(
  Stream.aggregateWithin(
    Sink.foldUntilEffect(Chunk.empty<AssembleProgress>(), 50, (acc, e) =>
      Effect.succeed(Chunk.append(acc, e))
    ),
    Schedule.spaced("200 millis")
  ),
  Stream.mapEffect((chunk) => Effect.succeed(chunk), { concurrency: 1, unordered: false })
)

// Example sink: write chunks to storage
yield* Stream.runForEachChunk(batched, (chunk) =>
  Effect.log(`batch-size:${Chunk.size(chunk)}`)
)
```

---

## Functional Requirements

### P0: Must Have

#### FR-0: Effect-Native Boundaries

All core logic is Effect-native. `async` is only used at tool/HTTP boundaries.
Inside services and pipelines, everything returns `Effect` and composes via
`Effect.gen`, `Effect.map`, and `Effect.flatMap`.

**Acceptance Criteria**:
- [ ] No `async` in `ai-core` service implementations
- [ ] Tool/HTTP handlers wrap Effects with `Effect.runPromise`

#### FR-1: Intent Classification

```typescript
// Input
interface ClassifyRequest {
  prompt: string
  hints?: string[]  // Optional: caller can provide hints like ['chart', 'dashboard']
}

// Output
interface StructuredIntent {
  domain: 'visualization' | 'form' | 'layout' | 'interactive' | 'content' | 'mixed'
  capabilities: string[]  // ['chart', 'responsive', 'foldable', 'generative']
  complexity: 'simple' | 'medium' | 'complex'
  confidence: number  // 0-1
}
```

**Acceptance Criteria**:
- [ ] Haiku model completes classification in <500ms
- [ ] Classification accuracy >90% on test set
- [ ] Graceful degradation: if classification fails, include all sections

#### FR-2: Section Registry (RedBlackTree + Map)

```typescript
interface PromptSection {
  id: string                      // 'chart-panel-options'
  tags: string[]                  // ['chart', 'visualization', 'panel']
  domain: Domain                  // Primary domain for relevance scoring
  requiredCapabilities?: string[] // Capabilities that boost relevance
  complexityLevel?: Complexity    // Alignment bonus if matches intent
  dependencies: string[]          // ['base', 'layout'] - other sections this requires
  hardInclude?: boolean           // Always include, bypass selection + compression
  baseRelevance: number           // 0-1, starting score before intent-based boosts
  priority: number                // 1-10, tiebreaker within same relevance
  estimatedTokens: {
    full: number
    compact: number
    micro: number
  }                               // Approximate token count per variant
  templateVariants: TemplateVariants
}

type TemplateFunction = (context: TemplateContext) => string
type TemplateVariants = {
  full: TemplateFunction
  compact: TemplateFunction
  micro: TemplateFunction
}

interface TemplateContext {
  catalog: CatalogDocs           // From getCatalogPrompt()
  request: RequestContext        // prompt, currentTree, etc.
  intent: StructuredIntent       // Classified intent
  custom: Record<string, unknown> // Additional context
}

// Dual data structure approach
interface SectionRegistry {
  sectionsById: Map<string, PromptSection>         // O(1) lookup by ID
  buildRelevanceTree: (scores: Map<string, number>) // Builds RedBlackTree per-request
    => RedBlackTree<number, PromptSection>
}
```

**RedBlackTree Selection Algorithm**:

```typescript
// 1. Score all sections against intent
const scores = computeRelevanceScores(intent, sectionsById)

// 2. Build RedBlackTree keyed by [relevance, id] to avoid collisions
let tree = RedBlackTree.empty<[number, string], PromptSection>(
  Order.tuple(Order.number, Order.string)
)
for (const [id, relevance] of scores) {
  const section = sectionsById.get(id)
  if (section) {
    tree = RedBlackTree.insert(tree, [relevance, id], section)
  }
}

// 3. Range query: O(log n) to find threshold, then iterate qualifying nodes
const threshold = 0.7 // Configurable
const selected: PromptSection[] = []
for (const [[_relevance, _id], section] of
     RedBlackTree.greaterThanEqualForwards(tree, [threshold, ''])) {
  selected.push(section)
}
// Result: sections ordered by relevance (tree property)
```

**Relevance Scoring Formula**:

```typescript
const computeRelevanceScores = (intent: StructuredIntent, sections: Map<string, PromptSection>) => {
  const scores = new Map<string, number>()

  for (const [id, section] of sections) {
    let relevance = section.baseRelevance ?? 0.5

    // Domain match: +0.2
    if (section.domain === intent.domain) {
      relevance += 0.2
    }

    // Capability match: +0.1 per match
    const capMatch = intent.capabilities.filter(c =>
      section.requiredCapabilities?.includes(c)
    ).length
    relevance += capMatch * 0.1

    // Complexity alignment: +0.1
    if (section.complexityLevel === intent.complexity) {
      relevance += 0.1
    }

    // Clamp to [0, 1]
    scores.set(id, Math.min(1, Math.max(0, relevance)))
  }

  return scores
}
```

**Acceptance Criteria**:
- [ ] Sections can be registered from any module
- [ ] Cyclical dependencies are skipped with warning
- [ ] Hot-reload works: invalidate section → next call uses new content
- [ ] RedBlackTree range query returns sections above threshold
- [ ] Relevance scoring formula is configurable
- [ ] O(log n) selection complexity verified in benchmarks
- [ ] Schema validation on read skips invalid rows with warning

#### FR-3: Prompt Assembly

```typescript
interface AssembleRequest {
  prompt: string
  currentTree?: unknown
  components?: ComponentDoc[]     // Dynamic component injection
  hardIncludeSectionIds?: string[] // Always include at full fidelity
  context?: Record<string, unknown>
}

interface AssembledPrompt {
  content: string
  metadata: PromptMetadata
}

interface PromptMetadata {
  sectionsIncluded: string[]
  sectionsExcluded: string[]
  tokenCount: number
  fullPromptTokens: number       // What it would be with all sections
  reduction: number              // Percentage reduction
  intent: StructuredIntent
  budget: {
    tier: 'simple' | 'medium' | 'complex'
    limit: number
    used: number
    warnings: string[]
  }
  warnings: string[]             // Compression/cycle/validation warnings
  assemblyTimeMs: number
  classificationTimeMs: number
}
```

**Acceptance Criteria**:
- [ ] Assembled prompt is valid (all required sections present)
- [ ] Metadata accurately reflects assembly decisions
- [ ] Observability span includes all metrics
- [ ] Assembly uses selected template variant (full/compact/micro)

#### FR-4: Token Budget Management

| Complexity | Budget | Use Case |
|------------|--------|----------|
| simple | 2000 | Single component, basic UI |
| medium | 5000 | Multi-component, some interactivity |
| complex | 10000 | Dashboard, mixed domains, generative |

**Compression Strategy (no drops)**:

- All sections must provide `templateVariants.full|compact|micro`
- Variants are pre-authored and factual (no auto-summarization)
- Budget manager selects variant per section
- Dependencies compress before non-dependencies
- Hard-includes always use `full`

```typescript
const applyBudget = (sections: PromptSection[], tier: Complexity) =>
  Effect.sync(() => {
    const warnings: string[] = []
    const selected = sections.map((section) => ({
      section,
      variant: 'full' as const,
    }))

    const compress = (entry: { section: PromptSection; variant: 'full' | 'compact' | 'micro' }) => {
      if (entry.section.hardInclude) return
      if (entry.variant === 'full') entry.variant = 'compact'
      else if (entry.variant === 'compact') entry.variant = 'micro'
      if (entry.variant !== 'full') {
        warnings.push(`compressed:${entry.section.id}:${entry.variant}`)
      }
    }

    // compress deps first, then non-deps until within budget
    while (estimateTokens(selected) > tierBudget(tier)) {
      const dep = selected.find((s) => isDependency(sections, s.section))
      if (dep) {
        compress(dep)
      } else {
        const next = selected.find((s) => s.variant !== 'micro')
        if (!next) break
        compress(next)
      }
    }

    return { sections: selected, warnings }
  })
```

**Acceptance Criteria**:
- [ ] Budget tier determined by intent complexity
- [ ] Dependencies resolved before budget enforcement
- [ ] Over-budget handled by compression (full → compact → micro), not dropping
- [ ] Compression applies to all sections, deps first
- [ ] Warnings emitted for any compressed sections

### P1: Should Have

#### FR-5: Intent Caching

```typescript
interface IntentCache {
  get: (key: string) => Effect.Effect<Option<StructuredIntent>>
  set: (key: string, intent: StructuredIntent) => Effect.Effect<void>
  invalidate: (key: string) => Effect.Effect<void>
}

// MVP implementation
class AlwaysMissCache implements IntentCache {
  get = () => Effect.succeed(Option.none())
  set = () => Effect.void
  invalidate = () => Effect.void
}
```

**Acceptance Criteria**:
- [ ] Cache is a mockable dependency
- [ ] MVP uses AlwaysMissCache
- [ ] Interface supports future implementations

#### FR-6: Catalog Filtering

Instead of always including full catalog, filter to relevant components:

```typescript
// If intent.capabilities includes 'chart'
// → Include chart component docs
// → Exclude form component docs

// If intent.capabilities includes 'form'
// → Include form component docs
// → Exclude chart component docs
```

**Acceptance Criteria**:
- [ ] Catalog section respects intent capabilities
- [ ] Base components (Text, Container, etc.) always included
- [ ] Domain-specific components conditionally included

### P2: Nice to Have

#### FR-7: Section Analytics

Track which sections are used most, least, never:

```typescript
interface SectionAnalytics {
  sectionId: string
  includeCount: number
  excludeCount: number
  avgTokenContribution: number
}
```

### P1: Observability & Refined Scoring

#### FR-8: Observability Infrastructure (Supervisor + Logger)

Effect-native observability using Supervisor for fiber lifecycle and custom Logger for structured output.

**Supervisor Integration**:

```typescript
// Custom Supervisor that tracks assembly fibers
class AssemblySupervisor extends Supervisor.AbstractSupervisor<AssemblyMetrics> {
  private metrics: AssemblyMetrics = {
    activeFibers: 0,
    completedFibers: 0,
    failedFibers: 0,
    totalAssemblyTime: 0,
  }

  get value(): Effect.Effect<AssemblyMetrics> {
    return Effect.succeed(this.metrics)
  }

  onStart<A, E, R>(
    _context: Context.Context<R>,
    _effect: Effect.Effect<A, E, R>,
    _parent: Option.Option<Fiber.RuntimeFiber<any, any>>,
    fiber: Fiber.RuntimeFiber<A, E>
  ): void {
    this.metrics.activeFibers++
    // Tag fiber with assembly metadata
    Effect.annotateLogs(Effect.void, {
      fiberId: fiber.id.toString(),
      operation: 'prompt-assembly',
    })
  }

  onEnd<A, E>(exit: Exit.Exit<A, E>, _fiber: Fiber.RuntimeFiber<A, E>): void {
    this.metrics.activeFibers--
    if (Exit.isSuccess(exit)) {
      this.metrics.completedFibers++
    } else {
      this.metrics.failedFibers++
    }
  }
}

// Usage: Supervise assembly operations
const supervisedAssembly = Effect.supervised(
  PromptAssemblerService.assemble(request),
  assemblySupervisor
)
```

**Custom Logger Integration** (using Effect's Console module):

```typescript
import { Logger, Effect, LogLevel, Console, Cause, HashMap, List } from 'effect'

/**
 * Structured logger that outputs assembly-specific JSON via Effect's Console
 *
 * Key pattern:
 * 1. Logger.make() creates the structured output format
 * 2. Logger.withLeveledConsole routes to Console.error/info/etc based on level
 * 3. Logger.replace integrates with Effect runtime
 */
const AssemblyLogger = Logger.make<string, unknown>((options) => {
  const { fiberId, logLevel, message, cause, spans, annotations, date } = options

  // Extract assembly-specific annotations using HashMap.get
  const assemblyId = HashMap.get(annotations, 'assemblyId')
  const stage = HashMap.get(annotations, 'stage')
  const sectionCount = HashMap.get(annotations, 'sectionCount')

  // Build structured entry
  return {
    timestamp: date.toISOString(),
    level: logLevel._tag,
    fiberId: fiberId.id.toString(),
    message,
    // Unwrap Option values
    ...(assemblyId._tag === 'Some' ? { assemblyId: assemblyId.value } : {}),
    ...(stage._tag === 'Some' ? { stage: stage.value } : {}),
    ...(sectionCount._tag === 'Some' ? { sectionCount: sectionCount.value } : {}),
    // Convert List to array for spans
    spans: List.toArray(spans).map(({ label, startTime }) => ({
      label,
      startTime,
    })),
    ...(Cause.isEmpty(cause) ? {} : { cause: Cause.pretty(cause) }),
  }
})

// Pipe through withLeveledConsole to use Effect's Console service
// This routes logError → Console.error, logInfo → Console.info, etc.
const AssemblyLeveledLogger = AssemblyLogger.pipe(
  Logger.map((entry) => JSON.stringify(entry)),  // Convert to JSON string
  Logger.withLeveledConsole                       // Route via Effect's Console
)

// Layer to replace the default logger
const AssemblyLoggerLayer = Logger.replace(
  Logger.defaultLogger,
  AssemblyLeveledLogger
)

// Alternative: Add as additional logger (keeps default + adds assembly)
const AssemblyLoggerAdditive = Logger.add(AssemblyLeveledLogger)
```

**Using built-in structured logger** (simpler alternative):

```typescript
import { Logger, Effect } from 'effect'

// Option 1: Built-in JSON logger (outputs JSON strings)
const JsonLoggerLayer = Logger.json

// Option 2: Built-in structured logger (outputs structured objects)
const StructuredLoggerLayer = Logger.structured

// Option 3: JSON with leveled console (respects log levels)
const LeveledJsonLogger = Logger.jsonLogger.pipe(Logger.withLeveledConsole)
const LeveledJsonLoggerLayer = Logger.replace(Logger.defaultLogger, LeveledJsonLogger)

// Usage: provide to Effect runtime
const program = Effect.gen(function* () {
  yield* Effect.log('Assembly started')
  yield* Effect.annotateLogs({ assemblyId: 'uuid-123' })(
    Effect.log('Processing sections')
  )
}).pipe(Effect.provide(JsonLoggerLayer))
```

**Span-based Pipeline Tracing**:

```typescript
const assemble = (request: AssembleRequest) =>
  Effect.gen(function* () {
    // Annotate entire assembly with unique ID
    yield* Effect.annotateLogsScoped({ assemblyId: crypto.randomUUID() })

    // Stage 1: Classification
    const intent = yield* Effect.withLogSpan('classification')(
      classifier.classify(request)
    ).pipe(
      Effect.tap(() => Effect.annotateLogs({ stage: 'classification' }))
    )

    // Stage 2: Relevance Scoring
    const scores = yield* Effect.withLogSpan('relevance-scoring')(
      registry.computeRelevanceScores(intent)
    )

    // Stage 3: Section Selection
    const sections = yield* Effect.withLogSpan('section-selection')(
      registry.getRelevantSections(intent, threshold)
    ).pipe(
      Effect.tap((s) => Effect.annotateLogs({ sectionCount: s.length }))
    )

    // Stage 4: Assembly
    return yield* Effect.withLogSpan('assembly')(
      assembleSections(sections, context)
    )
  }).pipe(Effect.scoped)
```

**Acceptance Criteria**:
- [ ] Supervisor tracks active/completed/failed fibers
- [ ] Custom Logger outputs structured JSON with assembly metadata
- [ ] Each pipeline stage has its own span for timing
- [ ] Annotations include assemblyId, stage, sectionCount
- [ ] Exit inspection distinguishes success/failure reasons

#### FR-9: Refined Relevancy Scoring (Threshold-Floored K + Composite Weights)

Discovery interview revealed: composite weight system with threshold-floored K selection.

> **Future Extension**: The current additive weight model is intentional simplicity. A separate spec
> will detail multiplicative intent amplification for more sophisticated relevance scoring.
> See: `thoughts/shared/specs/YYYY-MM-DD-intent-amplification-model.md` (planned)

**Threshold-Floored K Selection** (quality floor + efficiency-capped ceiling):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     THRESHOLD-FLOORED K ALGORITHM                            │
│                                                                             │
│   1. Score all sections                                                     │
│   2. Filter to those ≥ qualityThreshold (e.g., 0.5)   ← QUALITY FLOOR       │
│   3. Compute K_max from budget + efficiency metrics   ← EFFICIENCY CAP      │
│   4. Take top K_max from filtered set                 ← QUANTITY CEILING    │
│                                                                             │
│   Result: High-quality sections, bounded by efficiency                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
interface ThresholdFlooredKConfig {
  // Quality floor
  qualityThreshold: number   // e.g., 0.5 — minimum relevance to consider

  // Budget constraints
  tokenBudget: number        // e.g., 5000 — total token allowance

  // Efficiency metrics (computed at runtime)
  avgSectionTokens: number   // e.g., 200 — from registry stats
  avgSectionUtility: number  // e.g., 0.7 — historical "usefulness" per token

  // Hard limits
  minK: number               // e.g., 3 — always include at least this many
  maxK: number               // e.g., 20 — never exceed this many
}

/**
 * Compute K_max using budget and efficiency heuristic
 *
 * The efficiency factor adjusts K based on how "useful" sections typically are:
 * - High utility (0.9) → allow more sections (budget stretches further)
 * - Low utility (0.5) → restrict sections (budget spent carefully)
 */
const computeKMax = (config: ThresholdFlooredKConfig): number => {
  const {
    tokenBudget,
    avgSectionTokens,
    avgSectionUtility,
    minK,
    maxK,
  } = config

  // Base K from budget
  const baseK = Math.floor(tokenBudget / avgSectionTokens)

  // Efficiency multiplier: high utility = allow more, low utility = restrict
  // Range: [0.5, 1.5] based on avgSectionUtility [0, 1]
  const efficiencyMultiplier = 0.5 + avgSectionUtility

  // Adjusted K
  const adjustedK = Math.floor(baseK * efficiencyMultiplier)

  // Clamp to bounds
  return Math.max(minK, Math.min(maxK, adjustedK))
}

// Example:
// tokenBudget=5000, avgSectionTokens=200, avgSectionUtility=0.8
// baseK = 5000/200 = 25
// efficiencyMultiplier = 0.5 + 0.8 = 1.3
// adjustedK = 25 * 1.3 = 32 → clamped to maxK=20
```

**Selection Algorithm**:

```typescript
const selectSections = (
  intent: StructuredIntent,
  config: ThresholdFlooredKConfig,
  options?: { hardIncludeSectionIds?: string[] }
) =>
  Effect.gen(function* () {
    // 1. Score all sections (additive model)
    const scores = yield* computeRelevanceScores(intent)

    // 2. Build tree and filter by quality threshold
    const tree = yield* buildRelevanceTree(scores)
    const qualityFiltered: PromptSection[] = []
    for (const [[relevance, _id], section] of
         RedBlackTree.greaterThanEqualForwards(tree, [config.qualityThreshold, ''])) {
      qualityFiltered.push(section)
    }

    // 3. Compute efficiency-capped K
    const kMax = computeKMax(config)

    // 4. Take top K from quality-filtered set (already sorted by tree)
    // Note: tree iteration is ascending, so we reverse for top-K
    const topK = qualityFiltered.slice(-kMax).reverse()

    // 5. Add hard-include sections (always full fidelity)
    const hardIncludeIds = options?.hardIncludeSectionIds ?? []
    const hardIncludes = hardIncludeIds
      .map((id) => sectionsById.get(id))
      .filter((s): s is PromptSection => Boolean(s))

    // 6. Resolve dependencies (may add more sections)
    const { sections, warnings } = yield* resolveDependencies(
      [...topK, ...hardIncludes],
      sectionsById
    )
    // warnings propagated to PromptMetadata.warnings
    return sections
  })
```

**Composite Weight System**:

```typescript
/**
 * Four weight sources, summed for final relevance (ADDITIVE MODEL):
 *
 * 1. declared  — Section author's base relevance estimate
 * 2. learned   — Historical inclusion rate for this (domain, complexity) bucket
 * 3. computed  — Intent matching bonuses (domain, capabilities, complexity)
 * 4. override  — Runtime API adjustments from tools
 *
 * NOTE: Additive model is intentional MVP simplicity. Future extension will
 * explore multiplicative intent amplification where computed acts as a
 * multiplier on (declared + learned + override) rather than an addend.
 */
export const SectionWeights = Schema.Struct({
  /** Base relevance declared by section author */
  declared: Schema.Number.pipe(Schema.between(0, 1)),

  /**
   * Learned from historical inclusion rate
   * MVP: inclusion_count / request_count for matching (domain, complexity)
   *
   * NOTE: Full learning system deferred to sidecar application.
   * See: thoughts/shared/specs/YYYY-MM-DD-continual-learning-sidecar.md (planned)
   */
  learned: Schema.optionalWith(Schema.Number, { default: () => 0 }),

  /** Computed from current intent matching */
  computed: Schema.optionalWith(Schema.Number, { default: () => 0 }),

  /**
   * Runtime override from tools via API
   * Positive = boost, Negative = suppress (hard-include is separate)
   * Accessed via: POST /api/assembler/overrides/:sectionId
   */
  override: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type SectionWeights = typeof SectionWeights.Type

const computeFinalRelevance = (weights: SectionWeights): number => {
  // Additive model: all sources contribute equally, then clamp
  const raw = weights.declared + weights.learned + weights.computed + weights.override
  return Math.min(1, Math.max(0, raw))
}
```

**Enhanced Scoring Algorithm**:

```typescript
const computeRelevanceScores = (
  intent: StructuredIntent,
  sections: Map<string, PromptSection>,
  learnedWeights: Map<string, number>,  // From analytics
  overrides: Map<string, number>         // From config
) =>
  Effect.sync(() => {
    const scores = new Map<string, ScoredSection>()

    for (const [id, section] of sections) {
      // 1. Declared weight (section author)
      const declared = section.baseRelevance ?? 0.5

      // 2. Learned weight (historical)
      const learned = learnedWeights.get(id) ?? 0

      // 3. Computed weight (intent matching)
      let computed = 0
      if (section.domain === intent.domain) computed += 0.2
      const capMatch = intent.capabilities.filter(c =>
        section.requiredCapabilities?.includes(c)
      ).length
      computed += capMatch * 0.1
      if (section.complexityLevel === intent.complexity) computed += 0.1

      // 4. Override (admin config)
      const override = overrides.get(id) ?? 0

      const weights: SectionWeights = { declared, learned, computed, override }
      const relevance = computeFinalRelevance(weights)

      scores.set(id, {
        section,
        relevance,
        scoreBreakdown: { base: declared, domainBoost: 0, capabilityBoost: capMatch * 0.1, complexityBoost: computed - capMatch * 0.1 - (section.domain === intent.domain ? 0.2 : 0) },
      })
    }

    return scores
  })
```

**Top-K Selection** (replaces threshold):

```typescript
const getTopKSections = (
  intent: StructuredIntent,
  config: DynamicKConfig,
  options?: { hardIncludeSectionIds?: string[] }
) =>
  Effect.gen(function* () {
    // 1. Compute all scores
    const scores = yield* computeRelevanceScores(intent, sectionsById, learnedWeights, overrides)

    // 2. Build RedBlackTree (sorted by relevance)
    const tree = yield* buildRelevanceTree(scores)

    // 3. Compute K
    const avgTokens = yield* computeAvgTokens(sectionsById)
    const k = computeK({ ...config, avgSectionTokens: avgTokens })

    // 4. Take top K from tree (descending)
    const selected: PromptSection[] = []
    const iter = RedBlackTree.lessThanEqualBackwards(tree, 1.0) // Start from max
    for (const [_relevance, section] of iter) {
      if (selected.length >= k) break
      selected.push(section)
    }

    // 5. Add hard-include sections (always full fidelity)
    const hardIncludeIds = options?.hardIncludeSectionIds ?? []
    const hardIncludes = hardIncludeIds
      .map((id) => sectionsById.get(id))
      .filter((s): s is PromptSection => Boolean(s))

    // 6. Resolve dependencies (may exceed K)
    const { sections, warnings } = yield* resolveDependencies(
      [...selected, ...hardIncludes],
      sectionsById
    )
    // warnings propagated to PromptMetadata.warnings
    return sections
  })
```

**Acceptance Criteria**:
- [ ] K is dynamically computed from budget/avgTokens
- [ ] All four weight sources are summed correctly
- [ ] Learned weights are updated from section analytics
- [ ] Overrides can boost or suppress sections
- [ ] Top-K selection uses RedBlackTree descending iteration

#### FR-10: Override Runtime API

Overrides are managed via a runtime API that tools can call to dynamically boost or suppress sections.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OVERRIDE RUNTIME API                                 │
│                                                                             │
│   Tools (AI agents, MCP servers, etc.) can adjust section relevance         │
│   at runtime without code changes or restarts.                              │
│                                                                             │
│   Use Cases:                                                                │
│   • Boost new section until learned weight accumulates                      │
│   • Suppress deprecated section during phase-out                            │
│   • Force critical section (security rules) to always include               │
│   • Temporarily adjust for A/B testing                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Endpoints**:

```typescript
// POST /api/assembler/overrides/:sectionId
// Set override for a section
interface SetOverrideRequest {
  version: number    // Monotonic per section_id
  value: number      // -1.0 to +1.0
  reason?: string    // Audit trail
  ttl?: number       // Auto-expire in ms (optional)
}

// GET /api/assembler/overrides
// List all active overrides
interface OverrideEntry {
  sectionId: string
  version: number
  value: number
  reason?: string
  setAt: number      // Timestamp
  expiresAt?: number // If TTL was set
  setBy: string      // Tool/agent identifier
}

// DELETE /api/assembler/overrides/:sectionId
// Remove override (revert to declared + learned + computed only)
```

**Service Implementation (Postgres authoritative)**:

```typescript
class OverrideService extends Effect.Service<OverrideService>()(
  'ai-core/OverrideService',
  {
    effect: Effect.gen(function* () {
      const repo = yield* AssemblerRepository
      const cache = yield* OverrideCache

      const set = (sectionId: string, request: SetOverrideRequest, setBy: string) =>
        Effect.gen(function* () {
          const entry = {
            sectionId,
            version: request.version,
            value: request.value,
            reason: request.reason,
            setAt: Date.now(),
            expiresAt: request.ttl ? Date.now() + request.ttl : undefined,
            setBy,
          }
          yield* repo.upsertOverride(entry)
          yield* cache.set(sectionId, entry)
        })

      const get = (sectionId: string) =>
        cache.get(sectionId).pipe(
          Effect.map((v) => v ?? 0)
        )

      const remove = (sectionId: string) =>
        repo.removeOverride(sectionId)

      const list = () =>
        repo.listOverrides()

      return { set, get, remove, list } as const
    }),
  }
) {}
```

**Integration with Scoring**:

```typescript
// In computeRelevanceScores:
const override = yield* OverrideService.get(section.id)
weights.override = override
```

**Acceptance Criteria**:
- [ ] Tools can set/get/remove overrides via HTTP API
- [ ] Overrides support TTL for auto-expiry
- [ ] Audit trail includes reason and setBy
- [ ] Expired overrides are cleaned up on access
- [ ] Override values clamp final relevance to [0, 1]
- [ ] Hard-include is separate from overrides and bypasses selection/compression

#### FR-11: Embedding Service (Mockable)

Mockable interface for future semantic matching. MVP uses mock implementation.

```typescript
// Interface for semantic matching
interface EmbeddingService {
  /** Embed text to vector */
  embed: (text: string) => Effect.Effect<Float32Array, EmbeddingError>

  /** Compute similarity between vectors */
  similarity: (a: Float32Array, b: Float32Array) => Effect.Effect<number>

  /** Embed and cache section content */
  embedSection: (section: PromptSection) => Effect.Effect<void>

  /** Find sections similar to query */
  findSimilar: (query: string, k: number) => Effect.Effect<ScoredSection[]>
}

// MVP: Mock implementation (returns random scores)
class MockEmbeddingService extends Effect.Service<MockEmbeddingService>()(
  'ai-core/EmbeddingService',
  {
    effect: Effect.gen(function* () {
      // Mock embedding: returns zero vector
      const embed = (_text: string) =>
        Effect.succeed(new Float32Array(384).fill(0))

      // Mock similarity: returns 0.5
      const similarity = (_a: Float32Array, _b: Float32Array) =>
        Effect.succeed(0.5)

      const embedSection = (_section: PromptSection) =>
        Effect.void

      const findSimilar = (_query: string, _k: number) =>
        Effect.succeed([])

      return { embed, similarity, embedSection, findSimilar } as const
    }),
  }
) {}

// Future: Real implementation options
// - all-MiniLM-L6-v2 (100MB, 384-dim)
// - bge-small-en-v1.5 (compact, good quality)
// - @ai-sdk/deepinfra with BAAI/bge-large-en-v1.5 (API-based)
```

**Acceptance Criteria**:
- [ ] EmbeddingService is a mockable Effect.Service
- [ ] MVP uses MockEmbeddingService that returns constant values
- [ ] Interface supports future real implementations
- [ ] No external dependencies in MVP

#### FR-11: A/B Testing Support

Feature flag to compare old vs new prompt assembly:

```typescript
const USE_PROMPT_ASSEMBLER = process.env.USE_PROMPT_ASSEMBLER === 'true'
```

---

## Technical Architecture

### Tool-Centric Model (AI SDK Tools + Postgres Persistence)

The assembler exposes **AI SDK streaming tools** that agents call during UI generation. All artifacts persist to Postgres for audit trail, analytics, and hot-reload support.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI SDK TOOL-CENTRIC ARCHITECTURE                          │
│                                                                             │
│   UI Generation Agent (Claude)                                              │
│   │                                                                         │
│   ├─ tool: assembler_register_section                                       │
│   │   └─ Dev workflow: author section → validate → persist to Postgres      │
│   │                                                                         │
│   ├─ tool: assembler_set_override                                           │
│   │   └─ Runtime: boost/suppress section → Effect.Cache → Postgres (batch)  │
│   │                                                                         │
│   ├─ tool: assembler_assemble (STREAMING)                                   │
│   │   └─ Real-time: classify → score → select → assemble → persist trail    │
│   │   └─ Yields: IntentClassified → SectionsScored → SectionsSelected →     │
│   │              Assembled → AnalyticsRecorded                              │
│   │                                                                         │
│   ├─ tool: assembler_query_history                                          │
│   │   └─ Debug: "What prompts did we send for card XYZ?"                    │
│   │                                                                         │
│   └─ tool: assembler_get_analytics                                          │
│       └─ Learn: "Which sections are never used?"                            │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ Effect.Cache<SectionId, Override>                                    │   │
│   │   ├─ lookup() → Effect<Override>                                     │   │
│   │   ├─ Read-through cache; Postgres is authoritative                  │   │
│   │   └─ capacity: configurable (e.g., 1000 overrides)                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ Postgres (DATABASE_URL via Effect Config)                            │   │
│   │                                                                       │   │
│   │ sections                                                              │   │
│   │ ├─ id TEXT PRIMARY KEY                                                │   │
│   │ ├─ tags JSONB                        -- ['chart', 'visualization']   │   │
│   │ ├─ domain TEXT                       -- 'visualization'              │   │
│   │ ├─ metadata JSONB                    -- {capabilities, complexity}   │   │
│   │ ├─ template_variants JSONB           -- {full, compact, micro}        │   │
│   │ ├─ estimated_tokens JSONB                                           │   │
│   │ ├─ status TEXT                       -- 'draft' | 'active'           │   │
│   │ └─ created_at, updated_at TIMESTAMP                                   │   │
│   │                                                                       │   │
│   │ overrides                                                             │   │
│   │ ├─ section_id TEXT FK                                                 │   │
│   │ ├─ version BIGINT                 -- monotonic per section             │   │
│   │ ├─ value REAL                        -- -1.0 to +1.0                  │   │
│   │ ├─ reason TEXT                                                        │   │
│   │ ├─ set_by TEXT                       -- tool/agent identifier         │   │
│   │ ├─ expires_at TIMESTAMP              -- TTL                           │   │
│   │ └─ set_at TIMESTAMP                                                   │   │
│   │                                                                       │   │
│   │ assemblies                                                            │   │
│   │ ├─ id TEXT PRIMARY KEY               -- UUID                          │   │
│   │ ├─ intent JSONB                      -- {domain, capabilities, ...}   │   │
│   │ ├─ sections_included JSONB           -- ['base', 'chart-options']     │   │
│   │ ├─ sections_excluded JSONB           -- ['morphcard-sizing']          │   │
│   │ ├─ token_count INTEGER                                                │   │
│   │ ├─ reduction_percent REAL            -- 0.82 = 82% reduction          │   │
│   │ ├─ prompt_hash TEXT                  -- For deduplication             │   │
│   │ └─ created_at TIMESTAMP                                               │   │
│   │                                                                       │   │
│   │ analytics                                                             │   │
│   │ ├─ section_id TEXT FK                                                 │   │
│   │ ├─ intent_hash TEXT                  -- Hash of full intent           │   │
│   │ ├─ bucket JSONB                      -- {domain, capabilities[], ...} │   │
│   │ ├─ include_count INTEGER                                              │   │
│   │ ├─ exclude_count INTEGER                                              │   │
│   │ └─ avg_token_contribution REAL                                        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Write-Through Overrides (Postgres Authoritative)

Overrides are audited configuration. Postgres is the source of truth.
The cache is read-through only and never the durability path.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     WRITE-THROUGH OVERRIDE FLOW                              │
│                                                                             │
│   set_override(sectionId, value, version)                                   │
│   │                                                                         │
│   ▼                                                                         │
│   ┌───────────────────────────────────────┐                                 │
│   │ Postgres UPSERT (versioned)           │ ← Authoritative write           │
│   └───────────────────────────────────────┘                                 │
│   │                                                                         │
│   ▼                                                                         │
│   ┌───────────────────────────────────────┐                                 │
│   │ Effect.Cache.set(sectionId, override) │ ← Optional warm cache           │
│   └───────────────────────────────────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Versioned upsert**: `WHERE excluded.version > overrides.version` prevents stale writes.

### Section Lifecycle Workflow

Full lifecycle: Author → Test → Deploy → Monitor (with hot-reload support).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECTION LIFECYCLE WORKFLOW                                │
│                                                                             │
│   ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐     │
│   │   AUTHOR   │───▶│   TEST     │───▶│   DEPLOY   │───▶│   MONITOR  │     │
│   └────────────┘    └────────────┘    └────────────┘    └────────────┘     │
│        │                  │                 │                  │            │
│        ▼                  ▼                 ▼                  ▼            │
│   assembler_          assembler_       assembler_         assembler_       │
│   register_section    assemble         hot_reload         get_analytics    │
│   (status='draft')    (dry_run=true)   (section_id)       (intent_hash)    │
│        │                  │                 │                  │            │
│        ▼                  ▼                 ▼                  ▼            │
│   Postgres:           Compare with     Postgres:           Postgres:        │
│   sections            expected output  UPDATE sections     SELECT analytics │
│   (status='draft')                     SET template_variants=... WHERE intent_hash│
│                                        (triggers cache                      │
│                                         invalidation)      Learn: "chart    │
│                                                           section rarely    │
│                                                           used with 'form'  │
│                                                           domain"           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### AI SDK Tool Definitions

```typescript
// src/lib/ai-core/tools/assembler-tools.ts

import { tool } from 'ai'
import { Effect, Schema, Stream, JSONSchema } from 'effect'

// =============================================================================
// Tool: assembler_register_section
// =============================================================================

const RegisterSectionInput = Schema.Struct({
  id: Schema.String,
  tags: Schema.Array(Schema.String),
  domain: Schema.Literal('visualization', 'form', 'layout', 'interactive', 'content', 'mixed'),
  capabilities: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  complexityLevel: Schema.optional(Schema.Literal('simple', 'medium', 'complex')),
  dependencies: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  hardInclude: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  baseRelevance: Schema.Number.pipe(Schema.between(0, 1)),
  priority: Schema.Number.pipe(Schema.between(1, 10)),
  estimatedTokens: Schema.Struct({
    full: Schema.Number,
    compact: Schema.Number,
    micro: Schema.Number,
  }),
  templateVariants: Schema.Struct({
    full: Schema.String,
    compact: Schema.String,
    micro: Schema.String,
  }),
  status: Schema.optionalWith(Schema.Literal('draft', 'active'), { default: () => 'draft' as const }),
})
type RegisterSectionInput = typeof RegisterSectionInput.Type

export const assembler_register_section = tool({
  description: 'Register or update a prompt section with full/compact/micro templates. Use status=draft for testing.',
  parameters: jsonSchema<RegisterSectionInput>(
    JSONSchema.make(RegisterSectionInput) as Parameters<typeof jsonSchema>[0]
  ),
  execute: (input: RegisterSectionInput) =>
    Effect.gen(function* () {
      yield* AssemblerRepository.upsertSection(input)
      return { success: true, sectionId: input.id, status: input.status }
    }).pipe(
      Effect.provide(AssemblerRepositoryLive),
      Effect.runPromise
    ),
})

// =============================================================================
// Tool: assembler_set_override (Write to Effect.Cache)
// =============================================================================

const SetOverrideInput = Schema.Struct({
  sectionId: Schema.String,
  version: Schema.Number, // Monotonic per section_id
  value: Schema.Number.pipe(Schema.between(-1, 1)), // -1 to +1
  reason: Schema.optional(Schema.String),
  ttlMs: Schema.optionalWith(Schema.Number, { default: () => 300_000 }), // 5min default
})
type SetOverrideInput = typeof SetOverrideInput.Type

export const assembler_set_override = tool({
  description: 'Set relevance override for a section. Positive = boost, negative = suppress.',
  parameters: jsonSchema<SetOverrideInput>(
    JSONSchema.make(SetOverrideInput) as Parameters<typeof jsonSchema>[0]
  ),
  execute: (input: SetOverrideInput, { toolCallId }) =>
    Effect.gen(function* () {
      const setAt = Date.now()
      const expiresAt = setAt + input.ttlMs
      yield* AssemblerRepository.upsertOverride({
        sectionId: input.sectionId,
        version: input.version,
        value: input.value,
        reason: input.reason,
        setBy: toolCallId,
        expiresAt,
        setAt,
      })
      yield* OverrideCache.set(input.sectionId, {
        value: input.value,
        reason: input.reason,
        setBy: toolCallId,
        expiresAt,
        setAt,
        version: input.version,
      })
      return { success: true, sectionId: input.sectionId, ttlMs: input.ttlMs }
    }).pipe(
      Effect.provide(AssemblerRepositoryLive),
      Effect.provide(OverrideCacheLive),
      Effect.runPromise
    ),
})

// =============================================================================
// Tool: assembler_assemble (STREAMING)
// =============================================================================

const AssembleInput = Schema.Struct({
  prompt: Schema.String,
  hints: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  dryRun: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  hardIncludeSectionIds: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  context: Schema.optional(Schema.Unknown),
})
type AssembleInput = typeof AssembleInput.Type

/** Streaming progress events */
const AssembleProgress = Schema.Union(
  Schema.TaggedStruct('IntentClassified', {
    intent: StructuredIntent,
    classificationMs: Schema.Number,
  }),
  Schema.TaggedStruct('SectionsScored', {
    scores: Schema.Array(Schema.Struct({
      sectionId: Schema.String,
      relevance: Schema.Number,
    })),
  }),
  Schema.TaggedStruct('SectionsSelected', {
    included: Schema.Array(Schema.String),
    excluded: Schema.Array(Schema.String),
    kMax: Schema.Number,
  }),
  Schema.TaggedStruct('Assembled', {
    tokenCount: Schema.Number,
    reductionPercent: Schema.Number,
    assemblyMs: Schema.Number,
  }),
  Schema.TaggedStruct('AnalyticsRecorded', {
    analyticsId: Schema.String,
  }),
  Schema.TaggedStruct('Done', {
    assemblyId: Schema.String,
    prompt: Schema.String, // Final assembled prompt
  })
)
type AssembleProgress = typeof AssembleProgress.Type

export const assembler_assemble = tool({
  description: 'Assemble optimized prompt for UI generation. Streams progress events.',
  parameters: jsonSchema<AssembleInput>(
    JSONSchema.make(AssembleInput) as Parameters<typeof jsonSchema>[0]
  ),
  execute: (input: AssembleInput) =>
    Stream.async<AssembleProgress>((emit) =>
      Effect.gen(function* () {
        const assemblyId = crypto.randomUUID()
        const startTime = Date.now()

        // Controlled incremental emission (explicit step boundaries)
        const step = (event: AssembleProgress) =>
          Effect.sync(() => emit.single(event))

        // 1. Classify intent
        const intent = yield* IntentClassifier.classify({
          prompt: input.prompt,
          hints: input.hints,
        })
        yield* step({ _tag: 'IntentClassified', intent, classificationMs: Date.now() - startTime })

        // 2. Score all sections
        const scores = yield* AssemblerRepository.getAllSections().pipe(
          Effect.flatMap((sections) => computeRelevanceScores(intent, sections))
        )
        yield* step({
          _tag: 'SectionsScored',
          scores: Array.from(scores.entries()).map(([id, rel]) => ({ sectionId: id, relevance: rel })),
        })

        // 3. Select top-K with threshold floor
        const { included, excluded, kMax } = yield* selectSections(intent, scores, {
          hardIncludeSectionIds: input.hardIncludeSectionIds,
        }).pipe(Effect.provide(OverrideCacheLive))
        yield* step({ _tag: 'SectionsSelected', included, excluded, kMax })

        // 4. Assemble prompt
        const { prompt: assembledPrompt, tokenCount, fullTokens } = yield* assembleSections(
          included,
          input.context
        ).pipe(Effect.provide(AssemblerRepositoryLive))
        const reductionPercent = (fullTokens - tokenCount) / fullTokens
        yield* step({
          _tag: 'Assembled',
          tokenCount,
          reductionPercent,
          assemblyMs: Date.now() - startTime,
        })

        // 5. Record analytics (unless dry run)
        if (!input.dryRun) {
          const analyticsId = yield* AssemblerRepository.recordAssembly({
            id: assemblyId,
            intent,
            sectionsIncluded: included,
            sectionsExcluded: excluded,
            tokenCount,
            reductionPercent,
          }).pipe(Effect.provide(AssemblerRepositoryLive))
          yield* step({ _tag: 'AnalyticsRecorded', analyticsId })
        }

        // 6. Done
        yield* step({ _tag: 'Done', assemblyId, prompt: assembledPrompt })
      }).pipe(
        Effect.provide(IntentClassifierLive),
        Effect.provide(AssemblerRepositoryLive),
        Effect.provide(OverrideCacheLive)
      )
    , { bufferSize: 64, strategy: 'suspend' }
    )
    // Tool boundary should convert Stream to AsyncIterable for the SDK
    // e.g., Stream.toAsyncIterable(Runtime.defaultRuntime)
})

// =============================================================================
// Tool: assembler_query_history
// =============================================================================

const QueryHistoryInput = Schema.Struct({
  cardId: Schema.optional(Schema.String),
  domain: Schema.optional(Schema.Literal('visualization', 'form', 'layout', 'interactive', 'content', 'mixed')),
  limit: Schema.optionalWith(Schema.Number, { default: () => 20 }),
  since: Schema.optional(Schema.String), // ISO timestamp
})
type QueryHistoryInput = typeof QueryHistoryInput.Type

export const assembler_query_history = tool({
  description: 'Query past assembly history for debugging and analysis.',
  parameters: jsonSchema<QueryHistoryInput>(
    JSONSchema.make(QueryHistoryInput) as Parameters<typeof jsonSchema>[0]
  ),
  execute: (input: QueryHistoryInput) =>
    Effect.gen(function* () {
      const assemblies = yield* AssemblerRepository.queryAssemblies(input)
      return { assemblies, count: assemblies.length }
    }).pipe(
      Effect.provide(AssemblerRepositoryLive),
      Effect.runPromise
    ),
})

// =============================================================================
// Tool: assembler_get_analytics
// =============================================================================

const GetAnalyticsInput = Schema.Struct({
  intentHash: Schema.optional(Schema.String),
  domain: Schema.optional(Schema.Literal('visualization', 'form', 'layout', 'interactive', 'content', 'mixed')),
  sectionId: Schema.optional(Schema.String),
})
type GetAnalyticsInput = typeof GetAnalyticsInput.Type

export const assembler_get_analytics = tool({
  description: 'Get section usage analytics by intent hash or domain.',
  parameters: jsonSchema<GetAnalyticsInput>(
    JSONSchema.make(GetAnalyticsInput) as Parameters<typeof jsonSchema>[0]
  ),
  execute: (input: GetAnalyticsInput) =>
    Effect.gen(function* () {
      const analytics = yield* AssemblerRepository.getAnalytics(input)
      return { analytics }
    }).pipe(
      Effect.provide(AssemblerRepositoryLive),
      Effect.runPromise
    ),
})
```

### Postgres Repository (Effect SQL + Effect Platform Config)

```typescript
// src/lib/ai-core/services/AssemblerRepository.ts

import { Effect, Layer, Option, Schema } from 'effect'
import * as Sql from '@effect/sql'
import * as Pg from '@effect/sql-pg'
import * as Config from 'effect/Config'
import { PromptSection } from '../schemas/section'

// DATABASE_URL from Effect Platform config
const DbUrl = Config.string('DATABASE_URL')

// Postgres client layer
const PgLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const url = yield* DbUrl
    return Pg.PgClient.layer({
      connectionString: url,
      // Optional: max connections, statement_timeout, etc.
    })
  })
)

class AssemblerRepository extends Effect.Service<AssemblerRepository>()(
  'ai-core/AssemblerRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* Sql.SqlClient

      // Initialize schema on first access
      yield* sql`
        CREATE TABLE IF NOT EXISTS sections (
          id TEXT PRIMARY KEY,
          tags JSONB NOT NULL,
          domain TEXT NOT NULL,
          metadata JSONB NOT NULL,
          template_variants JSONB NOT NULL,
          estimated_tokens JSONB NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
      yield* sql`
        CREATE TABLE IF NOT EXISTS overrides (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          section_id TEXT NOT NULL,
          version BIGINT NOT NULL,
          value REAL NOT NULL,
          reason TEXT,
          set_by TEXT NOT NULL,
          expires_at TIMESTAMP,
          set_at TIMESTAMP NOT NULL,
          UNIQUE(section_id),
          FOREIGN KEY (section_id) REFERENCES sections(id)
        )
      `
      yield* sql`
        CREATE TABLE IF NOT EXISTS assemblies (
          id TEXT PRIMARY KEY,
          intent JSONB NOT NULL,
          sections_included JSONB NOT NULL,
          sections_excluded JSONB NOT NULL,
          token_count INTEGER NOT NULL,
          reduction_percent REAL NOT NULL,
          prompt_hash TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
      yield* sql`
        CREATE TABLE IF NOT EXISTS analytics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          section_id TEXT NOT NULL,
          intent_hash TEXT NOT NULL,
          bucket JSONB NOT NULL,
          include_count INTEGER NOT NULL DEFAULT 0,
          exclude_count INTEGER NOT NULL DEFAULT 0,
          avg_token_contribution REAL,
          UNIQUE(section_id, intent_hash),
          FOREIGN KEY (section_id) REFERENCES sections(id)
        )
      `
      yield* sql`CREATE INDEX IF NOT EXISTS idx_analytics_intent ON analytics(intent_hash)`
      yield* sql`CREATE INDEX IF NOT EXISTS idx_assemblies_created ON assemblies(created_at)`

      const upsertSection = (section: RegisterSectionInput) =>
        sql`
          INSERT INTO sections (id, tags, domain, metadata, template_variants, estimated_tokens, status, updated_at)
          VALUES (
            ${section.id},
            ${JSON.stringify(section.tags)},
            ${section.domain},
            ${JSON.stringify({ capabilities: section.capabilities, complexityLevel: section.complexityLevel, dependencies: section.dependencies, baseRelevance: section.baseRelevance, hardInclude: section.hardInclude, priority: section.priority })},
            ${JSON.stringify(section.templateVariants)},
            ${JSON.stringify(section.estimatedTokens)},
            ${section.status},
            CURRENT_TIMESTAMP
          )
          ON CONFLICT(id) DO UPDATE SET
            tags = excluded.tags,
            domain = excluded.domain,
            metadata = excluded.metadata,
            template_variants = excluded.template_variants,
            estimated_tokens = excluded.estimated_tokens,
            status = excluded.status,
            updated_at = CURRENT_TIMESTAMP
        `

      const getAllSections = () =>
        sql<{ id: string; tags: string; domain: string; metadata: string; template_variants: string; estimated_tokens: string }>`
          SELECT id, tags, domain, metadata, template_variants, estimated_tokens
          FROM sections
          WHERE status = 'active'
        `.pipe(
          Effect.map((rows) =>
            rows.map((r) => ({
              id: r.id,
              tags: JSON.parse(r.tags) as string[],
              domain: r.domain,
              ...(() => {
                const metadata = JSON.parse(r.metadata) as {
                  capabilities?: string[]
                  complexityLevel?: string
                  dependencies?: string[]
                  baseRelevance?: number
                  hardInclude?: boolean
                  priority?: number
                }
                return {
                  requiredCapabilities: metadata.capabilities ?? [],
                  complexityLevel: metadata.complexityLevel,
                  dependencies: metadata.dependencies ?? [],
                  baseRelevance: metadata.baseRelevance ?? 0.5,
                  hardInclude: metadata.hardInclude ?? false,
                  priority: metadata.priority ?? 5,
                }
              })(),
              templateVariants: JSON.parse(r.template_variants),
              estimatedTokens: JSON.parse(r.estimated_tokens),
            }))
          ),
          Effect.flatMap((rows) =>
            Effect.forEach(rows, (row) =>
              Schema.decode(PromptSection)(row).pipe(
                Effect.map(Option.some),
                Effect.catchAll((e) =>
                  Effect.logWarning('invalid-section-skipped', e).pipe(
                    Effect.as(Option.none<PromptSection>())
                  )
                )
              )
            ).pipe(
              Effect.map((decoded) =>
                decoded.flatMap((o) => (o._tag === 'Some' ? [o.value] : []))
              )
            )
          )
        )

      const recordAssembly = (assembly: {
        id: string
        intent: StructuredIntent
        sectionsIncluded: string[]
        sectionsExcluded: string[]
        tokenCount: number
        reductionPercent: number
      }) =>
        sql`
          INSERT INTO assemblies (id, intent, sections_included, sections_excluded, token_count, reduction_percent)
          VALUES (
            ${assembly.id},
            ${JSON.stringify(assembly.intent)},
            ${JSON.stringify(assembly.sectionsIncluded)},
            ${JSON.stringify(assembly.sectionsExcluded)},
            ${assembly.tokenCount},
            ${assembly.reductionPercent}
          )
        `.pipe(Effect.as(assembly.id))

      const upsertOverride = (override: {
        sectionId: string
        version: number
        value: number
        reason?: string
        setBy: string
        expiresAt?: number
        setAt: number
      }) =>
        sql`
          INSERT INTO overrides (section_id, version, value, reason, set_by, expires_at, set_at)
          VALUES (
            ${override.sectionId},
            ${override.version},
            ${override.value},
            ${override.reason ?? null},
            ${override.setBy},
            ${override.expiresAt ? new Date(override.expiresAt).toISOString() : null},
            ${new Date(override.setAt).toISOString()}
          )
          ON CONFLICT(section_id) DO UPDATE SET
            version = excluded.version,
            value = excluded.value,
            reason = excluded.reason,
            set_by = excluded.set_by,
            expires_at = excluded.expires_at,
            set_at = excluded.set_at
          WHERE excluded.version > overrides.version
        `

      // ... other methods

      return {
        upsertSection,
        getAllSections,
        recordAssembly,
        upsertOverride,
        // queryAssemblies, getAnalytics, batchWriteOverrides, etc.
      } as const
    }),
    dependencies: [PgLive],
  }
) {}

export const AssemblerRepositoryLive = AssemblerRepository.Default
```

### Effect.Cache for Overrides (Read-Through)

```typescript
// src/lib/ai-core/services/OverrideCache.ts

import { Effect, Cache, Duration, Layer } from 'effect'

interface Override {
  value: number
  reason?: string
  setBy: string
  expiresAt: number
  version: number
  setAt: number
}

class OverrideCache extends Effect.Service<OverrideCache>()(
  'ai-core/OverrideCache',
  {
    effect: Effect.gen(function* () {
      // Read-through cache (Postgres is authoritative)
      const cache = yield* Cache.make({
        capacity: 1000,
        timeToLive: Duration.minutes(5),
        lookup: (sectionId: string) =>
          // Load from Postgres on cache miss
          AssemblerRepository.getOverride(sectionId).pipe(
            Effect.provide(AssemblerRepositoryLive),
            Effect.orElseSucceed(() => null)
          ),
      })

      const get = (sectionId: string) =>
        cache.get(sectionId).pipe(
          Effect.map((o) => o?.value ?? 0)
        )

      const set = (sectionId: string, override: Override) =>
        cache.set(sectionId, override)

      return { get, set } as const
    }),
  }
) {}

export const OverrideCacheLive = OverrideCache.Default
```

### Service Definitions

```typescript
// src/lib/ai-core/services/PromptAssemblerService.ts

class PromptAssemblerService extends Effect.Service<PromptAssemblerService>()(
  'ai-core/PromptAssemblerService',
  {
    effect: Effect.gen(function* () {
      const classifier = yield* IntentClassifier
      const cache = yield* IntentCache
      const registry = yield* PromptSectionRegistry
      const budgetManager = yield* TokenBudgetManager

      const assemble = (request: AssembleRequest) =>
        Effect.gen(function* () {
          // 1. Classify intent
          const cacheKey = `${request.prompt}:${(request.components ?? []).map(c => c.name).join(',')}`
          const cached = yield* cache.get(cacheKey)
          const intent =
            cached._tag === 'Some'
              ? cached.value
              : yield* classifier.classify({
                  prompt: request.prompt,
                  hints: request.components?.map(c => c.name),
                }).pipe(
                  Effect.tap((i) => cache.set(cacheKey, i))
                )

          // 2. Resolve sections
          const sections = yield* registry.getRelevantSections(intent)

          // 3. Resolve dependencies first
          const { sections: withDeps, warnings: depWarnings } =
            yield* registry.resolveDependencies(sections)

          // 4. Apply budget via compression (full -> compact -> micro)
          const { sections: budgeted, warnings: budgetWarnings } =
            yield* budgetManager.apply(withDeps, intent.complexity)

          // 5. Assemble with interpolation
          const context: TemplateContext = {
            catalog: yield* getCatalogDocs(intent),
            request: { prompt: request.prompt, currentTree: request.currentTree },
            intent,
            custom: request.context ?? {},
          }

          const assembled = yield* assembleSections(budgeted, context)
          assembled.metadata.warnings = [...depWarnings, ...budgetWarnings]

          return assembled
        }).pipe(
          Effect.withSpan('PromptAssembler.assemble', {
            attributes: { prompt: request.prompt.slice(0, 100) },
          })
        )

      return { assemble } as const
    }),
    dependencies: [IntentClassifier.Default, IntentCache.Default, PromptSectionRegistry.Default, TokenBudgetManager.Default],
  }
) {}
```

### Section Registry (RedBlackTree + LayerMap)

```typescript
// src/lib/ai-core/services/PromptSectionRegistry.ts

import * as RedBlackTree from 'effect/RedBlackTree'
import { Order } from 'effect/Order'

// Composite key to handle duplicate relevance scores
// [relevance, sectionId] ensures uniqueness while maintaining relevance ordering
type RelevanceKey = readonly [number, string]

const RelevanceKeyOrder: Order<RelevanceKey> = Order.tuple(
  Order.number,    // Primary: by relevance
  Order.string     // Secondary: by section ID (tiebreaker)
)

class PromptSectionRegistry extends Effect.Service<PromptSectionRegistry>()(
  'ai-core/PromptSectionRegistry',
  {
    effect: Effect.gen(function* () {
      // LayerMap-backed loader (invalidate on section update from Postgres)
      // Primary storage: O(1) lookup by ID
      const sectionsById = new Map<string, PromptSection>()

      // Registration
      const register = (section: PromptSection) =>
        Effect.sync(() => {
          sectionsById.set(section.id, section)
        })

      // O(1) lookup
      const getById = (id: string) =>
        Effect.sync(() => Option.fromNullable(sectionsById.get(id)))

      // Build RedBlackTree from relevance scores (per-request)
      // Uses composite key [relevance, sectionId] to preserve sections with same relevance
      const buildRelevanceTree = (scores: Map<string, number>) =>
        Effect.sync(() => {
          let tree = RedBlackTree.empty<RelevanceKey, PromptSection>(RelevanceKeyOrder)
          for (const [id, relevance] of scores) {
            const section = sectionsById.get(id)
            if (section) {
              // Composite key: [relevance, id] ensures no overwrites
              tree = RedBlackTree.insert(tree, [relevance, id], section)
            }
          }
          return tree
        })

      // Compute relevance scores for all sections
      const computeRelevanceScores = (intent: StructuredIntent) =>
        Effect.sync(() => {
          const scores = new Map<string, number>()
          for (const [id, section] of sectionsById) {
            let relevance = section.baseRelevance ?? 0.5

            // Domain match: +0.2
            if (section.domain === intent.domain) relevance += 0.2

            // Capability match: +0.1 per match
            const capMatch = intent.capabilities.filter(c =>
              section.requiredCapabilities?.includes(c)
            ).length
            relevance += capMatch * 0.1

            // Complexity alignment: +0.1
            if (section.complexityLevel === intent.complexity) relevance += 0.1

            scores.set(id, Math.min(1, Math.max(0, relevance)))
          }
          return scores
        })

      // Main selection method: O(n) scoring + O(n log n) tree build + O(log n + k) range query
      const getRelevantSections = (
        intent: StructuredIntent,
        threshold = 0.7
      ) =>
        Effect.gen(function* () {
          // 1. Score all sections
          const scores = yield* computeRelevanceScores(intent)

          // 2. Build RedBlackTree (with composite keys)
          const tree = yield* buildRelevanceTree(scores)

          // 3. Range query: sections above threshold
          // Key is [relevance, id], so threshold key is [threshold, ''] (empty string sorts first)
          const selected: PromptSection[] = []
          for (const [[_relevance, _id], section] of
               RedBlackTree.greaterThanEqualForwards(tree, [threshold, ''])) {
            selected.push(section)
          }

          // 4. Dependencies resolved by PromptAssemblerService
          return selected
        })

      return {
        register,
        getById,
        getRelevantSections,
        computeRelevanceScores,
        buildRelevanceTree,
        resolveDependencies,
        // For hot-reload: clear and re-register
        clear: () => Effect.sync(() => sectionsById.clear()),
      } as const
    }),
  }
) {}

// Dependency resolution (topological sort with cycle skip + warnings)
const resolveDependencies = (
  sections: PromptSection[],
  registry: Map<string, PromptSection>
) =>
  Effect.gen(function* () {
    const resolved = new Set<string>()
    const visiting = new Set<string>()
    const result: PromptSection[] = []
    const warnings: string[] = []

    const visit = (section: PromptSection): Effect.Effect<void> =>
      Effect.gen(function* () {
        if (resolved.has(section.id)) return
        if (visiting.has(section.id)) {
          warnings.push(`dependency-cycle:${section.id}`)
          return
        }

        // Visit dependencies first
        visiting.add(section.id)
        for (const depId of section.dependencies) {
          const dep = registry.get(depId)
          if (dep && !resolved.has(depId)) {
            yield* visit(dep)
          }
        }
        visiting.delete(section.id)

        resolved.add(section.id)
        result.push(section)
      })

    for (const section of sections) {
      yield* visit(section)
    }

    return { sections: result, warnings }
  })
```

### File Organization

```
src/lib/ai-core/
├── tools/                            # AI SDK Tool Definitions
│   ├── assembler-tools.ts            # NEW - All 5 assembler tools
│   └── index.ts                      # Tool exports
├── services/
│   ├── AICoreService.ts              # Existing - uses PromptAssembler
│   ├── PromptAssemblerService.ts     # NEW - main orchestrator
│   ├── AssemblerRepository.ts        # NEW - Postgres persistence
│   ├── OverrideCache.ts              # NEW - Effect.Cache (read-through)
│   ├── IntentClassifier.ts           # NEW - Haiku classifier
│   ├── IntentCache.ts                # NEW - mockable cache
│   ├── TokenBudgetManager.ts         # NEW - tiered budgets
│   └── PromptSectionRegistry.ts      # NEW - in-memory + Postgres backed
├── sections/
│   ├── base.ts                       # Format rules, critical rules
│   ├── catalog.ts                    # Component documentation
│   └── index.ts                      # Section registration
├── schemas/
│   ├── stream.ts                     # Existing
│   ├── message.ts                    # Existing
│   ├── intent.ts                     # NEW - StructuredIntent
│   ├── section.ts                    # NEW - PromptSection
│   ├── assembled.ts                  # NEW - AssembledPrompt
│   └── analytics.ts                  # NEW - Analytics schemas
└── index.ts                          # Updated exports

# Postgres Database (via Effect Config)
DATABASE_URL                          # Persisted sections, overrides, assemblies, analytics

# Domain-colocated sections (register with ai-core registry via tool)
src/lib/charts/prompt-section.ts      # CHART PANEL OPTIONS
src/lib/layout/prompt-section.ts      # LAYOUT & RESPONSIVENESS
src/lib/json-render/prompt-sections/
├── domain-decomposition.ts           # DOMAIN DECOMPOSITION RULES
├── generative-container.ts           # GENERATIVECONTAINER RULES
├── morphcard-sizing.ts               # MORPHCARD SIZING DISCIPLINE
└── index.ts
```

---

## Schema Definitions

### StructuredIntent

```typescript
// src/lib/ai-core/schemas/intent.ts

import { Schema } from 'effect'

export const Domain = Schema.Literal(
  'visualization',
  'form',
  'layout',
  'interactive',
  'content',
  'mixed'
)

export const Complexity = Schema.Literal('simple', 'medium', 'complex')

export const StructuredIntent = Schema.Struct({
  domain: Domain,
  capabilities: Schema.Array(Schema.String),
  complexity: Complexity,
  confidence: Schema.Number.pipe(
    Schema.between(0, 1)
  ),
})
export type StructuredIntent = typeof StructuredIntent.Type
```

### PromptSection

```typescript
// src/lib/ai-core/schemas/section.ts

import { Schema } from 'effect'
import { Domain, Complexity } from './intent'

/**
 * Relevance scoring coefficients (configurable)
 */
export const RelevanceCoefficients = Schema.Struct({
  domainMatchBoost: Schema.optionalWith(Schema.Number, { default: () => 0.2 }),
  capabilityMatchBoost: Schema.optionalWith(Schema.Number, { default: () => 0.1 }),
  complexityAlignmentBoost: Schema.optionalWith(Schema.Number, { default: () => 0.1 }),
})
export type RelevanceCoefficients = typeof RelevanceCoefficients.Type

/**
 * PromptSection - defines a reusable prompt fragment with relevance metadata
 *
 * The RedBlackTree selection algorithm uses:
 * - baseRelevance as starting score
 * - domain, requiredCapabilities, complexityLevel for boosts
 * - dependencies for topological ordering
 */
export const PromptSection = Schema.Struct({
  /** Unique identifier (e.g., 'chart-panel-options') */
  id: Schema.String,

  /** Searchable tags for discovery */
  tags: Schema.Array(Schema.String),

  /** Primary domain for relevance scoring (+0.2 if matches intent.domain) */
  domain: Domain,

  /** Capabilities that boost relevance (+0.1 each if in intent.capabilities) */
  requiredCapabilities: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),

  /** Complexity alignment bonus (+0.1 if matches intent.complexity) */
  complexityLevel: Schema.optional(Complexity),

  /** Other sections this requires (resolved via topological sort) */
  dependencies: Schema.Array(Schema.String),

  /** Always include, bypass selection + compression */
  hardInclude: Schema.optionalWith(Schema.Boolean, { default: () => false }),

  /** Starting relevance score before intent-based boosts [0, 1] */
  baseRelevance: Schema.Number.pipe(Schema.between(0, 1)),

  /** Tiebreaker within same relevance level [1, 10] */
  priority: Schema.Number.pipe(Schema.between(1, 10)),

  /** Approximate token count per variant for budget management */
  estimatedTokens: Schema.Struct({
    full: Schema.Number,
    compact: Schema.Number,
    micro: Schema.Number,
  }),

  /** Required template variants (pre-authored) */
  templateVariants: Schema.Struct({
    full: Schema.String,
    compact: Schema.String,
    micro: Schema.String,
  }),
})
export type PromptSection = typeof PromptSection.Type

/**
 * Runtime version with template function
 */
export const PromptSectionWithTemplate = Schema.extend(
  PromptSection,
  Schema.Struct({
    /** Template function: (context) => string */
    templateVariants: Schema.Struct({
      full: Schema.Unknown,
      compact: Schema.Unknown,
      micro: Schema.Unknown,
    }),
  })
)
export type PromptSectionWithTemplate = typeof PromptSectionWithTemplate.Type

/**
 * Scored section - section with computed relevance for current request
 */
export const ScoredSection = Schema.Struct({
  section: PromptSection,
  relevance: Schema.Number.pipe(Schema.between(0, 1)),
  scoreBreakdown: Schema.Struct({
    base: Schema.Number,
    domainBoost: Schema.Number,
    capabilityBoost: Schema.Number,
    complexityBoost: Schema.Number,
  }),
})
export type ScoredSection = typeof ScoredSection.Type
```

### AssembledPrompt

```typescript
// src/lib/ai-core/schemas/assembled.ts

import { Schema } from 'effect'
import { StructuredIntent, Complexity } from './intent'

export const BudgetInfo = Schema.Struct({
  tier: Complexity,
  limit: Schema.Number,
  used: Schema.Number,
  warnings: Schema.Array(Schema.String),
})

export const PromptMetadata = Schema.Struct({
  sectionsIncluded: Schema.Array(Schema.String),
  sectionsExcluded: Schema.Array(Schema.String),
  tokenCount: Schema.Number,
  fullPromptTokens: Schema.Number,
  reduction: Schema.Number,
  intent: StructuredIntent,
  budget: BudgetInfo,
  warnings: Schema.Array(Schema.String),
  assemblyTimeMs: Schema.Number,
  classificationTimeMs: Schema.Number,
})
export type PromptMetadata = typeof PromptMetadata.Type

export const AssembledPrompt = Schema.Struct({
  content: Schema.String,
  metadata: PromptMetadata,
})
export type AssembledPrompt = typeof AssembledPrompt.Type
```

---

## Integration Plan

### Phase 1: Infrastructure (tmnl-XXXX)

1. Create `ai-core/schemas/intent.ts`, `section.ts`, `assembled.ts`
2. Create `IntentClassifier` service with Haiku
3. Create `AlwaysMissCache` as `IntentCache`
4. Create `PromptSectionRegistry` with LayerMap
5. Create `TokenBudgetManager`
6. Create `PromptAssemblerService`

### Phase 2: Section Migration (tmnl-XXXX)

1. Extract `base` section from server.ts
2. Extract `catalog` section
3. Extract `chart-panel-options` to `charts/prompt-section.ts`
4. Extract `layout-responsiveness` to `layout/prompt-section.ts`
5. Extract `domain-decomposition`, `generative-container`, `morphcard-sizing`
6. Verify all content migrated

### Phase 3: Integration (tmnl-XXXX)

1. Add `USE_PROMPT_ASSEMBLER` feature flag
2. Update `CardEntityHandlers.StreamUIGenerate` to use PromptAssemblerService
3. Update `server.ts` `/ui-generate` to use PromptAssemblerService
4. Compare token counts between old and new

### Phase 4: Validation (tmnl-XXXX)

1. Run A/B tests with same prompts
2. Measure token reduction
3. Verify UI generation quality unchanged
4. Remove feature flag, deprecate old code

---

## Out of Scope

- **Semantic intent caching**: Deferred to future iteration
- **Multi-model support**: MVP uses Haiku only for classification
- **Prompt optimization**: No automatic prompt compression or summarization
- **Cross-request learning**: No learning from past requests

---

## Open Questions for Implementation

1. **Token estimation**: How do we estimate tokens without calling the API? Use tiktoken or simple heuristic?
2. **Section ordering**: Does order matter? Should we sort by dependency depth, priority, or something else?
3. **Error recovery**: Invalid sections are skipped with warnings; should we add retry/backoff for transient DB decode errors?
4. **Metrics storage**: Where do we persist section analytics? Durable streams? In-memory only?

---

## Appendix: Current Prompt Sections

Analysis of `server.ts` `buildUIGenerationPrompt()`:

| Section | Lines | Est. Tokens | Tags |
|---------|-------|-------------|------|
| Format rules | 10 | 150 | base |
| Critical rules | 6 | 100 | base |
| Catalog docs | ~50 | 800 | catalog |
| Typography | 3 | 50 | content |
| Interactive | 5 | 80 | form, interactive |
| Cards | 8 | 120 | layout, content |
| Feedback | 8 | 120 | content |
| Advanced | 4 | 60 | content |
| FoldablePanel | 3 | 50 | layout, interactive |
| **CHART PANEL OPTIONS** | 30 | 450 | chart, visualization |
| **LAYOUT & RESPONSIVENESS** | 22 | 350 | layout, responsive |
| **DOMAIN DECOMPOSITION** | 40 | 600 | interactive, foldable |
| **GENERATIVECONTAINER** | 35 | 550 | generative |
| **MORPHCARD SIZING** | 40 | 600 | morphcard, sizing |
| ACTIONS | 4 | 60 | interactive, form |
| EXAMPLE OUTPUT | 7 | 100 | base |
| **Total** | ~275 | ~4240 | |

For a simple "create a button" request, only ~500 tokens are relevant (base + interactive + form).
That's an 88% reduction potential.

---

## Appendix: Research Findings

### Effect RedBlackTree

- **Location**: `effect/RedBlackTree` (available in Effect 3.x)
- **Complexity**: O(log n) insert, lookup, and range queries
- **Key API**:
  - `RedBlackTree.empty<K, V>(Order)` - create empty tree with ordering
  - `RedBlackTree.insert(tree, key, value)` - immutable insert
  - `RedBlackTree.greaterThanEqualForwards(tree, key)` - range query iterator
  - `RedBlackTree.lessThanBackwards(tree, key)` - reverse range query
- **Use Case**: Relevance-ordered section selection with threshold filtering
- **Benefits**:
  - Implicit ordering (tree property) - no explicit sort needed
  - Efficient range queries - skip irrelevant sections
  - Persistent data structure - safe for concurrent access

**Canonical Reference**: `packages/effect/src/internal/redBlackTree.ts`

```typescript
// Range query example
for (const [relevance, section] of
     RedBlackTree.greaterThanEqualForwards(tree, 0.7)) {
  // Only sections with relevance >= 0.7
  selected.push(section)
}
```

### Effect LayerMap

- Available in Effect 3.14+
- Supports hot-reload via `invalidate(key)`
- Manages resource lifecycle automatically
- `idleTimeToLive` for automatic cleanup

### Haiku Classification

- Average latency: 200-400ms
- Cost: ~$0.00025 per classification
- Sufficient for structured output (domain, capabilities, complexity)

### Token Estimation

- tiktoken: Accurate but requires WASM/native binding
- Simple heuristic: `chars / 4` is ~85% accurate for English
- Recommendation: Start with heuristic, upgrade to tiktoken if precision matters

### Complexity Analysis

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Intent classification | O(1) | Single LLM call |
| Relevance scoring | O(n) | Score all sections |
| RedBlackTree build | O(n log n) | Insert n sections |
| Range query | O(log n + k) | log n to find threshold, k results |
| Dependency resolution | O(V + E) | Topological sort |
| Template interpolation | O(k) | k selected sections |
| **Total** | **O(n log n)** | Dominated by tree build |

For typical section counts (n ≈ 20), this is negligible compared to LLM latency.

### Effect Supervisor API

**Source**: `effect/Supervisor` (verified in submodule)

```typescript
interface Supervisor<T> {
  /** Collect supervision value (metrics, fiber set, etc.) */
  readonly value: Effect.Effect<T>

  /** Called when a fiber starts */
  onStart<A, E, R>(
    context: Context.Context<R>,
    effect: Effect.Effect<A, E, R>,
    parent: Option.Option<Fiber.RuntimeFiber<any, any>>,
    fiber: Fiber.RuntimeFiber<A, E>
  ): void

  /** Called when a fiber ends with Exit */
  onEnd<A, E>(value: Exit.Exit<A, E>, fiber: Fiber.RuntimeFiber<A, E>): void

  /** Called on each Effect step (optional, for tracing) */
  onEffect<A, E>(fiber: Fiber.RuntimeFiber<A, E>, effect: Effect.Effect<any, any, any>): void

  /** Called when fiber suspends */
  onSuspend<A, E>(fiber: Fiber.RuntimeFiber<A, E>): void

  /** Called when fiber resumes */
  onResume<A, E>(fiber: Fiber.RuntimeFiber<A, E>): void
}

// Built-in supervisors
Supervisor.none        // No-op supervisor
Supervisor.track       // Tracks fibers in a set
Supervisor.fibersIn    // Tracks fibers in a MutableRef

// Usage
Effect.supervised(effect, customSupervisor)
Supervisor.addSupervisor(supervisor)  // Layer-based
```

**Key Pattern**: Use `Exit.isSuccess(exit)` / `Exit.isFailure(exit)` in `onEnd` to distinguish outcomes.

### Effect Logger API

**Source**: `effect/Logger` (verified in submodule + deepwiki)

```typescript
// Logger.make() signature - returns Output (not void!)
Logger.make<Message, Output>((options: Logger.Options<Message>) => Output)

interface Logger.Options<Message> {
  fiberId: FiberId.FiberId                    // Current fiber ID
  logLevel: LogLevel.LogLevel                 // debug, info, warning, error
  message: Message                            // The log message
  cause: Cause.Cause<unknown>                 // Error cause (if any)
  context: FiberRefs.FiberRefs                // Fiber context
  spans: List.List<LogSpan.LogSpan>           // Timing spans (use List.toArray)
  annotations: HashMap.HashMap<string, unknown>  // Custom annotations (use HashMap.get)
  date: Date                                  // Log timestamp
}
```

**Routing to Effect's Console** (CRITICAL - don't use raw console.log):

```typescript
// Logger.withLeveledConsole routes output to Console service by log level:
// - LogLevel.Error → Console.error
// - LogLevel.Warning → Console.warn
// - LogLevel.Info → Console.info
// - LogLevel.Debug → Console.debug

const customLogger = Logger.make((opts) => ({ /* structured */ })).pipe(
  Logger.map(JSON.stringify),      // Convert to string
  Logger.withLeveledConsole        // Route via Effect's Console
)

// Replace default logger
const layer = Logger.replace(Logger.defaultLogger, customLogger)

// Or add alongside default
const addLayer = Logger.add(customLogger)
```

**Annotation APIs**:

```typescript
// Add annotations to logs within a scope
Effect.annotateLogs(effect, { key: 'value' })

// Scoped annotations (apply to entire scope)
Effect.annotateLogsScoped({ assemblyId: 'uuid' })

// Add timing spans
Effect.withLogSpan('span-name')(effect)

// Set minimum log level
Logger.withMinimumLogLevel(LogLevel.Debug)
```

**Built-in Loggers** (all are Layers):

```typescript
Logger.pretty           // Human-readable colored output
Logger.json             // JSON lines format (Layer)
Logger.structured       // Structured objects (Layer)
Logger.jsonLogger       // JSON logger instance (not Layer)
Logger.structuredLogger // Structured logger instance (not Layer)
```

**Layer vs Instance**:
- `Logger.json` and `Logger.structured` are `Layer<never>` - provide directly
- `Logger.jsonLogger` and `Logger.structuredLogger` are logger instances - use with `Logger.replace()`

### RedBlackTree Duplicate Key Handling

**Critical Finding**: Duplicate keys REPLACE old values in RedBlackTree.

```typescript
// If two sections have same relevance score, second insert replaces first
tree = RedBlackTree.insert(tree, 0.8, sectionA)
tree = RedBlackTree.insert(tree, 0.8, sectionB)  // sectionA is LOST

// Solution: Use composite key [relevance, uniqueId]
const CompositeKey = {
  compare: (a: [number, string], b: [number, string]) => {
    const relevanceCmp = a[0] - b[0]
    if (relevanceCmp !== 0) return relevanceCmp
    return a[1].localeCompare(b[1])  // Tiebreak by ID
  }
}

tree = RedBlackTree.empty<[number, string], PromptSection>(CompositeKey)
tree = RedBlackTree.insert(tree, [0.8, 'section-a'], sectionA)
tree = RedBlackTree.insert(tree, [0.8, 'section-b'], sectionB)  // Both preserved
```

### Embedding Options Research

| Model | Size | Dimensions | Quality | Use Case |
|-------|------|------------|---------|----------|
| all-MiniLM-L6-v2 | 100MB | 384 | Good | Local inference |
| bge-small-en-v1.5 | 33MB | 384 | Better | Compact, quality |
| bge-large-en-v1.5 | 335MB | 1024 | Best | Maximum quality |
| @ai-sdk/deepinfra | API | 1024 | Best | No local model |

**Metrics for Semantic Matching**:
- Cosine similarity (standard)
- BERTScore (context-aware)
- Sentence-BERT embeddings

**MVP Decision**: Mock implementation returns constant 0.5 similarity. Real implementation deferred to P2.
