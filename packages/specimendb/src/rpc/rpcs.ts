import { Rpc, RpcGroup } from 'effect/unstable/rpc'
import * as Schema from 'effect/Schema'
import { EvidenceKind, Specimen, SpecimenStatus } from '../schemas/specimen'
import { Guess } from '../schemas/guess'
import { Locality } from '../schemas/locality'
import { SpecimenId } from '../schemas/identifiers'
import { SpecimendbRpcError } from './errors'
import {
  IntakeFileTag,
  SpecimenGetTag,
  SpecimenListTag,
  SpecimenPromoteTag,
} from './tags'

/** Eat a dump. Pictures send file bytes. Locality is GPS tags or absent. */
export const IntakeFile = Rpc.make(IntakeFileTag, {
  payload: Schema.Struct({
    kind: EvidenceKind,
    bytes: Schema.optional(Schema.Uint8ArrayFromBase64),
    filename: Schema.optional(Schema.NonEmptyString),
    mimeType: Schema.optional(Schema.NonEmptyString),
    claim: Schema.optional(Schema.NonEmptyString),
    tags: Schema.optional(Schema.Array(Schema.NonEmptyString)),
    organismGuess: Schema.optional(Schema.NullOr(Guess)),
    structureGuess: Schema.optional(Schema.NullOr(Guess)),
    locality: Schema.optional(Locality),
    questions: Schema.optional(Schema.Array(Schema.NonEmptyString)),
    id: Schema.optional(SpecimenId),
  }),
  success: Specimen,
  error: SpecimendbRpcError,
})

export const SpecimenGet = Rpc.make(SpecimenGetTag, {
  payload: Schema.Struct({
    id: SpecimenId,
  }),
  success: Specimen,
  error: SpecimendbRpcError,
})

export const SpecimenList = Rpc.make(SpecimenListTag, {
  payload: Schema.Struct({}),
  success: Schema.Array(Specimen),
  error: SpecimendbRpcError,
})

export const SpecimenPromote = Rpc.make(SpecimenPromoteTag, {
  payload: Schema.Struct({
    id: SpecimenId,
    to: SpecimenStatus,
  }),
  success: Specimen,
  error: SpecimendbRpcError,
})

export const SpecimendbRpcs = RpcGroup.make(
  IntakeFile,
  SpecimenGet,
  SpecimenList,
  SpecimenPromote,
)

export type SpecimendbRpcs = typeof SpecimendbRpcs
