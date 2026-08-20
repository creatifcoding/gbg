import { Schema } from 'effect'
import { QuestionId, SpecimenId } from './identifiers'

export const Question = Schema.Struct({
  id: QuestionId,
  specimenId: SpecimenId,
  text: Schema.NonEmptyString,
})
export type Question = typeof Question.Type

export const decodeQuestion = Schema.decodeUnknownSync(Question)

export function parseQuestions(raw: string): string[] {
  return raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
