/**
 * GEOINT Harness ToolDefinitions
 *
 * First harness-facing tool surface for geospatial entity orchestration.
 *
 * @module geoint/harness/tools
 */

import { Type, type Static } from '@sinclair/typebox'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'

// ─────────────────────────────────────────────────────────────────────────────
// Shared Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const GeointEntityTypeSchema = Type.Union([
  Type.Literal('flight'),
  Type.Literal('poi'),
  Type.Literal('weather'),
  Type.Literal('track'),
  Type.Literal('feature'),
  Type.Literal('imagery'),
])
export type GeointEntityTypeParam = Static<typeof GeointEntityTypeSchema>

export const GeointBoundsSchema = Type.Object({
  west: Type.Number(),
  east: Type.Number(),
  south: Type.Number(),
  north: Type.Number(),
})
export type GeointBoundsParam = Static<typeof GeointBoundsSchema>

// ─────────────────────────────────────────────────────────────────────────────
// geoint_search
// ─────────────────────────────────────────────────────────────────────────────

export const GeointSearchParams = Type.Object({
  mode: Type.Union([
    Type.Literal('all'),
    Type.Literal('type'),
    Type.Literal('bounds'),
    Type.Literal('type+bounds'),
  ]),
  entityType: Type.Optional(GeointEntityTypeSchema),
  bounds: Type.Optional(GeointBoundsSchema),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 5000 })),
})
export type GeointSearchParams = Static<typeof GeointSearchParams>

export interface GeointSearchDetails {
  readonly mode: GeointSearchParams['mode']
  readonly count: number
  readonly entityIds: string[]
  readonly items: unknown[]
}

export function createGeointSearchTool(bridge: {
  execute: (
    callId: string,
    params: GeointSearchParams,
    signal: AbortSignal | undefined,
    onUpdate: ((partial: { content: Array<{ type: string; text: string }>; details?: GeointSearchDetails }) => void) | undefined,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeointSearchDetails }>
}): ToolDefinition<typeof GeointSearchParams, GeointSearchDetails> {
  return {
    name: 'geoint_search',
    label: 'GEOINT Search',
    description: 'Search already-spawned GEOINT entities by type and/or bounds. Returns summaries for matching entities.',
    parameters: GeointSearchParams,
    async execute(toolCallId, params, signal, onUpdate, _ctx) {
      return bridge.execute(toolCallId, params, signal, onUpdate)
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// geoint_spawn
// ─────────────────────────────────────────────────────────────────────────────

export const GeointSpawnParams = Type.Object({
  mode: Type.Union([Type.Literal('one'), Type.Literal('batch')]),
  result: Type.Optional(Type.Unknown({ description: 'Single SearchResultItem payload' })),
  results: Type.Optional(Type.Array(Type.Unknown(), { description: 'Batch of SearchResultItem payloads' })),
})
export type GeointSpawnParams = Static<typeof GeointSpawnParams>

export interface GeointSpawnDetails {
  readonly mode: GeointSpawnParams['mode']
  readonly spawnedCount: number
  readonly entityIds: string[]
  readonly items: unknown[]
}

export function createGeointSpawnTool(bridge: {
  execute: (
    callId: string,
    params: GeointSpawnParams,
    signal: AbortSignal | undefined,
    onUpdate: ((partial: { content: Array<{ type: string; text: string }>; details?: GeointSpawnDetails }) => void) | undefined,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeointSpawnDetails }>
}): ToolDefinition<typeof GeointSpawnParams, GeointSpawnDetails> {
  return {
    name: 'geoint_spawn',
    label: 'Spawn GEOINT Entity',
    description: 'Spawn one or many GEOINT entities from SearchResultItem payload(s).',
    parameters: GeointSpawnParams,
    async execute(toolCallId, params, signal, onUpdate, _ctx) {
      return bridge.execute(toolCallId, params, signal, onUpdate)
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// geoint_select
// ─────────────────────────────────────────────────────────────────────────────

export const GeointSelectParams = Type.Object({
  action: Type.Union([Type.Literal('set'), Type.Literal('clear'), Type.Literal('focus')]),
  entityId: Type.Optional(Type.String()),
  zoom: Type.Optional(Type.Number({ minimum: 0, maximum: 22 })),
})
export type GeointSelectParams = Static<typeof GeointSelectParams>

export interface GeointSelectDetails {
  readonly action: GeointSelectParams['action']
  readonly selectedEntityId: string | null
  readonly entity?: unknown
  readonly viewport?: unknown
}

export function createGeointSelectTool(bridge: {
  execute: (
    callId: string,
    params: GeointSelectParams,
    signal: AbortSignal | undefined,
    onUpdate: ((partial: { content: Array<{ type: string; text: string }>; details?: GeointSelectDetails }) => void) | undefined,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeointSelectDetails }>
}): ToolDefinition<typeof GeointSelectParams, GeointSelectDetails> {
  return {
    name: 'geoint_select',
    label: 'Select GEOINT Entity',
    description: 'Set/clear/focus entity selection. Focus also recenters viewport around the entity.',
    parameters: GeointSelectParams,
    async execute(toolCallId, params, signal, onUpdate, _ctx) {
      return bridge.execute(toolCallId, params, signal, onUpdate)
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// geoint_summary
// ─────────────────────────────────────────────────────────────────────────────

export const GeointSummaryParams = Type.Object({
  scope: Type.Union([
    Type.Literal('entity'),
    Type.Literal('all'),
    Type.Literal('type'),
    Type.Literal('bounds'),
  ]),
  entityId: Type.Optional(Type.String()),
  entityType: Type.Optional(GeointEntityTypeSchema),
  bounds: Type.Optional(GeointBoundsSchema),
  includeViewport: Type.Optional(Type.Boolean({ default: false })),
})
export type GeointSummaryParams = Static<typeof GeointSummaryParams>

export interface GeointSummaryDetails {
  readonly scope: GeointSummaryParams['scope']
  readonly total: number
  readonly byType: Partial<Record<GeointEntityTypeParam, number>>
  readonly entities: unknown[]
  readonly viewport?: unknown
}

export function createGeointSummaryTool(bridge: {
  execute: (
    callId: string,
    params: GeointSummaryParams,
    signal: AbortSignal | undefined,
    onUpdate: ((partial: { content: Array<{ type: string; text: string }>; details?: GeointSummaryDetails }) => void) | undefined,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeointSummaryDetails }>
}): ToolDefinition<typeof GeointSummaryParams, GeointSummaryDetails> {
  return {
    name: 'geoint_summary',
    label: 'GEOINT Summary',
    description: 'Return entity summaries for one entity, all entities, a type slice, or bounds slice.',
    parameters: GeointSummaryParams,
    async execute(toolCallId, params, signal, onUpdate, _ctx) {
      return bridge.execute(toolCallId, params, signal, onUpdate)
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// geoint_plan
// ─────────────────────────────────────────────────────────────────────────────

export const GeointPlanParams = Type.Object({
  queryId: Type.Optional(Type.String({ description: 'Caller-supplied query identifier' })),
  text: Type.Optional(Type.String()),
  bbox: Type.Optional(Type.Array(Type.Number(), { minItems: 4, maxItems: 4 })),
  requestedSources: Type.Optional(Type.Array(Type.String())),
  strategy: Type.Optional(Type.Union([
    Type.Literal('latency-first'),
    Type.Literal('coverage-first'),
    Type.Literal('trust-first'),
  ])),
  constraints: Type.Optional(Type.Object({
    filterLanguage: Type.Optional(Type.Union([
      Type.Literal('none'),
      Type.Literal('cql2-text'),
      Type.Literal('cql2-json'),
    ])),
    requiresStreaming: Type.Optional(Type.Boolean()),
    requiresTemporalOrdering: Type.Optional(Type.Boolean()),
    maxSources: Type.Optional(Type.Number({ minimum: 1, maximum: 16 })),
  })),
})
export type GeointPlanParams = Static<typeof GeointPlanParams>

export interface GeointPlanDetails {
  readonly planId: string
  readonly strategy: 'latency-first' | 'coverage-first' | 'trust-first'
  readonly selectedCount: number
  readonly rejectedCount: number
  readonly selected: Array<{
    sourceId: string
    canonicalSource: string
    role: string
    provider: string
    rank: number
    rationale: string
    fallbackOf?: string
  }>
  readonly rejected: Array<{
    sourceId: string
    canonicalSource: string
    reason: string
  }>
  readonly plan: unknown
}

export function createGeointPlanTool(bridge: {
  execute: (
    callId: string,
    params: GeointPlanParams,
    signal: AbortSignal | undefined,
    onUpdate: ((partial: { content: Array<{ type: string; text: string }>; details?: GeointPlanDetails }) => void) | undefined,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: GeointPlanDetails }>
}): ToolDefinition<typeof GeointPlanParams, GeointPlanDetails> {
  return {
    name: 'geoint_plan',
    label: 'GEOINT Plan',
    description: 'Build a source-aware query plan with ranked attempts, fallbacks, and explicit rejections.',
    parameters: GeointPlanParams,
    async execute(toolCallId, params, signal, onUpdate, _ctx) {
      return bridge.execute(toolCallId, params, signal, onUpdate)
    },
  }
}
