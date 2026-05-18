/** Relationship layer hardening integration tests. */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { GraphClient } from '../../services/l1/GraphClient'
import type { MachineId, WorkOrderId } from '../../schemas/identifiers'
import { GraphIntegrationLayer } from './layer'
import { withCleanMachineDatabase } from './machines/layer'

const RUN = process.env['RUN_INTEGRATION_TESTS'] === '1'
let counter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`

describe.skipIf(!RUN)('relationship edge audit and safe Cypher', () => {
  it.effect('audits edge upserts and rejects mutating read-only Cypher', () =>
    withCleanMachineDatabase(
      Effect.gen(function* () {
        const graph = yield* GraphClient
        const sql = yield* PgClient.PgClient
        const workOrderId = nextId('TEST-WO-EDGE') as WorkOrderId
        const machineId = nextId('TEST-MCH-EDGE') as MachineId

        yield* graph.upsertRelationshipNode({ type: 'work_order', id: workOrderId }, { status: 'started' })
        yield* graph.upsertRelationshipNode({ type: 'machine', id: machineId }, { status: 'running' })
        yield* graph.upsertRelationshipEdge({
          source: { type: 'work_order', id: workOrderId },
          target: { type: 'machine', id: machineId },
          edgeType: 'targets',
          metadata: {
            _tag: 'RelationshipEdgeMetadata',
            createdBy: 'edge-audit-test',
            reason: 'requires_asset',
            context: { test: true },
          },
        })

        const rows = yield* sql<{
          edgeId: string
          action: string
          edgeType: string
          sourceId: string
          targetId: string
          actor: string
        }>`
          SELECT
            edge_id AS "edgeId",
            action,
            edge_type AS "edgeType",
            source_id AS "sourceId",
            target_id AS "targetId",
            actor
          FROM iiot.relationship_edge_audit
          WHERE source_id = ${workOrderId}
            AND target_id = ${machineId}
          ORDER BY created_at DESC
          LIMIT 1
        `

        expect(rows).toHaveLength(1)
        expect(rows[0]!.edgeId).toContain('EDGE-targets-work_order-')
        expect(rows[0]!.action).toBe('upsert')
        expect(rows[0]!.edgeType).toBe('targets')
        expect(rows[0]!.actor).toBe('edge-audit-test')

        const read = yield* graph.executeReadOnlyCypher(
          `MATCH (wo:work_order {id: '${workOrderId}'}) RETURN wo.id AS work_order_id`,
          '(work_order_id agtype)',
        )
        expect(read.rows[0]?.['workOrderId']).toBe(workOrderId)

        const rejected = yield* graph.executeReadOnlyCypher(
          `CREATE (:machine {id: 'TEST-MUTATING'})`,
        ).pipe(Effect.either)
        expect(rejected._tag).toBe('Left')
      })
    ).pipe(Effect.provide(GraphIntegrationLayer))
  )
})
