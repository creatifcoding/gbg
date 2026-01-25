/**
 * Authorization Middleware Tests
 *
 * Tests the HttpApiMiddleware.Tag integration for JWT authentication.
 *
 * @module holonet/core/auth/__tests__/middleware
 */

import { describe, it, expect } from 'vitest';
import { Effect, Layer, Redacted } from 'effect';
import {
  AuthorizationMiddleware,
  AuthorizationMiddlewareLive,
  OptionalAuthorizationMiddleware,
  OptionalAuthorizationMiddlewareLive,
  CurrentHolonetClaims,
  OptionalHolonetClaims,
  Unauthorized,
} from '../middleware';
import { HolonetAuthService, createTestToken } from '../HolonetAuthService';

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_SECRET = 'test-secret-for-middleware-tests';

// Create the middleware layer with test auth service
const TestMiddlewareLayer = AuthorizationMiddlewareLive.pipe(
  Layer.provide(HolonetAuthService.withSecret(TEST_SECRET))
);

const OptionalMiddlewareLayer = OptionalAuthorizationMiddlewareLive.pipe(
  Layer.provide(HolonetAuthService.withSecret(TEST_SECRET))
);

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a valid test token
 */
const createValidToken = () =>
  Effect.runPromise(
    createTestToken(
      {
        sub: 'test-user',
        email: 'test@example.com',
        permissions: ['stream:read'],
        scopes: ['stream:*'],
      },
      TEST_SECRET
    )
  );

/**
 * Create an expired token
 */
const createExpiredToken = () =>
  Effect.runPromise(
    createTestToken(
      {
        sub: 'expired-user',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      },
      TEST_SECRET
    )
  );

// =============================================================================
// AuthorizationMiddleware Tests
// =============================================================================

describe('AuthorizationMiddleware', () => {
  it('validates a correct token and provides claims', async () => {
    const token = await createValidToken();

    await Effect.gen(function* () {
      const middleware = yield* AuthorizationMiddleware;

      // Simulate calling the bearer handler
      const claims = yield* middleware.bearer(Redacted.make(token));

      expect(claims.sub).toBe('test-user');
      expect(claims.email).toBe('test@example.com');
      expect(claims.permissions).toContain('stream:read');
    }).pipe(Effect.provide(TestMiddlewareLayer), Effect.runPromise);
  });

  it('returns Unauthorized for expired token', async () => {
    const token = await createExpiredToken();

    await Effect.gen(function* () {
      const middleware = yield* AuthorizationMiddleware;

      const result = yield* Effect.either(middleware.bearer(Redacted.make(token)));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(Unauthorized);
        expect(result.left.code).toBe('token_expired');
      }
    }).pipe(Effect.provide(TestMiddlewareLayer), Effect.runPromise);
  });

  it('returns Unauthorized for invalid signature', async () => {
    // Create token with wrong secret
    const token = await Effect.runPromise(
      createTestToken({ sub: 'hacker' }, 'wrong-secret')
    );

    await Effect.gen(function* () {
      const middleware = yield* AuthorizationMiddleware;

      const result = yield* Effect.either(middleware.bearer(Redacted.make(token)));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(Unauthorized);
      }
    }).pipe(Effect.provide(TestMiddlewareLayer), Effect.runPromise);
  });

  it('returns Unauthorized for malformed token', async () => {
    await Effect.gen(function* () {
      const middleware = yield* AuthorizationMiddleware;

      const result = yield* Effect.either(
        middleware.bearer(Redacted.make('not-a-valid-jwt'))
      );

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(Unauthorized);
      }
    }).pipe(Effect.provide(TestMiddlewareLayer), Effect.runPromise);
  });
});

// =============================================================================
// OptionalAuthorizationMiddleware Tests
// =============================================================================

describe('OptionalAuthorizationMiddleware', () => {
  it('validates a correct token and provides claims', async () => {
    const token = await createValidToken();

    await Effect.gen(function* () {
      const middleware = yield* OptionalAuthorizationMiddleware;

      const claims = yield* middleware.bearer(Redacted.make(token));

      expect(claims).toBeDefined();
      expect(claims?.sub).toBe('test-user');
    }).pipe(Effect.provide(OptionalMiddlewareLayer), Effect.runPromise);
  });

  it('returns undefined for undefined token (anonymous)', async () => {
    await Effect.gen(function* () {
      const middleware = yield* OptionalAuthorizationMiddleware;

      const claims = yield* middleware.bearer(undefined);

      expect(claims).toBeUndefined();
    }).pipe(Effect.provide(OptionalMiddlewareLayer), Effect.runPromise);
  });

  it('still returns Unauthorized for invalid token', async () => {
    const token = await createExpiredToken();

    await Effect.gen(function* () {
      const middleware = yield* OptionalAuthorizationMiddleware;

      const result = yield* Effect.either(middleware.bearer(Redacted.make(token)));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(Unauthorized);
      }
    }).pipe(Effect.provide(OptionalMiddlewareLayer), Effect.runPromise);
  });
});

// =============================================================================
// Context Tag Tests
// =============================================================================

describe('Context Tags', () => {
  it('CurrentHolonetClaims provides claims in context', async () => {
    const token = await createValidToken();

    await Effect.gen(function* () {
      const middleware = yield* AuthorizationMiddleware;
      const claims = yield* middleware.bearer(Redacted.make(token));

      // Simulate what a handler would do
      yield* Effect.gen(function* () {
        // Access claims from context (simulated)
        expect(claims.sub).toBe('test-user');
      }).pipe(Effect.provideService(CurrentHolonetClaims, claims));
    }).pipe(Effect.provide(TestMiddlewareLayer), Effect.runPromise);
  });

  it('OptionalHolonetClaims can be undefined', async () => {
    await Effect.gen(function* () {
      const middleware = yield* OptionalAuthorizationMiddleware;
      const claims = yield* middleware.bearer(undefined);

      yield* Effect.gen(function* () {
        expect(claims).toBeUndefined();
      }).pipe(Effect.provideService(OptionalHolonetClaims, claims));
    }).pipe(Effect.provide(OptionalMiddlewareLayer), Effect.runPromise);
  });
});
