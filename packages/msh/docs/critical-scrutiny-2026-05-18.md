# @tmnl/msh Critical Scrutiny — 2026-05-18

Status: audit findings, not yet remediated.

Baseline before scrutiny:

```bash
cd packages/msh && bunx tsc --noEmit
cd packages/msh && bunx vitest run
```

Observed result: typecheck passed; normal tests passed (`82 passed`, live suites skipped by default). `packages/msh` was clean before this report.

## Fix-now findings

### 1. `MshJwtService.keyPairFromSeed` accepts mismatched key kinds

Status: remediated. `MshJwtService` now infers NKey kind from the restored public-key prefix (`O`, `A`, `U`, `N`) and fails if it differs from the requested kind.

File: `src/auth/jwt.ts`

`keyPairFromSeed(kind, seed)` constructed `createPair(kind, kp)`, and `createPair` stored the caller-supplied kind without inferring the actual kind from the restored public key. The subsequent check `pair.kind !== kind` was therefore tautological.

Probe:

```ts
const user = yield* jwt.createUserKeyPair
const mislabeled = yield* jwt.keyPairFromSeed("operator", user.seed)
// Success: { kind: "operator", publicKey: "U..." }
```

Impact: key-kind assertions can be bypassed in-process. NATS may reject invalid chains later, but MSH's trust-chain monotonicity invariant is already compromised.

Recommended fix: infer kind from restored public key prefix and fail if it does not match the expected kind. Apply the same guard inside `createPair` so all constructors remain honest.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/jwt.test.ts test/auth-behavior.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: `keyPairFromSeed('operator', user.seed)` now returns `JwtConstructionError`.

### 2. `NatsHubService.publish` double-delivers to local subscribers

File: `src/nats/hub.ts`

`publish` first publishes directly into all matching local PubSubs, then forwards to core NATS. A matching local NATS subscription receives the same message back from the server, causing duplicate delivery.

Live probe against ephemeral `nats-server` produced:

```json
[
  "probe.dup.<ts>:one",
  "probe.dup.<ts>:one"
]
```

Impact: local subscribers see duplicates even for a single publish. Any downstream consumer that assumes at-most-once local fan-out is wrong.

Recommended fix: default `publish` should only encode and forward to NATS. Let the NATS subscription feed the hub. If optimistic local fan-out is ever desired, make it explicit and de-duplicate using message ids.

### 3. `NatsHubService` schema isolation is broken

File: `src/nats/hub.ts`

Hub keying uses `(schema as any).ast?._tag`, so most structs collide as `Struct`. The first subscriber's schema owns the shared typed hub; later subscribers with a different schema share the same PubSub. Worse, local synthetic `publish` bypasses subscriber decoding entirely and injects the publisher's typed data into all matching hubs.

Probe with `Schema.Struct({ a: String })` and `Schema.Struct({ b: String })` on the same pattern showed the A subscriber receiving `{ b: "bee" }` with no decode error.

Impact: type-level stream contracts are unsound.

Recommended fix: make the hub raw-byte based per NATS subscription key (`pattern`, `queue`, maybe subscription options), then decode per subscriber stream. Do not store schema-typed messages in the shared hub.

### 4. `SubscribeOptions.startSequence` is exposed but not wired to NATS

Files: `src/nats/stream.ts`, `src/nats/inner.ts`

`NatsStreamService.subscribe` exposes `startSequence`, but `ConsumerConfigInput` / `inner.consumers.add` never map it to the NATS consumer config (`opt_start_seq`). A live probe using `deliverPolicy: "by_start_sequence", startSequence: 2` failed during consumer creation.

Impact: API advertises replay-from-sequence semantics that do not work.

Recommended fix: add typed config fields for `startSequence` / `startTime`, map them to NATS consumer config, and add a live test proving the first delivered message is the requested sequence.

### 5. `MshAuthService` leaves state as `failed` after successful retry

Status: remediated. Auth lifecycle state is now driven by Schema-backed `AuthLifecycleSignal` operation kinds and a single transition graph. Credential source IO is isolated behind `MshCredentialSourceReader`, with named Effect programs for env/file reads.

File: `src/auth/service.ts`

After a credential load failure, a later `getAuthenticator` could succeed, but the state remained `failed` because success only transitioned from `loading_credentials` to `ready`.

Probe result:

```json
{"first":"Failure","afterFirst":"failed","second":"Success","afterSecond":"failed"}
```

Impact: callers observing auth state receive stale failure state after recovery.

Recommended fix: on retry from `failed`, transition through `loading_credentials`; after successful credential load, set `ready` regardless of whether the prior state was `failed` or `loading_credentials`.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/auth-behavior.test.ts test/auth.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: a failed `CredsEnv` load can recover after the variable becomes available, and state moves from `failed` → `loading_credentials` → `ready` via `CredentialLoadRequested` / `CredentialLoadSucceeded` signals.

### 6. `SubjectSpec.matches` treats literal dots as regex wildcards

Status: remediated. Subject matching/extraction now compares token-by-token: full-token placeholders capture one non-empty subject token, and literal tokens must match exactly.

File: `src/subject/schemas.ts`

`matches()` built a regex directly from the subject pattern and only replaced placeholders. Literal `.` characters were not escaped.

Probe:

```ts
new SubjectSpec({ pattern: "foo.bar.{id}", ... }).matches("fooXbar.1")
// true
```

Impact: subject registry matching can authorize/route subjects that do not match the tokenized NATS pattern.

Recommended fix: match token-by-token instead of building a raw regex, or escape all literal pattern tokens before placeholder expansion.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/subject-registry.test.ts test/property.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: literal-token mutations such as `geointXflight.ABC123.position` no longer match `geoint.flight.{icao24}.position`, and property coverage exercises generated literal/placeholder boundaries.

## Medium-priority findings

### 7. Connection finalizer does not await drain/close

File: `src/nats/connection.ts`

The scoped release finalizer calls `conn.drain().catch(() => {})` and `conn.close().catch(() => {})` inside `Effect.sync`, then returns immediately.

Impact: scope exit can complete before the NATS connection is actually drained or closed; cleanup errors are fully swallowed.

Recommended fix: use an async finalizer and await drain/close. If failures should not fail scope release, log or trace them deliberately.

### 8. Core connection eagerly requires JetStream manager

File: `src/nats/connection.ts`

The connection layer eagerly initializes both `nc.jetstream()` and `nc.jetstreamManager()`. Even pure core pub/sub consumers therefore require JetStream management permission at startup.

Impact: least-privilege deployments cannot use core-only MSH services without `$JS.API` access.

Recommended fix: split core connection from JetStream manager access, or make the manager lazy.

### 9. `ensureStream` accepts existing streams without config validation

File: `src/nats/stream.ts`

`ensureStream(config)` returns existing stream info if a stream by that name exists, without validating subjects, retention, storage, duplicate window, etc.

Impact: callers can believe they ensured a topology while running against an incompatible existing stream.

Recommended fix: either rename to `getOrCreateStream` or compare material config and fail/update explicitly.

### 10. Optional JetStream manager wrappers likely hide permission failures

File: `src/nats/inner.ts`

Several optional wrappers return `null` on any thrown error. That is appropriate for true not-found cases, but not for permission, network, or server errors.

Impact: operational failures can be misclassified as absence.

Recommended fix: inspect NATS error codes and only convert recognized not-found responses to `null`.

## Lower-priority findings

- `NatsCodec.encodeBatch` / `decodeBatch` accept `concurrency` but currently process sequentially.
- `parseJwtExpiry` decodes base64url without explicit padding normalization; Bun is tolerant, but this is fragile cross-runtime code.
- `NatsStreamService.collectMessages` breaks after `limit` without explicitly stopping the pull consumer message iterator in that helper path.

## Test gaps exposed

Add deterministic tests before/with fixes for:

1. `keyPairFromSeed("operator", userSeed)` must fail.
2. One local hub publish should produce exactly one local delivery against live NATS.
3. Different schemas on the same pattern must not leak wrong-typed data.
4. `deliverPolicy: "by_start_sequence"` + `startSequence` must deliver from that sequence live.
5. Auth retry success must update state away from `failed`.
6. `SubjectSpec.matches("fooXbar.1")` must be false for pattern `foo.bar.{id}`.
