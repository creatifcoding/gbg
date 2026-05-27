/** Typed PTB error constructors and phase normalization. */

import {
  SuiArgumentInvalidError,
  SuiBuildError,
  SuiProtocolLimitExceededError,
  SuiPtbCompileError,
  SuiPtbInvalidError,
  type SuiPtbErrorPhase,
} from '../schema';

export type SuiPtbError =
  | SuiPtbInvalidError
  | SuiArgumentInvalidError
  | SuiProtocolLimitExceededError
  | SuiPtbCompileError
  | SuiBuildError;

export function ptbInvariant(phase: 'analyze' | 'compile', message: string, cause?: unknown): SuiPtbError {
  const location = parseLocation(message);
  return phase === 'compile'
    ? new SuiPtbCompileError({ phase, message, commandIndex: location.commandIndex, cause })
    : new SuiPtbInvalidError({
        phase,
        message,
        commandIndex: location.commandIndex,
        argumentIndex: location.argumentIndex,
        cause,
      });
}

export function normalizePtbError(label: string, cause: unknown): SuiPtbError {
  if (
    cause instanceof SuiPtbInvalidError ||
    cause instanceof SuiArgumentInvalidError ||
    cause instanceof SuiProtocolLimitExceededError ||
    cause instanceof SuiPtbCompileError ||
    cause instanceof SuiBuildError
  ) {
    return cause;
  }

  const phase = phaseFromLabel(label);
  const message = messageOf(cause);
  const location = parseLocation(label);
  if (phase === 'compile') {
    return new SuiPtbCompileError({ phase, message, commandIndex: location.commandIndex, cause });
  }
  if (phase === 'build') {
    return new SuiBuildError({ builder: label, message, cause });
  }
  return new SuiPtbInvalidError({
    phase,
    message,
    commandIndex: location.commandIndex,
    argumentIndex: location.argumentIndex,
    cause,
  });
}

function phaseFromLabel(label: string): SuiPtbErrorPhase {
  if (label.startsWith('compile.')) return 'compile';
  if (label.startsWith('build.')) return 'build';
  if (label.startsWith('analyze.')) return 'analyze';
  return 'decode';
}

function parseLocation(value: string): { readonly commandIndex?: number; readonly argumentIndex?: number } {
  const commandIndex = parseNumber(value.match(/command\D+(\d+)/i)?.[1]);
  const argumentIndex = parseNumber(value.match(/arg(?:ument)?\D+(\d+)/i)?.[1]);
  return { commandIndex, argumentIndex };
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function messageOf(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause !== null && typeof cause === 'object') {
    const message = (cause as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(cause);
}
