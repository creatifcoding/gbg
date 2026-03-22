/**
 * HolonetAuthService Tests
 *
 * Tests JWT validation, permission checking, and auth flows.
 *
 * @module holonet/core/auth/__tests__/HolonetAuthService
 */

import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import {
  HolonetAuthService,
  createTestToken,
} from '../HolonetAuthService';
import { PermissionDeniedError, createAdminClaims, createReadOnlyClaims } from '../permissions';
import type { HolonetClaims } from '../schemas';

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_SECRET = 'test-secret-for-auth-tests';

// Create auth service layer with test secret
const TestAuthLayer = HolonetAuthService.withSecret(TEST_SECRET);

// Create auth service layer with no verification (for testing anonymous)
const AnonymousAuthLayer = HolonetAuthService.Default;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Helper to run Effect with test layer
 */
const runWithAuth = <A, E>(effect: Effect.Effect<A, E, HolonetAuthService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestAuthLayer)));

/**
 * Helper to create a valid test token
 */
const createValidToken = (claims: Partial<HolonetClaims> = {}) =>
  Effect.runPromise(
    createTestToken(
      {
        sub: 'test-user',
        permissions: ['stream:admin'],
        scopes: ['stream:*'],
        ...claims,
      },
      TEST_SECRET
    )
  );

/**
 * Helper to create an expired token
 */
const createExpiredToken = () =>
  Effect.runPromise(
    createTestToken(
      {
        sub: 'test-user',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      },
      TEST_SECRET
    )
  );

// =============================================================================
// Token Extraction Tests
// =============================================================================

describe('HolonetAuthService - Token Extraction', () => {
  it('extracts token from valid Bearer header', () =>
    runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const token = yield* auth.extractToken('Bearer my-token-123');
        expect(token).toBe('my-token-123');
      })
    ));

  it('fails on missing Authorization header (when required)', () =>
    runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const result = yield* Effect.either(auth.extractToken(undefined));
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MissingAuthHeaderError');
        }
      })
    ));

  it('fails on malformed Authorization header', () =>
    runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const result = yield* Effect.either(auth.extractToken('Basic user:pass'));
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MissingAuthHeaderError');
          expect(result.left.message).toContain('Expected: Bearer');
        }
      })
    ));

  it('allows missing header when not required', () =>
    Effect.gen(function* () {
      const auth = yield* HolonetAuthService;
      const token = yield* auth.extractToken(undefined);
      expect(token).toBe('');
    }).pipe(Effect.provide(AnonymousAuthLayer), Effect.runPromise));
});

// =============================================================================
// Token Validation Tests
// =============================================================================

describe('HolonetAuthService - Token Validation', () => {
  it('validates a correctly signed token', async () => {
    const token = await createValidToken({
      sub: 'user-123',
      email: 'test@example.com',
    });

    await runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const claims = yield* auth.validateToken(token);
        expect(claims.sub).toBe('user-123');
        expect(claims.email).toBe('test@example.com');
      })
    );
  });

  it('fails on expired token', async () => {
    const token = await createExpiredToken();

    await runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const result = yield* Effect.either(auth.validateToken(token));
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('JwtExpiredError');
        }
      })
    );
  });

  it('fails on invalid signature', async () => {
    // Create token with different secret
    const token = await Effect.runPromise(
      createTestToken({ sub: 'hacker' }, 'wrong-secret')
    );

    await runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const result = yield* Effect.either(auth.validateToken(token));
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('JwtValidationError');
        }
      })
    );
  });

  it('returns empty claims for empty token (anonymous)', () =>
    Effect.gen(function* () {
      const auth = yield* HolonetAuthService;
      const claims = yield* auth.validateToken('');
      expect(claims.sub).toBeUndefined();
    }).pipe(Effect.provide(AnonymousAuthLayer), Effect.runPromise));
});

// =============================================================================
// Authentication Flow Tests
// =============================================================================

describe('HolonetAuthService - Authentication Flow', () => {
  it('returns AuthSuccess for valid token', async () => {
    const token = await createValidToken({ sub: 'user-123' });

    await runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const result = yield* auth.authenticate(`Bearer ${token}`);
        expect(result._tag).toBe('AuthSuccess');
        if (result._tag === 'AuthSuccess') {
          expect(result.claims.sub).toBe('user-123');
          expect(result.token).toBe(token);
        }
      })
    );
  });

  it('returns AuthFailure for expired token', async () => {
    const token = await createExpiredToken();

    await runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const result = yield* auth.authenticate(`Bearer ${token}`);
        expect(result._tag).toBe('AuthFailure');
        if (result._tag === 'AuthFailure') {
          expect(result.reason).toContain('expired');
        }
      })
    );
  });

  it('returns Anonymous when auth not required and no header', () =>
    Effect.gen(function* () {
      const auth = yield* HolonetAuthService;
      const result = yield* auth.authenticate(undefined);
      expect(result._tag).toBe('Anonymous');
    }).pipe(Effect.provide(AnonymousAuthLayer), Effect.runPromise));
});

// =============================================================================
// Authorization Tests
// =============================================================================

describe('HolonetAuthService - Authorization', () => {
  it('authorizes admin for any operation', async () => {
    const token = await createValidToken({
      sub: 'admin',
      permissions: ['stream:admin'],
      scopes: ['stream:*'],
    });

    await runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const claims = yield* auth.authorizeOperation(
          `Bearer ${token}`,
          'delete',
          'any-stream'
        );
        expect(claims.sub).toBe('admin');
      })
    );
  });

  it('allows read for read-only user', async () => {
    const token = await createValidToken({
      sub: 'reader',
      permissions: ['stream:read'],
      scopes: ['stream:sensor-*'],
    });

    await runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const claims = yield* auth.authorizeOperation(
          `Bearer ${token}`,
          'read',
          'sensor-001'
        );
        expect(claims.sub).toBe('reader');
      })
    );
  });

  it('denies write for read-only user', async () => {
    const token = await createValidToken({
      sub: 'reader',
      permissions: ['stream:read'],
      scopes: ['stream:*'],
    });

    await runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const result = yield* Effect.either(
          auth.authorizeOperation(`Bearer ${token}`, 'append', 'some-stream')
        );
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('PermissionDeniedError');
        }
      })
    );
  });

  it('denies access outside scope', async () => {
    const token = await createValidToken({
      sub: 'scoped-user',
      permissions: ['stream:write'],
      scopes: ['stream:sensor-*'],
    });

    await runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const result = yield* Effect.either(
          auth.authorizeOperation(`Bearer ${token}`, 'read', 'other-stream')
        );
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('PermissionDeniedError');
          expect((result.left as PermissionDeniedError).reason).toContain('scope');
        }
      })
    );
  });
});

// =============================================================================
// Permission Model Tests
// =============================================================================

describe('Permission Model', () => {
  it('admin claims have full access', () =>
    runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const claims = createAdminClaims('admin-user');

        // Should succeed for all operations
        yield* auth.checkPermission(claims, 'create', 'any-stream');
        yield* auth.checkPermission(claims, 'read', 'any-stream');
        yield* auth.checkPermission(claims, 'append', 'any-stream');
        yield* auth.checkPermission(claims, 'delete', 'any-stream');
      })
    ));

  it('read-only claims deny write', () =>
    runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const claims = createReadOnlyClaims('reader', ['stream:*']);

        // Read should succeed
        yield* auth.checkPermission(claims, 'read', 'any-stream');

        // Write should fail
        const result = yield* Effect.either(
          auth.checkPermission(claims, 'append', 'any-stream')
        );
        expect(result._tag).toBe('Left');
      })
    ));

  it('scope patterns match correctly', () =>
    runWithAuth(
      Effect.gen(function* () {
        const auth = yield* HolonetAuthService;
        const claims = createReadOnlyClaims('scoped', ['stream:sensor-*', 'stream:exact-match']);

        // Wildcard match
        yield* auth.checkPermission(claims, 'read', 'sensor-001');
        yield* auth.checkPermission(claims, 'read', 'sensor-abc');

        // Exact match
        yield* auth.checkPermission(claims, 'read', 'exact-match');

        // No match
        const result = yield* Effect.either(
          auth.checkPermission(claims, 'read', 'other-stream')
        );
        expect(result._tag).toBe('Left');
      })
    ));
});
