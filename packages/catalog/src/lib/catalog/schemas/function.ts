import { Schema } from 'effect'
import { FunctionId } from './identifiers'

/**
 * Named BioFunction so the TypeScript type does not collide with global Function.
 * Node kind on edges stays `'function'`.
 */
export const BioFunction = Schema.Struct({
  id: FunctionId,
  name: Schema.NonEmptyString,
  summary: Schema.String,
  example: Schema.Boolean,
})
export type BioFunction = typeof BioFunction.Type

export const decodeBioFunction = Schema.decodeUnknownSync(BioFunction)
