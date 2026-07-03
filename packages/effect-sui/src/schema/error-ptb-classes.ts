import * as Schema from 'effect/Schema';

import { SuiPtbErrorPhase } from './error-codes';

export class SuiPtbInvalidError extends Schema.TaggedErrorClass<SuiPtbInvalidError>('@tmnl/effect-sui/SuiPtbInvalidError')('Sui/PtbInvalid', {
  phase: SuiPtbErrorPhase,
  message: Schema.String,
  commandIndex: Schema.optional(Schema.Number),
  argumentIndex: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiArgumentInvalidError extends Schema.TaggedErrorClass<SuiArgumentInvalidError>('@tmnl/effect-sui/SuiArgumentInvalidError')('Sui/ArgumentInvalid', {
  phase: SuiPtbErrorPhase,
  argument: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiProtocolLimitExceededError extends Schema.TaggedErrorClass<SuiProtocolLimitExceededError>('@tmnl/effect-sui/SuiProtocolLimitExceededError')('Sui/ProtocolLimitExceeded', {
  limit: Schema.String,
  actual: Schema.optional(Schema.Number),
  maximum: Schema.optional(Schema.Number),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiPtbCompileError extends Schema.TaggedErrorClass<SuiPtbCompileError>('@tmnl/effect-sui/SuiPtbCompileError')('Sui/PtbCompile', {
  phase: SuiPtbErrorPhase,
  message: Schema.String,
  commandIndex: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiBuildError extends Schema.TaggedErrorClass<SuiBuildError>('@tmnl/effect-sui/SuiBuildError')('Sui/Build', {
  builder: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}
