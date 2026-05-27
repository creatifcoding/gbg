import * as Schema from 'effect-v4/Schema';

export const SuiDiagnosticCategory = Schema.Literals([
  'schema',
  'object',
  'transport',
  'bcs',
  'ptb',
  'gas',
  'payment',
  'auth',
  'preflight',
  'moveAbort',
  'execution',
  'reservation',
  'finality',
  'package',
  'invariant',
  'defect',
  'interrupt',
  'unknown',
] as const);
export type SuiDiagnosticCategory = typeof SuiDiagnosticCategory.Type;

export const SuiDiagnosticSeverity = Schema.Literals(['debug', 'info', 'warn', 'error', 'fatal'] as const);
export type SuiDiagnosticSeverity = typeof SuiDiagnosticSeverity.Type;

export const SuiRetryHint = Schema.Literals([
  'never',
  'retry',
  'waitAndRetry',
  'refreshObjects',
  'increaseGas',
  'reauthorize',
  'checkNetwork',
  'notApplicable',
] as const);
export type SuiRetryHint = typeof SuiRetryHint.Type;

export const SuiDiagnosticReasonKind = Schema.Literals(['fail', 'die', 'interrupt', 'unknown'] as const);
export type SuiDiagnosticReasonKind = typeof SuiDiagnosticReasonKind.Type;

export const SuiDiagnosticAttributes = Schema.Record(Schema.String, Schema.Unknown);
export type SuiDiagnosticAttributes = typeof SuiDiagnosticAttributes.Type;

export class SuiDiagnostic extends Schema.TaggedClass<SuiDiagnostic>()('SuiDiagnostic', {
  category: SuiDiagnosticCategory,
  severity: SuiDiagnosticSeverity,
  retryHint: SuiRetryHint,
  message: Schema.String,
  source: Schema.optional(Schema.String),
  sourceTag: Schema.optional(Schema.String),
  reasonKinds: Schema.Array(SuiDiagnosticReasonKind),
  attributes: Schema.optional(SuiDiagnosticAttributes),
}) {}

export class SuiDiagnosticEvent extends Schema.TaggedClass<SuiDiagnosticEvent>()('SuiDiagnosticEvent', {
  name: Schema.String,
  diagnostic: SuiDiagnostic,
  stage: Schema.optional(Schema.String),
  attributes: Schema.optional(SuiDiagnosticAttributes),
}) {}
