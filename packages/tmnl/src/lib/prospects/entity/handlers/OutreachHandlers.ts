/**
 * OutreachEntity Handlers
 * @module prospects/entity/handlers/OutreachHandlers
 */

import { Effect, Option } from 'effect'
import { OutreachEntity, OutreachNotFoundError } from '../OutreachEntity'
import { OutreachModel } from '../../models/OutreachModel'
import { OutreachRepository } from '../../services/repositories'

const dateToString = (v: any): string | null =>
  v == null ? null : typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : String(v)

const toView = (row: any) => ({
  id: row.id,
  decisionMakerId: row.decisionMakerId ?? row.decision_maker_id,
  companyId: row.companyId ?? row.company_id,
  channel: row.channel,
  status: row.status,
  subject: row.subject ?? null,
  sentAt: dateToString(row.sentAt ?? row.sent_at),
  respondedAt: dateToString(row.respondedAt ?? row.responded_at),
})

export const OutreachEntityHandlers = OutreachEntity.toLayer(
  Effect.gen(function* () {
    const repo = yield* OutreachRepository

    const load = (id: string) =>
      Effect.gen(function* () {
        const row = yield* repo.reload(id)
        if (!row) return yield* Effect.fail(new OutreachNotFoundError({ outreachId: id }))
        return toView(row)
      })

    return {
      'Outreach.Create': (envelope) =>
        Effect.gen(function* () {
          const p = envelope.payload
          yield* repo.insert(
            OutreachModel.insert.make({
              id: p.id,
              decisionMakerId: p.decisionMakerId,
              companyId: p.companyId,
              channel: p.channel,
              status: 'drafted',
              subject: p.subject ? Option.some(p.subject) : Option.none(),
              body: p.body ? Option.some(p.body) : Option.none(),
              sentAt: Option.none(),
              respondedAt: Option.none(),
              notes: Option.none(),
            })
          )
          return yield* load(p.id)
        }),

      'Outreach.Get': (envelope) => load(envelope.payload.id),
      'Outreach.MarkSent': (envelope) =>
        Effect.gen(function* () {
          yield* repo.markSent(envelope.payload.id)
          return yield* load(envelope.payload.id)
        }),
      'Outreach.MarkReplied': (envelope) =>
        Effect.gen(function* () {
          yield* repo.markReplied(envelope.payload.id, envelope.payload.notes)
          return yield* load(envelope.payload.id)
        }),
      'Outreach.MarkBounced': (envelope) =>
        Effect.gen(function* () {
          yield* repo.markBounced(envelope.payload.id)
          return yield* load(envelope.payload.id)
        }),
    }
  })
)
