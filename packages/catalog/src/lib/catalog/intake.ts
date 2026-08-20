import { Schema } from 'effect'
import { createSpecimen } from './entity/specimen-entity'
import { createEdge } from './entity/edge-entity'
import { Guess, guessFromInput } from './schemas/guess'
import { EvidenceKind } from './schemas/specimen'
import { decodeObservation, type Observation } from './schemas/observation'
import type { Specimen } from './schemas/specimen'
import type { SpecimenEvent } from './schemas/events/specimen-events'
import type { Question } from './schemas/question'
import type { Tag } from './schemas/tag'
import { Tags } from './schemas/tag'
import type { Edge } from './schemas/edge'
import {
  ObservationId,
  QuestionId,
  SpecimenId,
  TagId,
} from './schemas/identifiers'

export const IntakeInput = Schema.Struct({
  kind: EvidenceKind,
  claim: Schema.NonEmptyString,
  tags: Tags,
  organismGuess: Schema.optional(Schema.NullOr(Guess)),
  structureGuess: Schema.optional(Schema.NullOr(Guess)),
  locality: Schema.optional(Schema.NullOr(Schema.NonEmptyString)),
  observedAt: Schema.optional(Schema.NullOr(Schema.NonEmptyString)),
  questions: Schema.Array(Schema.NonEmptyString),
})
export type IntakeInput = typeof IntakeInput.Type

export const decodeIntake = Schema.decodeUnknownSync(IntakeInput)

export type IntakeResult = {
  specimen: Specimen
  observation: Observation
  observationEdge: Edge
  tags: ReadonlyArray<Tag>
  questions: ReadonlyArray<Question>
  events: ReadonlyArray<SpecimenEvent>
}

export class IntakeError extends Error {
  readonly _tag = 'IntakeError'
  constructor(readonly issues: ReadonlyArray<string>) {
    super(issues.join('; '))
    this.name = 'IntakeError'
  }
}

export function optionalText(raw: string): string | null {
  const value = raw.trim()
  return value.length === 0 ? null : value
}

export function fileSpecimen(input: unknown, now = Date.now()): IntakeResult {
  let intake: IntakeInput
  try {
    intake = decodeIntake(input)
  } catch (error) {
    throw new IntakeError(issuesFromUnknown(error))
  }

  const specimenId = Schema.decodeUnknownSync(SpecimenId)(crypto.randomUUID())
  const observationId = Schema.decodeUnknownSync(ObservationId)(
    crypto.randomUUID(),
  )
  const tags: Tag[] = intake.tags.map((slug) => ({
    id: Schema.decodeUnknownSync(TagId)(crypto.randomUUID()),
    slug,
  }))
  const questions: Question[] = intake.questions.map((text) => ({
    id: Schema.decodeUnknownSync(QuestionId)(crypto.randomUUID()),
    specimenId,
    text,
  }))

  const { specimen, event } = createSpecimen(
    {
      id: specimenId,
      kind: intake.kind,
      claim: intake.claim,
      organismGuess: intake.organismGuess ?? null,
      structureGuess: intake.structureGuess ?? null,
      locality: intake.locality ?? null,
      observedAt: intake.observedAt ?? null,
      tagIds: tags.map((tag) => tag.id),
      questionIds: questions.map((question) => question.id),
      observationIds: [observationId],
    },
    now,
  )

  const observation = decodeObservation({
    id: observationId,
    specimenId,
    kind: intake.kind,
    note: '',
    attachmentIds: [],
    createdAt: now,
  })

  const observationEdge = createEdge({
    id: `edge_obs_${observationId}`,
    kind: 'observation-of',
    from: { _tag: 'observation', id: observationId },
    to: { _tag: 'specimen', id: specimenId },
    createdAt: now,
  })

  return {
    specimen,
    observation,
    observationEdge,
    tags,
    questions,
    events: [event],
  }
}

export { guessFromInput }

function issuesFromUnknown(error: unknown): string[] {
  if (error instanceof Error && error.message.length > 0) {
    return ['Need a type, a one-line claim, and 3+ tags.', error.message]
  }
  return ['Need a type, a one-line claim, and 3+ tags.']
}
