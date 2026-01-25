export {
  AuthenticationService,
  AuthenticatorTag,
  PasswordAuthenticator,
  BiometricAuthenticator,
  FacialAuthenticator,
  GestureAuthenticator,
  AuthenticationError,
  ValidationError,
  StrategyNotFoundError,
} from "./AuthenticationService"
export type { Authenticator, AuthenticationServiceShape } from "./AuthenticationService"

export {
  IdleDetectionService,
  IdleConfigTag,
  idleStateAtom,
  lastActivityAtom,
  remainingTimeAtom,
  forceLockAtom,
  useIdleDetection,
} from "./IdleDetectionService"
export type { IdleConfig, IdleDetectionServiceShape } from "./IdleDetectionService"
