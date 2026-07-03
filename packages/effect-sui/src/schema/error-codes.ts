import * as Schema from 'effect/Schema';

export const SuiObjectErrorCode = Schema.Literals([
  'notExists',
  'dynamicFieldNotFound',
  'deleted',
  'displayError',
  'stale',
  'unknown',
] as const);
export type SuiObjectErrorCode = typeof SuiObjectErrorCode.Type;

export const SuiReservationConflictKind = Schema.Literals([
  'object',
  'gas',
  'sender',
  'sponsor',
  'duplicate',
  'unknown',
] as const);
export type SuiReservationConflictKind = typeof SuiReservationConflictKind.Type;

export const SuiPtbErrorPhase = Schema.Literals(['decode', 'analyze', 'compile', 'build'] as const);
export type SuiPtbErrorPhase = typeof SuiPtbErrorPhase.Type;

export const SuiExecutionErrorKind = Schema.Literals([
  'MoveAbort',
  'SizeError',
  'CommandArgumentError',
  'TypeArgumentError',
  'PackageUpgradeError',
  'IndexError',
  'CoinDenyListError',
  'CongestedObjects',
  'ObjectIdError',
  'RejectedByValidator',
  'Unknown',
] as const);
export type SuiExecutionErrorKind = typeof SuiExecutionErrorKind.Type;

export const SuiPaymentMode = Schema.Literals(['auto', 'explicit', 'sponsored', 'addressBalance', 'unknown'] as const);
export type SuiPaymentMode = typeof SuiPaymentMode.Type;

export const SuiAuthMode = Schema.Literals(['keypair', 'offline', 'sponsored', 'wallet', 'multisig', 'unknown'] as const);
export type SuiAuthMode = typeof SuiAuthMode.Type;

export const SuiWaitErrorKind = Schema.Literals(['timeout', 'aborted', 'notVisible', 'transport', 'unknown'] as const);
export type SuiWaitErrorKind = typeof SuiWaitErrorKind.Type;

export const SuiPackageErrorKind = Schema.Literals(['package', 'moduleNotFound', 'typeNotRegistered', 'publish', 'upgrade', 'unknown'] as const);
export type SuiPackageErrorKind = typeof SuiPackageErrorKind.Type;
