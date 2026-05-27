import {
  SuiAuthError,
  type SuiAuthMode,
  SuiDryRunError,
  SuiGasCoinConflictError,
  SuiGasPlanningError,
  SuiInsufficientGasError,
  SuiInvariantViolation,
  type SuiObjectId,
  SuiPaymentError,
  type SuiPaymentMode,
  SuiSignatureError,
  SuiSponsorRejectedError,
  SuiTransportError,
  SuiWalletRejectedError,
} from '../schema';
import { messageOf } from './error-shared';
import type { SuiExecutionFailure } from './error-execution';
import type { SuiFinalityFailure } from './error-finality';

export type SuiPolicyFailure =
  | SuiGasPlanningError
  | SuiPaymentError
  | SuiGasCoinConflictError
  | SuiInsufficientGasError
  | SuiSponsorRejectedError
  | SuiAuthError
  | SuiSignatureError
  | SuiWalletRejectedError
  | SuiTransportError;

export type SuiFlowError = SuiInvariantViolation | SuiExecutionFailure | SuiDryRunError | SuiPolicyFailure | SuiFinalityFailure;

export function invariant(invariantName: string, cause: unknown): SuiInvariantViolation {
  if (cause instanceof SuiInvariantViolation) return cause;
  return new SuiInvariantViolation({ invariant: invariantName, message: messageOf(cause), cause });
}

export function gasPlanning(policy: string | undefined, cause: unknown): SuiGasPlanningError {
  if (cause instanceof SuiGasPlanningError) return cause;
  return new SuiGasPlanningError({ policy, message: messageOf(cause), cause });
}

export function payment(mode: SuiPaymentMode, cause: unknown): SuiPaymentError {
  if (cause instanceof SuiPaymentError) return cause;
  return new SuiPaymentError({ mode, message: messageOf(cause), cause });
}

export function gasCoinConflict(cause: unknown, objectId?: SuiObjectId, resourceKey?: string): SuiGasCoinConflictError {
  if (cause instanceof SuiGasCoinConflictError) return cause;
  return new SuiGasCoinConflictError({ objectId, resourceKey, message: messageOf(cause), cause });
}

export function insufficientGas(cause: unknown): SuiInsufficientGasError {
  if (cause instanceof SuiInsufficientGasError) return cause;
  return new SuiInsufficientGasError({ message: messageOf(cause), cause });
}

export function sponsorRejected(cause: unknown): SuiSponsorRejectedError {
  if (cause instanceof SuiSponsorRejectedError) return cause;
  return new SuiSponsorRejectedError({ message: messageOf(cause), cause });
}

export function auth(mode: SuiAuthMode, cause: unknown): SuiAuthError {
  if (cause instanceof SuiAuthError) return cause;
  return new SuiAuthError({ mode, message: messageOf(cause), cause });
}

export function signature(mode: SuiAuthMode, cause: unknown): SuiSignatureError {
  if (cause instanceof SuiSignatureError) return cause;
  return new SuiSignatureError({ mode, message: messageOf(cause), cause });
}

export function walletRejected(cause: unknown, wallet?: string): SuiWalletRejectedError {
  if (cause instanceof SuiWalletRejectedError) return cause;
  return new SuiWalletRejectedError({ wallet, message: messageOf(cause), cause });
}
