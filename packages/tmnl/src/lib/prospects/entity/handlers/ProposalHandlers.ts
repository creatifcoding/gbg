/**
 * ProposalEntity Handlers
 * @module prospects/entity/handlers/ProposalHandlers
 */

import { Effect, Option } from 'effect'
import { ProposalEntity, ProposalNotFoundError } from '../ProposalEntity'
import { ProposalModel } from '../../models/ProposalModel'
import { ProposalRepository } from '../../services/repositories'

const toView = (row: any) => ({
  id: row.id,
  companyId: row.companyId ?? row.company_id,
  title: row.title,
  status: row.status,
  version: row.version,
  sectionCount: Array.isArray(row.sectionsJson ?? row.sections_json)
    ? (row.sectionsJson ?? row.sections_json).length : 0,
  deliveryMethod: row.deliveryMethod ?? row.delivery_method ?? null,
})

export const ProposalEntityHandlers = ProposalEntity.toLayer(
  Effect.gen(function* () {
    const repo = yield* ProposalRepository

    const load = (id: string) =>
      Effect.gen(function* () {
        const row = yield* repo.reload(id)
        if (!row) return yield* Effect.fail(new ProposalNotFoundError({ proposalId: id }))
        return toView(row)
      })

    return {
      'Proposal.Create': (envelope) =>
        Effect.gen(function* () {
          const p = envelope.payload
          yield* repo.insert(
            ProposalModel.insert.make({
              id: p.id,
              companyId: p.companyId,
              title: p.title,
              status: 'draft',
              version: 1,
              decisionMakerIdsJson: p.decisionMakerIds,
              signalIdsJson: p.signalIds,
              sectionsJson: [],
              contractEstimateJson: Option.none(),
              capabilitiesJson: Option.none(),
              deliveryMethod: p.deliveryMethod ? Option.some(p.deliveryMethod) : Option.none(),
              sentAt: Option.none(),
              expiresAt: Option.none(),
              notes: Option.none(),
            })
          )
          return yield* load(p.id)
        }),

      'Proposal.Get': (envelope) => load(envelope.payload.id),

      'Proposal.DraftSection': (envelope) =>
        Effect.gen(function* () {
          const { id, section } = envelope.payload
          const row = yield* repo.reload(id)
          if (!row) return yield* Effect.fail(new ProposalNotFoundError({ proposalId: id }))

          const existing = Array.isArray((row as any).sectionsJson) ? [...(row as any).sectionsJson] : []
          const idx = existing.findIndex((s: any) => s.key === section.key)
          if (idx >= 0) existing[idx] = section
          else existing.push(section)

          yield* repo.updateSections(id, JSON.stringify(existing))
          return yield* load(id)
        }),

      'Proposal.AdvanceStatus': (envelope) =>
        Effect.gen(function* () {
          yield* repo.advanceStatus(envelope.payload.id, envelope.payload.status)
          return yield* load(envelope.payload.id)
        }),

      'Proposal.SetEstimate': (envelope) =>
        Effect.gen(function* () {
          yield* repo.setEstimate(envelope.payload.id, JSON.stringify(envelope.payload.estimate))
          return yield* load(envelope.payload.id)
        }),

      'Proposal.SetCapabilities': (envelope) =>
        Effect.gen(function* () {
          yield* repo.setCapabilities(envelope.payload.id, JSON.stringify(envelope.payload.capabilities))
          return yield* load(envelope.payload.id)
        }),
    }
  })
)
