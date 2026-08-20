import {
  decodeStoredCard,
  isValidCardTransition,
  type Card,
  type CardKind,
  type CardStatus,
} from '../schemas/card'
import type { CardCreated, CardEvent } from '../schemas/events/card-events'
import type { AttachmentId, CardId, QuestionId, TagId } from '../schemas/identifiers'
import type { Guess } from '../schemas/guess'

export class CardTransitionError extends Error {
  readonly _tag = 'CardTransitionError'
  constructor(
    readonly cardId: CardId,
    readonly from: CardStatus,
    readonly to: CardStatus,
  ) {
    super(`Cannot move card ${cardId} from ${from} to ${to}`)
    this.name = 'CardTransitionError'
  }
}

export type CreateCardInput = {
  id: CardId
  kind: CardKind
  claim: string
  organismGuess: Guess | null
  structureGuess?: Guess | null
  functionGuess?: Guess | null
  tagIds: ReadonlyArray<TagId>
  questionIds: ReadonlyArray<QuestionId>
  attachmentIds?: ReadonlyArray<AttachmentId>
  example?: boolean
}

function eventId(now: number, suffix: string): CardCreated['id'] {
  return `evt_${now}_${suffix}` as CardCreated['id']
}

export function createCard(
  input: CreateCardInput,
  now = Date.now(),
): { card: Card; event: CardEvent } {
  const card = decodeStoredCard({
    _tag: 'Card',
    id: input.id,
    kind: input.kind,
    status: 'raw',
    claim: input.claim,
    body: '',
    organismGuess: input.organismGuess,
    structureGuess: input.structureGuess ?? null,
    functionGuess: input.functionGuess ?? null,
    tagIds: [...input.tagIds],
    questionIds: [...input.questionIds],
    attachmentIds: [...(input.attachmentIds ?? [])],
    example: input.example ?? false,
    createdAt: now,
    updatedAt: now,
  })

  const event: CardEvent = {
    id: eventId(now, `${card.id}_created`),
    type: 'CardCreated',
    entityId: card.id,
    occurredAt: now,
    payload: { kind: card.kind, claim: card.claim },
  }

  return { card, event }
}

export function transitionCard(
  card: Card,
  to: CardStatus,
  now = Date.now(),
): { card: Card; event: CardEvent } {
  if (!isValidCardTransition(card.status, to)) {
    throw new CardTransitionError(card.id, card.status, to)
  }

  const next = decodeStoredCard({
    ...card,
    status: to,
    updatedAt: now,
  })

  const event: CardEvent = {
    id: eventId(now, `${card.id}_${card.status}_${to}`),
    type: 'CardTransitioned',
    entityId: card.id,
    occurredAt: now,
    payload: { from: card.status, to },
  }

  return { card: next, event }
}

export function setCardBody(
  card: Card,
  body: string,
  now = Date.now(),
): { card: Card; event: CardEvent } {
  const next = decodeStoredCard({
    ...card,
    body,
    updatedAt: now,
  })

  const event: CardEvent = {
    id: eventId(now, `${card.id}_body`),
    type: 'CardBodySet',
    entityId: card.id,
    occurredAt: now,
    payload: {},
  }

  return { card: next, event }
}

export function attachToCard(
  card: Card,
  attachmentId: AttachmentId,
  now = Date.now(),
): Card {
  if (card.attachmentIds.includes(attachmentId)) return card
  return decodeStoredCard({
    ...card,
    attachmentIds: [...card.attachmentIds, attachmentId],
    updatedAt: now,
  })
}
