import { describe, expect, it } from 'vitest'
import { DateTime, Effect, Option } from 'effect'
import {
  RelationshipEdgeAuditEntry,
  RelationshipEdgeAuditQuery,
} from '../../schemas/relationships'
import {
  RelationshipEdgeAuditRepo,
  RelationshipEdgeAuditRepoInMemory,
} from '../RelationshipEdgeAuditRepo'

const now = DateTime.unsafeNow().pipe(DateTime.toDateUtc)

const entry = (patch: Partial<RelationshipEdgeAuditEntry> = {}) => new RelationshipEdgeAuditEntry({
  id: patch.id ?? crypto.randomUUID(),
  edgeId: patch.edgeId ?? 'EDGE-targets-work_order-WO-1-machine-MCH-1',
  action: patch.action ?? 'upsert',
  edgeType: patch.edgeType ?? 'targets',
  sourceType: patch.sourceType ?? 'work_order',
  sourceId: patch.sourceId ?? 'WO-1',
  targetType: patch.targetType ?? 'machine',
  targetId: patch.targetId ?? 'MCH-1',
  actor: patch.actor ?? 'test',
  reason: patch.reason ?? Option.some('test-reason'),
  descriptorVersion: patch.descriptorVersion ?? 1,
  validFrom: patch.validFrom ?? Option.some(now),
  validTo: patch.validTo ?? Option.none(),
  metadata: patch.metadata ?? { eventTag: 'AssetAttached' },
  createdAt: patch.createdAt ?? now,
})

describe('RelationshipEdgeAuditRepo', () => {
  it('queries audit entries by edge id', async () => {
    const rows = [
      entry({ edgeId: 'EDGE-1', sourceId: 'WO-1' }),
      entry({ edgeId: 'EDGE-2', sourceId: 'WO-2' }),
    ]

    const result = await Effect.runPromise(Effect.gen(function* () {
      const repo = yield* RelationshipEdgeAuditRepo
      return yield* repo.findByEdgeId('EDGE-1')
    }).pipe(Effect.provide(RelationshipEdgeAuditRepoInMemory(rows))))

    expect(result.map((row) => row.edgeId)).toEqual(['EDGE-1'])
  })

  it('queries audit entries by source and target endpoint', async () => {
    const rows = [
      entry({ sourceType: 'work_order', sourceId: 'WO-1', targetType: 'machine', targetId: 'MCH-1' }),
      entry({ sourceType: 'work_order', sourceId: 'WO-1', targetType: 'line', targetId: 'LIN-1' }),
      entry({ sourceType: 'work_order', sourceId: 'WO-2', targetType: 'machine', targetId: 'MCH-1' }),
    ]

    const result = await Effect.runPromise(Effect.gen(function* () {
      const repo = yield* RelationshipEdgeAuditRepo
      const source = yield* repo.findBySource({ sourceType: 'work_order', sourceId: 'WO-1' })
      const target = yield* repo.findByTarget({ targetType: 'machine', targetId: 'MCH-1' })
      return { source, target }
    }).pipe(Effect.provide(RelationshipEdgeAuditRepoInMemory(rows))))

    expect(result.source.map((row) => row.targetId)).toEqual(['MCH-1', 'LIN-1'])
    expect(result.target.map((row) => row.sourceId)).toEqual(['WO-1', 'WO-2'])
  })

  it('searches by typed optional filters', async () => {
    const rows = [
      entry({ edgeType: 'targets', action: 'upsert', sourceId: 'WO-1', targetId: 'MCH-1' }),
      entry({ edgeType: 'targets', action: 'soft_delete', sourceId: 'WO-1', targetId: 'MCH-1' }),
      entry({ edgeType: 'requires', action: 'upsert', sourceId: 'WO-1', targetId: 'EXT-1', targetType: 'external' }),
    ]

    const result = await Effect.runPromise(Effect.gen(function* () {
      const repo = yield* RelationshipEdgeAuditRepo
      return yield* repo.search(new RelationshipEdgeAuditQuery({
        edgeType: 'targets',
        action: 'soft_delete',
        limit: 10,
      }))
    }).pipe(Effect.provide(RelationshipEdgeAuditRepoInMemory(rows))))

    expect(result).toHaveLength(1)
    expect(result[0]?.action).toBe('soft_delete')
    expect(result[0]?.edgeType).toBe('targets')
  })
})
