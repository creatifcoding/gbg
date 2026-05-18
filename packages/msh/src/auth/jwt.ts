/**
 * MSH JWT Construction — Effect wrapper over @nats-io/jwt
 *
 * This module owns NATS-native JWT construction only. Domain policy belongs
 * above msh (pct/lnk/dmn). Secrets are always represented as Redacted values.
 *
 * @module @tmnl/msh/auth/jwt
 */

import * as Context from 'effect-v4/Context';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Redacted from 'effect-v4/Redacted';
import * as Schema from 'effect-v4/Schema';
import {
  Algorithms,
  createAccount,
  createOperator,
  createServer,
  createUser,
  decode as decodeJwt,
  encodeAccount,
  encodeActivation,
  encodeOperator,
  encodeUser,
  fmtCreds,
  fromSeed,
  parseCreds as parseNatsCreds,
} from '@nats-io/jwt';
import type {
  Account,
  Activation,
  ClaimsData,
  ConnectionType,
  OperatorLimits,
  EncodingOptions,
  Key,
  KeyPair,
  Operator,
  Permissions,
  User,
  UserEncodingOptions,
} from '@nats-io/jwt';

import { MshSpan } from '../tracing';
import { CredsAuth, CredsInline, JwtAuth } from './schemas';

// =============================================================================
// Claim Construction Schemas
// =============================================================================

/** Supported NATS JWT algorithms. v2 is the modern nkey-backed default. */
export const JwtAlgorithm = Schema.Literals(['ed25519', 'ed25519-nkey'] as const);
export type JwtAlgorithm = typeof JwtAlgorithm.Type;

/** Kind of NKey pair. Prefixes map to NATS nkey public key prefixes. */
export const MshNKeyKind = Schema.Literals(['operator', 'account', 'user', 'server'] as const);
export type MshNKeyKind = typeof MshNKeyKind.Type;

/** Safe wrapper for an NKey pair. Seed is redacted; public key is safe. */
export class MshNKeyPair extends Schema.TaggedClass<MshNKeyPair>()('MshNKeyPair', {
  kind: MshNKeyKind,
  publicKey: Schema.String,
  seed: Schema.Redacted(Schema.String),
}) {}

/** Validity/audience options shared by all NATS JWTs. */
export class JwtValidity extends Schema.TaggedClass<JwtValidity>()('JwtValidity', {
  exp: Schema.optionalKey(Schema.Number),
  nbf: Schema.optionalKey(Schema.Number),
  aud: Schema.optionalKey(Schema.String),
  algorithm: Schema.optionalKey(JwtAlgorithm),
}) {}

/** NATS pub/sub permission block. */
export const JwtPermission = Schema.Struct({
  allow: Schema.optionalKey(Schema.Array(Schema.String)),
  deny: Schema.optionalKey(Schema.Array(Schema.String)),
});
export type JwtPermission = typeof JwtPermission.Type;

/** NATS response permission block. */
export const JwtResponsePermission = Schema.Struct({
  max: Schema.optionalKey(Schema.Number),
  ttl: Schema.optionalKey(Schema.Number),
});
export type JwtResponsePermission = typeof JwtResponsePermission.Type;

/** User permissions accepted by NATS JWTs. */
export const JwtPermissions = Schema.Struct({
  pub: Schema.optionalKey(JwtPermission),
  sub: Schema.optionalKey(JwtPermission),
  resp: Schema.optionalKey(JwtResponsePermission),
});
export type JwtPermissions = typeof JwtPermissions.Type;

/** Common user limit fields. */
export const JwtUserLimits = Schema.Struct({
  data: Schema.optionalKey(Schema.Number),
  payload: Schema.optionalKey(Schema.Number),
  subs: Schema.optionalKey(Schema.Number),
  src: Schema.optionalKey(Schema.Array(Schema.String)),
  locale: Schema.optionalKey(Schema.String),
});
export type JwtUserLimits = typeof JwtUserLimits.Type;

/** Account limits accepted by NATS account JWTs. Use -1 for unlimited numeric limits. */
export const JwtAccountLimits = Schema.Struct({
  data: Schema.optionalKey(Schema.Number),
  payload: Schema.optionalKey(Schema.Number),
  subs: Schema.optionalKey(Schema.Number),
  conn: Schema.optionalKey(Schema.Number),
  leaf: Schema.optionalKey(Schema.Number),
  imports: Schema.optionalKey(Schema.Number),
  exports: Schema.optionalKey(Schema.Number),
  wildcards: Schema.optionalKey(Schema.Boolean),
  mem_storage: Schema.optionalKey(Schema.Number),
  disk_storage: Schema.optionalKey(Schema.Number),
  streams: Schema.optionalKey(Schema.Number),
  consumer: Schema.optionalKey(Schema.Number),
  mem_max_stream_bytes: Schema.optionalKey(Schema.Number),
  disk_max_stream_bytes: Schema.optionalKey(Schema.Number),
  max_bytes_required: Schema.optionalKey(Schema.Boolean),
  max_ack_pending: Schema.optionalKey(Schema.Number),
});
export type JwtAccountLimits = typeof JwtAccountLimits.Type;

/** Construct an operator JWT. */
export class OperatorJwtRequest extends Schema.TaggedClass<OperatorJwtRequest>()('OperatorJwtRequest', {
  name: Schema.String,
  operator: MshNKeyPair,
  signer: Schema.optionalKey(MshNKeyPair),
  signingKeys: Schema.optionalKey(Schema.Array(Schema.String)),
  accountServerUrl: Schema.optionalKey(Schema.String),
  operatorServiceUrls: Schema.optionalKey(Schema.Array(Schema.String)),
  systemAccount: Schema.optionalKey(Schema.String),
  tags: Schema.optionalKey(Schema.Array(Schema.String)),
  validity: Schema.optionalKey(JwtValidity),
}) {}

/** Construct an account JWT. */
export class AccountJwtRequest extends Schema.TaggedClass<AccountJwtRequest>()('AccountJwtRequest', {
  name: Schema.String,
  account: MshNKeyPair,
  signer: Schema.optionalKey(MshNKeyPair),
  signingKeys: Schema.optionalKey(Schema.Array(Schema.String)),
  disallowBearer: Schema.optionalKey(Schema.Boolean),
  defaultPermissions: Schema.optionalKey(JwtPermissions),
  limits: Schema.optionalKey(JwtAccountLimits),
  tags: Schema.optionalKey(Schema.Array(Schema.String)),
  validity: Schema.optionalKey(JwtValidity),
}) {}

/** Construct a user JWT. */
export class UserJwtRequest extends Schema.TaggedClass<UserJwtRequest>()('UserJwtRequest', {
  name: Schema.String,
  user: MshNKeyPair,
  issuer: MshNKeyPair,
  signer: Schema.optionalKey(MshNKeyPair),
  permissions: Schema.optionalKey(JwtPermissions),
  limits: Schema.optionalKey(JwtUserLimits),
  bearerToken: Schema.optionalKey(Schema.Boolean),
  allowedConnectionTypes: Schema.optionalKey(Schema.Array(Schema.String)),
  tags: Schema.optionalKey(Schema.Array(Schema.String)),
  scopedUser: Schema.optionalKey(Schema.Boolean),
  validity: Schema.optionalKey(JwtValidity),
}) {}

/** Construct a service/stream activation JWT. */
export class ActivationJwtRequest extends Schema.TaggedClass<ActivationJwtRequest>()('ActivationJwtRequest', {
  name: Schema.String,
  subject: MshNKeyPair,
  issuer: MshNKeyPair,
  signer: Schema.optionalKey(MshNKeyPair),
  kind: Schema.Literals(['service', 'stream'] as const),
  serviceSubject: Schema.optionalKey(Schema.String),
  validity: Schema.optionalKey(JwtValidity),
}) {}

/** Parsed NATS credentials. Seed is redacted; JWT + public IDs are safe metadata. */
export class ParsedCreds extends Schema.TaggedClass<ParsedCreds>()('ParsedCreds', {
  jwt: Schema.String,
  seed: Schema.Redacted(Schema.String),
  accountId: Schema.String,
  userPublicKey: Schema.String,
}) {}

// =============================================================================
// JWT Errors
// =============================================================================

export class JwtConstructionError extends Schema.TaggedErrorClass<JwtConstructionError>(
  '@tmnl/msh/auth/JwtConstructionError',
)('Auth/JwtConstruction', {
  message: Schema.String,
  operation: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class JwtDecodeError extends Schema.TaggedErrorClass<JwtDecodeError>(
  '@tmnl/msh/auth/JwtDecodeError',
)('Auth/JwtDecode', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export type JwtError = JwtConstructionError | JwtDecodeError;

// =============================================================================
// Helpers
// =============================================================================

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const seedString = (pair: MshNKeyPair): string => Redacted.value(pair.seed);
const keyFromPair = (pair: MshNKeyPair): Key => seedString(pair);
const pairToKeyPair = (pair: MshNKeyPair): KeyPair => fromSeed(encoder.encode(seedString(pair)));

const toAlgorithm = (algorithm?: JwtAlgorithm): Algorithms =>
  algorithm === 'ed25519' ? Algorithms.v1 : Algorithms.v2;

const toEncodingOptions = (validity?: JwtValidity): Partial<EncodingOptions> => ({
  exp: validity?.exp,
  nbf: validity?.nbf,
  aud: validity?.aud,
  algorithm: toAlgorithm(validity?.algorithm),
});

const toUserEncodingOptions = (request: UserJwtRequest): Partial<UserEncodingOptions> => ({
  ...toEncodingOptions(request.validity),
  scopedUser: request.scopedUser,
  signer: request.signer ? keyFromPair(request.signer) : undefined,
});

const assertKind = (
  pair: MshNKeyPair,
  expected: MshNKeyKind,
  operation: string,
): Effect.Effect<void, JwtConstructionError> =>
  pair.kind === expected
    ? Effect.void
    : Effect.fail(new JwtConstructionError({
        operation,
        message: `Expected ${expected} key, received ${pair.kind} key (${pair.publicKey})`,
      }));

const createPair = (
  kind: MshNKeyKind,
  kp: KeyPair,
): MshNKeyPair => {
  const seed = decoder.decode(kp.getSeed());
  const publicKey = kp.getPublicKey();
  kp.clear();
  return new MshNKeyPair({
    kind,
    publicKey,
    seed: Redacted.make(seed),
  });
};

const mutableStrings = (values: readonly string[] | undefined): string[] | undefined =>
  values ? [...values] : undefined;

const buildOperator = (request: OperatorJwtRequest): Partial<Operator> => ({
  signing_keys: mutableStrings(request.signingKeys),
  account_server_url: request.accountServerUrl,
  operator_service_urls: mutableStrings(request.operatorServiceUrls),
  system_account: request.systemAccount,
  tags: mutableStrings(request.tags),
});

const buildAccount = (request: AccountJwtRequest): Partial<Account> => ({
  signing_keys: mutableStrings(request.signingKeys),
  default_permissions: request.defaultPermissions as Partial<Permissions> | undefined,
  disallow_bearer: request.disallowBearer,
  limits: request.limits as Partial<OperatorLimits> | undefined,
  tags: mutableStrings(request.tags),
});

const buildUser = (request: UserJwtRequest): Partial<User> => ({
  ...(request.permissions as Partial<Permissions> | undefined),
  ...(request.limits as Partial<User> | undefined),
  bearer_token: request.bearerToken,
  allowed_connection_types: mutableStrings(request.allowedConnectionTypes) as ConnectionType[] | undefined,
  tags: mutableStrings(request.tags),
});

const buildActivation = (request: ActivationJwtRequest): Partial<Activation> => ({
  subject: request.serviceSubject,
});

// =============================================================================
// Service Shape
// =============================================================================

export interface MshJwtServiceShape {
  readonly createOperatorKeyPair: Effect.Effect<MshNKeyPair, JwtConstructionError>;
  readonly createAccountKeyPair: Effect.Effect<MshNKeyPair, JwtConstructionError>;
  readonly createUserKeyPair: Effect.Effect<MshNKeyPair, JwtConstructionError>;
  readonly createServerKeyPair: Effect.Effect<MshNKeyPair, JwtConstructionError>;
  readonly keyPairFromSeed: (kind: MshNKeyKind, seed: Redacted.Redacted<string>) => Effect.Effect<MshNKeyPair, JwtConstructionError>;

  readonly encodeOperator: (request: OperatorJwtRequest) => Effect.Effect<string, JwtConstructionError>;
  readonly encodeAccount: (request: AccountJwtRequest) => Effect.Effect<string, JwtConstructionError>;
  readonly encodeUser: (request: UserJwtRequest) => Effect.Effect<string, JwtConstructionError>;
  readonly encodeActivation: (request: ActivationJwtRequest) => Effect.Effect<string, JwtConstructionError>;

  readonly decode: <T = unknown>(jwt: string) => Effect.Effect<ClaimsData<T>, JwtDecodeError>;
  readonly formatCreds: (jwt: string, user: MshNKeyPair) => Effect.Effect<Uint8Array, JwtConstructionError>;
  readonly parseCreds: (creds: Uint8Array) => Effect.Effect<ParsedCreds, JwtDecodeError>;

  /** Issue a User JWT and return an auth mode usable by MshAuthService. */
  readonly issueJwtAuth: (request: UserJwtRequest, rotationWindowMs?: number) => Effect.Effect<JwtAuth, JwtConstructionError>;

  /** Issue a User JWT + creds bundle as an inline CredsAuth mode. */
  readonly issueCredsAuth: (request: UserJwtRequest) => Effect.Effect<CredsAuth, JwtConstructionError>;
}

// =============================================================================
// Service Definition
// =============================================================================

export class MshJwtService extends Context.Service<
  MshJwtService,
  MshJwtServiceShape
>()('@tmnl/msh/auth/JwtService') {
  static readonly layer = Layer.succeed(
    MshJwtService,
    MshJwtService.of({
      createOperatorKeyPair: Effect.try({
        try: () => createPair('operator', createOperator()),
        catch: (cause) => new JwtConstructionError({ operation: 'createOperatorKeyPair', message: 'Failed to create operator nkey pair', cause }),
      }).pipe(Effect.withSpan(MshSpan.Auth.Jwt.createOperatorKeyPair)),

      createAccountKeyPair: Effect.try({
        try: () => createPair('account', createAccount()),
        catch: (cause) => new JwtConstructionError({ operation: 'createAccountKeyPair', message: 'Failed to create account nkey pair', cause }),
      }).pipe(Effect.withSpan(MshSpan.Auth.Jwt.createAccountKeyPair)),

      createUserKeyPair: Effect.try({
        try: () => createPair('user', createUser()),
        catch: (cause) => new JwtConstructionError({ operation: 'createUserKeyPair', message: 'Failed to create user nkey pair', cause }),
      }).pipe(Effect.withSpan(MshSpan.Auth.Jwt.createUserKeyPair)),

      createServerKeyPair: Effect.try({
        try: () => createPair('server', createServer()),
        catch: (cause) => new JwtConstructionError({ operation: 'createServerKeyPair', message: 'Failed to create server nkey pair', cause }),
      }).pipe(Effect.withSpan(MshSpan.Auth.Jwt.createServerKeyPair)),

      keyPairFromSeed: Effect.fn(MshSpan.Auth.Jwt.keyPairFromSeed)(
        function*(kind: MshNKeyKind, seed: Redacted.Redacted<string>) {
          return yield* Effect.try({
            try: () => {
              const kp = fromSeed(encoder.encode(Redacted.value(seed)));
              const pair = createPair(kind, kp);
              if (pair.kind !== kind) {
                throw new Error(`Expected ${kind} seed, decoded ${pair.kind}`);
              }
              return pair;
            },
            catch: (cause) => new JwtConstructionError({ operation: 'keyPairFromSeed', message: `Failed to restore ${kind} nkey pair from seed`, cause }),
          });
        },
      ),

      encodeOperator: Effect.fn(MshSpan.Auth.Jwt.encodeOperator)(
        function*(request: OperatorJwtRequest) {
          yield* assertKind(request.operator, 'operator', 'encodeOperator');
          if (request.signer) yield* assertKind(request.signer, 'operator', 'encodeOperator');

          return yield* Effect.tryPromise({
            try: () => encodeOperator(
              request.name,
              keyFromPair(request.operator),
              buildOperator(request),
              {
                ...toEncodingOptions(request.validity),
                signer: request.signer ? keyFromPair(request.signer) : undefined,
              },
            ),
            catch: (cause) => new JwtConstructionError({ operation: 'encodeOperator', message: `Failed to encode operator JWT '${request.name}'`, cause }),
          });
        },
      ),

      encodeAccount: Effect.fn(MshSpan.Auth.Jwt.encodeAccount)(
        function*(request: AccountJwtRequest) {
          yield* assertKind(request.account, 'account', 'encodeAccount');
          if (request.signer && request.signer.kind !== 'operator' && request.signer.kind !== 'account') {
            return yield* Effect.fail(new JwtConstructionError({
              operation: 'encodeAccount',
              message: `Account JWT signer must be operator or account key, received ${request.signer.kind}`,
            }));
          }

          return yield* Effect.tryPromise({
            try: () => encodeAccount(
              request.name,
              keyFromPair(request.account),
              buildAccount(request),
              {
                ...toEncodingOptions(request.validity),
                signer: request.signer ? keyFromPair(request.signer) : undefined,
              },
            ),
            catch: (cause) => new JwtConstructionError({ operation: 'encodeAccount', message: `Failed to encode account JWT '${request.name}'`, cause }),
          });
        },
      ),

      encodeUser: Effect.fn(MshSpan.Auth.Jwt.encodeUser)(
        function*(request: UserJwtRequest) {
          yield* assertKind(request.user, 'user', 'encodeUser');
          yield* assertKind(request.issuer, 'account', 'encodeUser');
          if (request.signer) yield* assertKind(request.signer, 'account', 'encodeUser');

          return yield* Effect.tryPromise({
            try: () => encodeUser(
              request.name,
              keyFromPair(request.user),
              keyFromPair(request.issuer),
              buildUser(request),
              toUserEncodingOptions(request),
            ),
            catch: (cause) => new JwtConstructionError({ operation: 'encodeUser', message: `Failed to encode user JWT '${request.name}'`, cause }),
          });
        },
      ),

      encodeActivation: Effect.fn(MshSpan.Auth.Jwt.encodeActivation)(
        function*(request: ActivationJwtRequest) {
          yield* assertKind(request.issuer, 'account', 'encodeActivation');

          return yield* Effect.tryPromise({
            try: () => encodeActivation(
              request.name,
              keyFromPair(request.subject),
              keyFromPair(request.issuer),
              request.kind,
              buildActivation(request),
              {
                ...toEncodingOptions(request.validity),
                signer: request.signer ? keyFromPair(request.signer) : undefined,
              },
            ),
            catch: (cause) => new JwtConstructionError({ operation: 'encodeActivation', message: `Failed to encode activation JWT '${request.name}'`, cause }),
          });
        },
      ),

      decode: Effect.fn(MshSpan.Auth.Jwt.decode)(
        function*<T = unknown>(jwt: string) {
          return yield* Effect.try({
            try: () => decodeJwt<T>(jwt),
            catch: (cause) => new JwtDecodeError({ message: 'Failed to decode/verify NATS JWT', cause }),
          });
        },
      ),

      formatCreds: Effect.fn(MshSpan.Auth.Jwt.formatCreds)(
        function*(jwt: string, user: MshNKeyPair) {
          yield* assertKind(user, 'user', 'formatCreds');
          return yield* Effect.acquireUseRelease(
            Effect.try({
              try: () => pairToKeyPair(user),
              catch: (cause) => new JwtConstructionError({ operation: 'formatCreds', message: 'Failed to restore user nkey pair', cause }),
            }),
            (kp) => Effect.try({
              try: () => fmtCreds(jwt, kp),
              catch: (cause) => new JwtConstructionError({ operation: 'formatCreds', message: 'Failed to format NATS credentials', cause }),
            }),
            (kp) => Effect.sync(() => kp.clear()),
          );
        },
      ),

      parseCreds: Effect.fn(MshSpan.Auth.Jwt.parseCreds)(
        function*(creds: Uint8Array) {
          return yield* Effect.tryPromise({
            try: async () => {
              const parsed = await parseNatsCreds(creds);
              return new ParsedCreds({
                jwt: parsed.jwt,
                seed: Redacted.make(parsed.key),
                accountId: parsed.aid,
                userPublicKey: parsed.uc.sub,
              });
            },
            catch: (cause) => new JwtDecodeError({ message: 'Failed to parse NATS credentials', cause }),
          });
        },
      ),

      issueJwtAuth: Effect.fn(MshSpan.Auth.Jwt.issueJwtAuth)(
        function*(request: UserJwtRequest, rotationWindowMs = 30_000) {
          yield* assertKind(request.user, 'user', 'issueJwtAuth');
          yield* assertKind(request.issuer, 'account', 'issueJwtAuth');
          if (request.signer) yield* assertKind(request.signer, 'account', 'issueJwtAuth');

          const token = yield* Effect.tryPromise({
            try: () => encodeUser(
              request.name,
              keyFromPair(request.user),
              keyFromPair(request.issuer),
              buildUser(request),
              toUserEncodingOptions(request),
            ),
            catch: (cause) => new JwtConstructionError({ operation: 'issueJwtAuth', message: `Failed to issue JwtAuth for '${request.name}'`, cause }),
          });

          return new JwtAuth({
            jwt: token,
            seed: request.user.seed,
            rotationWindowMs,
          });
        },
      ),

      issueCredsAuth: Effect.fn(MshSpan.Auth.Jwt.issueCredsAuth)(
        function*(request: UserJwtRequest) {
          yield* assertKind(request.user, 'user', 'issueCredsAuth');
          yield* assertKind(request.issuer, 'account', 'issueCredsAuth');
          if (request.signer) yield* assertKind(request.signer, 'account', 'issueCredsAuth');

          const token = yield* Effect.tryPromise({
            try: () => encodeUser(
              request.name,
              keyFromPair(request.user),
              keyFromPair(request.issuer),
              buildUser(request),
              toUserEncodingOptions(request),
            ),
            catch: (cause) => new JwtConstructionError({ operation: 'issueCredsAuth', message: `Failed to issue CredsAuth for '${request.name}'`, cause }),
          });

          const creds = yield* Effect.acquireUseRelease(
            Effect.try({
              try: () => pairToKeyPair(request.user),
              catch: (cause) => new JwtConstructionError({ operation: 'issueCredsAuth', message: 'Failed to restore user nkey pair', cause }),
            }),
            (kp) => Effect.try({
              try: () => decoder.decode(fmtCreds(token, kp)),
              catch: (cause) => new JwtConstructionError({ operation: 'issueCredsAuth', message: 'Failed to format issued credentials', cause }),
            }),
            (kp) => Effect.sync(() => kp.clear()),
          );

          return new CredsAuth({
            source: new CredsInline({ contents: Redacted.make(creds) }),
          });
        },
      ),
    }),
  );
}

export const MshJwtServiceLive = MshJwtService.layer;
