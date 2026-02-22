import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { Type } from '@sinclair/typebox'
import * as path from 'node:path'
import { Effect, Schema } from 'effect'
import {
  AnnotationRecord,
  DiscoveryQueryFilter,
  DiscoveryQueryResult,
  DiscoveredPatternEvent,
  MergeConflictFilter,
  MergeConflictQueryResult,
  MergeConflictRecord,
  MergeDecisionRecord,
  MergeRunRecord,
  Pattern,
  PatternSearchFilter,
} from './schema.ts'
import { PatternRegistryStore } from './persistence/index.ts'
import {
  extractAstPatternOccurrences,
  loadCuratedPatternDocuments,
} from './ingestion/index.ts'
import {
  buildMergeGroup,
  groupPatternsByCanonicalKey,
  summarizeEvidence,
} from './merge/index.ts'

const decodePattern = Schema.decodeUnknownSync(Pattern)
const decodeDiscoveryEvent = Schema.decodeUnknownSync(DiscoveredPatternEvent)
const decodeAnnotation = Schema.decodeUnknownSync(AnnotationRecord)
const decodeSearchFilter = Schema.decodeUnknownSync(PatternSearchFilter)
const decodeDiscoveryFilter = Schema.decodeUnknownSync(DiscoveryQueryFilter)
const decodeMergeRunRecord = Schema.decodeUnknownSync(MergeRunRecord)
const decodeMergeDecisionRecord = Schema.decodeUnknownSync(MergeDecisionRecord)
const decodeMergeConflictRecord = Schema.decodeUnknownSync(MergeConflictRecord)
const decodeMergeConflictFilter = Schema.decodeUnknownSync(MergeConflictFilter)

const runStoreEffect = async <A>(effect: Effect.Effect<A, unknown, PatternRegistryStore>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(PatternRegistryStore.Default), Effect.scoped))

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const withPatternDefaults = (raw: unknown): unknown => {
  const now = new Date().toISOString()
  const r = asRecord(raw)

  return {
    ...r,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: now,
  }
}

const withDiscoveryDefaults = (raw: unknown): unknown => {
  const now = new Date().toISOString()
  const r = asRecord(raw)
  const metadata = asRecord(r.metadata)

  return {
    ...r,
    metadata: {
      ...metadata,
      discoveredAt: typeof metadata.discoveredAt === 'string' ? metadata.discoveredAt : now,
    },
  }
}

const withAnnotationDefaults = (raw: unknown): unknown => {
  const now = new Date().toISOString()
  const r = asRecord(raw)

  return {
    ...r,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: now,
  }
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)

const ensurePatternShape = (
  raw: unknown,
  defaults: {
    readonly sourceId: string
    readonly author: string
    readonly location?: string
    readonly fallbackKind?: 'plan' | 'pattern' | 'implementation' | 'idea'
    readonly fallbackTitle?: string
    readonly fallbackSummary?: string
    readonly fallbackDescription?: string
    readonly fallbackTags?: ReadonlyArray<string>
  },
): unknown => {
  const now = new Date().toISOString()
  const r = asRecord(raw)

  const fallbackTitle = defaults.fallbackTitle ?? 'Discovered Pattern'
  const title = typeof r.title === 'string' && r.title.trim().length > 0 ? r.title : fallbackTitle
  const summary = typeof r.summary === 'string' && r.summary.trim().length > 0
    ? r.summary
    : (defaults.fallbackSummary ?? title)
  const description = typeof r.description === 'string' && r.description.trim().length > 0
    ? r.description
    : (defaults.fallbackDescription ?? summary)

  const mergedTags = Array.from(new Set([
    ...(Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : []),
    ...(defaults.fallbackTags ?? []),
  ]))

  const provenance = Array.isArray(r.provenance) && r.provenance.length > 0
    ? r.provenance
    : [{
      _tag: 'ManualProvenance',
      sourceId: defaults.sourceId,
      author: defaults.author,
      location: defaults.location,
    }]

  const patternId = typeof r.patternId === 'string' && r.patternId.trim().length > 0
    ? r.patternId
    : `pat-${slugify(title)}`

  return {
    ...r,
    patternId,
    kind: (r.kind === 'plan' || r.kind === 'pattern' || r.kind === 'implementation' || r.kind === 'idea')
      ? r.kind
      : (defaults.fallbackKind ?? 'pattern'),
    title,
    summary,
    description,
    lifecycle: (r.lifecycle === 'draft' || r.lifecycle === 'active' || r.lifecycle === 'deprecated' || r.lifecycle === 'archived')
      ? r.lifecycle
      : 'active',
    tags: mergedTags,
    provenance,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: now,
  }
}

const makeDiscoveryEvent = (
  patternId: string,
  params: {
    readonly sourceType: 'manual' | 'ast' | 'semantic' | 'tool' | 'hook'
    readonly sourceId: string
    readonly discoveredBy: string
    readonly confidence: number
    readonly filePath?: string
    readonly symbol?: string
    readonly extractor?: string
    readonly note?: string
    readonly tags?: ReadonlyArray<string>
    readonly payload?: unknown
  },
): typeof DiscoveredPatternEvent.Type => {
  const now = new Date().toISOString()

  return decodeDiscoveryEvent(withDiscoveryDefaults({
    eventId: `evt-${crypto.randomUUID()}`,
    patternId,
    metadata: {
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      filePath: params.filePath,
      symbol: params.symbol,
      extractor: params.extractor,
      confidence: Math.max(0, Math.min(1, params.confidence)),
      discoveredBy: params.discoveredBy,
      discoveredAt: now,
    },
    tags: params.tags ?? [],
    note: params.note,
    payload: params.payload,
  }))
}

const buildMergePreviewData = async () => {
  return runStoreEffect(
    Effect.gen(function* () {
      const store = yield* PatternRegistryStore
      const patterns = yield* store.listAllPatterns
      const discoveries = yield* store.listDiscoveryEvents

      const evidenceByPatternId = summarizeEvidence(discoveries)
      const grouped = groupPatternsByCanonicalKey(patterns)
      const groups = [...grouped.entries()]
        .map(([canonicalKey, members]) => buildMergeGroup(canonicalKey, members, evidenceByPatternId))
        .sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey))

      return {
        patterns,
        discoveries,
        groups,
      }
    }),
  )
}

export default function patternRegistryExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'pattern_registry_upsert_pattern',
    label: 'Pattern Registry Upsert Pattern',
    description: 'Create or update a registry pattern using schema-validated payloads.',
    parameters: Type.Object({
      pattern: Type.Unknown({ description: 'Pattern payload (Pattern schema)' }),
    }),
    async execute(_toolCallId, params) {
      try {
        const pattern = decodePattern(withPatternDefaults(params.pattern))

        await runStoreEffect(
          Effect.gen(function* () {
            const store = yield* PatternRegistryStore
            yield* store.upsertPattern(pattern)
          }),
        )

        return {
          content: [{ type: 'text', text: `Pattern upserted: ${pattern.patternId} (${pattern.kind})` }],
          details: Schema.encodeUnknownSync(Pattern)(pattern),
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `pattern_registry_upsert_pattern failed: ${message}` }],
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'pattern_registry_ingest_curated',
    label: 'Pattern Registry Ingest Curated',
    description: 'Load curated pattern entries from JSON/Markdown files and persist them with discovery logs.',
    parameters: Type.Object({
      path: Type.String({ description: 'File or directory containing curated pattern docs (.json/.md)' }),
      sourceId: Type.Optional(Type.String({ description: 'Logical source ID for provenance/discovery metadata' })),
      author: Type.Optional(Type.String({ description: 'Author/discoveredBy label for imported entries' })),
      dryRun: Type.Optional(Type.Boolean({ description: 'Validate and preview without persisting' })),
    }),
    async execute(_toolCallId, params) {
      try {
        const targetPath = params.path
        const sourceId = params.sourceId ?? `curated:${path.basename(targetPath)}`
        const author = params.author ?? 'pattern-registry-curated-loader'
        const dryRun = params.dryRun === true

        const docs = loadCuratedPatternDocuments(targetPath)
        if (docs.length === 0) {
          return {
            content: [{ type: 'text', text: 'No curated entries found in the provided path.' }],
            details: { path: targetPath, documents: 0, entries: 0 },
          }
        }

        const prepared: Array<{ pattern: typeof Pattern.Type; sourcePath: string }> = []
        const failures: Array<{ sourcePath: string; error: string }> = []

        for (const doc of docs) {
          for (const raw of doc.entries) {
            try {
              const pattern = decodePattern(
                ensurePatternShape(raw, {
                  sourceId,
                  author,
                  location: doc.sourcePath,
                  fallbackKind: 'pattern',
                }),
              )
              prepared.push({ pattern, sourcePath: doc.sourcePath })
            } catch (error) {
              failures.push({
                sourcePath: doc.sourcePath,
                error: error instanceof Error ? error.message : String(error),
              })
            }
          }
        }

        if (!dryRun && prepared.length > 0) {
          await runStoreEffect(
            Effect.gen(function* () {
              const store = yield* PatternRegistryStore

              for (const item of prepared) {
                yield* store.upsertPattern(item.pattern)
                yield* store.logDiscoveryEvent(
                  makeDiscoveryEvent(item.pattern.patternId, {
                    sourceType: 'manual',
                    sourceId,
                    discoveredBy: author,
                    confidence: 0.95,
                    filePath: item.sourcePath,
                    extractor: 'curated-loader-v1',
                    tags: ['curated', ...item.pattern.tags],
                    note: 'Imported from curated pattern source',
                  }),
                )
              }
            }),
          )
        }

        const lines = [
          `Curated ingest ${dryRun ? '(dry-run) ' : ''}complete.`,
          `documents=${docs.length} valid=${prepared.length} invalid=${failures.length}`,
        ]

        if (failures.length > 0) {
          lines.push('', 'First failures:')
          for (const failure of failures.slice(0, 5)) {
            lines.push(`- ${failure.sourcePath}: ${failure.error}`)
          }
        }

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          details: {
            path: targetPath,
            sourceId,
            dryRun,
            documents: docs.length,
            validEntries: prepared.length,
            invalidEntries: failures.length,
            failures,
            patterns: prepared.slice(0, 25).map((p) => Schema.encodeUnknownSync(Pattern)(p.pattern)),
          },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `pattern_registry_ingest_curated failed: ${message}` }],
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'pattern_registry_extract_ast',
    label: 'Pattern Registry Extract AST Signatures',
    description: 'Extract high-signal Effect/Schema/Atom signatures from code and persist discovered patterns.',
    parameters: Type.Object({
      roots: Type.Optional(Type.Array(Type.String(), { description: 'Root directories/files to scan (default: src, .pi/extensions)' })),
      sourceId: Type.Optional(Type.String({ description: 'Logical source ID for extraction run' })),
      discoveredBy: Type.Optional(Type.String({ description: 'Actor label for discovery metadata' })),
      minOccurrences: Type.Optional(Type.Number({ description: 'Minimum occurrences required to emit a pattern (default: 1)' })),
      maxOccurrences: Type.Optional(Type.Number({ description: 'Cap logged occurrences for this run (default: 500)' })),
      persist: Type.Optional(Type.Boolean({ description: 'Persist extracted patterns/discoveries (default: true)' })),
    }),
    async execute(_toolCallId, params) {
      try {
        const roots = params.roots && params.roots.length > 0 ? params.roots : ['src', '.pi/extensions']
        const minOccurrences = Math.max(1, Math.round(params.minOccurrences ?? 1))
        const maxOccurrences = Math.max(1, Math.round(params.maxOccurrences ?? 500))
        const persist = params.persist !== false
        const sourceId = params.sourceId ?? `ast:${new Date().toISOString()}`
        const discoveredBy = params.discoveredBy ?? 'pattern-registry-ast-extractor'

        const extraction = extractAstPatternOccurrences(roots)
        const grouped = new Map<string, {
          title: string
          summary: string
          tags: ReadonlyArray<string>
          occurrences: Array<typeof extraction.occurrences[number]>
        }>()

        for (const occurrence of extraction.occurrences) {
          const current = grouped.get(occurrence.signatureId)
          if (current) {
            current.occurrences.push(occurrence)
          } else {
            grouped.set(occurrence.signatureId, {
              title: occurrence.title,
              summary: occurrence.summary,
              tags: occurrence.tags,
              occurrences: [occurrence],
            })
          }
        }

        const selectedGroups = [...grouped.entries()]
          .filter(([, group]) => group.occurrences.length >= minOccurrences)
          .sort((a, b) => b[1].occurrences.length - a[1].occurrences.length)
          .map(([signatureId, group]) => ({ signatureId, group }))

        const patterns = selectedGroups.map(({ signatureId, group }) => {
          const fileSet = new Set(group.occurrences.map((o) => o.filePath))
          const topSamples = group.occurrences.slice(0, 3)
            .map((o) => `${o.filePath}:${o.line} — ${o.snippet}`)
            .join('\n')

          return decodePattern(
            ensurePatternShape({
              patternId: `pat-ast-${signatureId}`,
              kind: 'implementation',
              title: group.title,
              summary: `Detected ${group.occurrences.length} occurrence(s) across ${fileSet.size} file(s).`,
              description: `${group.summary}\n\nTop samples:\n${topSamples}`,
              tags: ['ast', 'discovered', ...group.tags],
              provenance: [{
                _tag: 'CodeProvenance',
                sourceId,
                filePath: group.occurrences[0]?.filePath ?? 'unknown',
                extractor: 'pattern-registry-ast-v1',
              }],
            }, {
              sourceId,
              author: discoveredBy,
              fallbackKind: 'implementation',
            }),
          )
        })

        const patternIdBySignature = new Map(
          selectedGroups.map(({ signatureId }) => [signatureId, `pat-ast-${signatureId}`] as const),
        )

        const loggingPlan: Array<{ patternId: string; occurrence: typeof extraction.occurrences[number] }> = []
        if (persist && selectedGroups.length > 0) {
          const queues = selectedGroups.map(({ signatureId, group }) => ({
            signatureId,
            patternId: patternIdBySignature.get(signatureId)!,
            occurrences: [...group.occurrences],
          }))

          while (loggingPlan.length < maxOccurrences) {
            let progressed = false

            for (const queue of queues) {
              const next = queue.occurrences.shift()
              if (!next) continue

              loggingPlan.push({ patternId: queue.patternId, occurrence: next })
              progressed = true

              if (loggingPlan.length >= maxOccurrences) break
            }

            if (!progressed) break
          }
        }

        const loggedBySignature = new Map<string, number>()
        for (const item of loggingPlan) {
          const current = loggedBySignature.get(item.occurrence.signatureId) ?? 0
          loggedBySignature.set(item.occurrence.signatureId, current + 1)
        }

        let loggedOccurrences = 0
        if (persist && patterns.length > 0) {
          await runStoreEffect(
            Effect.gen(function* () {
              const store = yield* PatternRegistryStore

              for (const pattern of patterns) {
                yield* store.upsertPattern(pattern)
              }

              for (const item of loggingPlan) {
                loggedOccurrences += 1

                yield* store.logDiscoveryEvent(
                  makeDiscoveryEvent(item.patternId, {
                    sourceType: 'ast',
                    sourceId,
                    discoveredBy,
                    confidence: 0.8,
                    filePath: item.occurrence.filePath,
                    extractor: 'pattern-registry-ast-v1',
                    tags: ['ast', ...item.occurrence.tags],
                    note: `${item.occurrence.signatureId} at line ${item.occurrence.line}`,
                    payload: {
                      line: item.occurrence.line,
                      snippet: item.occurrence.snippet,
                    },
                  }),
                )
              }
            }),
          )
        }

        const coverageSummary = selectedGroups
          .map(({ signatureId, group }) => ({
            signatureId,
            totalOccurrences: group.occurrences.length,
            loggedOccurrences: loggedBySignature.get(signatureId) ?? 0,
          }))

        const lines = [
          `AST extraction complete${persist ? '' : ' (preview mode)'}.`,
          `scannedFiles=${extraction.scannedFiles} matchedFiles=${extraction.matchedFiles}`,
          `occurrences=${extraction.occurrences.length} selectedPatterns=${patterns.length}`,
          persist ? `loggedOccurrences=${loggedOccurrences}` : 'loggedOccurrences=0',
          persist ? `loggingStrategy=round-robin-per-signature` : 'loggingStrategy=none',
        ]

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          details: {
            roots,
            sourceId,
            persist,
            minOccurrences,
            maxOccurrences,
            scannedFiles: extraction.scannedFiles,
            matchedFiles: extraction.matchedFiles,
            totalOccurrences: extraction.occurrences.length,
            selectedPatterns: patterns.map((pattern) => Schema.encodeUnknownSync(Pattern)(pattern)),
            coverageSummary,
            topOccurrences: extraction.occurrences.slice(0, 100),
          },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `pattern_registry_extract_ast failed: ${message}` }],
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'pattern_registry_search',
    label: 'Pattern Registry Search',
    description: 'Search registry patterns by query/kind/tags/lifecycle.',
    parameters: Type.Object({
      query: Type.Optional(Type.String()),
      kind: Type.Optional(Type.Union([
        Type.Literal('plan'),
        Type.Literal('pattern'),
        Type.Literal('implementation'),
        Type.Literal('idea'),
      ])),
      tags: Type.Optional(Type.Array(Type.String())),
      lifecycle: Type.Optional(Type.Union([
        Type.Literal('draft'),
        Type.Literal('active'),
        Type.Literal('deprecated'),
        Type.Literal('archived'),
      ])),
      limit: Type.Optional(Type.Number()),
      offset: Type.Optional(Type.Number()),
    }),
    async execute(_toolCallId, params) {
      try {
        const filter = decodeSearchFilter(params)

        const result = await runStoreEffect(
          Effect.gen(function* () {
            const store = yield* PatternRegistryStore
            return yield* store.searchPatterns(filter)
          }),
        )

        if (result.total === 0) {
          return {
            content: [{ type: 'text', text: 'No patterns found for the provided filter.' }],
            details: result,
          }
        }

        const lines = [
          `Found ${result.total} pattern(s) (showing ${result.offset + 1}-${Math.min(result.offset + result.patterns.length, result.total)}):`,
          '',
          ...result.patterns.map((p) => {
            const tags = p.tags.length > 0 ? ` [${p.tags.join(', ')}]` : ''
            return `- ${p.patternId} │ ${p.kind}/${p.lifecycle}${tags}\n  ${p.title}\n  ${p.summary}`
          }),
        ]

        if (result.hasMore) {
          lines.push('', `... more available (next offset: ${result.offset + result.limit})`)
        }

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          details: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            hasMore: result.hasMore,
            patterns: result.patterns.map((p) => Schema.encodeUnknownSync(Pattern)(p)),
          },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `pattern_registry_search failed: ${message}` }],
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'pattern_registry_log_discovery',
    label: 'Pattern Registry Log Discovery',
    description: 'Log discovered pattern events with provenance metadata.',
    parameters: Type.Object({
      event: Type.Unknown({ description: 'DiscoveredPatternEvent payload' }),
    }),
    async execute(_toolCallId, params) {
      try {
        const event = decodeDiscoveryEvent(withDiscoveryDefaults(params.event))

        await runStoreEffect(
          Effect.gen(function* () {
            const store = yield* PatternRegistryStore
            yield* store.logDiscoveryEvent(event)
          }),
        )

        return {
          content: [{ type: 'text', text: `Discovery event logged: ${event.eventId} -> ${event.patternId}` }],
          details: Schema.encodeUnknownSync(DiscoveredPatternEvent)(event),
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `pattern_registry_log_discovery failed: ${message}` }],
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'pattern_registry_add_annotation',
    label: 'Pattern Registry Add Annotation',
    description: 'Attach annotation metadata to a discovery event.',
    parameters: Type.Object({
      annotation: Type.Unknown({ description: 'AnnotationRecord payload' }),
    }),
    async execute(_toolCallId, params) {
      try {
        const annotation = decodeAnnotation(withAnnotationDefaults(params.annotation))

        await runStoreEffect(
          Effect.gen(function* () {
            const store = yield* PatternRegistryStore
            yield* store.addAnnotation(annotation)
          }),
        )

        return {
          content: [{ type: 'text', text: `Annotation stored: ${annotation.annotationId} (${annotation.status})` }],
          details: Schema.encodeUnknownSync(AnnotationRecord)(annotation),
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `pattern_registry_add_annotation failed: ${message}` }],
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'pattern_registry_query_discoveries',
    label: 'Pattern Registry Query Discoveries',
    description: 'Query discovery ledger entries with metadata/annotation visibility.',
    parameters: Type.Object({
      patternId: Type.Optional(Type.String()),
      sourceType: Type.Optional(Type.Union([
        Type.Literal('manual'),
        Type.Literal('ast'),
        Type.Literal('semantic'),
        Type.Literal('tool'),
        Type.Literal('hook'),
      ])),
      author: Type.Optional(Type.String()),
      tags: Type.Optional(Type.Array(Type.String())),
      dateFrom: Type.Optional(Type.String()),
      dateTo: Type.Optional(Type.String()),
      minConfidence: Type.Optional(Type.Number()),
      maxConfidence: Type.Optional(Type.Number()),
      limit: Type.Optional(Type.Number()),
      offset: Type.Optional(Type.Number()),
    }),
    async execute(_toolCallId, params) {
      try {
        const filter = decodeDiscoveryFilter(params)

        const result = await runStoreEffect(
          Effect.gen(function* () {
            const store = yield* PatternRegistryStore
            return yield* store.queryDiscoveries(filter)
          }),
        )

        if (result.total === 0) {
          return {
            content: [{ type: 'text', text: 'No discovery entries found for the provided filter.' }],
            details: Schema.encodeUnknownSync(DiscoveryQueryResult)(result),
          }
        }

        const lines: string[] = [
          `Found ${result.total} discovery event(s) (showing ${result.offset + 1}-${Math.min(result.offset + result.entries.length, result.total)}):`,
          '',
        ]

        for (const entry of result.entries) {
          const e = entry.event
          const tags = e.tags.length > 0 ? ` [${e.tags.join(', ')}]` : ''
          lines.push(`- ${e.eventId} -> ${e.patternId}${tags}`)
          lines.push(`  source=${e.metadata.sourceType} confidence=${e.metadata.confidence.toFixed(2)} by=${e.metadata.discoveredBy}`)
          lines.push(`  at=${e.metadata.discoveredAt}${e.metadata.filePath ? ` path=${e.metadata.filePath}` : ''}`)

          if (entry.annotations.length > 0) {
            for (const annotation of entry.annotations) {
              lines.push(`    • ${annotation.annotationId} (${annotation.status}) ${annotation.author}: ${annotation.message}`)
            }
          }
        }

        if (result.hasMore) {
          lines.push('', `... more available (next offset: ${result.offset + result.limit})`)
        }

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          details: Schema.encodeUnknownSync(DiscoveryQueryResult)(result),
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `pattern_registry_query_discoveries failed: ${message}` }],
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'pattern_registry_merge_preview',
    label: 'Pattern Registry Merge Preview',
    description: 'Preview canonical merge groups, winner decisions, and conflict candidates without mutating registry state.',
    parameters: Type.Object({
      limitGroups: Type.Optional(Type.Number()),
      includeCandidates: Type.Optional(Type.Boolean()),
    }),
    async execute(_toolCallId, params) {
      try {
        const limitGroups = Math.max(1, Math.round(params.limitGroups ?? 200))
        const includeCandidates = params.includeCandidates === true

        const preview = await buildMergePreviewData()
        const groups = preview.groups.slice(0, limitGroups)
        const conflicts = groups.flatMap((group) => group.conflicts)

        const lines: string[] = [
          `Merge preview ready: groups=${groups.length}/${preview.groups.length} patterns=${preview.patterns.length} discoveries=${preview.discoveries.length}`,
          `conflicts=${conflicts.length}`,
          '',
        ]

        for (const group of groups.slice(0, 20)) {
          lines.push(`- ${group.canonicalKey}`)
          lines.push(`  winner=${group.winner.pattern.patternId} sourceRank=${group.winner.sourceRank} score=${group.winner.score.toFixed(3)} reason=${group.reason}`)
          if (group.conflicts.length > 0) {
            lines.push(`  conflicts=${group.conflicts.length}`)
          }
          if (includeCandidates) {
            for (const candidate of group.candidates) {
              lines.push(`    • ${candidate.pattern.patternId} rank=${candidate.sourceRank} score=${candidate.score.toFixed(3)}`)
            }
          }
        }

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          details: {
            totals: {
              patterns: preview.patterns.length,
              discoveries: preview.discoveries.length,
              groups: preview.groups.length,
              conflicts: conflicts.length,
            },
            groups: groups.map((group) => ({
              canonicalKey: group.canonicalKey,
              reason: group.reason,
              winner: {
                patternId: group.winner.pattern.patternId,
                source: group.winner.source,
                sourceRank: group.winner.sourceRank,
                score: group.winner.score,
              },
              mergedPattern: Schema.encodeUnknownSync(Pattern)(group.mergedPattern),
              candidates: group.candidates.map((candidate) => ({
                patternId: candidate.pattern.patternId,
                source: candidate.source,
                sourceRank: candidate.sourceRank,
                score: candidate.score,
                evidence: candidate.evidence,
              })),
              conflicts: group.conflicts,
            })),
          },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `pattern_registry_merge_preview failed: ${message}` }],
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'pattern_registry_merge_apply',
    label: 'Pattern Registry Merge Apply',
    description: 'Apply canonical merge decisions, persist winner patterns, and record merge runs/decisions/conflicts.',
    parameters: Type.Object({
      maxGroups: Type.Optional(Type.Number()),
      stopOnConflict: Type.Optional(Type.Boolean()),
      dryRun: Type.Optional(Type.Boolean()),
    }),
    async execute(_toolCallId, params) {
      try {
        const maxGroups = Math.max(1, Math.round(params.maxGroups ?? 500))
        const stopOnConflict = params.stopOnConflict !== false
        const dryRun = params.dryRun === true

        const preview = await buildMergePreviewData()
        const groups = preview.groups.slice(0, maxGroups)
        const runId = `merge-${crypto.randomUUID()}`
        const createdAt = new Date().toISOString()
        const conflictPreview = groups.flatMap((group) => group.conflicts)

        const runRecord = decodeMergeRunRecord({
          runId,
          createdAt,
          dryRun,
          totalGroups: groups.length,
          mergedCount: groups.length,
          conflictCount: conflictPreview.length,
          payload: {
            totalPatterns: preview.patterns.length,
            totalDiscoveries: preview.discoveries.length,
            stopOnConflict,
            maxGroups,
          },
        })

        if (!dryRun) {
          await runStoreEffect(
            Effect.gen(function* () {
              const store = yield* PatternRegistryStore
              yield* store.saveMergeRun(runRecord)

              for (const group of groups) {
                const decision = decodeMergeDecisionRecord({
                  decisionId: `mdec-${crypto.randomUUID()}`,
                  runId,
                  canonicalKey: group.canonicalKey,
                  winnerPatternId: group.winner.pattern.patternId,
                  mergedPatternId: group.mergedPattern.patternId,
                  sourceRank: group.winner.sourceRank,
                  score: group.winner.score,
                  reason: group.conflicts.length > 0 ? 'conflict' : group.reason,
                  createdAt,
                  payload: {
                    candidates: group.candidates.map((candidate) => ({
                      patternId: candidate.pattern.patternId,
                      source: candidate.source,
                      sourceRank: candidate.sourceRank,
                      score: candidate.score,
                    })),
                  },
                })

                yield* store.saveMergeDecision(decision)

                if (group.conflicts.length > 0) {
                  for (const conflictPreviewItem of group.conflicts) {
                    const conflict = decodeMergeConflictRecord({
                      conflictId: `mconf-${crypto.randomUUID()}`,
                      runId,
                      canonicalKey: conflictPreviewItem.canonicalKey,
                      winnerPatternId: conflictPreviewItem.winnerPatternId,
                      contenderPatternId: conflictPreviewItem.contenderPatternId,
                      reason: conflictPreviewItem.reason,
                      status: 'open',
                      createdAt,
                      payload: {
                        winner: group.winner.pattern.patternId,
                      },
                    })
                    yield* store.saveMergeConflict(conflict)
                  }

                  if (stopOnConflict) {
                    continue
                  }
                }

                if (!(group.conflicts.length > 0 && stopOnConflict)) {
                  yield* store.upsertPattern(group.mergedPattern)
                }
              }
            }),
          )
        }

        const lines = [
          `${dryRun ? 'Dry-run ' : ''}merge apply complete.`,
          `runId=${runId}`,
          `groups=${groups.length} conflicts=${conflictPreview.length}`,
          !dryRun && stopOnConflict
            ? 'stopOnConflict=true (conflicted groups were logged but not upserted)'
            : `stopOnConflict=${stopOnConflict}`,
        ]

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          details: {
            run: Schema.encodeUnknownSync(MergeRunRecord)(runRecord),
            dryRun,
            stopOnConflict,
            groups: groups.map((group) => ({
              canonicalKey: group.canonicalKey,
              winnerPatternId: group.winner.pattern.patternId,
              reason: group.reason,
              conflicts: group.conflicts,
              mergedPattern: Schema.encodeUnknownSync(Pattern)(group.mergedPattern),
            })),
          },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `pattern_registry_merge_apply failed: ${message}` }],
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'pattern_registry_list_conflicts',
    label: 'Pattern Registry List Merge Conflicts',
    description: 'List persisted merge conflicts for review and audit.',
    parameters: Type.Object({
      status: Type.Optional(Type.Union([
        Type.Literal('open'),
        Type.Literal('resolved'),
        Type.Literal('ignored'),
      ])),
      runId: Type.Optional(Type.String()),
      canonicalKey: Type.Optional(Type.String()),
      limit: Type.Optional(Type.Number()),
      offset: Type.Optional(Type.Number()),
    }),
    async execute(_toolCallId, params) {
      try {
        const filter = decodeMergeConflictFilter(params)

        const result = await runStoreEffect(
          Effect.gen(function* () {
            const store = yield* PatternRegistryStore
            return yield* store.listMergeConflicts(filter)
          }),
        )

        if (result.total === 0) {
          return {
            content: [{ type: 'text', text: 'No merge conflicts found.' }],
            details: Schema.encodeUnknownSync(MergeConflictQueryResult)(result),
          }
        }

        const lines = [
          `Found ${result.total} conflict(s) (showing ${result.offset + 1}-${Math.min(result.offset + result.conflicts.length, result.total)}):`,
          '',
        ]

        for (const conflict of result.conflicts) {
          lines.push(`- ${conflict.conflictId} [${conflict.status}] run=${conflict.runId}`)
          lines.push(`  ${conflict.canonicalKey}`)
          lines.push(`  winner=${conflict.winnerPatternId} contender=${conflict.contenderPatternId}`)
          lines.push(`  reason=${conflict.reason}`)
        }

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          details: Schema.encodeUnknownSync(MergeConflictQueryResult)(result),
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `pattern_registry_list_conflicts failed: ${message}` }],
          isError: true,
        }
      }
    },
  })
}
