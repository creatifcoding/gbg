import { Schema } from 'effect'
import { MechanismId } from './identifiers'

export const Mechanism = Schema.Struct({
  id: MechanismId,
  name: Schema.NonEmptyString,
  summary: Schema.String,
  example: Schema.Boolean,
})
export type Mechanism = typeof Mechanism.Type

export const decodeMechanism = Schema.decodeUnknownSync(Mechanism)
