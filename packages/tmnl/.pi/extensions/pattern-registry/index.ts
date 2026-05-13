import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { Type } from '@sinclair/typebox'
import { Effect, Schema } from 'effect'
import {
  AnnotationRecord,
  DiscoveryQueryFilter,
  DiscoveredPatternEvent,
  Pattern,
  PatternSearchFilter,
} from './schema.ts'
import { PatternRegistryStore } from './persistence/index.ts'

const decodePattern = Schema.decodeUnknownSync(Pattern)
const decodeDiscoveryEvent = Schema.decodeUnknownSync(DiscoveredPatternEvent)
const decodeAnnotation = Schema.decodeUnknownSync(AnnotationRecord)
const decodeSearchFilter = Schema.decodeUnknownSync(PatternSearchFilter)
const decodeDiscoveryFilter = Schema.decodeUnknownSync(DiscoveryQueryFilter)

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
}
