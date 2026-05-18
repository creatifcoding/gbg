# @tmnl/msh Critical Scrutiny — 2026-05-18

Status: remediated and closed out. Findings are tracked in the #F1021 remediation feature tree; closeout validation passed on 2026-05-18.

Baseline before scrutiny:

```bash
cd packages/msh && bunx tsc --noEmit
cd packages/msh && bunx vitest run
```

Observed baseline result: typecheck passed; normal tests passed (`82 passed`, live suites skipped by default). `packages/msh` was clean before this report.

Closeout validation:

```bash
cd packages/msh && bunx vitest run && bunx tsc --noEmit --pretty false
# 10 files passed, 4 skipped; 98 tests passed, 11 skipped

cd packages/msh && MSH_LIVE_NATS=1 bunx vitest run test/live-*.test.ts
# 4 files passed; 11 tests passed
```

## Fix-now findings

### 1. `MshJwtService.keyPairFromSeed` accepts mismatched key kinds

Status: remediated. `MshJwtService` now infers NKey kind from the restored public-key prefix (`O`, `A`, `U`, `N`) and fails if it differs from the requested kind.

File: `src/auth/jwt.ts`

`keyPairFromSeed(kind, seed)` constructed `createPair(kind, kp)`, and `createPair` stored the caller-supplied kind without inferring the actual kind from the restored public key. The subsequent check `pair.kind !== kind` was therefore tautological.

Impact: key-kind assertions could be bypassed in-process. NATS may reject invalid chains later, but MSH's trust-chain monotonicity invariant was already compromised.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/jwt.test.ts test/auth-behavior.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: `keyPairFromSeed('operator', user.seed)` now returns `JwtConstructionError`.

### 2. `NatsHubService.publish` double-delivers to local subscribers

Status: remediated. Hub publish now forwards encoded bytes to core NATS only; local subscribers receive the NATS echo path, not a synthetic local fanout plus echo.

File: `src/nats/hub.ts`

Original issue: `publish` first published directly into all matching local PubSubs, then forwarded to core NATS. A matching local NATS subscription received the same message back from the server, causing duplicate delivery.

Impact: local subscribers could see duplicates for a single publish.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/hub-pubsub.integration.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: one `NatsPubSubService.publish` to a matching wildcard subscriber yields exactly one delivery, and core NATS receives one encoded publish.

### 3. `NatsHubService` schema isolation is broken

Status: remediated. Hub fanout is raw-message based per NATS subscription identity; schema decode now happens per subscriber stream.

File: `src/nats/hub.ts`

Original issue: hub keying used `(schema as any).ast?._tag`, so most structs collided as `Struct`. Later subscribers with different schemas shared the first subscriber's typed hub, and synthetic publish bypassed decode entirely.

Impact: type-level stream contracts were unsound.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/hub-pubsub.integration.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: incompatible schemas sharing the same subject pattern are isolated; the wrong schema subscriber receives no decoded data while the matching schema subscriber receives the message.

### 4. `SubscribeOptions.startSequence` is exposed but not wired to NATS

Status: remediated. `SubscribeOptions.startSequence` / `startTime` now flow through `ConsumerConfigInput` and map to NATS `opt_start_seq` / `opt_start_time` for both durable and ephemeral subscription paths.

Files: `src/nats/stream.ts`, `src/nats/inner.ts`

Original issue: `NatsStreamService.subscribe` exposed replay-from-sequence options but never forwarded them to `jsm.consumers.add`.

Impact: API advertised replay-from-sequence semantics that did not work.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/service-mock.test.ts test/live-infrastructure.test.ts && bunx tsc --noEmit --pretty false
cd packages/msh && MSH_LIVE_NATS=1 bunx vitest run test/live-infrastructure.test.ts
```

Regression added: live JetStream test publishes seq 1/2 and verifies `deliverPolicy: 'by_start_sequence', startSequence: 2` starts at seq 2.

### 5. `MshAuthService` leaves state as `failed` after successful retry

Status: remediated. Auth lifecycle state is now driven by Schema-backed `AuthLifecycleSignal` operation kinds and a single transition graph. Credential source IO is isolated behind `MshCredentialSourceReader`, with named Effect programs for env/file reads.

File: `src/auth/service.ts`

Original issue: after a credential load failure, a later `getAuthenticator` could succeed, but state remained `failed` because success only transitioned from `loading_credentials` to `ready`.

Impact: callers observing auth state received stale failure state after recovery.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/auth-behavior.test.ts test/auth.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: a failed `CredsEnv` load can recover after the variable becomes available, and state moves from `failed` → `loading_credentials` → `ready` via `CredentialLoadRequested` / `CredentialLoadSucceeded` signals.

### 6. `SubjectSpec.matches` treats literal dots as regex wildcards

Status: remediated. Subject matching/extraction now compares token-by-token: full-token placeholders capture one non-empty subject token, and literal tokens must match exactly. Registry `patternMatch` query also uses token-wise NATS-style wildcard matching instead of raw regex fragments.

Files: `src/subject/schemas.ts`, `src/subject/registry.ts`

Original issue: `matches()` built a regex directly from the subject pattern and only replaced placeholders. Literal `.` characters were not escaped.

Impact: subject registry matching could authorize/route subjects that do not match the tokenized NATS pattern.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/subject-registry.test.ts test/property.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: literal-token mutations such as `geointXflight.ABC123.position` no longer match `geoint.flight.{icao24}.position`, and property coverage exercises generated literal/placeholder boundaries.

## Medium-priority findings

### 7. Connection finalizer does not await drain/close

Status: remediated. Release now delegates to exported `releaseNatsConnection`, an Effect program that awaits `drain()` before `close()`.

File: `src/nats/connection.ts`

Original issue: the scoped release finalizer called `conn.drain().catch(() => {})` and `conn.close().catch(() => {})` inside `Effect.sync`, then returned immediately.

Impact: scope exit could complete before the NATS connection was actually drained or closed; cleanup errors were fully swallowed.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/service-mock.test.ts --testNamePattern "awaits connection drain" && bunx tsc --noEmit --pretty false
```

Regression added: `close()` observes that `drain()` completed first.

### 8. Core connection eagerly requires JetStream manager

Status: remediated. `NatsConnectionService` no longer calls `nc.jetstreamManager()` during layer acquisition. It exposes a memoized `getJsm()` Effect; `NatsInnerService` calls that lazily only in stream/consumer management operations.

Files: `src/nats/connection.ts`, `src/nats/inner.ts`

Original issue: even pure core pub/sub consumers required JetStream management permission at startup.

Impact: least-privilege deployments could not use core-only MSH services without `$JS.API` access.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/service-mock.test.ts test/hub-pubsub.integration.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: mock core publish/request succeeds when JetStream manager access is unavailable; stream manager calls fail at use time with typed errors.

### 9. `ensureStream` accepts existing streams without config validation

Status: remediated. `ensureStream` is now strict get-or-create: existing streams are accepted only when requested material fields match; mismatches fail with Schema-backed `Stream.ConfigMismatchError` carrying `streamName` and mismatched field names.

Files: `src/nats/stream.ts`, `src/nats/errors.ts`

Original issue: `ensureStream(config)` returned existing stream info by name without validating subjects, retention, storage, duplicate window, etc.

Impact: callers could believe they ensured a topology while running against an incompatible existing stream.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/live-infrastructure.test.ts test/service-mock.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: identical existing stream config succeeds; incompatible subjects fail with `Stream/ConfigMismatch` and `mismatches: ['subjects']`.

### 10. Optional JetStream manager wrappers likely hide permission failures

Status: remediated. Optional wrappers now return `null` only for recognized not-found errors; operational failures surface as typed errors.

File: `src/nats/inner.ts`

Original issue: some optional wrappers returned `null` on any thrown error, hiding permission, network, or server failures.

Impact: operational failures could be misclassified as absence.

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/service-mock.test.ts test/errors.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: `streams.find` converts stream-not-found to `null` but preserves JetStream-manager failure; `objectStore.info` converts object-not-found to `null` but maps operational failures to `Inner/KV/Get`.

## Lower-priority findings

### 11. `NatsCodec.encodeBatch` / `decodeBatch` accept `concurrency` but process sequentially

Status: remediated. Service batch operations now route through the same stream-native `Stream.mapEffect(..., { concurrency })` path as codec stream transforms.

Files: `src/nats/codec.ts`, `test/codec.test.ts`

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/codec.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: `test/codec.test.ts` uses an effectful delayed schema and `Ref`-tracked in-flight counters to prove `concurrency: 2` overlaps exactly two transforms while preserving batch order/index metadata.

### 12. `parseJwtExpiry` decodes base64url without explicit padding normalization

Status: remediated. JWT expiry parsing now converts base64url to base64 and pads payload segments before `atob`; invalid lengths still fail closed to `undefined` through the existing parser catch path.

File: `src/auth/rotation.ts`

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/jwt.test.ts test/auth-behavior.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: padded and unpadded payload segments requiring padding both parse to the expected `exp`.

### 13. `NatsStreamService.collectMessages` breaks after `limit` without stopping the iterator

Status: remediated. `collectMessages` now wraps the `for await` loop in `try/finally` and best-effort invokes `messages.stop?.()` on limit break, normal completion, or error.

File: `src/nats/stream.ts`

Resolution evidence:

```bash
cd packages/msh && bunx vitest run test/service-mock.test.ts test/live-infrastructure.test.ts && bunx tsc --noEmit --pretty false
```

Regression added: limited `NatsStreamService.fetch` collection calls `ConsumerMessages.stop()` exactly once.

## Test gaps exposed and covered

1. `keyPairFromSeed("operator", userSeed)` must fail — covered in `test/jwt.test.ts`.
2. One local hub publish should produce exactly one local delivery — covered in `test/hub-pubsub.integration.test.ts`.
3. Different schemas on the same pattern must not leak wrong-typed data — covered in `test/hub-pubsub.integration.test.ts`.
4. `deliverPolicy: "by_start_sequence"` + `startSequence` must deliver from that sequence live — covered in `test/live-infrastructure.test.ts`.
5. Auth retry success must update state away from `failed` — covered in `test/auth-behavior.test.ts`.
6. `SubjectSpec.matches("fooXbar.1")` must be false for pattern `foo.bar.{id}` — covered in `test/subject-registry.test.ts` and `test/property.test.ts`.
7. Core-only MSH use must not require JetStream manager permission — covered in `test/service-mock.test.ts`.
8. Optional wrappers must distinguish not-found from operational failure — covered in `test/service-mock.test.ts`.
9. Codec batch concurrency option must do real concurrent work — covered in `test/codec.test.ts`.
10. JWT expiry parsing must handle padded/unpadded base64url — covered in `test/jwt.test.ts`.
11. Limited consumer collection must stop iterators — covered in `test/service-mock.test.ts`.

## Remediation commit ledger

Path-scoped commits for this scrutiny wave:

- `302b7bf2 fix(msh): recover auth after credential retry`
- `4658eabd refactor(@tmnl/msh): model auth lifecycle signals`
- `285115fd test(@tmnl/msh): cover auth lifecycle signals`
- `b043e5b0 docs(@tmnl/msh): record auth lifecycle remediation`
- `20e3482c fix(msh): isolate hub fanout decoding`
- `99e4c38f fix(msh): wire JetStream start sequence`
- `68e8492f fix(@tmnl/msh): match subject specs token-wise`
- `d948688e test(@tmnl/msh): reject subject literal token drift`
- `a787b526 test(@tmnl/msh): cover subject literal boundaries`
- `a5c554c6 docs(@tmnl/msh): record subject matching remediation`
- `1bc2ec26 fix(msh): query subject patterns token-wise`
- `cb7abbfb fix(msh): await NATS connection release`
- `8c9e7092 docs(@tmnl/msh): record connection finalizer remediation`
- `7fdf5c13 fix(msh): lazy JetStream manager access`
- `c1fd8cdd fix(msh): reject mismatched stream ensure`
- `5a323380 fix(msh): preserve operational optional errors`
- `9e010fb7 fix(msh): normalize JWT expiry payload padding`
- `c69de124 fix(msh): stop collected consumer iterators`
- `4ed17d35 fix(msh): honor codec batch concurrency`
