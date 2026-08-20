import { Schema } from 'effect'
import {
  AttachmentId,
  CardId,
  QuestionId,
  TagId,
} from './identifiers'
import { Guess } from './guess'

export const CardKind = Schema.Literals([
  'picture',
  'dossier',
  'artifact',
  'note',
] as const)
export type CardKind = typeof CardKind.Type

export const CardStatus = Schema.Literals([
  'raw',
  'filed',
  'working',
  'dead',
] as const)
export type CardStatus = typeof CardStatus.Type

export const CARD_KINDS = [
  'picture',
  'dossier',
  'artifact',
  'note',
] as const satisfies ReadonlyArray<CardKind>

export const CARD_STATUSES = [
  'raw',
  'filed',
  'working',
  'dead',
] as const satisfies ReadonlyArray<CardStatus>

/**
 * Card lifecycle. Linear happy path, skip-to-dead from any live state.
 * Do not auto-walk skipped states (raw cannot jump to working).
 */
const cardTransitions: Record<CardStatus, readonly CardStatus[]> = {
  raw: ['filed', 'dead'],
  filed: ['working', 'dead'],
  working: ['dead'],
  dead: [],
}

export function isValidCardTransition(from: CardStatus, to: CardStatus): boolean {
  return cardTransitions[from].includes(to)
}

export function getValidNextCardStates(current: CardStatus): readonly CardStatus[] {
  return cardTransitions[current]
}

export const Card = Schema.Struct({
  _tag: Schema.Literal('Card'),
  id: CardId,
  kind: CardKind,
  status: CardStatus,
  claim: Schema.NonEmptyString,
  body: Schema.String,
  organismGuess: Schema.NullOr(Guess),
  structureGuess: Schema.NullOr(Guess),
  functionGuess: Schema.NullOr(Guess),
  tagIds: Schema.Array(TagId),
  questionIds: Schema.Array(QuestionId),
  attachmentIds: Schema.Array(AttachmentId),
  example: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
export type Card = typeof Card.Type

export const decodeStoredCard = Schema.decodeUnknownSync(Card)

export function isCardKind(value: string): value is CardKind {
  return (CARD_KINDS as readonly string[]).includes(value)
}

export function isCardStatus(value: string): value is CardStatus {
  return (CARD_STATUSES as readonly string[]).includes(value)
}
