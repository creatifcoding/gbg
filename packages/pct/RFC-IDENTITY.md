# RFC: Scoped Identity Architecture for PCT / Lnk / MSH

Status: Draft 0.1  
Scope: `@tmnl/pct` identity, federation authorization, Lnk/MSH integration boundaries  
Predecessors: Flow B/B+ federation, Flow C EventLogRemote spike

## 1. Intent

PCT needs production identity without turning every subsystem into an identity issuer.

The hard problem is not “load a key from disk.” The hard problem is that one local entity may participate in several systems at once:

- PCT registry publishing
- Effect-smol EventLogRemote replication
- Lnk stream/data surfaces
- MSH/NATS transport
- operator CLI actions
- future UI/user-agent surfaces

Those systems need different audiences, permissions, expiry policies, and revocation behavior. Passing one global keypair everywhere would create identity sprawl, privilege bleed, and an unpleasant little security compost heap. Prime, let us not build that.

This RFC defines a scoped identity model:

1. one protected **local root** per node/entity;
2. explicit **scoped identities** issued from that root;
3. remote peers represented by public descriptors only;
4. operation protection via capability grants bound to identity, audience, resource, and action.

## 2. Source-grounded facts

Local Effect-smol source is authoritative.

### 2.1 `EventLog.Identity`

`submodules/effect-smol/packages/effect/src/unstable/eventlog/EventLog.ts` defines `Identity` as:

```ts
{
  publicKey: string
  privateKey: Redacted<Uint8Array>
}
```

It also exposes:

- `encodeIdentityString(identity)`
- `decodeIdentityString(value)`
- `makeIdentity`

### 2.2 Current Effect-smol generated identity

`EventLogEncryption.makeEncryptionSubtle(...).generateIdentity` currently creates:

```ts
{
  publicKey: crypto.randomUUID(),
  privateKey: Redacted.make(crypto.getRandomValues(new Uint8Array(32)))
}
```

Important correction: despite the field name, this `publicKey` is currently an identity label, not by itself a verification public key derived from the private secret.

### 2.3 Derived cryptographic material

`internal/identityRootSecretDerivation.ts` derives material from `EventLog.Identity.privateKey`:

- AES-GCM encryption material using label `effect/eventlog/identity/v1/encryption`
- Ed25519 signing material using label `effect/eventlog/identity/v1/signing`
- exported Ed25519 `signingPublicKey`

Session authentication in `EventLogSessionAuth.ts` uses this derived signing material.

Therefore PCT must not claim that `nodeId = hash(EventLog.Identity.publicKey)` cryptographically verifies a signature. Today it only gives stable addressing if the identity file is stable. Verification requires the derived signing public key or another explicit public verification key.

## 3. Problem statement

Current PCT identity layers provide `Pact.Identity` and `EventLog.Identity` together. That was acceptable for tests and early federation. It is not sufficient for production because:

1. `EventLog.Identity` contains root secret material and should not be broadly injectable.
2. Different systems need different authority scopes.
3. Remote identity must never be represented by local private identity services.
4. Capability checks must be local policy decisions, not accidental trust in a transport session.
5. NATS/MSH credentials may be related to the node but should not be equivalent to PCT registry authority.

## 4. Design principles

1. **Root stays local**  
   The local root secret is never put into generic service context outside the identity authority boundary.

2. **Scope before use**  
   Subsystems request an identity for a purpose and audience. They do not receive “the identity.”

3. **Remote is public-only**  
   Remote peers are descriptors, trust records, and capability grants. They are not local identity services.

4. **Capabilities protect operations**  
   Authorization is bound to `(subject, audience, resource, action)` with optional expiry and revocation.

5. **Transport auth is not enough**  
   EventLogRemote session auth, NATS auth, and HTTP TLS are necessary but not sufficient. PCT write boundaries still check capabilities.

6. **Do not conflate coordinate systems**  
   PCT registry revisions, EventJournal remote sequences, NATS stream sequence numbers, and capability revisions are separate.

## 5. Core model

### 5.1 Local root identity

The local root identity is the protected authority for one node/entity.

Conceptual schema:

```ts
LocalRootIdentity = {
  _tag: "LocalRootIdentity"
  rootId: RootId
  createdAt: number
  publicDescriptor: RootPublicDescriptor
  privateMaterialRef: SecretRef
}
```

`privateMaterialRef` may point to:

- local encrypted file
- process secret provider
- OS keychain
- HSM/KMS/vault in future

PCT’s current `layerPersistent({ filePath })` is a bootstrap implementation of this, but it still exposes `EventLog.Identity` directly. That should become an implementation detail behind an authority service.

### 5.2 Scoped identity

A scoped identity is issued for a purpose and audience.

Conceptual schema:

```ts
ScopedIdentity = {
  _tag: "ScopedIdentity"
  subjectId: SubjectId
  rootId: RootId
  scope: IdentityScope
  audience: Audience
  publicKeys: PublicKeySet
  proof: RootSignature | CertificateChain
  expiresAt?: number
}
```

Scopes are explicit:

```ts
IdentityScope =
  | "pct.registry.publish"
  | "pct.registry.replicate"
  | "pct.eventlog.remote"
  | "lnk.stream.read"
  | "lnk.stream.write"
  | "msh.nats.transport"
  | "operator.cli"
```

Initial implementation may issue scoped identities by generating scoped key material and signing the public descriptor with the local root. Deterministic derivation is attractive, but must be implemented deliberately and not by depending on Effect-smol internal helper modules as public API.

### 5.3 Remote identity

Remote identity is public metadata plus local trust state.

```ts
RemoteIdentity = {
  _tag: "RemoteIdentity"
  subjectId: SubjectId
  rootId?: RootId
  descriptor: PublicIdentityDescriptor
  trust: "unknown" | "pinned" | "trusted" | "revoked"
  seenAt: number
}
```

Remote identity records may be discovered through:

- PCT federation handshake
- EventLogRemote authentication
- MSH/NATS discovery
- operator pinning

But discovery does not imply authorization. Authorization comes from grants.

## 6. Capability grants

PCT protection should use capability grants rather than ambient roles.

Conceptual schema:

```ts
CapabilityGrant = {
  _tag: "CapabilityGrant"
  grantId: string
  subjectId: SubjectId
  issuerId: SubjectId
  audience: Audience
  resource: ResourceRef
  actions: ReadonlyArray<Action>
  issuedAt: number
  expiresAt?: number
  revokedAt?: number
  proof: Signature
}
```

Examples:

```ts
CanPublishSchema = {
  audience: "pct.registry",
  resource: "schema:*",
  actions: ["registry.schema.register"]
}

CanReplicateRegistry = {
  audience: "pct.eventlog.remote",
  resource: "store:pct:registry",
  actions: ["eventlog.changes", "eventlog.write"]
}

CanWriteStream = {
  audience: "lnk.wire",
  resource: "stream:vitals/*",
  actions: ["stream.append"]
}
```

Capability checks belong at write and sync boundaries:

- `Notary.registerSchema`
- `Notary.publishProcedure`
- `Federation.peer` / sync initiation
- EventLogRemote server `onWrite` and `changes`
- future Lnk Wire backend writes
- MSH/NATS bridge boundaries

## 7. Service architecture

### 7.1 Proposed services

```txt
IdentityAuthority
├── localRootDescriptor
├── issueScopedIdentity(scope, audience)
├── scopedEventLogIdentity(scope, audience)
├── resolveRemoteIdentity(descriptor)
└── verifyCapability(grant, request)

Pact.Identity
└── public node/addressing descriptor only

EventLog.Identity
└── provided only to narrow scoped substrate layers
```

### 7.2 `IdentityAuthority`

The authority is the only service that can touch root private material.

Sketch:

```ts
interface IdentityAuthorityShape {
  readonly localRoot: Effect<RootPublicDescriptor>
  readonly issue: (
    request: ScopedIdentityRequest,
  ) => Effect<ScopedIdentityHandle, IdentityError>
  readonly verify: (
    request: CapabilityCheck,
  ) => Effect<CapabilityDecision, IdentityError>
}
```

`ScopedIdentityHandle` should expose minimal operations or narrowly scoped material:

- public descriptor
- sign function
- optional encrypted export for substrate adapters
- optional `EventLog.Identity` only for Effect-smol EventLogRemote integration

It should not be a generic root keypair.

### 7.3 PCT public identity

`Pact.Identity` should become a public/addressing surface:

```ts
{
  nodeId: NodeId
  nodeUrl: Option<string>
  rootId?: RootId
  publicDescriptor?: PublicIdentityDescriptor
}
```

It should not imply possession of root private material.

## 8. NodeId and public-key architecture

Current code derives `nodeId` from `EventLog.Identity.publicKey`. Given Effect-smol’s current implementation, this is only a stable label hash.

Production PCT should move to:

```txt
nodeId = pct:<fingerprint(root public descriptor)>
```

Where the root public descriptor includes verification material, not merely an opaque UUID label.

Until that migration lands:

- keep current `nodeId` derivation for compatibility;
- document it as an address identifier, not a cryptographic proof;
- add a `rootId` / descriptor field before relying on cryptographic verification.

## 9. Local / remote separation

### Local

Local identity APIs may issue scoped handles. They may access private material through `IdentityAuthority`.

### Remote

Remote identity APIs may store and verify public descriptors, pin peer descriptors, and evaluate grants. They never expose `EventLog.Identity` or any private material.

### Anti-patterns

Forbidden:

```ts
// broad root secret in application context
Layer.provide(EventLog.Identity, rootIdentity)

// same identity silently used for registry, NATS, CLI, and stream writes
const identity = yield* EventLog.Identity
```

Preferred:

```ts
const authority = yield* IdentityAuthority
const registryIdentity = yield* authority.issue({
  scope: "pct.registry.publish",
  audience: "pct.registry",
})
```

## 10. NATS / MSH implications

NATS credentials should not become PCT registry identity.

Likely mapping:

| System | Identity use | Storage/issuer |
| --- | --- | --- |
| PCT registry | publish/deprecate schemas and operations | scoped PCT identity |
| EventLogRemote | authenticate changes/write for `pct:registry` store | scoped EventLog identity |
| Lnk Wire | read/write streams | scoped Lnk identity |
| MSH/NATS | transport authentication and subjects | MSH-issued credential bound to PCT descriptor |
| Operator CLI | local privileged actions | operator-scoped identity or local root unlock |

NATS KV/streams may reference identity descriptors and grants, but must not silently authorize PCT registry writes by virtue of NATS connectivity alone.

## 11. Configuration direction

Future config shape:

```json
{
  "identity": {
    "root": {
      "provider": "file",
      "filePath": ".pct/identity/root.identity"
    },
    "node": {
      "url": "http://127.0.0.1:8080"
    },
    "scopes": {
      "pct.registry": { "mode": "derived" },
      "pct.eventlogRemote": { "mode": "derived" },
      "lnk.wire": { "mode": "derived" },
      "msh.nats": { "mode": "external" }
    }
  }
}
```

Environment variables:

```txt
PCT_IDENTITY_ROOT_PROVIDER=file
PCT_IDENTITY_ROOT_FILE_PATH=.pct/identity/root.identity
PCT_IDENTITY_NODE_URL=http://127.0.0.1:8080
```

## 12. Migration plan

### Step 1 — RFC and comment correction

- Land this RFC.
- Correct code comments that imply `EventLog.Identity.publicKey` is sufficient cryptographic verification material.

### Step 2 — Schema contracts

Add `src/identity/IdentityContracts.ts` with Effect Schema definitions for:

- `RootId`
- `SubjectId`
- `Audience`
- `IdentityScope`
- `PublicIdentityDescriptor`
- `ScopedIdentityDescriptor`
- `RemoteIdentity`
- `CapabilityGrant`

Use `Schema.TaggedStruct` for grants/descriptors.

### Step 3 — IdentityAuthority

Add `IdentityAuthority` as the root private-material boundary.

Initial implementation:

- wraps current persistent `EventLog.Identity` file;
- issues narrow scoped handles;
- can produce the Effect-smol `EventLog.Identity` required by EventLogRemote;
- does not expose the root identity broadly.

### Step 4 — Serve config

Wire identity config into `pact serve`:

- dev/test default may remain ephemeral;
- production config uses persistent authority;
- `Pact.Identity` becomes public descriptor/address surface.

### Step 5 — Capability enforcement

Add capability checks to write/sync boundaries.

Initial policy may be permissive for local dev, but production mode should require explicit grants.

### Step 6 — MSH/NATS binding

After MSH contract review, bind NATS credentials to scoped identity descriptors/grants. Do not make NATS auth the PCT authorization system.

## 13. Non-goals

- No bespoke identity system that replaces Effect-smol authentication internals.
- No direct dependency on Effect-smol internal helper modules as public API.
- No single global identity service that every subsystem can consume.
- No raw NATS/JetStream adapter in Lnk before MSH seam review.
- No hard requirement for external vault/KMS in the first production pass.

## 14. Open questions

1. Should scoped identities be deterministic derivations or generated child keys signed by the root?
2. What is the stable wire format for root/scoped public descriptors?
3. Do capability grants live in the PCT registry, a separate grant store, or both?
4. Should local operator actions be backed by root unlock, separate operator key, or OS user trust?
5. How much of this can reuse Effect-smol exported APIs without depending on internals?

## 15. Ratified direction for next work

Current direction from alignment:

1. Draft scoped identity RFC.
2. Implement Postgres-backed Effect-smol `SqlEventJournal` path.
3. Review MSH/NATS seam and decide NATS KV/stream role.
4. Finish with live two-server EventLogRemote convergence.

The identity work must land before expanding transport complexity. Otherwise every adapter will invent its own identity story, and then we will be debugging authorization archaeology instead of building a federation substrate.
