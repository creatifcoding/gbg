/**
 * GraphClient - Apache AGE Graph Boundary
 *
 * Owns only AGE execution and schema/descriptor-validated graph primitives.
 * Domain graph semantics (asset hierarchy, alarm sensor reads, WorkOrder helper
 * queries) live in L2 graph query/projection services.
 *
 * @module
 */

import { Context, DateTime, Effect, Layer, Schema } from 'effect'
import { PgClient } from '@effect/sql-pg'
import type { EdgeId } from '../../schemas/identifiers'
import { GraphQueryError } from '../../schemas/errors'
import {
  getRelationshipEdgeDescriptor,
  isRelationshipAllowed,
  RelationshipEdgeMetadataInput,
  RelationshipEdgeRefInput,
  RelationshipEdgeType,
  RelationshipEdgeUpsertInput,
  RelationshipEndpoint,
  RelationshipEndpointInput,
  RelationshipNodeType,
  type RelationshipEdgeRef,
  type RelationshipEdgeUpsert,
  type RelationshipPropagationPolicy,
} from '../../schemas/relationships'
import type { ObservationSignal, ReactorObservation } from '../../schemas/reactor'
import { IIoTPgClientLive } from './IIoTPgClient'

// =============================================================================
// Configuration
// =============================================================================

export interface GraphConfig {
  readonly graphName: string
}

export const GraphConfig = Context.GenericTag<GraphConfig>('iiot/GraphConfig')

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  graphName: 'iiot_graph',
}

// =============================================================================
// Cypher Result Types
// =============================================================================

export interface CypherResult {
  readonly rows: ReadonlyArray<Record<string, unknown>>
}

export interface PropagationTargetExpansion {
  readonly edgeType: typeof RelationshipEdgeType.Type
  readonly source: RelationshipEndpoint
  readonly target: RelationshipEndpoint
  readonly requestTarget: RelationshipEndpoint
}

type RelationshipEndpointBoundaryInput = RelationshipEndpoint | typeof RelationshipEndpointInput.Type
type RelationshipEdgeRefBoundaryInput = RelationshipEdgeRef | typeof RelationshipEdgeRefInput.Type
type RelationshipEdgeUpsertBoundaryInput = RelationshipEdgeUpsert | typeof RelationshipEdgeUpsertInput.Type

type RelationshipTargetIdsInput = {
  readonly source: RelationshipEndpointBoundaryInput
  readonly edgeType: typeof RelationshipEdgeType.Type
  readonly targetType: typeof RelationshipNodeType.Type
}

const RelationshipTargetIdsInput = Schema.Struct({
  source: RelationshipEndpointInput,
  edgeType: RelationshipEdgeType,
  targetType: RelationshipNodeType,
})

const RelationshipEdgeSoftDeleteInput = Schema.Struct({
  source: RelationshipEndpointInput,
  target: RelationshipEndpointInput,
  edgeType: RelationshipEdgeType,
  reason: Schema.optional(Schema.String),
})

type RelationshipEdgeSoftDeleteInput = typeof RelationshipEdgeSoftDeleteInput.Type

// =============================================================================
// Apache AGE Helpers
// =============================================================================

const parseAgtype = (value: unknown): unknown => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

const escapeCypher = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const nodeIdProperty = (type: typeof RelationshipNodeType.Type): string => {
  switch (type) {
    case 'sensor':
    case 'device':
      return 'device_id'
    default:
      return 'id'
  }
}

const makeEdgeId = (input: {
  readonly source: RelationshipEndpoint
  readonly target: RelationshipEndpoint
  readonly edgeType: typeof RelationshipEdgeType.Type
}): EdgeId => {
  const raw = `EDGE-${input.edgeType}-${input.source.type}-${input.source.id}-${input.target.type}-${input.target.id}`
  return raw.replace(/[^a-zA-Z0-9:_-]/g, '-') as EdgeId
}

const cypherMap = (entries: Record<string, string | number | boolean | null | undefined>): string => {
  const props = Object.entries(entries)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (value === null) return `${key}: null`
      if (typeof value === 'number' || typeof value === 'boolean') return `${key}: ${String(value)}`
      return `${key}: '${escapeCypher(value)}'`
    })
  return `{${props.join(', ')}}`
}

const decodeGraphInput = <A, I>(
  schema: Schema.Schema<A, I>,
  value: unknown,
  query: string,
): Effect.Effect<A, GraphQueryError> =>
  Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError((cause) => new GraphQueryError({
      query,
      message: `Invalid graph input for ${query}: ${String(cause)}`,
      cause,
    })),
  )

const normalizeEndpoint = (
  endpoint: RelationshipEndpointBoundaryInput,
  query: string,
): Effect.Effect<RelationshipEndpoint, GraphQueryError> =>
  decodeGraphInput(RelationshipEndpointInput, endpoint, query).pipe(
    Effect.map((input) => new RelationshipEndpoint({ type: input.type, id: input.id })),
  )

// =============================================================================
// Service Definition
// =============================================================================

export class GraphClient extends Effect.Service<GraphClient>()('iiot/GraphClient', {
  effect: Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    const graphName = DEFAULT_GRAPH_CONFIG.graphName

    const setSearchPath = () =>
      sql.unsafe(`SET search_path = ag_catalog, iiot, public`)

    const executeCypher = (
      query: string,
      columnDefs: string = '(result agtype)',
    ): Effect.Effect<CypherResult, GraphQueryError> =>
      Effect.gen(function* () {
        yield* Effect.logDebug(`Executing Cypher: ${query.slice(0, 100)}...`)
        yield* setSearchPath()

        const cypherSql = `SELECT * FROM cypher('${graphName}', $$ ${query} $$) AS ${columnDefs}`
        const rawRows = yield* sql.unsafe<Record<string, unknown>>(cypherSql)

        const rows = rawRows.map((row) => {
          const parsed: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(row)) {
            parsed[key] = parseAgtype(value)
          }
          return parsed
        })

        return { rows }
      }).pipe(
        Effect.catchAll((cause) => Effect.fail(new GraphQueryError({
          query,
          message: `Cypher query failed: ${String(cause)}`,
          cause,
        }))),
      )

    const assertReadOnlyCypher = (query: string): Effect.Effect<void, GraphQueryError> => {
      const forbidden = /\b(CREATE|MERGE|SET|DELETE|DETACH|DROP|ALTER|CALL|REMOVE)\b/i
      return forbidden.test(query)
        ? Effect.fail(new GraphQueryError({
          query,
          message: 'Only read-only Cypher is allowed on this API',
        }))
        : Effect.void
    }

    const executeReadOnlyCypher = (
      query: string,
      columnDefs: string = '(result agtype)',
    ): Effect.Effect<CypherResult, GraphQueryError> =>
      Effect.zipRight(assertReadOnlyCypher(query), executeCypher(query, columnDefs))

    const upsertRelationshipNode = (
      endpointInput: RelationshipEndpointBoundaryInput,
      properties: Record<string, string | number | boolean | null | undefined> = {},
    ): Effect.Effect<void, GraphQueryError> =>
      Effect.gen(function* () {
        const endpoint = yield* normalizeEndpoint(endpointInput, 'upsertRelationshipNode.endpoint')
        const idProperty = nodeIdProperty(endpoint.type)
        const propertyMap = cypherMap({
          ...properties,
          [idProperty]: endpoint.id,
          updated_at: new Date().toISOString(),
        })

        yield* executeCypher(
          `MERGE (n:${endpoint.type} {${idProperty}: '${escapeCypher(endpoint.id)}'})
           SET n += ${propertyMap}`,
          '(n agtype)',
        )
      })

    const upsertRelationshipEdge = (inputValue: RelationshipEdgeUpsertBoundaryInput): Effect.Effect<void, GraphQueryError> =>
      Effect.gen(function* () {
        const input = yield* decodeGraphInput(RelationshipEdgeUpsertInput, inputValue, 'upsertRelationshipEdge')
        const source = new RelationshipEndpoint({ type: input.source.type, id: input.source.id })
        const target = new RelationshipEndpoint({ type: input.target.type, id: input.target.id })
        const metadata = yield* decodeGraphInput(RelationshipEdgeMetadataInput, input.metadata, 'upsertRelationshipEdge.metadata')

        if (!isRelationshipAllowed({ edgeType: input.edgeType, sourceType: source.type, targetType: target.type })) {
          return yield* Effect.fail(new GraphQueryError({
            query: 'upsertRelationshipEdge',
            message: `Relationship ${source.type} -[:${input.edgeType}]-> ${target.type} is not allowed by registry`,
          }))
        }

        const sourceIdProperty = nodeIdProperty(source.type)
        const targetIdProperty = nodeIdProperty(target.type)
        const edgeId = metadata.edgeId ?? makeEdgeId({ source, target, edgeType: input.edgeType })
        const validFrom = metadata.validFrom ?? new Date().toISOString()
        const edgeProperties = cypherMap({
          edge_id: edgeId,
          created_at: new Date().toISOString(),
          created_by: metadata.createdBy,
          valid_from: validFrom,
          valid_to: null,
          reason: metadata.reason,
          version: 1,
          source_type: source.type,
          target_type: target.type,
          context_json: JSON.stringify(metadata.context ?? {}),
        })

        yield* executeCypher(
          `MATCH (source:${source.type} {${sourceIdProperty}: '${escapeCypher(source.id)}'}),
                  (target:${target.type} {${targetIdProperty}: '${escapeCypher(target.id)}'})
           MERGE (source)-[edge:${input.edgeType}]->(target)
           SET edge += ${edgeProperties}`,
          '(edge agtype)',
        )

        yield* sql`
          INSERT INTO iiot.relationship_edge_audit (
            edge_id,
            action,
            edge_type,
            source_type,
            source_id,
            target_type,
            target_id,
            actor,
            reason,
            descriptor_version,
            valid_from,
            metadata
          ) VALUES (
            ${edgeId},
            'upsert',
            ${input.edgeType},
            ${source.type},
            ${source.id},
            ${target.type},
            ${target.id},
            ${metadata.createdBy},
            ${metadata.reason ?? null},
            1,
            ${validFrom},
            ${JSON.stringify(metadata.context ?? {})}::jsonb
          )
        `
      })

    const softDeleteRelationshipEdge = (inputValue: RelationshipEdgeSoftDeleteInput | RelationshipEdgeRefBoundaryInput): Effect.Effect<void, GraphQueryError> =>
      Effect.gen(function* () {
        const input = yield* decodeGraphInput(RelationshipEdgeSoftDeleteInput, inputValue, 'softDeleteRelationshipEdge')
        const source = new RelationshipEndpoint({ type: input.source.type, id: input.source.id })
        const target = new RelationshipEndpoint({ type: input.target.type, id: input.target.id })

        if (!isRelationshipAllowed({ edgeType: input.edgeType, sourceType: source.type, targetType: target.type })) {
          return yield* Effect.fail(new GraphQueryError({
            query: 'softDeleteRelationshipEdge',
            message: `Relationship ${source.type} -[:${input.edgeType}]-> ${target.type} is not allowed by registry`,
          }))
        }

        const sourceIdProperty = nodeIdProperty(source.type)
        const targetIdProperty = nodeIdProperty(target.type)
        const edgeId = makeEdgeId({ source, target, edgeType: input.edgeType })
        const validTo = new Date().toISOString()
        yield* executeCypher(
          `MATCH (source:${source.type} {${sourceIdProperty}: '${escapeCypher(source.id)}'})
                  -[edge:${input.edgeType}]->
                 (target:${target.type} {${targetIdProperty}: '${escapeCypher(target.id)}'})
           SET edge.valid_to = '${validTo}',
               edge.deactivation_reason = '${escapeCypher(input.reason ?? 'soft_delete')}'`,
          '(edge agtype)',
        )

        yield* sql`
          INSERT INTO iiot.relationship_edge_audit (
            edge_id,
            action,
            edge_type,
            source_type,
            source_id,
            target_type,
            target_id,
            actor,
            reason,
            descriptor_version,
            valid_to,
            metadata
          ) VALUES (
            ${edgeId},
            'soft_delete',
            ${input.edgeType},
            ${source.type},
            ${source.id},
            ${target.type},
            ${target.id},
            'system',
            ${input.reason ?? 'soft_delete'},
            1,
            ${validTo},
            '{}'::jsonb
          )
        `
      })

    const getRelationshipTargetIds = (inputValue: RelationshipTargetIdsInput): Effect.Effect<readonly string[], GraphQueryError> =>
      Effect.gen(function* () {
        const input = yield* decodeGraphInput(RelationshipTargetIdsInput, inputValue, 'getRelationshipTargetIds')
        const source = new RelationshipEndpoint({ type: input.source.type, id: input.source.id })

        if (!isRelationshipAllowed({ edgeType: input.edgeType, sourceType: source.type, targetType: input.targetType })) {
          return yield* Effect.fail(new GraphQueryError({
            query: 'getRelationshipTargetIds',
            message: `Relationship ${source.type} -[:${input.edgeType}]-> ${input.targetType} is not allowed by registry`,
          }))
        }

        const sourceIdProperty = nodeIdProperty(source.type)
        const targetIdProperty = nodeIdProperty(input.targetType)
        const result = yield* executeCypher(
          `MATCH (source:${source.type} {${sourceIdProperty}: '${escapeCypher(source.id)}'})
                  -[edge:${input.edgeType}]->
                 (target:${input.targetType})
           WHERE edge.valid_to IS NULL
           RETURN target.${targetIdProperty} AS target_id
           ORDER BY target.${targetIdProperty}`,
          '(target_id agtype)',
        )

        return result.rows.map((row) => String(row['targetId']))
      })

    const asOfActiveTargetIdsFromAudit = (input: {
      readonly source: RelationshipEndpoint
      readonly edgeType: typeof RelationshipEdgeType.Type
      readonly targetType: typeof RelationshipNodeType.Type
      readonly asOf: Date
    }): Effect.Effect<readonly string[], GraphQueryError> =>
      sql<{ requestId: string }>`
        SELECT DISTINCT upsert.target_id AS "requestId"
        FROM iiot.relationship_edge_audit upsert
        WHERE upsert.action = 'upsert'
          AND upsert.edge_type = ${input.edgeType}
          AND upsert.source_type = ${input.source.type}
          AND upsert.source_id = ${input.source.id}
          AND upsert.target_type = ${input.targetType}
          AND (upsert.valid_from IS NULL OR upsert.valid_from <= ${input.asOf})
          AND NOT EXISTS (
            SELECT 1
            FROM iiot.relationship_edge_audit deleted
            WHERE deleted.edge_id = upsert.edge_id
              AND deleted.action = 'soft_delete'
              AND deleted.valid_to IS NOT NULL
              AND deleted.valid_to < ${input.asOf}
          )
        ORDER BY upsert.target_id
      `.pipe(
        Effect.map((rows) => rows.map((row) => row.requestId)),
        Effect.mapError((cause) => new GraphQueryError({
          query: 'relationship_edge_audit.as_of_targets',
          message: `Audit-backed propagation target expansion failed: ${String(cause)}`,
          cause,
        })),
      )

    const asOfActiveSourceIdsFromAudit = (input: {
      readonly target: RelationshipEndpoint
      readonly edgeType: typeof RelationshipEdgeType.Type
      readonly sourceType: typeof RelationshipNodeType.Type
      readonly asOf: Date
    }): Effect.Effect<readonly string[], GraphQueryError> =>
      sql<{ requestId: string }>`
        SELECT DISTINCT upsert.source_id AS "requestId"
        FROM iiot.relationship_edge_audit upsert
        WHERE upsert.action = 'upsert'
          AND upsert.edge_type = ${input.edgeType}
          AND upsert.source_type = ${input.sourceType}
          AND upsert.target_type = ${input.target.type}
          AND upsert.target_id = ${input.target.id}
          AND (upsert.valid_from IS NULL OR upsert.valid_from <= ${input.asOf})
          AND NOT EXISTS (
            SELECT 1
            FROM iiot.relationship_edge_audit deleted
            WHERE deleted.edge_id = upsert.edge_id
              AND deleted.action = 'soft_delete'
              AND deleted.valid_to IS NOT NULL
              AND deleted.valid_to < ${input.asOf}
          )
        ORDER BY upsert.source_id
      `.pipe(
        Effect.map((rows) => rows.map((row) => row.requestId)),
        Effect.mapError((cause) => new GraphQueryError({
          query: 'relationship_edge_audit.as_of_sources',
          message: `Audit-backed propagation source expansion failed: ${String(cause)}`,
          cause,
        })),
      )

    const expandPropagationTargets = (input: {
      readonly observation: ReactorObservation
      readonly policy: RelationshipPropagationPolicy
      readonly signal: ObservationSignal
    }): Effect.Effect<readonly PropagationTargetExpansion[], GraphQueryError> =>
      Effect.gen(function* () {
        const edge = getRelationshipEdgeDescriptor(input.policy.edgeType)
        const subject = input.observation.subject
        const subjectIdProperty = nodeIdProperty(subject.type)
        const asOf = DateTime.toDate(input.observation.event.occurredAt)

        if (input.policy.observedEndpoint === 'source') {
          if (!edge.allowedSourceTypes.includes(subject.type)) return []

          const expansions = yield* Effect.forEach(
            edge.allowedTargetTypes,
            (targetType) =>
              Effect.gen(function* () {
                const targetIdProperty = nodeIdProperty(targetType)
                const result = yield* executeReadOnlyCypher(
                  `MATCH (observed:${subject.type} {${subjectIdProperty}: '${escapeCypher(subject.id)}'})
                          -[edge:${input.policy.edgeType}]->
                         (target:${targetType})
                   WHERE edge.valid_to IS NULL
                   RETURN target.${targetIdProperty} AS request_id
                   ORDER BY target.${targetIdProperty}`,
                  '(request_id agtype)',
                )
                const activeIds = result.rows.map((row) => String(row['requestId']))
                const auditIds = yield* asOfActiveTargetIdsFromAudit({
                  source: subject,
                  edgeType: input.policy.edgeType,
                  targetType,
                  asOf,
                })

                return Array.from(new Set([...activeIds, ...auditIds])).map((id): PropagationTargetExpansion => {
                  const source = subject
                  const target = new RelationshipEndpoint({ type: targetType, id })
                  return {
                    edgeType: input.policy.edgeType,
                    source,
                    target,
                    requestTarget: input.policy.requestEndpoint === 'source' ? source : target,
                  }
                })
              }),
            { concurrency: 'unbounded' },
          )

          return expansions.flat()
        }

        if (!edge.allowedTargetTypes.includes(subject.type)) return []

        const expansions = yield* Effect.forEach(
          edge.allowedSourceTypes,
          (sourceType) =>
            Effect.gen(function* () {
              const sourceIdProperty = nodeIdProperty(sourceType)
              const result = yield* executeReadOnlyCypher(
                `MATCH (source:${sourceType})
                        -[edge:${input.policy.edgeType}]->
                       (observed:${subject.type} {${subjectIdProperty}: '${escapeCypher(subject.id)}'})
                 WHERE edge.valid_to IS NULL
                 RETURN source.${sourceIdProperty} AS request_id
                 ORDER BY source.${sourceIdProperty}`,
                '(request_id agtype)',
              )
              const activeIds = result.rows.map((row) => String(row['requestId']))
              const auditIds = yield* asOfActiveSourceIdsFromAudit({
                target: subject,
                edgeType: input.policy.edgeType,
                sourceType,
                asOf,
              })

              return Array.from(new Set([...activeIds, ...auditIds])).map((id): PropagationTargetExpansion => {
                const source = new RelationshipEndpoint({ type: sourceType, id })
                const target = subject
                return {
                  edgeType: input.policy.edgeType,
                  source,
                  target,
                  requestTarget: input.policy.requestEndpoint === 'source' ? source : target,
                }
              })
            }),
          { concurrency: 'unbounded' },
        )

        return expansions.flat()
      }).pipe(Effect.withSpan('iiot.graph.expandPropagationTargets'))

    const healthCheck = (): Effect.Effect<boolean, GraphQueryError> =>
      Effect.gen(function* () {
        yield* setSearchPath()
        const result = yield* sql<{ name: string }>`
          SELECT name FROM ag_catalog.ag_graph WHERE name = ${graphName}
        `
        return result.length > 0
      }).pipe(
        Effect.catchAll((cause) => Effect.fail(new GraphQueryError({
          query: 'health_check',
          message: `Apache AGE health check failed: ${String(cause)}`,
          cause,
        }))),
      )

    return {
      executeCypher,
      executeReadOnlyCypher,
      upsertRelationshipNode,
      upsertRelationshipEdge,
      softDeleteRelationshipEdge,
      getRelationshipTargetIds,
      expandPropagationTargets,
      healthCheck,
    } as const
  }),
  dependencies: [IIoTPgClientLive],
}) {}

export const GraphClientLive = GraphClient.Default

export const GraphClientTest = Layer.effect(
  GraphClient,
  Effect.gen(function* () {
    yield* PgClient.PgClient
    return yield* GraphClient
  }),
)
