import { Schema } from 'effect'
import { Attachment } from '../schemas/attachment'
import { CardKind, CardStatus } from '../schemas/card'
import { Guess } from '../schemas/guess'
import { CardId } from '../schemas/identifiers'
import type { Card } from '../schemas/card'
import type { CatalogSnapshot } from './catalog-snapshot'

export const CardView = Schema.Struct({
  id: CardId,
  kind: CardKind,
  status: CardStatus,
  claim: Schema.NonEmptyString,
  body: Schema.String,
  organismGuess: Schema.NullOr(Guess),
  structureGuess: Schema.NullOr(Guess),
  functionGuess: Schema.NullOr(Guess),
  tags: Schema.Array(Schema.NonEmptyString),
  questions: Schema.Array(Schema.NonEmptyString),
  attachments: Schema.Array(Attachment),
  example: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
export type CardView = typeof CardView.Type

/** UI-facing alias. Screens consume the hydrated projection, not the stored Card. */
export const CatalogCard = CardView
export type CatalogCard = CardView

export const decodeCardView = Schema.decodeUnknownSync(CardView)
export const encodeCardView = Schema.encodeUnknownSync(CardView)

export const CatalogFilter = Schema.Struct({
  kind: Schema.optional(CardKind),
  status: Schema.optional(CardStatus),
  tag: Schema.optional(Schema.NonEmptyString),
})
export type CatalogFilter = typeof CatalogFilter.Type

export function hydrateCard(
  snapshot: CatalogSnapshot,
  card: Card,
): CardView {
  const tagsById = new Map(snapshot.tags.map((tag) => [tag.id, tag]))
  const questionsById = new Map(
    snapshot.questions.map((question) => [question.id, question]),
  )
  const attachmentsById = new Map(
    snapshot.attachments.map((attachment) => [attachment.id, attachment]),
  )

  return decodeCardView({
    id: card.id,
    kind: card.kind,
    status: card.status,
    claim: card.claim,
    body: card.body,
    organismGuess: card.organismGuess,
    structureGuess: card.structureGuess,
    functionGuess: card.functionGuess,
    tags: card.tagIds
      .map((id) => tagsById.get(id)?.slug)
      .filter((slug): slug is string => Boolean(slug)),
    questions: card.questionIds
      .map((id) => questionsById.get(id)?.text)
      .filter((text): text is string => Boolean(text)),
    attachments: card.attachmentIds
      .map((id) => attachmentsById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    example: card.example,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  })
}

export function matchesFilter(
  view: CardView,
  filter: CatalogFilter,
): boolean {
  if (filter.kind && view.kind !== filter.kind) return false
  if (filter.status && view.status !== filter.status) return false
  if (filter.tag && !view.tags.includes(filter.tag)) return false
  return true
}
