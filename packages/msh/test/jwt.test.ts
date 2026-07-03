/**
 * JWT Construction Tests
 *
 * Verifies programmatic NATS JWT construction via MshJwtService.
 * No NATS server required — this only checks generated/decoded claims.
 *
 * @module @tmnl/msh/test/jwt
 */

import { describe, it, expect } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Redacted from 'effect/Redacted';

import {
  MshJwtService,
  MshJwtServiceLive,
  OperatorJwtRequest,
  AccountJwtRequest,
  UserJwtRequest,
  JwtConstructionError,
  MshNKeyPair,
  JwtAuth,
  CredsAuth,
  CredsInline,
  parseJwtExpiry,
} from '../src/auth';

// =============================================================================
// Key generation
// =============================================================================

describe('MshJwtService — NKey generation', () => {
  it('creates redacted operator/account/user key pairs', () =>
    Effect.gen(function* () {
      const jwt = yield* MshJwtService;

      const operator = yield* jwt.createOperatorKeyPair;
      const account = yield* jwt.createAccountKeyPair;
      const user = yield* jwt.createUserKeyPair;

      expect(operator.kind).toBe('operator');
      expect(operator.publicKey.startsWith('O')).toBe(true);
      expect(Redacted.isRedacted(operator.seed)).toBe(true);

      expect(account.kind).toBe('account');
      expect(account.publicKey.startsWith('A')).toBe(true);
      expect(Redacted.isRedacted(account.seed)).toBe(true);

      expect(user.kind).toBe('user');
      expect(user.publicKey.startsWith('U')).toBe(true);
      expect(Redacted.isRedacted(user.seed)).toBe(true);
    }).pipe(Effect.provide(MshJwtServiceLive), Effect.runPromise));

  it('restores key pairs from redacted seeds', () =>
    Effect.gen(function* () {
      const jwt = yield* MshJwtService;
      const user = yield* jwt.createUserKeyPair;
      const restored = yield* jwt.keyPairFromSeed('user', user.seed);

      expect(restored.kind).toBe('user');
      expect(restored.publicKey).toBe(user.publicKey);
      expect(Redacted.isRedacted(restored.seed)).toBe(true);
    }).pipe(Effect.provide(MshJwtServiceLive), Effect.runPromise));

  it('rejects seeds whose public key kind does not match the requested kind', () =>
    Effect.gen(function* () {
      const jwt = yield* MshJwtService;
      const user = yield* jwt.createUserKeyPair;

      const result = yield* jwt.keyPairFromSeed('operator', user.seed).pipe(Effect.result);

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        expect(result.failure).toBeInstanceOf(JwtConstructionError);
        expect(result.failure.message).toContain('Failed to restore operator nkey pair from seed');
      }
    }).pipe(Effect.provide(MshJwtServiceLive), Effect.runPromise));
});

// =============================================================================
// Trust chain construction
// =============================================================================

describe('MshJwtService — JWT trust chain', () => {
  it('creates operator → account → user JWTs with monotonic issuer chain', () =>
    Effect.gen(function* () {
      const jwt = yield* MshJwtService;

      const operator = yield* jwt.createOperatorKeyPair;
      const account = yield* jwt.createAccountKeyPair;
      const user = yield* jwt.createUserKeyPair;

      const operatorToken = yield* jwt.encodeOperator(new OperatorJwtRequest({
        name: 'TMNL Operator',
        operator,
        signingKeys: [operator.publicKey],
      }));

      const accountToken = yield* jwt.encodeAccount(new AccountJwtRequest({
        name: 'TMNL Account',
        account,
        signer: operator,
      }));

      const userToken = yield* jwt.encodeUser(new UserJwtRequest({
        name: 'TMNL User',
        user,
        issuer: account,
        permissions: {
          pub: { allow: ['tmnl.>'] },
          sub: { allow: ['tmnl.>'] },
        },
        validity: { _tag: 'JwtValidity', exp: Math.floor(Date.now() / 1000) + 3600 },
      }));

      const operatorClaims = yield* jwt.decode(operatorToken);
      const accountClaims = yield* jwt.decode(accountToken);
      const userClaims = yield* jwt.decode(userToken);

      expect(operatorClaims.sub).toBe(operator.publicKey);
      expect(operatorClaims.iss).toBe(operator.publicKey);
      expect(operatorClaims.nats.type).toBe('operator');

      expect(accountClaims.sub).toBe(account.publicKey);
      expect(accountClaims.iss).toBe(operator.publicKey);
      expect(accountClaims.nats.type).toBe('account');

      expect(userClaims.sub).toBe(user.publicKey);
      expect(userClaims.iss).toBe(account.publicKey);
      expect(userClaims.nats.type).toBe('user');
      expect(userClaims.nats.pub?.allow).toEqual(['tmnl.>']);
      expect(userClaims.nats.sub?.allow).toEqual(['tmnl.>']);
    }).pipe(Effect.provide(MshJwtServiceLive), Effect.runPromise));

  it('formats and parses .creds without leaking seed in structured fields', () =>
    Effect.gen(function* () {
      const jwt = yield* MshJwtService;
      const account = yield* jwt.createAccountKeyPair;
      const user = yield* jwt.createUserKeyPair;

      const userToken = yield* jwt.encodeUser(new UserJwtRequest({
        name: 'Creds User',
        user,
        issuer: account,
      }));

      const creds = yield* jwt.formatCreds(userToken, user);
      const parsed = yield* jwt.parseCreds(creds);

      expect(parsed.jwt).toBe(userToken);
      expect(parsed.accountId).toBe(account.publicKey);
      expect(parsed.userPublicKey).toBe(user.publicKey);
      expect(Redacted.isRedacted(parsed.seed)).toBe(true);
      expect(Redacted.value(parsed.seed)).toBe(Redacted.value(user.seed));
    }).pipe(Effect.provide(MshJwtServiceLive), Effect.runPromise));

  it('issues JwtAuth and CredsAuth modes consumable by MshAuthService', () =>
    Effect.gen(function* () {
      const jwt = yield* MshJwtService;
      const account = yield* jwt.createAccountKeyPair;
      const user = yield* jwt.createUserKeyPair;
      const request = new UserJwtRequest({ name: 'Issued User', user, issuer: account });

      const jwtAuth = yield* jwt.issueJwtAuth(request, 15_000);
      const credsAuth = yield* jwt.issueCredsAuth(request);

      expect(jwtAuth).toBeInstanceOf(JwtAuth);
      expect(jwtAuth.jwt.split('.')).toHaveLength(3);
      expect(jwtAuth.rotationWindowMs).toBe(15_000);
      expect(Redacted.value(jwtAuth.seed!)).toBe(Redacted.value(user.seed));

      expect(credsAuth).toBeInstanceOf(CredsAuth);
      expect(credsAuth.source).toBeInstanceOf(CredsInline);
      if (credsAuth.source instanceof CredsInline) {
        expect(Redacted.isRedacted(credsAuth.source.contents)).toBe(true);
        expect(Redacted.value(credsAuth.source.contents)).toContain('BEGIN NATS USER JWT');
      }
    }).pipe(Effect.provide(MshJwtServiceLive), Effect.runPromise));
});

// =============================================================================
// JWT expiry parsing
// =============================================================================

const encodeJwtSegment = (value: unknown, padding: 'padded' | 'unpadded'): string => {
  const encoded = btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return padding === 'padded' ? encoded : encoded.replace(/=/g, '');
};

const claimsRequiringPadding = (exp: number): Record<string, unknown> => {
  let claims: Record<string, unknown> = { exp, sub: 'u' };
  while (!encodeJwtSegment(claims, 'padded').endsWith('=')) {
    claims = { ...claims, pad: `${claims.pad ?? ''}x` };
  }
  return claims;
};

describe('JWT expiry parsing', () => {
  it('parses padded and unpadded base64url payload segments', () => {
    const exp = 1_893_456_000;
    const header = encodeJwtSegment({ alg: 'none', typ: 'JWT' }, 'unpadded');
    const claims = claimsRequiringPadding(exp);
    const paddedPayload = encodeJwtSegment(claims, 'padded');
    const unpaddedPayload = encodeJwtSegment(claims, 'unpadded');

    expect(paddedPayload).toContain('=');
    expect(unpaddedPayload).not.toContain('=');
    expect(parseJwtExpiry(`${header}.${paddedPayload}.sig`)).toBe(exp);
    expect(parseJwtExpiry(`${header}.${unpaddedPayload}.sig`)).toBe(exp);
  });
});

// =============================================================================
// Failure isolation
// =============================================================================

describe('MshJwtService — failure isolation', () => {
  it('fails closed on key kind mismatch', () =>
    Effect.gen(function* () {
      const jwt = yield* MshJwtService;
      const account = yield* jwt.createAccountKeyPair;

      const result = yield* jwt.encodeOperator(new OperatorJwtRequest({
        name: 'Not An Operator',
        operator: account,
      })).pipe(Effect.result);

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        expect(result.failure).toBeInstanceOf(JwtConstructionError);
        expect(result.failure.message).toContain('Expected operator key');
      }
    }).pipe(Effect.provide(MshJwtServiceLive), Effect.runPromise));

  it('returns JwtConstructionError for malformed manually-constructed key pairs', () =>
    Effect.gen(function* () {
      const jwt = yield* MshJwtService;
      const malformed = new MshNKeyPair({
        kind: 'operator',
        publicKey: 'O_NOT_REAL',
        seed: Redacted.make('S_NOT_REAL'),
      });

      const result = yield* jwt.encodeOperator(new OperatorJwtRequest({
        name: 'Malformed',
        operator: malformed,
      })).pipe(Effect.result);

      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure') {
        expect(result.failure).toBeInstanceOf(JwtConstructionError);
        expect(result.failure.message).toContain('Failed to encode operator JWT');
      }
    }).pipe(Effect.provide(MshJwtServiceLive), Effect.runPromise));
});
