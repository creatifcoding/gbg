import * as Schema from 'effect/Schema';

import { SuiAuthMode, SuiExecutionErrorKind, SuiPaymentMode, SuiWaitErrorKind } from './error-codes';
import { SuiAddress, SuiObjectId, SuiTransactionDigest } from './strings';

export class SuiGasPlanningError extends Schema.TaggedErrorClass<SuiGasPlanningError>('@tmnl/effect-sui/SuiGasPlanningError')('Sui/GasPlanning', {
  policy: Schema.optional(Schema.String),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiDryRunError extends Schema.TaggedErrorClass<SuiDryRunError>('@tmnl/effect-sui/SuiDryRunError')('Sui/DryRun', {
  message: Schema.String,
  digest: Schema.optional(SuiTransactionDigest),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiMoveAbortError extends Schema.TaggedErrorClass<SuiMoveAbortError>('@tmnl/effect-sui/SuiMoveAbortError')('Sui/MoveAbort', {
  abortCode: Schema.String,
  packageId: Schema.optional(SuiObjectId),
  module: Schema.optional(Schema.String),
  functionName: Schema.optional(Schema.String),
  command: Schema.optional(Schema.Number),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiPaymentError extends Schema.TaggedErrorClass<SuiPaymentError>('@tmnl/effect-sui/SuiPaymentError')('Sui/Payment', {
  mode: SuiPaymentMode,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiGasCoinConflictError extends Schema.TaggedErrorClass<SuiGasCoinConflictError>('@tmnl/effect-sui/SuiGasCoinConflictError')('Sui/GasCoinConflict', {
  objectId: Schema.optional(SuiObjectId),
  resourceKey: Schema.optional(Schema.String),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiInsufficientGasError extends Schema.TaggedErrorClass<SuiInsufficientGasError>('@tmnl/effect-sui/SuiInsufficientGasError')('Sui/InsufficientGas', {
  owner: Schema.optional(SuiAddress),
  required: Schema.optional(Schema.String),
  available: Schema.optional(Schema.String),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiSponsorRejectedError extends Schema.TaggedErrorClass<SuiSponsorRejectedError>('@tmnl/effect-sui/SuiSponsorRejectedError')('Sui/SponsorRejected', {
  sponsor: Schema.optional(SuiAddress),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiAuthError extends Schema.TaggedErrorClass<SuiAuthError>('@tmnl/effect-sui/SuiAuthError')('Sui/Auth', {
  mode: SuiAuthMode,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiSignatureError extends Schema.TaggedErrorClass<SuiSignatureError>('@tmnl/effect-sui/SuiSignatureError')('Sui/Signature', {
  mode: SuiAuthMode,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiWalletRejectedError extends Schema.TaggedErrorClass<SuiWalletRejectedError>('@tmnl/effect-sui/SuiWalletRejectedError')('Sui/WalletRejected', {
  wallet: Schema.optional(Schema.String),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiRejectedByValidatorError extends Schema.TaggedErrorClass<SuiRejectedByValidatorError>('@tmnl/effect-sui/SuiRejectedByValidatorError')('Sui/RejectedByValidator', {
  kind: SuiExecutionErrorKind,
  digest: Schema.optional(SuiTransactionDigest),
  command: Schema.optional(Schema.Number),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiWaitError extends Schema.TaggedErrorClass<SuiWaitError>('@tmnl/effect-sui/SuiWaitError')('Sui/Wait', {
  kind: SuiWaitErrorKind,
  digest: Schema.optional(SuiTransactionDigest),
  timeoutMs: Schema.optional(Schema.Number),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiIndexerVisibilityError extends Schema.TaggedErrorClass<SuiIndexerVisibilityError>('@tmnl/effect-sui/SuiIndexerVisibilityError')('Sui/IndexerVisibility', {
  digest: SuiTransactionDigest,
  checkpoint: Schema.optional(Schema.String),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}
