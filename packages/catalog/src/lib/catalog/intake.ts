import { Schema } from 'effect'
import { createCard } from './entity/card-entity'
import { CardKind } from './schemas/card'
import { Guess, guessFromInput } from './schemas/guess'
import type { Card } from './schemas/card'
import type { CardEvent } from './schemas/events/card-events'
import type { Question } from './schemas/question'
import type { Tag } from './schemas/tag'
import { Tags } from './schemas/tag'
import type { CardId, QuestionId, TagId } from './schemas/identifiers'

export const IntakeInput = Schema.Struct({
  kind: CardKind,
  claim: Schema.NonEmptyString,
  tags: Tags,
  organismGuess: Schema.optional(Schema.NullOr(Guess)),
  questions: Schema.Array(Schema.NonEmptyString),
})
export type IntakeInput = typeof IntakeInput.Type

export const decodeIntake = Schema.decodeUnknownSync(IntakeInput)

export type IntakeResult = {
  card: Card
  tags: ReadonlyArray<Tag>
  questions: ReadonlyArray<Question>
  events: ReadonlyArray<CardEvent>
}

export class IntakeError extends Error {
  readonly _tag = 'IntakeError'
  constructor(readonly issues: ReadonlyArray<string>) {
    super(issues.join('; '))
    this.name = 'IntakeError'
  }
}

export function fileCard(input: unknown, now = Date.now()): IntakeResult {
  let intake: IntakeInput
  try {
    intake = decodeIntake(input)
  } catch (error) {
    throw new IntakeError(issuesFromUnknown(error))
  }

  const cardId = crypto.randomUUID() as CardId
  const tags: Tag[] = intake.tags.map((slug) => ({
    id: crypto.randomUUID() as TagId,
    slug,
  }))
  const questions: Question[] = intake.questions.map((text) => ({
    id: crypto.randomUUID() as QuestionId,
    cardId,
    text,
  }))

  const { card, event } = createCard(
    {
      id: cardId,
      kind: intake.kind,
      claim: intake.claim,
      organismGuess: intake.organismGuess ?? null,
      tagIds: tags.map((tag) => tag.id),
      questionIds: questions.map((question) => question.id),
    },
    now,
  )

  return { card, tags, questions, events: [event] }
}

export { guessFromInput }

function issuesFromUnknown(error: unknown): string[] {
  if (error instanceof Error && error.message.length > 0) {
    return ['Need a type, a one-line claim, and 3+ tags.', error.message]
  }
  return ['Need a type, a one-line claim, and 3+ tags.']
}
