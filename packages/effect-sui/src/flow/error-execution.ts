import {
  decodeSuiObjectId,
  SuiDryRunError,
  SuiExecutionError,
  type SuiExecutionErrorKind,
  SuiMoveAbortError,
  SuiRejectedByValidatorError,
  type SuiObjectId,
} from '../schema';
import { asRecord, messageOf } from './error-shared';

type UnknownRecord = Record<PropertyKey, unknown>;

type SdkExecutionError = {
  readonly message?: unknown;
  readonly command?: unknown;
  readonly $kind?: unknown;
  readonly MoveAbort?: unknown;
};

const executionKinds = new Set<string>([
  'MoveAbort',
  'SizeError',
  'CommandArgumentError',
  'TypeArgumentError',
  'PackageUpgradeError',
  'IndexError',
  'CoinDenyListError',
  'CongestedObjects',
  'ObjectIdError',
  'Unknown',
]);

export type SuiExecutionFailure = SuiExecutionError | SuiMoveAbortError | SuiRejectedByValidatorError;

export function execution(command: string, cause: unknown): SuiExecutionFailure {
  if (
    cause instanceof SuiExecutionError ||
    cause instanceof SuiMoveAbortError ||
    cause instanceof SuiRejectedByValidatorError
  ) {
    return cause;
  }

  const sdkError = extractExecutionError(cause);
  if (sdkError) return sdkExecution(cause, sdkError);

  return new SuiExecutionError({ command, message: messageOf(cause), cause });
}

export function dryRun(command: string, cause: unknown): SuiDryRunError | SuiExecutionFailure {
  if (cause instanceof SuiDryRunError) return cause;
  const normalized = execution(command, cause);
  if (normalized instanceof SuiMoveAbortError || normalized instanceof SuiRejectedByValidatorError) return normalized;
  return new SuiDryRunError({ message: normalized.message, cause });
}

export function sdkExecution(cause: unknown, error: SdkExecutionError): SuiExecutionFailure {
  const kind = executionKind(error);
  const commandIndex = typeof error.command === 'number' ? error.command : undefined;
  const message = typeof error.message === 'string' ? error.message : messageOf(cause);

  if (kind === 'MoveAbort') {
    const abort = asRecord(error.MoveAbort);
    const location = asRecord(abort?.location);
    return new SuiMoveAbortError({
      abortCode: String(abort?.abortCode ?? 'unknown'),
      packageId: optionalObjectId(location?.package),
      module: typeof location?.module === 'string' ? location.module : undefined,
      functionName: typeof location?.functionName === 'string' ? location.functionName : undefined,
      command: commandIndex,
      message,
      cause,
    });
  }

  return new SuiRejectedByValidatorError({ kind, command: commandIndex, message, cause });
}

export function extractExecutionError(cause: unknown): SdkExecutionError | undefined {
  const record = asRecord(cause);
  const direct = hasExecutionShape(record) ? record : undefined;
  const nested = asRecord(record?.executionError);
  return hasExecutionShape(nested) ? nested : direct;
}

function hasExecutionShape(value: UnknownRecord | undefined): value is SdkExecutionError & UnknownRecord {
  if (!value) return false;
  if (typeof value.message !== 'string') return false;
  return typeof value.$kind === 'string' || executionKindsArray().some((kind) => value[kind] !== undefined);
}

function executionKind(error: SdkExecutionError): SuiExecutionErrorKind {
  if (typeof error.$kind === 'string' && executionKinds.has(error.$kind)) return error.$kind as SuiExecutionErrorKind;
  const discovered = executionKindsArray().find((kind) => (error as UnknownRecord)[kind] !== undefined);
  return (discovered ?? 'Unknown') as SuiExecutionErrorKind;
}

function executionKindsArray(): ReadonlyArray<string> {
  return [...executionKinds];
}

function optionalObjectId(value: unknown): SuiObjectId | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    return decodeSuiObjectId(value);
  } catch {
    return undefined;
  }
}
