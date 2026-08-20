import { Schema } from 'effect'
import { OrganismId } from './identifiers'

export const Organism = Schema.Struct({
  id: OrganismId,
  name: Schema.NonEmptyString,
  clade: Schema.optional(Schema.NonEmptyString),
  habitat: Schema.optional(Schema.NonEmptyString),
  example: Schema.Boolean,
})
export type Organism = typeof Organism.Type

export const decodeOrganism = Schema.decodeUnknownSync(Organism)
