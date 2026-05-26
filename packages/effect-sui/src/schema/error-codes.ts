import * as Schema from 'effect-v4/Schema';

export const SuiObjectErrorCode = Schema.Literals([
  'notExists',
  'dynamicFieldNotFound',
  'deleted',
  'displayError',
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
