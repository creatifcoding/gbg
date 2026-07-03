# RFC: PCT/LNK/MSH Permission and ACL Matrix

Date: 2026-05-25
Status: feature plan
Parent: `#F1124 Feature-plan permission and ACL matrix`
Research task: `#4095`
Design task: `#4096`

## Intent

Map the current authentication and permission surfaces across MSH, LNK, and PCT,
then define the production hardening plan for least-privilege NATS ACLs, HTTP
route authorization, and diagnostics.

Short version: MSH already has the cryptographic substrate. PCT/LNK do not yet
thread that substrate through their production config surfaces, and the NATS
control plane relies almost entirely on broker ACLs that we have not made
explicit. A glamorous little footgun, Prime. We are naming it before it names us.

## Research evidence

### Repo evidence

- `packages/msh/src/auth/schemas.ts`
  - Canonical MSH auth modes are Schema-backed:
    - `NKeyAuth`
    - `JwtAuth`
    - `CredsAuth`
    - `TokenAuth`
  - Secrets use `Schema.Redacted` for seeds/tokens/inline creds.
  - Auth state is an explicit 8-state FSM.
- `packages/msh/src/auth/service.ts`
  - `MshAuthService` converts configured auth modes into `nats.ws`
    authenticators.
  - It tracks safe metadata only: mode, state, public key, source type.
  - It fails closed on invalid lifecycle transitions or missing credentials.
- `packages/msh/src/auth/jwt.ts`
  - `MshJwtService` can construct operator/account/user/service activation JWTs.
  - `JwtPermissions` supports `pub`, `sub`, and response permission blocks.
  - Account/user limits are represented with Schema-backed structures.
- `packages/msh/src/nats/connection.ts`
  - `NatsConnectionService` accepts `MshConfig.auth` and passes the resolved
    authenticator to `nats.ws.connect`.
  - `MshConfig` is therefore the substrate seam that PCT/LNK must expose if they
    want authenticated NATS connections.
- `packages/msh/test/live-token-auth.test.ts`
  - Token auth is proven against real `nats-server` authorization config.
- `packages/msh/test/live-jwt-auth.test.ts`
  - NKey, JWT, and creds auth are proven against real `nats-server`, including
    operator/account/user JWTs with MEMORY resolver.
  - The test explicitly notes that infrastructure clients need `$JS.API.>` and
    `_INBOX.>` for JetStream manager request/reply.
- `packages/msh/src/diagnostics/MshDiagnostics.ts`
  - Existing diagnostics already know the operational failure modes:
    - core flush → connectivity/core request permission;
    - JetStream manager access → `$JS.API.>` publish and `_INBOX.>` subscribe;
    - stream info → stream-info permissions;
    - KV bucket read → KV read permissions;
    - auth metadata → credential source availability.
- `packages/lnk/src/services/wire/nats-bridge/MshBridgeWire.ts`
  - `MshBridgeWireOptions` includes NATS connection fields but **does not expose
    `auth`**.
  - `connectionConfig()` passes servers/name/reconnect/debug only.
- `packages/pct/src/config/PactConfig.ts`
  - `lnk.msh` and `natsControl` expose servers/name/reconnect/debug but **do not
    expose `auth`, credentials, user JWTs, or private inbox prefixes**.
- `packages/pct/src/cli/serve.ts`
  - `mshBridgeOptionsFromConfig()` and `natsControlConnectionOptionsFromConfig()`
    do not thread `MshConfig.auth`.
  - NATS control-plane hosting therefore cannot currently authenticate through
    normal `pact serve` config.
- `packages/pct/src/server/Routes.ts`
  - HTTP PCT routes are currently unauthenticated:
    - `GET /capabilities`
    - `GET /schemas/:schemaId`
    - `POST /publish`
    - `POST /publish/procedure`
    - `POST /publish/group`
- `packages/pct/src/federation/eventlog-remote/Server.ts`
  - EventLogRemote has session challenge authentication, but policy is currently
    memory-local and public-key based with no allowlist/capability matrix.
  - Once authenticated, the code gates only the store id, not operation-level
    role policy.
- `packages/pct/src/server/NatsControlPlane.ts`
  - PCT hosts `schema.get` and `capabilities.get` through MSH's generic micro
    endpoint host.
  - There is no app-layer auth policy at the endpoint; access is expected to be
    enforced by NATS account/subject permissions.
- `packages/pct/src/client/NatsSchemaResolverLayer.ts`
  - Client-side schema resolution publishes to `${subjectRoot}.schema.get` and
    expects request/reply over core NATS.
  - It receives the NATS connection from `NatsConnectionService`; it does not own
    auth itself.
- `packages/msh/src/core/auth/schemas.ts`
  - Stranded older domain-style permission schemas exist (`stream:read`,
    `stream:write`, etc.) but are not imported by MSH/LNK/PCT. Do not extend this
    ghost surface without an explicit migration decision.

### External / DeepWiki evidence

- Official NATS authorization docs state that permissions are subject-level,
  per-user publish/subscribe allow/deny rules, with wildcards and deny taking
  priority over allow. Source:
  https://docs.nats.io/running-a-nats-service/configuration/securing_nats/authorization
- The same docs state request/reply must not forget reply subjects such as
  `_INBOX.>`, and that `allow_responses` can dynamically allow service responders
  to publish to reply subjects. Source:
  https://docs.nats.io/running-a-nats-service/configuration/securing_nats/authorization
- NATS private-inbox examples show that broad `_INBOX.>` subscription lets one
  user snoop another user's replies; explicit inbox prefixes plus matching ACLs
  prevent this. Source:
  https://natsbyexample.com/examples/auth/private-inbox/cli
- NATS JWT docs describe operator → account → user trust chains and user JWT
  permissions/limits. Source:
  https://docs.nats.io/running-a-nats-service/configuration/securing_nats/auth_intro/jwt
- NATS JetStream API docs list admin/control subjects:
  - `$JS.API.INFO`
  - `$JS.API.STREAM.CREATE.*`
  - `$JS.API.STREAM.INFO.*`
  - `$JS.API.STREAM.UPDATE.*`
  - `$JS.API.STREAM.DELETE.*`
  - `$JS.API.CONSUMER.*`
  - `$JS.API.CONSUMER.MSG.NEXT.<stream>.<consumer>`
  - `$JS.ACK.<stream>.>`
  - `$JS.EVENT.ADVISORY.>` / `$JS.EVENT.METRIC.>`
  Source: https://github.com/nats-io/nats.docs/blob/master/using-nats/jetstream/nats_api_reference.md
- `nats.ws` service framework documents service discovery/control subjects:
  - `$SRV.PING`
  - `$SRV.STATS`
  - `$SRV.INFO`
  - and name/id-qualified variants.
  Source: `packages/msh/node_modules/nats.ws/lib/nats-base-client/service.d.ts`
- DeepWiki on `nats-io/nats-server` confirmed:
  - user/JWT permissions are `pub`/`sub` allow/deny subject lists;
  - service response permissions are a separate response-permission block;
  - JetStream manager/admin paths use `$JS.API.*` subjects;
  - KV is JetStream-backed and must be treated as JetStream + KV subject access;
  - monitoring endpoints are HTTP surfaces, not NATS subject permissions.

## Boundary decisions

1. **MSH remains substrate-only.**
   MSH may expose auth modes, JWT construction, NATS connection auth, and helper
   ACL rendering primitives. It must not decide that `schema.get` means public or
   that `lnk.stream.append` means producer. That policy belongs above it.

2. **LNK owns Durable Streams roles.**
   LNK maps stream semantics to NATS/JetStream/KV subjects. It owns producer,
   reader, provisioner, metadata CAS, and diagnostics role shapes.

3. **PCT owns control-plane roles.**
   PCT maps `schema.get`, `capabilities.get`, `publish`, EventLogRemote changes,
   and projection control endpoints to read/write/admin roles.

4. **NATS broker ACLs are the first enforcement boundary for NATS services.**
   PCT micro endpoints may later add app-layer capability checks, but the
   minimum production boundary is explicit NATS account/user permissions.

5. **HTTP routes need their own policy.**
   NATS ACLs do nothing for `GET /schemas` or `POST /publish`. PCT HTTP auth is
   a separate hardening lane in the same feature.

6. **Private inbox prefixes are not optional for multi-tenant production.**
   Broad `_INBOX.>` subscribe is acceptable in tests and single-tenant dev only.
   Production clients need isolated inbox prefixes or account isolation.

## Current gaps

### G1 — Config cannot express authenticated PCT/LNK NATS connections

`MshConfig` supports auth; `pact serve` and LNK `MshBridgeWireOptions` do not.
This blocks production `pact serve` from connecting to an authenticated NATS
cluster without programmatic layer surgery.

### G2 — No explicit NATS ACL profiles

We have subject roots (`pct.v1`, `_tmnl.lnk.stream`, `pct.v1.projection`) but no
canonical matrix that says which role may pub/sub which subjects.

### G3 — Control-plane services rely on implied broker policy

PCT NATS control-plane endpoints have no app-layer authorization. That is fine
if broker ACLs are crisp; currently they are not documented or generated.

### G4 — HTTP publish routes are open by default

`POST /publish*` mutates registry state with no auth policy. This is a production
non-starter; a registry node should not be writable by every charming stranger
with curl.

### G5 — EventLogRemote session auth lacks policy binding

The session challenge proves key possession, but there is no configured allowlist
or role map tying public keys to read/write/replicate privileges.

### G6 — Diagnostics observe symptoms, not role compliance

Diagnostics can say `$JS.API` failed; they cannot yet say “this node is supposed
to be `lnk-reader`, therefore it is missing `sub _INBOX_reader.>` and
`pub $JS.API.CONSUMER.MSG.NEXT...`.”

### G7 — Legacy MSH domain permission schemas are stranded

`packages/msh/src/core/auth/schemas.ts` has older `stream:*` permission concepts.
No current code imports them. They should be archived, removed, or explicitly
migrated — not accidentally revived.

## Proposed role matrix

This matrix is intentionally split between **current broad profile** and
**target least-privilege profile**. The broad profile reflects what today's code
needs because setup and runtime concerns are still sharing connections. The
least-privilege profile is the direction of travel.

### NATS substrate roles

| Role | Owner | Current broad permissions | Target profile |
| --- | --- | --- | --- |
| `msh-admin` | ops/MSH | `pub >`, `sub >` or JWT admin user | reserved for provisioning and emergency diagnostics only |
| `msh-js-admin` | ops/MSH | `pub $JS.API.>`, `sub _INBOX.>` plus stream subjects | stream/consumer/KV create/update/delete/info for selected prefixes only |
| `msh-monitor-http` | ops | HTTP access to `/healthz`, `/varz`, `/connz`, `/jsz` | network-policy protected; not represented as NATS subject ACL |
| `msh-service-discovery-client` | ops/PCT | `pub $SRV.PING.>`, `pub $SRV.INFO.>`, `pub $SRV.STATS.>`, `sub _INBOX.>` | same, but with private inbox prefix |

### PCT control-plane roles

Assume `pctRoot = pct.v1` or `_tmnl.pct.v1`.

| Role | Purpose | Publish allow | Subscribe allow | Notes |
| --- | --- | --- | --- | --- |
| `pct-schema-client` | LNK typed binding / remote clients | `${pctRoot}.schema.get` | private inbox prefix | No publish routes; read-only. |
| `pct-capabilities-client` | discovery/read-only status | `${pctRoot}.capabilities.get` | private inbox prefix | Can be merged with schema client. |
| `pct-control-plane-host` | service responder | `$SRV.PING.>`, `$SRV.INFO.>`, `$SRV.STATS.>` only if host self-query is needed; otherwise none | `${pctRoot}.schema.get`, `${pctRoot}.capabilities.get`, `$SRV.PING.>`, `$SRV.INFO.>`, `$SRV.STATS.>` | Prefer `allow_responses` for replies instead of broad `_INBOX.>` publish. |
| `pct-registry-publisher-http` | HTTP registry mutation | n/a | n/a | Enforced by PCT HTTP auth, not NATS. |
| `pct-eventlog-remote-peer` | EventLogRemote Flow C | n/a for HTTP | n/a for HTTP | Must map public key → allowed store/ops. |

### Projection NATS control roles

Assume `projectionRoot = pct.v1.projection`.

| Role | Publish allow | Subscribe allow | Notes |
| --- | --- | --- | --- |
| `projection-control-client-read` | `${projectionRoot}.status`, `${projectionRoot}.tail` | private inbox prefix | Operator/status only. |
| `projection-control-client-admin` | `${projectionRoot}.plan`, `${projectionRoot}.start`, `${projectionRoot}.stop`, `${projectionRoot}.run_once`, `${projectionRoot}.status`, `${projectionRoot}.tail` | private inbox prefix | Requires human/operator or automation credential. |
| `projection-worker-host` | none, plus response permission | `${projectionRoot}.plan`, `${projectionRoot}.start`, `${projectionRoot}.stop`, `${projectionRoot}.status`, `${projectionRoot}.run_once`, `${projectionRoot}.tail`, `$SRV.>` | Use `allow_responses`; app semantics stay in PCT. |

### LNK Durable Streams roles

Assume:

- `lnkSubjectRoot = _tmnl.lnk.stream`
- `streamNamePrefix = LNK`
- `metadataBucket = LNK_META`
- subject for stream id `x` is `${lnkSubjectRoot}.${safeStreamToken(x)}`
- backing JetStream stream is `${streamNamePrefix}_${safeStreamToken(x)}`

| Role | Current broad permissions | Target profile |
| --- | --- | --- |
| `lnk-bridge-combined` | `pub $JS.API.>`, `sub _INBOX.>`, `pub ${lnkSubjectRoot}.>`, KV/JS access for metadata bucket | Existing `MshBridgeWire.layer` effectively needs this until provisioner/producer/reader paths split. |
| `lnk-provisioner` | same as broad | create/update/info/delete selected LNK streams, create/read/update metadata KV bucket, no app data reads unless needed for verification |
| `lnk-producer` | same as broad today | `pub ${lnkSubjectRoot}.<stream-token>` plus metadata read/update if producer sequencing remains metadata-coupled; no consumer read subjects |
| `lnk-reader` | same as broad today | metadata read, consumer create/info/msg-next for selected streams, private inbox prefix, `$JS.ACK.<stream>.>` publish |
| `lnk-diagnostics` | `$JS.API.INFO`, stream info, KV read, private inbox | no data append/delete; may subscribe advisories/metrics if enabled |

### HTTP PCT roles

| Role | HTTP routes | Notes |
| --- | --- | --- |
| `pct-http-public-read` | `GET /capabilities`, `GET /schemas/:schemaId` | Optional public mode; safe only if schema documents are non-sensitive. |
| `pct-http-registry-writer` | `POST /publish`, `POST /publish/procedure`, `POST /publish/group` | Must require bearer/JWT/session auth. |
| `pct-http-federation-peer` | EventLogRemote path | Public key challenge + configured allowlist/role policy. |
| `pct-http-admin` | future diagnostics/admin routes | Should be distinct from registry writer. |

## Config shape proposal

Define these with Effect Schema in implementation, not raw TS-only types.

### Shared NATS auth reference

```ts
NatsAuthRef =
  | { _tag: "none" }
  | { _tag: "token-env"; variable: string; user?: string }
  | { _tag: "creds-file"; path: string; watchForChanges?: boolean }
  | { _tag: "creds-env"; variable: string }
  | { _tag: "jwt-env"; jwtVariable: string; seedVariable?: string }
```

This should decode to MSH `MshAuthMode` at the boundary. Avoid duplicating MSH
secret-bearing classes in PCT config files unless the redaction story is explicit.

### PCT config additions

```ts
natsControl: {
  auth?: NatsAuthRef
  inboxPrefix?: string
  permissionProfile?: "dev-open" | "schema-reader" | "control-plane-host" | "operator-admin"
}

lnk: {
  msh: {
    auth?: NatsAuthRef
    inboxPrefix?: string
    permissionProfile?: "dev-open" | "bridge-combined" | "provisioner" | "producer" | "reader"
  }
}

httpAuth: {
  mode: "disabled" | "bearer" | "eventlog-session"
  publicRead: boolean
  bearerEnv?: string
  writers?: string[]
  federationPeers?: Array<{ publicKey: string; stores: string[]; operations: string[] }>
}
```

## Implementation slices

### Slice A — Formalize permission contracts

Deliverables:

- Effect Schema contracts for:
  - `NatsAuthRef`
  - `NatsPermissionProfile`
  - `PctHttpAuthPolicy`
  - `RolePermissionMatrix`
- RFC-backed tests that decode example config snippets.
- Explicit decision on stranded `packages/msh/src/core/auth/schemas.ts`:
  archive/remove/adapt, but no silent reuse.

### Slice B — Thread MSH auth through LNK and PCT config

Deliverables:

- Add `auth?: MshConfigInput["auth"]` or decoded equivalent to
  `MshBridgeWireOptions`.
- Pass auth through `connectionConfig()`.
- Add PCT config fields for `lnk.msh.auth` and `natsControl.auth`.
- Update `mshBridgeOptionsFromConfig()` and
  `natsControlConnectionOptionsFromConfig()`.
- Add env/file config tests with redaction-safe behavior.

### Slice C — Private inbox support

Deliverables:

- Add optional `inboxPrefix` to MSH connection/config boundary if supported by
  `nats.ws` connection options.
- Expose it in PCT `natsControl` and LNK MSH bridge config.
- Add tests proving request/reply clients can use scoped inbox subjects.
- Document dev-only status of broad `_INBOX.>`.

### Slice D — ACL profile renderer

Deliverables:

- PCT-owned profile renderer that emits:
  - NATS server `authorization.users[].permissions` snippets; and/or
  - MSH `UserJwtRequest.permissions` structures.
- Profiles for:
  - PCT schema reader;
  - PCT control-plane host;
  - projection control reader/admin/host;
  - LNK bridge-combined;
  - LNK provisioner/producer/reader/diagnostics.
- Snapshot tests for generated allow/deny lists.

### Slice E — HTTP authorization policy

Deliverables:

- PCT HTTP auth middleware/service.
- Preserve explicit public-read mode for `GET /capabilities` and
  `GET /schemas/:schemaId`.
- Protect `POST /publish*` by default when production mode is enabled.
- Bind EventLogRemote public keys to configured stores and operations.
- Add route tests for unauthorized/forbidden/not-found behavior.

### Slice F — Diagnostics/doctor permission probes

Deliverables:

- Permission profile-aware diagnostics:
  - expected role → expected NATS actions;
  - run safe probes;
  - report missing subject/action with remediation.
- PCT/LNK/MSH rollup that distinguishes auth failure from permission failure.
- Redaction audit for all findings.

### Slice G — Live auth/ACL tests

Deliverables:

- Local live NATS tests using generated auth config/JWT permissions.
- Positive path:
  - schema reader can call `schema.get` but cannot publish registry writes;
  - LNK producer can append but not consume;
  - LNK reader can consume but not append;
  - projection read client can status/tail but not start/stop.
- Negative path:
  - unauthorized NATS requests fail;
  - HTTP publish fails without writer credentials;
  - EventLogRemote rejects unallowed public keys.

### Slice H — Ops/Kubernetes secret surface

Deliverables:

- Document Kubernetes secret/env mounting for token/creds/JWT modes.
- Provide Helm/kind examples that keep monitor endpoints cluster-internal.
- Keep NACK ownership caveat from the soak plan: do not let a controller
  reconcile app-owned dynamic streams unless ownership is explicit.

## Proposed follow-on implementation feature

Create a follow-on feature under `#F1121`:

- Feature: `PCT/LNK/MSH Permission and ACL Hardening`
  - A: Permission contract schemas and stranded-auth cleanup decision
  - B: Thread MSH auth through LNK/PCT config
  - C: Private inbox support and request/reply isolation
  - D: NATS ACL profile renderer
  - E: PCT HTTP auth policy
  - F: Permission-aware diagnostics/doctor probes
  - G: Live auth/ACL proof tests
  - H: Ops/Kubernetes secret examples

## Recommendation

Do this in two movements:

1. **Connection auth + config threading first.** Without this, no authenticated
   NATS cluster can be driven from normal `pact serve` config. This is the
   smallest production-unblocking slice.
2. **ACL renderer + diagnostics second.** Once config can authenticate, generate
   and verify least-privilege permissions. Humans should not hand-maintain
   `$JS.API.CONSUMER.MSG.NEXT.<stream>.<consumer>` strings at 2 a.m. That is how
   outages acquire folklore.
