/**
 * DecisionMakerEntity Handlers
 * @module prospects/entity/handlers/DecisionMakerHandlers
 */

import { Effect, Option } from 'effect'
import { DecisionMakerEntity, DMNotFoundError } from '../DecisionMakerEntity'
import { DecisionMakerModel } from '../../models/DecisionMakerModel'
import { DecisionMakerRepository } from '../../services/repositories'
import { CIPScoring } from '../../services/cip-scoring'
import { ProvenanceService } from '../../services/provenance'
import type { EntityType } from '../../services/provenance'

const ENTITY_TYPE: EntityType = 'decision_maker'

const toView = (row: any) => ({
  id: row.id,
  name: row.name,
  title: row.title ?? null,
  titleLevel: row.titleLevel ?? row.title_level,
  companyId: row.companyId ?? row.company_id,
  cipCapital: row.cipCapital ?? row.cip_capital ?? 0,
  cipInterest: row.cipInterest ?? row.cip_interest ?? 0,
  cipPower: row.cipPower ?? row.cip_power ?? 0,
  cipComposite: row.cipComposite ?? row.cip_composite ?? 0,
  pipelineStage: row.pipelineStage ?? row.pipeline_stage,
})

export const DecisionMakerEntityHandlers = DecisionMakerEntity.toLayer(
  Effect.gen(function* () {
    const repo = yield* DecisionMakerRepository
    const cip = yield* CIPScoring
    const provenance = yield* ProvenanceService

    const load = (id: string) =>
      Effect.gen(function* () {
        const row = yield* repo.reload(id)
        if (!row) return yield* Effect.fail(new DMNotFoundError({ decisionMakerId: id }))
        return toView(row)
      })

    return {
      'DecisionMaker.Create': (envelope) =>
        Effect.gen(function* () {
          const p = envelope.payload
          yield* repo.insert(
            DecisionMakerModel.insert.make({
              id: p.id,
              name: p.name,
              title: p.title ? Option.some(p.title) : Option.none(),
              titleLevel: p.titleLevel ?? 'unknown',
              companyId: p.companyId,
              contactsJson: p.contacts ? Option.some(p.contacts) : Option.none(),
              tenureJson: p.tenure ? Option.some(p.tenure) : Option.none(),
              contractEstimateJson: Option.none(),
              cipCapital: 0, cipInterest: 0, cipPower: 0, cipComposite: 0,
              pipelineStage: 'harvested',
              notes: Option.none(),
            })
          )
          yield* provenance.trackBatch([
            { entityType: ENTITY_TYPE, entityId: p.id, fieldName: 'name', value: p.name,
              source: { connector: 'manual' }, confidence: 1.0 },
            ...(p.title ? [{ entityType: ENTITY_TYPE as EntityType, entityId: p.id, fieldName: 'title',
              value: p.title, source: { connector: 'manual' as string }, confidence: 0.9 }] : []),
          ])
          return yield* load(p.id)
        }),

      'DecisionMaker.Get': (envelope) => load(envelope.payload.id),

      'DecisionMaker.RecalculateCIP': (envelope) =>
        Effect.gen(function* () {
          const result = yield* cip.recalculateOne(envelope.payload.id)
          if (!result) return yield* Effect.fail(new DMNotFoundError({ decisionMakerId: envelope.payload.id }))
          return result
        }),

      'DecisionMaker.UpdateContacts': (envelope) =>
        Effect.gen(function* () {
          const { id, contacts } = envelope.payload
          yield* repo.updateContacts(id, JSON.stringify(contacts))
          yield* provenance.track({ entityType: ENTITY_TYPE, entityId: id, fieldName: 'contacts',
            value: JSON.stringify(contacts), source: { connector: 'manual' }, confidence: 1.0 })
          return yield* load(id)
        }),

      'DecisionMaker.SetContractEstimate': (envelope) =>
        Effect.gen(function* () {
          const { id, estimate } = envelope.payload
          yield* repo.setContractEstimate(id, JSON.stringify(estimate))
          yield* provenance.track({ entityType: ENTITY_TYPE, entityId: id, fieldName: 'contract_estimate',
            value: JSON.stringify(estimate), source: { connector: 'manual' }, confidence: 1.0 })
          return yield* load(id)
        }),

      'DecisionMaker.UpdateStage': (envelope) =>
        Effect.gen(function* () {
          const { id, stage } = envelope.payload
          yield* repo.updateStage(id, stage)
          yield* provenance.track({ entityType: ENTITY_TYPE, entityId: id, fieldName: 'pipeline_stage',
            value: stage, source: { connector: 'manual' }, confidence: 1.0 })
          return yield* load(id)
        }),
    }
  })
)
