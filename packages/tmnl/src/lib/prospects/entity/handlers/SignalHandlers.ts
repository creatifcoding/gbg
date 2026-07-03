/**
 * SignalEntity Handlers
 * @module prospects/entity/handlers/SignalHandlers
 */

import { Effect, Option } from 'effect'
import { SignalEntity, SignalNotFoundError } from '../SignalEntity'
import { SignalModel } from '../../models/SignalModel'
import { SignalRepository } from '../../services/repositories'

const toView = (row: any) => ({
  id: row.id,
  companyId: row.companyId,
  decisionMakerId: row.decisionMakerId ?? row.decision_maker_id ?? null,
  signalType: row.signalType ?? row.signal_type,
  title: row.title,
  description: row.description ?? null,
  sourceUrl: row.sourceUrl ?? row.source_url ?? null,
  weight: row.weight,
  detectedAt: typeof row.detectedAt === 'object' ? row.detectedAt?.toISOString?.() ?? '' :
    (row.detectedAt ?? row.detected_at ?? ''),
})

export const SignalEntityHandlers = SignalEntity.toLayer(
  Effect.gen(function* () {
    const repo = yield* SignalRepository

    const load = (id: string) =>
      Effect.gen(function* () {
        const row = yield* repo.reload(id)
        if (!row) return yield* Effect.fail(new SignalNotFoundError({ signalId: id }))
        return toView(row)
      })

    return {
      'Signal.Create': (envelope) =>
        Effect.gen(function* () {
          const p = envelope.payload
          yield* repo.insert(
            SignalModel.insert.make({
              id: p.id,
              companyId: p.companyId,
              decisionMakerId: Option.none(),
              signalType: p.signalType,
              title: p.title,
              description: p.description ? Option.some(p.description) : Option.none(),
              sourceUrl: p.sourceUrl ? Option.some(p.sourceUrl) : Option.none(),
              weight: p.weight ?? 1,
              expiresAt: Option.none(),
              raw: p.raw ? Option.some(p.raw) : Option.none(),
            })
          )
          return yield* load(p.id)
        }),

      'Signal.Get': (envelope) => load(envelope.payload.id),

      'Signal.AttachToDM': (envelope) =>
        Effect.gen(function* () {
          yield* repo.attachToDM(envelope.payload.id, envelope.payload.decisionMakerId)
          return yield* load(envelope.payload.id)
        }),

      'Signal.Expire': (envelope) =>
        Effect.gen(function* () {
          yield* repo.expire(envelope.payload.id)
          return yield* load(envelope.payload.id)
        }),
    }
  })
)
