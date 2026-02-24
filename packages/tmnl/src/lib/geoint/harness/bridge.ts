/**
 * GEOINT Harness Bridge
 *
 * Wires ToolDefinition.execute calls to GeointHarnessService Effect methods.
 *
 * @module geoint/harness/bridge
 */

import { Effect, Schema } from 'effect'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'
import type { SearchResultItem as SearchResultItemType } from '../schemas/search'
import { SearchResultItem } from '../schemas/search'
import type { GeointHarnessServiceShape } from './GeointHarnessService'
import {
  createGeointSearchTool,
  createGeointSpawnTool,
  createGeointSelectTool,
  createGeointSummaryTool,
  type GeointSearchParams,
  type GeointSpawnParams,
  type GeointSelectParams,
  type GeointSummaryParams,
} from './tools'

const decodeSearchResult = Schema.decodeUnknownSync(SearchResultItem)
const decodeSearchResultArray = Schema.decodeUnknownSync(Schema.Array(SearchResultItem))

type EntitySummary = NonNullable<ReturnType<typeof import('../stx/entity-ops').getEntitySummary>>

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const inBounds = (
  item: { position: { longitude: number; latitude: number } },
  bounds: { west: number; east: number; south: number; north: number },
) =>
  item.position.longitude >= bounds.west &&
  item.position.longitude <= bounds.east &&
  item.position.latitude >= bounds.south &&
  item.position.latitude <= bounds.north

const ensureEntityId = (params: { entityId?: string }, operation: string): string => {
  if (!params.entityId || params.entityId.trim().length === 0) {
    throw new Error(`${operation} requires entityId`)
  }
  return params.entityId
}

const summarizeForSpawn = (
  summaries: Array<EntitySummary | null>,
) => summaries
  .filter((s): s is EntitySummary => Boolean(s))
  .map((s) => ({
    entityId: s.entityId,
    entityType: s.entityType,
    displayLabel: s.displayLabel,
    state: s.state,
    position: s.position,
  }))

const summarizeForList = (
  summaries: Array<EntitySummary | null>,
) => summaries.filter((s): s is EntitySummary => Boolean(s))

export function createGeointTools(
  service: GeointHarnessServiceShape,
): ToolDefinition[] {
  const searchTool = createGeointSearchTool({
    async execute(_callId, params: GeointSearchParams) {
      const all = await Effect.runPromise(service.getAllSummaries())
      const normalized = summarizeForList(all)

      let filtered = normalized
      if (params.mode === 'type' || params.mode === 'type+bounds') {
        if (!params.entityType) {
          throw new Error('geoint_search mode type/type+bounds requires entityType')
        }
        filtered = filtered.filter((s) => s.entityType === params.entityType)
      }
      if (params.mode === 'bounds' || params.mode === 'type+bounds') {
        if (!params.bounds) {
          throw new Error('geoint_search mode bounds/type+bounds requires bounds')
        }
        filtered = filtered.filter((s) => inBounds(s, params.bounds!))
      }

      const limit = params.limit ? clamp(params.limit, 1, 5000) : 200
      const items = filtered.slice(0, limit)

      return {
        content: [{
          type: 'text',
          text: `GEOINT search (${params.mode}) returned ${items.length} entities${items.length !== filtered.length ? ` (limited from ${filtered.length})` : ''}.`,
        }],
        details: {
          mode: params.mode,
          count: items.length,
          entityIds: items.map((s) => s.entityId),
          items,
        },
      }
    },
  })

  const spawnTool = createGeointSpawnTool({
    async execute(_callId, params: GeointSpawnParams) {
      if (params.mode === 'one') {
        if (!params.result) {
          throw new Error('geoint_spawn mode one requires result')
        }
        const decoded = decodeSearchResult(params.result) as SearchResultItemType
        const stx = await Effect.runPromise(service.spawnFromSearchResult(decoded))
        const summary = await Effect.runPromise(service.getSummary(stx.data.entityId.get()))
        const items = summarizeForSpawn([summary])

        return {
          content: [{ type: 'text', text: `Spawned entity ${items[0]?.entityId ?? 'unknown'} (${items[0]?.entityType ?? 'n/a'}).` }],
          details: {
            mode: 'one' as const,
            spawnedCount: items.length,
            entityIds: items.map((i) => i.entityId),
            items,
          },
        }
      }

      if (!params.results || params.results.length === 0) {
        throw new Error('geoint_spawn mode batch requires non-empty results')
      }

      const decoded = decodeSearchResultArray(params.results) as ReadonlyArray<SearchResultItemType>
      const spawned = await Effect.runPromise(service.spawnBatchFromSearchResults(decoded))
      const summaries = await Promise.all(
        spawned.map((s) => Effect.runPromise(service.getSummary(s.data.entityId.get()))),
      )
      const items = summarizeForSpawn(summaries)

      return {
        content: [{ type: 'text', text: `Spawned ${items.length} GEOINT entities from batch.` }],
        details: {
          mode: 'batch' as const,
          spawnedCount: items.length,
          entityIds: items.map((i) => i.entityId),
          items,
        },
      }
    },
  })

  const selectTool = createGeointSelectTool({
    async execute(_callId, params: GeointSelectParams) {
      switch (params.action) {
        case 'clear': {
          await Effect.runPromise(service.select(null))
          return {
            content: [{ type: 'text', text: 'Cleared GEOINT selection.' }],
            details: {
              action: 'clear' as const,
              selectedEntityId: null,
            },
          }
        }

        case 'set': {
          const entityId = ensureEntityId(params, 'geoint_select[action=set]')
          await Effect.runPromise(service.select(entityId))
          const entity = await Effect.runPromise(service.getSummary(entityId))
          return {
            content: [{ type: 'text', text: `Selected entity ${entityId}.` }],
            details: {
              action: 'set' as const,
              selectedEntityId: entityId,
              entity,
            },
          }
        }

        case 'focus': {
          const entityId = ensureEntityId(params, 'geoint_select[action=focus]')
          const viewport = await Effect.runPromise(service.focusEntity(entityId, params.zoom))
          const entity = await Effect.runPromise(service.getSummary(entityId))
          return {
            content: [{ type: 'text', text: `Focused entity ${entityId} at zoom ${viewport.zoom}.` }],
            details: {
              action: 'focus' as const,
              selectedEntityId: entityId,
              entity,
              viewport,
            },
          }
        }
      }
    },
  })

  const summaryTool = createGeointSummaryTool({
    async execute(_callId, params: GeointSummaryParams) {
      let entities: Array<EntitySummary | null>

      switch (params.scope) {
        case 'entity': {
          const entityId = ensureEntityId(params, 'geoint_summary[scope=entity]')
          entities = [await Effect.runPromise(service.getSummary(entityId))]
          break
        }
        case 'all': {
          entities = await Effect.runPromise(service.getAllSummaries())
          break
        }
        case 'type': {
          if (!params.entityType) {
            throw new Error('geoint_summary scope type requires entityType')
          }
          const byType = await Effect.runPromise(service.getByType(params.entityType))
          entities = await Promise.all(
            byType.map((s) => Effect.runPromise(service.getSummary(s.data.entityId.get()))),
          )
          break
        }
        case 'bounds': {
          if (!params.bounds) {
            throw new Error('geoint_summary scope bounds requires bounds')
          }
          const inArea = await Effect.runPromise(service.getInBounds(params.bounds))
          entities = await Promise.all(
            inArea.map((s) => Effect.runPromise(service.getSummary(s.data.entityId.get()))),
          )
          break
        }
      }

      const normalized = summarizeForList(entities)
      const byType = normalized.reduce<Partial<Record<EntitySummary['entityType'], number>>>(
        (acc, item) => {
          acc[item.entityType] = (acc[item.entityType] ?? 0) + 1
          return acc
        },
        {},
      )

      const viewport = params.includeViewport
        ? await Effect.runPromise(service.getViewport())
        : undefined

      return {
        content: [{
          type: 'text',
          text: `GEOINT summary (${params.scope}): ${normalized.length} entities. ${Object.entries(byType)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ')}`,
        }],
        details: {
          scope: params.scope,
          total: normalized.length,
          byType,
          entities: normalized,
          ...(viewport ? { viewport } : {}),
        },
      }
    },
  })

  return [searchTool, spawnTool, selectTool, summaryTool]
}
