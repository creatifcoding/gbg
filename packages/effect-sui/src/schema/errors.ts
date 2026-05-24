/** Schema-backed Sui typed errors. */

import * as Schema from 'effect-v4/Schema';

import { SuiObjectId, SuiTransactionDigest } from './strings';

export const SuiObjectErrorCode = Schema.Literals([
  'notExists',
  'dynamicFieldNotFound',
  'deleted',
  'displayError',
  'unknown',
] as const);
export type SuiObjectErrorCode = typeof SuiObjectErrorCode.Type;

export class SuiSchemaDecodeError extends Schema.TaggedErrorClass<SuiSchemaDecodeError>(
  '@tmnl/effect-sui/SuiSchemaDecodeError',
)('Sui/SchemaDecode', {
  schema: Schema.String,
  message: Schema.String,
  input: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiObjectLoadError extends Schema.TaggedErrorClass<SuiObjectLoadError>(
  '@tmnl/effect-sui/SuiObjectLoadError',
)('Sui/ObjectLoad', {
  code: SuiObjectErrorCode,
  message: Schema.String,
  objectId: Schema.optional(SuiObjectId),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiTransportError extends Schema.TaggedErrorClass<SuiTransportError>(
  '@tmnl/effect-sui/SuiTransportError',
)('Sui/Transport', {
  transport: Schema.Literals(['json-rpc', 'grpc', 'graphql', 'faucet', 'unknown'] as const),
  message: Schema.String,
  endpoint: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiExecutionError extends Schema.TaggedErrorClass<SuiExecutionError>(
  '@tmnl/effect-sui/SuiExecutionError',
)('Sui/Execution', {
  message: Schema.String,
  digest: Schema.optional(SuiTransactionDigest),
  command: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
}) {}

export const SuiReservationConflictKind = Schema.Literals([
  'object',
  'gas',
  'sender',
  'sponsor',
  'duplicate',
  'unknown',
] as const);
export type SuiReservationConflictKind = typeof SuiReservationConflictKind.Type;

export class SuiReservationConflict extends Schema.TaggedErrorClass<SuiReservationConflict>(
  '@tmnl/effect-sui/SuiReservationConflict',
)('Sui/ReservationConflict', {
  kind: SuiReservationConflictKind,
  resourceKey: Schema.String,
  intent: Schema.String,
  heldBy: Schema.optional(Schema.String),
  requestedBy: Schema.optional(Schema.String),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiInvariantViolation extends Schema.TaggedErrorClass<SuiInvariantViolation>(
  '@tmnl/effect-sui/SuiInvariantViolation',
)('Sui/InvariantViolation', {
  invariant: Schema.String,
  message: Schema.String,
  context: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
}) {}

export type SuiError =
  | SuiSchemaDecodeError
  | SuiObjectLoadError
  | SuiTransportError
  | SuiExecutionError
  | SuiReservationConflict
  | SuiInvariantViolation;
