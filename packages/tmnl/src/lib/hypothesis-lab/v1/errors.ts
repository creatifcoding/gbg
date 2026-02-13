import { Schema } from 'effect';

export class HookResolutionError extends Schema.TaggedError<HookResolutionError>()(
  'HookResolutionError',
  {
    hookKey: Schema.String,
    message: Schema.String,
  }
) {}

export class HookExecutionError extends Schema.TaggedError<HookExecutionError>()(
  'HookExecutionError',
  {
    hookKey: Schema.String,
    stage: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  }
) {}

export class HookContractDecodeError extends Schema.TaggedError<HookContractDecodeError>()(
  'HookContractDecodeError',
  {
    hookKey: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  }
) {}

export class MissingRunStateError extends Schema.TaggedError<MissingRunStateError>()(
  'MissingRunStateError',
  {
    message: Schema.String,
  }
) {}

export class MissingPlanError extends Schema.TaggedError<MissingPlanError>()(
  'MissingPlanError',
  {
    message: Schema.String,
  }
) {}

export class MissingVerdictError extends Schema.TaggedError<MissingVerdictError>()(
  'MissingVerdictError',
  {
    message: Schema.String,
  }
) {}

export class MatrixComputationError extends Schema.TaggedError<MatrixComputationError>()(
  'MatrixComputationError',
  {
    runId: Schema.String,
    message: Schema.String,
  }
) {}

export class LedgerPersistenceError extends Schema.TaggedError<LedgerPersistenceError>()(
  'LedgerPersistenceError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  }
) {}

export class ReplayEvaluationError extends Schema.TaggedError<ReplayEvaluationError>()(
  'ReplayEvaluationError',
  {
    runId: Schema.String,
    message: Schema.String,
  }
) {}

export const HypothesisLabError = Schema.Union(
  HookResolutionError,
  HookExecutionError,
  HookContractDecodeError,
  MissingRunStateError,
  MissingPlanError,
  MissingVerdictError,
  MatrixComputationError,
  LedgerPersistenceError,
  ReplayEvaluationError
);

export type HypothesisLabError = typeof HypothesisLabError.Type;
