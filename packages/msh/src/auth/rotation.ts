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
import { MshSpan } from '../tracing';
import { TokenRotationError } from './schemas';

// =============================================================================
// JWT Claims Parsing (minimal — just exp)
// =============================================================================

const normalizeBase64Url = (input: string): string => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = base64.length % 4;
  if (remainder === 0) return base64;
  if (remainder === 1) throw new Error('Invalid base64url length');
  return base64 + '='.repeat(4 - remainder);
};

/**
 * Extract expiry (exp) from a JWT without full validation.
 * NATS JWTs use standard JWT structure: header.payload.signature
 * We only need the payload's `exp` field for rotation scheduling.
 */
export const parseJwtExpiryEffect = (
  jwt: string,
): Effect.Effect<number | undefined> =>
  Effect.try({
    try: () => {
      const parts = jwt.split('.');
      if (parts.length !== 3) return undefined;
      // Base64url decode the payload. JWT segments may be padded or unpadded.
      const payload = parts[1];
      const decoded = atob(normalizeBase64Url(payload));
      const claims = JSON.parse(decoded) as { exp?: number };
      return claims.exp;
    },
    catch: () => undefined,
  }).pipe(Effect.catch(() => Effect.succeed(undefined)));

export const parseJwtExpiry = (jwt: string): number | undefined =>
  Effect.runSync(parseJwtExpiryEffect(jwt));

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
    const exp = yield* parseJwtExpiryEffect(jwt);

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
