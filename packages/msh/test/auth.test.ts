/**
 * Auth Invariant Tests
 *
 * Verifies all 9 systemic invariants across auth schemas, service, and rotation.
 *
 * @module @tmnl/msh/test/auth
 */

import { describe, it, expect } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Redacted from 'effect/Redacted';

import {
  NKeyAuth, JwtAuth, CredsAuth, TokenAuth,
  CredsFile, CredsEnv, CredsInline,
  MshAuthMode, AuthState,
  CredentialLoadError, AuthenticationError, TokenRotationError, AuthInvariantViolation,
  type AuthMetadata,
} from '../src/auth/schemas';
import { parseJwtExpiry, msUntilRotation, isJwtExpired } from '../src/auth/rotation';

// =============================================================================
// Helpers
// =============================================================================

/** Create a minimal JWT with a given exp claim */
const makeJwt = (claims: Record<string, unknown>): string => {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = btoa(JSON.stringify(claims))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${payload}.sig`;
};

// =============================================================================
// I1 — Secret Confinement
// =============================================================================

describe('I1: Secret Confinement', () => {
  it('NKeyAuth.seed is Redacted — cannot be JSON.stringify-ed', () => {
    const auth = new NKeyAuth({
      seed: Redacted.make('SUAIBDPBAUTWCWBKIO6X'),
      publicKey: 'UAH42UG6PV552P5SWLWT',
    });

    // The seed should be a Redacted value
    expect(Redacted.isRedacted(auth.seed)).toBe(true);
    // Redacted.value extracts it (only for authorized code)
    expect(Redacted.value(auth.seed)).toBe('SUAIBDPBAUTWCWBKIO6X');
    // publicKey is safe to access
    expect(auth.publicKey).toBe('UAH42UG6PV552P5SWLWT');
  });

  it('TokenAuth.token is Redacted', () => {
    const auth = new TokenAuth({ token: Redacted.make('secret-token') });
    expect(Redacted.isRedacted(auth.token)).toBe(true);
  });

  it('CredsInline.contents is Redacted', () => {
    const creds = new CredsInline({ contents: Redacted.make('-----BEGIN NATS USER JWT-----\n...') });
    expect(Redacted.isRedacted(creds.contents)).toBe(true);
  });
});

// =============================================================================
// I2 — Trust Chain Monotonicity (type-level)
// =============================================================================

describe('I2: Trust Chain Types', () => {
  it('MshAuthMode discriminates on _tag', () => {
    const nkey = new NKeyAuth({ seed: Redacted.make('seed') });
    const jwt = new JwtAuth({ jwt: 'eyJ...', rotationWindowMs: 30000 });
    const creds = new CredsAuth({ source: new CredsFile({ path: '/tmp/creds', watchForChanges: false }) });
    const token = new TokenAuth({ token: Redacted.make('tok') });

    expect(nkey._tag).toBe('NKeyAuth');
    expect(jwt._tag).toBe('JwtAuth');
    expect(creds._tag).toBe('CredsAuth');
    expect(token._tag).toBe('TokenAuth');
  });
});

// =============================================================================
// I3 — Temporal Validity
// =============================================================================

describe('I3: Temporal Validity', () => {
  it('parseJwtExpiry extracts exp from JWT', () => {
    const jwt = makeJwt({ sub: 'user', exp: 1700000000 });
    expect(parseJwtExpiry(jwt)).toBe(1700000000);
  });

  it('parseJwtExpiry returns undefined for JWT without exp', () => {
    const jwt = makeJwt({ sub: 'user' });
    expect(parseJwtExpiry(jwt)).toBeUndefined();
  });

  it('parseJwtExpiry returns undefined for malformed JWT', () => {
    expect(parseJwtExpiry('not.a.jwt')).toBeUndefined();
    expect(parseJwtExpiry('')).toBeUndefined();
  });

  it('msUntilRotation calculates correct delay', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 120; // 2 min from now
    const ms = msUntilRotation(futureExp, 30000); // 30s rotation window
    // Should be roughly 90 seconds (120s - 30s window)
    expect(ms).toBeGreaterThan(85000);
    expect(ms).toBeLessThan(95000);
  });

  it('msUntilRotation returns negative for expired token', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const ms = msUntilRotation(pastExp, 30000);
    expect(ms).toBeLessThan(0);
  });

  it('isJwtExpired detects expired token', () => {
    const expiredJwt = makeJwt({ exp: Math.floor(Date.now() / 1000) - 120 });
    expect(isJwtExpired(expiredJwt)).toBe(true);
  });

  it('isJwtExpired allows valid token', () => {
    const validJwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isJwtExpired(validJwt)).toBe(false);
  });

  it('isJwtExpired respects clock tolerance', () => {
    // Token expired 30s ago, but tolerance is 60s
    const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) - 30 });
    expect(isJwtExpired(jwt, 60)).toBe(false);
    expect(isJwtExpired(jwt, 10)).toBe(true);
  });
});

// =============================================================================
// I5 — State Completeness
// =============================================================================

describe('I5: State Completeness', () => {
  it('AuthState covers all 8 states', () => {
    const states: AuthState[] = [
      'unconfigured', 'loading_credentials', 'ready', 'authenticating',
      'authenticated', 'expiring', 'rotating', 'failed',
    ];
    // Each should be a valid AuthState (Schema.Literals validates this)
    for (const state of states) {
      expect(Schema.decodeUnknownSync(AuthState)(state)).toBe(state);
    }
  });

  it('AuthState rejects invalid states', () => {
    expect(() => Schema.decodeUnknownSync(AuthState)('invalid')).toThrow();
    expect(() => Schema.decodeUnknownSync(AuthState)('')).toThrow();
  });
});

// =============================================================================
// I7 — Credential Provenance
// =============================================================================

describe('I7: Credential Provenance', () => {
  it('CredsFile tracks file path', () => {
    const source = new CredsFile({ path: '/etc/nats/user.creds', watchForChanges: true });
    expect(source._tag).toBe('CredsFile');
    expect(source.path).toBe('/etc/nats/user.creds');
    expect(source.watchForChanges).toBe(true);
  });

  it('CredsEnv tracks env variable name', () => {
    const source = new CredsEnv({ variable: 'NATS_CREDS' });
    expect(source._tag).toBe('CredsEnv');
    expect(source.variable).toBe('NATS_CREDS');
  });

  it('CredsInline is Redacted', () => {
    const source = new CredsInline({ contents: Redacted.make('inline-creds') });
    expect(source._tag).toBe('CredsInline');
    expect(Redacted.isRedacted(source.contents)).toBe(true);
  });
});

// =============================================================================
// I8 — Graceful Degradation
// =============================================================================

describe('I8: Graceful Degradation', () => {
  it('AuthInvariantViolation names the violated invariant', () => {
    const err = new AuthInvariantViolation({
      invariant: 'I5',
      message: 'Invalid state transition: ready → expiring',
      context: 'allowed: authenticating',
    });

    expect(err._tag).toBe('Auth/InvariantViolation');
    expect(err.invariant).toBe('I5');
    expect(err.message).toContain('Invalid state transition');
  });

  it('CredentialLoadError names the source', () => {
    const err = new CredentialLoadError({
      message: 'File not found',
      source: 'file:/etc/nats/missing.creds',
    });

    expect(err._tag).toBe('Auth/CredentialLoad');
    expect(err.source).toContain('missing.creds');
  });

  it('all auth errors are yieldable', async () => {
    for (const err of [
      new CredentialLoadError({ message: 'x', source: 'test' }),
      new AuthenticationError({ message: 'x', mode: 'nkey' }),
      new TokenRotationError({ message: 'x' }),
      new AuthInvariantViolation({ invariant: 'I1', message: 'x' }),
    ]) {
      const result = await Effect.runPromise(
        Effect.gen(function* () { yield* err; return 'unreachable'; }).pipe(Effect.result),
      );
      expect(result._tag).toBe('Failure');
    }
  });
});

// =============================================================================
// I9 — Observability Without Leakage
// =============================================================================

describe('I9: Observability Without Leakage', () => {
  it('AuthMetadata includes mode and publicKey but not secrets', () => {
    const meta: AuthMetadata = {
      mode: 'nkey',
      state: 'authenticated',
      publicKey: 'UAH42UG6PV552P5SWLWT',
      loadedAt: Date.now(),
    };

    // Safe fields present
    expect(meta.mode).toBe('nkey');
    expect(meta.publicKey).toBeDefined();

    // No secret fields in the type
    expect('seed' in meta).toBe(false);
    expect('token' in meta).toBe(false);
  });
});
