/**
 * Splash Screen Module
 *
 * Lock Screen + Authentication + Idle Detection + 3D ASCII Effects.
 *
 * Old splash components (CRTEffect, LogoReveal, TerminalInit, Splash)
 * deleted — see SPLASH_V2.md for the replacement architecture.
 */

// Aberration (3D ASCII effect)
export { AsciiEffect, AsciiScene } from "./aberration"
export type { AsciiEffectProps } from "./aberration"

// Lock screen controller
export { LockScreenController } from "./lock"

// Services
export {
  AuthenticationService,
  AuthenticatorTag,
  PasswordAuthenticator,
  BiometricAuthenticator,
  FacialAuthenticator,
  GestureAuthenticator,
  IdleDetectionService,
  IdleConfigTag,
  idleStateAtom,
  lastActivityAtom,
  remainingTimeAtom,
  forceLockAtom,
  useIdleDetection,
} from "./services"

// Schemas
export {
  // Credentials
  Email,
  Password,
  PinCode,
  AuthType,
  PasswordCredentials,
  PinCredentials,
  BiometricCredentials,
  FacialCredentials,
  GestureCredentials,
  Credentials,
  LoginFormState,
  initialLoginFormState,
  // Auth results
  User,
  Session,
  AuthFailureReason,
  AuthSuccess,
  AuthFailure,
  AuthMfaChallenge,
  AuthResult,
  isAuthSuccess,
  isAuthFailure,
  isAuthMfaChallenge,
} from "./schemas"
