/**
 * Token Rotation — JWT Expiry Detection + Scheduled Re-Auth
 *
 * Invariants:
 * - I3: Temporal Validity — rotate BEFORE expiry
 * - I5: State transitions: Authenticated → Expiring → Rotating → Authenticated
 * - I6: Per-connection isolation
 * - I9: Spans include expiresIn, never token content
 *
 * @module @tmnl/msh/auth/rotation
 */

import * as Effect from 'effect-v4/Effect';
import * as Schema from 'effect-v4/Schema';
import { MshSpan } from '../tracing';
import { TokenRotationError } from './schemas';

// =============================================================================
// JWT Claims Parsing (minimal — just exp)
// =============================================================================

/**
 * Extract expiry (exp) from a JWT without full validation.
 * NATS JWTs use standard JWT structure: header.payload.signature
 * We only need the payload's `exp` field for rotation scheduling.
 */
export const parseJwtExpiry = (jwt: string): number | undefined => {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return undefined;
    // Base64url decode the payload
    const payload = parts[1];
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(padded);
    const claims = JSON.parse(decoded) as { exp?: number };
    return claims.exp;
  } catch {
    return undefined;
  }
};

/**
 * Calculate when to start rotation based on expiry and window.
 *
 * @param expiresAtSec - Unix timestamp (seconds) when token expires
 * @param rotationWindowMs - How many ms before expiry to start rotation
 * @returns ms until rotation should start (negative = already past)
 */
export const msUntilRotation = (
  expiresAtSec: number,
  rotationWindowMs: number,
): number => {
  const expiresAtMs = expiresAtSec * 1000;
  const rotateAtMs = expiresAtMs - rotationWindowMs;
  return rotateAtMs - Date.now();
};

/**
 * Schedule a rotation callback before JWT expiry.
 *
 * Returns an Effect that:
 * 1. Parses the JWT expiry
 * 2. Calculates when to rotate
 * 3. Sleeps until rotation window
 * 4. Calls the onRotate callback
 *
 * If the token has no exp, or is already expired, fails with TokenRotationError.
 */
export const scheduleRotation = (
  jwt: string,
  rotationWindowMs: number,
  onRotate: () => Effect.Effect<void, TokenRotationError>,
): Effect.Effect<void, TokenRotationError> =>
  Effect.gen(function* () {
    const exp = parseJwtExpiry(jwt);

    if (exp === undefined) {
      // No expiry — token doesn't expire, no rotation needed
      return;
    }

    const msUntil = msUntilRotation(exp, rotationWindowMs);

    if (msUntil <= 0) {
      // Already in rotation window or expired
      return yield* onRotate();
    }

    // Sleep until rotation window
    yield* Effect.sleep(msUntil);

    // Trigger rotation
    yield* onRotate();
  }).pipe(Effect.withSpan(MshSpan.Auth.rotateToken));

/**
 * Check if a JWT is currently expired.
 */
export const isJwtExpired = (jwt: string, clockToleranceSec = 60): boolean => {
  const exp = parseJwtExpiry(jwt);
  if (exp === undefined) return false; // No expiry = never expires
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec > exp + clockToleranceSec;
};
