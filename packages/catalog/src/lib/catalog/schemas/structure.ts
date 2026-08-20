import { Schema } from 'effect'
import { StructureId } from './identifiers'

export const Structure = Schema.Struct({
  id: StructureId,
  name: Schema.NonEmptyString,
  summary: Schema.String,
  example: Schema.Boolean,
})
export type Structure = typeof Structure.Type

export const decodeStructure = Schema.decodeUnknownSync(Structure)
