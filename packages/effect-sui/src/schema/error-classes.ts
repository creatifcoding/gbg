export * from './error-codec-classes';
export * from './error-core-classes';
export * from './error-flow-classes';
export * from './error-package-classes';
export * from './error-ptb-classes';

import type { SuiBcsParseError, SuiPureEncodeError } from './error-codec-classes';
import type {
  SuiExecutionError,
  SuiInvariantViolation,
  SuiObjectLoadError,
  SuiObjectStaleError,
  SuiReservationConflict,
  SuiSchemaDecodeError,
  SuiTransportError,
} from './error-core-classes';
import type {
  SuiAuthError,
  SuiDryRunError,
  SuiGasCoinConflictError,
  SuiGasPlanningError,
  SuiIndexerVisibilityError,
  SuiInsufficientGasError,
  SuiMoveAbortError,
  SuiPaymentError,
  SuiRejectedByValidatorError,
  SuiSignatureError,
  SuiSponsorRejectedError,
  SuiWaitError,
  SuiWalletRejectedError,
} from './error-flow-classes';
import type { SuiModuleNotFoundError, SuiPackageError, SuiTypeNotRegisteredError } from './error-package-classes';
import type {
  SuiArgumentInvalidError,
  SuiBuildError,
  SuiProtocolLimitExceededError,
  SuiPtbCompileError,
  SuiPtbInvalidError,
} from './error-ptb-classes';

export type SuiError =
  | SuiSchemaDecodeError
  | SuiObjectLoadError
  | SuiObjectStaleError
  | SuiTransportError
  | SuiExecutionError
  | SuiReservationConflict
  | SuiInvariantViolation
  | SuiBcsParseError
  | SuiPureEncodeError
  | SuiPtbInvalidError
  | SuiArgumentInvalidError
  | SuiProtocolLimitExceededError
  | SuiPtbCompileError
  | SuiBuildError
  | SuiGasPlanningError
  | SuiDryRunError
  | SuiMoveAbortError
  | SuiPaymentError
  | SuiGasCoinConflictError
  | SuiInsufficientGasError
  | SuiSponsorRejectedError
  | SuiAuthError
  | SuiSignatureError
  | SuiWalletRejectedError
  | SuiRejectedByValidatorError
  | SuiWaitError
  | SuiIndexerVisibilityError
  | SuiPackageError
  | SuiModuleNotFoundError
  | SuiTypeNotRegisteredError;
