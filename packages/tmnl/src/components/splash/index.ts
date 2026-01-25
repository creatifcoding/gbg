/**
 * Splash Screen Module
 *
 * Q-Branch Brutalist boot sequence:
 * - CRT effects (static, scanlines, moiré, flicker)
 * - Terminal init log (staccato rhythm)
 * - TMNL logo reveal (letter→word expansion)
 * - Morph/dissolve transition
 *
 * Selfcharters Lock Screen:
 * - ASCII aberration 3D scene (Three.js + postprocessing)
 * - Idle detection with configurable timeout
 * - Multi-strategy authentication (password, biometric, facial, gesture)
 * - MediaPipe hand gesture control (pending)
 */

// Original splash components
export { Splash, default } from './Splash'
export { CRTEffect } from './CRTEffect'
export { TerminalInit } from './TerminalInit'
export { LogoReveal } from './LogoReveal'

// Tokens for customization
export * from './tokens'

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
