# RFC-001 Section: Security Architecture

```
Section:       Security Architecture
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (security-splitter)
Created:       2026-02-09
Predecessor:   rfc-section-security-trust.md (Sections Z.2-Z.5, Z.8-Z.9, Z.12)
Research Base: research-consistency-models.md (Sections 8.4, 8.11)
               research-cluster-patterns.md (Section 5)
               research-effect-architecture.md (Sections 1, 6)
```

> This section specifies the security architecture for entity lifecycle event
> distribution across a metropolitan manufacturing network serving 200,000+
> organizations. It defines the threat model, authentication architecture,
> authorization model, cryptographic requirements, network security boundaries,
> and regulatory compliance mappings. This section is normative for all
> implementations.
>
> File paths are relative to `packages/tmnl/src/`.

---

## Table of Contents

1. [Scope](#s1-scope)
2. [Conventions](#s2-conventions)
3. [Threat Model](#s3-threat-model)
4. [Authentication Architecture](#s4-authentication-architecture)
5. [Authorization Model](#s5-authorization-model)
6. [Cryptographic Requirements](#s6-cryptographic-requirements)
7. [Network Security](#s7-network-security)
8. [Security Compliance](#s8-security-compliance)
9. [Codebase Grounding](#s9-codebase-grounding)

---

## S.1 Scope

This section addresses the security architecture for the TMNL metropolitan
manufacturing network. It covers:

- **Threat landscape** specific to multi-tenant manufacturing networks
- **Authentication** for edge devices, human operators, cloud services, and
  cross-organization interactions
- **Authorization** at NATS subject, RPC, and entity levels
- **Cryptographic primitives** for transport, storage, and identity
- **Network security boundaries** leveraging NATS account isolation
- **Regulatory compliance** mappings for IEC 62443, NIST CSF, FDA 21 CFR Part 11,
  and ISA-18.2

This section does NOT cover:

- Trust scoring and reputation (see `rfc-section-trust-model.md`)
- Tenant data isolation mechanics (see `rfc-section-tenant-isolation.md`)
- Application-level access control patterns within the UI

**Companion sections**:

- `rfc-section-trust-model.md` -- G-10 trust score, anti-fraud, trust lifecycle
- `rfc-section-tenant-isolation.md` -- NATS account isolation, data partitioning,
  compute isolation, audit
- `rfc-section-two-domain-consistency.md` -- Normative ordering guarantees (G-1
  through G-8)
- `rfc-section-edge-architecture.md` -- Edge-first deployment topology

---

## S.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

---

## S.3 Threat Model

### S.3.1 Metropolitan Manufacturing Network Threat Landscape

The metropolitan manufacturing network presents a threat model distinct from
single-enterprise IIoT deployments. The network interconnects 200,000+
organizations ranging from 2-person machine shops to 500-employee aerospace
facilities. This heterogeneity produces an unusually wide attack surface:

1. **Diverse security postures**: A 2-person shop running an unpatched $50 edge
   device shares network infrastructure with a defense contractor running
   hardened, audited systems.
2. **Competitive co-habitation**: Direct competitors share the same platform,
   creating incentives for industrial espionage that do not exist in
   single-enterprise deployments.
3. **Physical-digital convergence**: Compromised edge devices can affect
   physical manufacturing processes, not just data integrity.
4. **Regulatory heterogeneity**: Organizations span FDA-regulated pharmaceutical
   manufacturing, ITAR-controlled defense work, and unregulated custom
   fabrication. A single platform serves all.

### S.3.2 Threat Actors

| Actor | Motivation | Capability | Likelihood |
|-------|-----------|------------|------------|
| **Compromised org** | Industrial espionage, competitive intelligence | Valid account credentials; can publish/subscribe within own account; may attempt lateral movement via cross-org exports | High |
| **Malicious insider** | Sabotage, data theft, competitive advantage | Valid operator or admin credentials; knowledge of internal subject patterns and entity IDs | Medium |
| **Supply chain attacker** | Firmware backdoors, persistent access | Ability to inject malicious firmware into edge devices; may compromise device attestation chain | Medium |
| **Nation-state actor** | Strategic industrial intelligence, IP theft | Advanced persistent threat; may target platform infrastructure directly; capable of cryptographic attacks on weak primitives | Low (high impact) |
| **Network attacker** | Data interception, session hijacking | Passive eavesdropping or active MITM on network segments between edge and hub | Low (TLS mitigated) |
| **Malicious platform operator** | Access to all org data, surveillance | Infrastructure-level access; can read NATS traffic if not encrypted per-org | Critical if unmitigated |

### S.3.3 Attack Surfaces

| Surface | Entry Point | Threat | Mitigation Reference |
|---------|-------------|--------|---------------------|
| **Edge devices** | MQTT/Sparkplug ingestion, device firmware | Compromised readings, clock manipulation, DoS | S.4.3, S.6.4, S.7.5 |
| **NATS messaging** | Account credentials, subject subscriptions | Cross-org data leakage, message injection | S.4.1, S.5.1, S.7.1 |
| **API endpoints** | WebSocket `/ws/iiot`, HTTP RPCs | Unauthorized entity access, session hijacking | S.4.4, S.5.2, S.6.1 |
| **Cross-org events** | Export/import configuration, marketplace subjects | Data sovereignty violation, false capacity injection | S.5.4, S.7.1 |
| **Platform infrastructure** | Operator keys, NATS cluster nodes, storage | Complete data access, system-wide compromise | S.4.1, S.6.2, S.7.3 |
| **@effect/cluster** | Runner-to-runner communication, shard migration | Entity state corruption, unauthorized shard access | S.4.5, S.6.3 |

### S.3.4 Threat Matrix

The following matrix maps threat actors to attack surfaces with risk ratings
(Likelihood x Impact):

| | Edge Devices | NATS Messaging | API Endpoints | Cross-Org Events | Platform Infra | Cluster |
|---|---|---|---|---|---|---|
| **Compromised org** | Low | **High** | Medium | **High** | Low | Low |
| **Malicious insider** | Medium | **High** | **High** | Medium | Low | Medium |
| **Supply chain** | **High** | Low | Low | Low | Low | Low |
| **Nation-state** | Medium | Medium | Medium | Medium | **Critical** | Medium |
| **Network attacker** | Low | Low | Low | Low | Low | Low |
| **Platform operator** | Low | **Critical** | Medium | **Critical** | **Critical** | **Critical** |

**Key insight**: The platform operator is the highest-risk single point of
compromise. The architecture MUST ensure that operator infrastructure access does
NOT grant access to org data (S.7.2).

---

## S.4 Authentication Architecture

### S.4.1 NATS Decentralized JWT Authentication

Authentication uses NATS' decentralized JWT model [NATS-DECENTRALIZED], which
eliminates the need for a central authentication database:

```
Operator Key (platform root of trust)
  |
  +-- Account Key: earl-machine-shop
  |     +-- User Key: earl-edge-001 (CNC machine gateway)
  |     +-- User Key: earl-edge-002 (secondary gateway)
  |     +-- User Key: earl-operator-01 (human operator)
  |
  +-- Account Key: precision-machining-inc
  |     +-- User Key: pm-edge-001 (factory server)
  |     +-- User Key: pm-cloud-001 (cloud analytics)
  |
  +-- Account Key: manufacturing-commons (system)
        +-- User Key: commons-aggregator
        +-- User Key: commons-monitor
```

**Architecture properties**:

1. **No central auth database**: The NATS server validates the JWT signature
   chain (user -> account -> operator) without querying a central database.
   This means authentication is available even during partial network partitions.
2. **Offline-capable**: The JWT is self-contained. An edge device with a valid
   JWT can authenticate to any NATS server even if the provisioning service is
   unavailable.
3. **Revocation**: JWTs can be revoked via a revocation list published to the
   NATS cluster [NATS-JWT]. Revoked JWTs are rejected on next connection
   attempt.

**Requirements**:

1. The operator key MUST be stored in an HSM or equivalent hardware vault. It
   signs account JWTs but MUST NEVER be transmitted to edge devices or stored
   on internet-accessible systems.
2. Account keys MAY be self-managed by the organization (decentralized model)
   or managed by the platform operator (centralized model). Self-managed keys
   SHOULD be preferred for organizations with security staff.
3. User keys (edge device credentials) MUST be revocable via JWT revocation
   list without requiring device physical access.
4. Account JWTs MUST specify resource limits (see `rfc-section-tenant-isolation.md`
   Section TI.4 for limit specifications).

### S.4.2 Per-Org Account Provisioning

Organizations are provisioned via operator-signed JWTs [NATS-JWT]:

1. A new organization requests onboarding through the platform API.
2. The platform generates an NKey pair (Ed25519) for the organization's account.
3. The operator key signs an account JWT binding the NKey to the org identity.
4. The account JWT is delivered to the organization's administrator via a
   secure channel (TLS-encrypted API response, never email).
5. The organization uses the account key to sign user JWTs for its devices
   and operators.

**Account JWT claims MUST include**:

```json
{
  "name": "earl-machine-shop",
  "sub": "<account NKey public key>",
  "nats": {
    "limits": {
      "conn": 100,
      "data": 10485760,
      "payload": 1048576,
      "subs": 1000
    },
    "exports": [],
    "imports": [],
    "default_permissions": {
      "pub": { "deny": ["$SYS.>"] },
      "sub": { "deny": ["$SYS.>"] }
    }
  }
}
```

### S.4.3 Edge Device Authentication

Edge devices MUST authenticate with credentials that satisfy these requirements:

1. **Unique per device**: Credentials MUST NOT be shared across devices within
   an org. A device credential for `edge-001` MUST NOT authenticate as
   `edge-002`.
2. **Subject-scoped**: The device JWT MUST include subject permissions that
   restrict the device to its own readings: `publish: iiot.readings.{deviceId}`,
   `publish: iiot.alarms.{deviceId}`.
3. **Rotatable**: Credentials MUST be rotatable without device physical access.
   The org's account key re-signs a new user JWT with the same NKey.
4. **Time-bounded**: Device JWTs MUST expire with a configurable TTL
   (RECOMMENDED: 90 days for edge devices).
5. **mTLS for transport**: Edge devices connecting to hub NATS servers MUST use
   mutual TLS (mTLS). The device presents its client certificate; the hub
   presents its server certificate.

**Sparkplug B devices**: Devices connecting via MQTT/Sparkplug B [SPARKPLUG-B]
authenticate at the MQTT broker level. The Sparkplug adapter
(`lib/iiot/adapters/sparkplug-adapter.ts`) validates that the MQTT client
ID matches the expected device identity before accepting metrics.

### S.4.4 Human Authentication

Human operators access the platform via WebSocket connections to `/ws/iiot` or
HTTP API endpoints. Authentication follows an OIDC/OAuth2 -> NATS JWT bridge:

1. The operator authenticates via OIDC (e.g., Azure AD, Okta, Keycloak)
   through the organization's identity provider [OAUTH2].
2. The platform's auth service validates the OIDC token and issues a
   short-lived NATS user JWT scoped to the operator's role (S.5.1).
3. The NATS user JWT has a TTL of RECOMMENDED 24 hours for human operators
   (shorter than edge devices to reflect higher-risk interactive sessions).
4. The operator's role (admin, supervisor, operator, viewer) is encoded in the
   JWT's subject permissions.

**Requirements**:

1. Human operator JWTs MUST carry the operator's identity for FDA 21 CFR Part
   11 audit trail compliance (S.8.1).
2. Session tokens MUST be invalidated on logout.
3. Multi-factor authentication (MFA) SHOULD be required for admin and
   supervisor roles.

### S.4.5 Service-to-Service Authentication within @effect/cluster

Within an organization's cloud infrastructure, `@effect/cluster` [EFFECT-CLUSTER]
runner nodes communicate via the Effect RPC transport. These inter-service
connections use SPIFFE [SPIFFE] identities for mutual authentication:

```
SPIFFE ID format:
  spiffe://org-{orgId}.manufacturing-commons/service/{serviceName}

Examples:
  spiffe://org-earl-machine-shop.manufacturing-commons/service/entity-runner
  spiffe://org-earl-machine-shop.manufacturing-commons/service/api-gateway
  spiffe://org-earl-machine-shop.manufacturing-commons/service/analytics-worker
  spiffe://platform.manufacturing-commons/service/commons-aggregator
```

**Requirements**:

1. Each `@effect/cluster` runner node MUST present a SPIFFE identity when
   communicating with other runner nodes within the same org.
2. SPIFFE identities MUST be scoped to the organization's trust domain. A
   service in `org-earl-machine-shop` MUST NOT present an identity in the
   `org-precision-machining-inc` trust domain.
3. The SPIFFE Workload API SHOULD be used for automatic credential rotation.
   Short-lived X.509-SVIDs (RECOMMENDED: 1-hour TTL) eliminate the need for
   manual certificate management.
4. Platform-level services (commons-aggregator, trust-score-computer) MUST use
   the `platform.manufacturing-commons` trust domain, separate from any org
   trust domain.

**Relationship to NATS authentication**: SPIFFE provides service-to-service
identity within an org's cloud infrastructure. NATS JWTs (S.4.1) provide
device-to-cluster identity for edge devices. Both operate independently:

| Identity System | Scope | Use Case | TTL |
|----------------|-------|----------|-----|
| NATS JWT (S.4.1) | Edge device -> NATS cluster | Device authentication, subject permissions | 90 days |
| OIDC/OAuth2 (S.4.4) | Human -> Platform API | Operator authentication, role mapping | 24 hours |
| SPIFFE X.509-SVID (S.4.5) | Service -> Service (cloud) | Runner-to-runner mTLS, API gateway auth | 1 hour |
| Operator Key (S.4.2) | Platform -> Account | Account provisioning, JWT signing | Long-lived (HSM) |

---

## S.5 Authorization Model

### S.5.1 NATS Subject-Based Authorization

Within an organization's NATS account, role-based access control is enforced via
user JWT subject permissions [NATS-JWT]:

| Role | Publish Permissions | Subscribe Permissions | Notes |
|------|--------------------|-----------------------|-------|
| **Edge Device** | `iiot.readings.{deviceId}`, `iiot.alarms.{deviceId}` | `iiot.commands.{deviceId}` | Scoped to own device ID |
| **Operator** | `iiot.commands.*`, `iiot.overrides.*` | `iiot.readings.*`, `iiot.alarms.*`, `iiot.equipment.*` | Can issue commands; FDA audit required |
| **Supervisor** | `workorders.*`, `iiot.overrides.*` | `iiot.*` (full internal visibility) | Work order lifecycle management |
| **Analytics** | (none -- read-only) | `iiot.readings.*`, `iiot.equipment.*` | Read-only access for BI/analytics |
| **Admin** | `$SYS.>` (system subjects) | `$SYS.>`, `iiot.*` | NATS system administration |

**Requirements**:

1. Edge devices MUST be restricted to publishing only their own device's
   subjects. A device credential for `edge-001` MUST NOT be able to publish
   to `iiot.readings.edge-002`.
2. The Operator role MUST have command actions recorded as `OperatorEvents`
   (`lib/iiot/schemas/events/regulatory/operator-events.ts`).
3. Role assignments are encoded in the user JWT's `pub.allow` and `sub.allow`
   fields [NATS-JWT].
4. Role escalation (e.g., operator -> admin) MUST require re-authentication
   and a new JWT issuance.

### S.5.2 RPC-Level Authorization via Effect Middleware

Beyond NATS subject-level authorization, the RPC layer enforces
application-level access control via Effect middleware [EFFECT-RPCMIDDLEWARE]:

```typescript
// Conceptual middleware -- authorization check before entity access
const AuthorizationMiddleware = RpcMiddleware.make((req) =>
  Effect.gen(function* () {
    const session = yield* SessionContext
    const entityOrgId = yield* extractOrgId(req)

    // Verify the requesting session belongs to the entity's org
    if (session.orgId !== entityOrgId) {
      return yield* Effect.fail(new UnauthorizedError({
        message: `Org ${session.orgId} cannot access entities in org ${entityOrgId}`,
        code: 'CROSS_ORG_ACCESS_DENIED',
      }))
    }

    // Verify the role has permission for this operation
    if (!hasPermission(session.role, req.method)) {
      return yield* Effect.fail(new ForbiddenError({
        message: `Role ${session.role} lacks permission for ${req.method}`,
        code: 'INSUFFICIENT_ROLE',
      }))
    }

    return yield* RpcMiddleware.next
  })
)
```

**Requirements**:

1. Every RPC handler MUST validate that the requesting session's `orgId`
   matches the target entity's `orgId`. Cross-org entity access is forbidden
   by default.
2. RPC authorization MUST be enforced in middleware, not in individual handlers.
   This ensures no handler can accidentally bypass authorization.
3. Authorization failures MUST be logged with the session identity, target
   entity, and attempted operation.

### S.5.3 Entity-Level Authorization

Entity handlers within `@effect/cluster` enforce entity-level access control:

1. Entity shard keys include `orgId` as a prefix, ensuring entities are
   routed to the correct org's shard.
2. The entity handler verifies `orgId` in the request context before
   processing any command.
3. No entity can be migrated across org boundaries. Shard rebalancing
   MUST preserve org affinity.

### S.5.4 Cross-Org Authorization

Cross-organization interactions use signed authorization tokens:

1. When Org A requests a transaction with Org B (e.g., work order placement),
   Org A MUST present a signed authorization token to the
   `manufacturing-commons` system account.
2. The authorization token MUST include:

   ```typescript
   const CrossOrgAuthToken = Schema.Struct({
     requestingOrgId: Schema.String,
     targetOrgId: Schema.String,
     transactionType: Schema.Literal(
       'work-order', 'capability-inquiry', 'quality-report'
     ),
     scope: Schema.Array(Schema.String),      // Subjects granted access to
     issuedAt: Schema.DateTimeUtc,
     expiresAt: Schema.DateTimeUtc,            // RECOMMENDED: 24-hour max TTL
     signature: Schema.String,                 // Signed by requesting org's account key
   })
   ```

3. The target org MUST validate the token signature against the requesting
   org's public key (available via NATS account resolution).
4. Cross-org tokens MUST be single-use or time-bounded. Long-lived cross-org
   access grants are PROHIBITED.

### S.5.5 Role Hierarchy

The platform defines a role hierarchy that applies within each organization:

```
admin
  +-- supervisor
        +-- operator
              +-- viewer
                    +-- device
```

**Hierarchy rules**:

1. Higher roles inherit all permissions of lower roles.
2. The `device` role is the most constrained -- publish/subscribe only to
   own device subjects.
3. The `admin` role grants NATS system subject access (`$SYS.>`) in addition
   to all IIoT subjects.
4. Cross-org interactions require `supervisor` or `admin` role. `operator`
   and `viewer` roles MUST NOT initiate cross-org transactions.

### S.5.6 Authorization Flow Summary

```
+----------------------------------------------------------+
|                     AUTHORIZATION FLOW                     |
+----------------------------------------------------------+
|                                                            |
|  INTRA-ORG (S.5.1):                                      |
|  Device -> [JWT pub/sub perms] -> NATS account subjects   |
|  Operator -> [JWT role perms] -> commands, overrides       |
|                                                            |
|  RPC LAYER (S.5.2):                                       |
|  Session -> [Effect middleware] -> orgId + role check      |
|  Middleware -> [pass/reject] -> entity handler             |
|                                                            |
|  CROSS-ORG (S.5.4):                                       |
|  Org A -> [signed token] -> manufacturing-commons          |
|  manufacturing-commons -> [validate sig] -> route to Org B |
|  Org B -> [validate + accept/reject] -> bilateral channel  |
|                                                            |
+----------------------------------------------------------+
```

---

## S.6 Cryptographic Requirements

### S.6.1 Transport Layer Security

1. All connections between edge devices and hub NATS servers MUST use TLS 1.3
   as the minimum version. TLS 1.2 MAY be supported for legacy edge devices
   during a transition period not exceeding 12 months from platform launch.
2. All inter-node communication (runner <-> runner, edge <-> cloud) MUST use
   TLS 1.3 [ZERO-TRUST].
3. WebSocket connections to `/ws/iiot` MUST use WSS (WebSocket Secure) with
   TLS 1.3.
4. HTTP API endpoints MUST enforce HTTPS with HSTS headers
   (`Strict-Transport-Security: max-age=31536000; includeSubDomains`).

**Cipher suites** (TLS 1.3, in preference order):

| Suite | Key Exchange | Symmetric | Hash |
|-------|-------------|-----------|------|
| TLS_AES_256_GCM_SHA384 | X25519 | AES-256-GCM | SHA-384 |
| TLS_CHACHA20_POLY1305_SHA256 | X25519 | ChaCha20-Poly1305 | SHA-256 |
| TLS_AES_128_GCM_SHA256 | X25519 | AES-128-GCM | SHA-256 |

### S.6.2 Identity Cryptography

1. NATS NKeys MUST use Ed25519 for signing [NATS-ACCOUNTS]. Ed25519 provides
   128-bit security with compact 32-byte public keys suitable for
   resource-constrained edge devices.
2. SPIFFE X.509-SVIDs MUST use ECDSA P-256 or Ed25519 for key pairs.
3. JWT signatures in the NATS chain (operator -> account -> user) MUST use
   Ed25519.

### S.6.3 Data at Rest Encryption

1. JetStream data at rest MUST be encrypted with AES-256-GCM.
2. NATS KV buckets containing entity state MUST be encrypted with AES-256-GCM.
3. Encryption keys MUST be per-organization. The platform operator MUST NOT
   have access to org-level encryption keys in the default configuration.
4. Key management SHOULD use a KMS (e.g., HashiCorp Vault, AWS KMS, Azure Key
   Vault) with automatic key rotation on a 90-day cycle.

### S.6.4 Edge Device Cryptography

Edge devices span a wide capability range. Minimum cryptographic requirements
are tiered:

| Edge Tier | TLS | Key Type | Attestation | Example Device |
|-----------|-----|----------|-------------|----------------|
| **Tier 1** ($50 SBC) | TLS 1.3 (software) | Ed25519 NKey | None | Raspberry Pi, Orange Pi |
| **Tier 2** (Industrial gateway) | TLS 1.3 (hardware accel) | Ed25519 NKey | Optional TPM | Advantech, Moxa |
| **Tier 3** (Hardened edge server) | TLS 1.3 + mTLS | Ed25519 + X.509 | TPM 2.0 required | Dell Edge, HPE Edgeline |
| **Tier 4** (Full edge cluster) | TLS 1.3 + mTLS | SPIFFE SVIDs | TPM 2.0 + Secure Boot | Kubernetes-on-edge |

### S.6.5 Key Rotation Policies

| Key Type | Rotation Period | Mechanism |
|----------|----------------|-----------|
| Operator key | Manual (HSM-backed) | Ceremony-based rotation with multi-party authorization |
| Account key | Annual | Org-initiated re-keying; new account JWT signed by operator |
| Device JWT | 90 days (RECOMMENDED) | Automatic re-signing by account key |
| SPIFFE SVID | 1 hour | Automatic via SPIFFE Workload API |
| JetStream encryption key | 90 days | KMS-managed automatic rotation |
| TLS server certificates | 90 days | ACME/Let's Encrypt or internal CA |

### S.6.6 mTLS for Edge-to-Hub Connections

Mutual TLS ensures both parties authenticate:

1. **Hub presents**: Server certificate signed by platform CA.
2. **Edge presents**: Client certificate derived from device NKey or
   org-issued X.509 certificate.
3. **Verification**: Hub verifies client certificate against org's trust
   anchor. Edge verifies hub certificate against platform root CA.
4. **Fallback**: For Tier 1 devices without client certificate capability,
   NATS JWT-only authentication is acceptable. The connection MUST still
   use TLS 1.3 for transport encryption.

---

## S.7 Network Security

### S.7.1 NATS Account Isolation as Network Boundary

NATS account isolation [NATS-ACCOUNTS] is the primary network security
boundary. Each organization's account is a hermetically sealed messaging
namespace:

1. Subjects within an account are INVISIBLE to all other accounts by default.
2. Cross-account communication REQUIRES explicit export/import configuration
   (see `rfc-section-tenant-isolation.md` Section TI.4).
3. Account limits enforce per-org resource quotas, preventing any single org
   from consuming disproportionate cluster resources.

This architectural choice means that even if an attacker compromises one org's
credentials, they gain ZERO visibility into other orgs' data.

### S.7.2 Platform Operator Isolation

The platform operator presents the highest-risk threat vector (S.3.4). The
architecture MUST enforce:

1. The platform operator MUST NOT have read access to org account data by
   default. Platform monitoring MUST use aggregated metrics from NATS system
   subjects (`$SYS.>`), not raw event streams.
2. Operator keys and account keys are cryptographically separate. Possessing
   the operator key allows creating/revoking accounts but does NOT grant
   message-level access within those accounts.
3. Per-org encryption at rest (S.6.3) ensures that even infrastructure-level
   access to storage does not reveal plaintext event data.
4. Platform-level access to org data MUST require an explicit, time-bounded
   grant from the org admin, logged with full audit trail.

### S.7.3 Hub-to-Hub Encryption

In multi-hub deployments (regional or global distribution):

1. Hub-to-hub route connections MUST use TLS 1.3.
2. Route authentication MUST use operator-level NKeys, not account-level keys.
3. NATS gateway connections between superclusters MUST use mTLS with
   certificates signed by the platform CA.

### S.7.4 Leaf Node Connection Security

Edge devices connecting as NATS leaf nodes [NATS-LEAFNODE]:

1. Leaf node connections MUST use TLS 1.3.
2. Leaf node credentials MUST be scoped to the org's account.
3. Leaf node subject mappings MUST NOT expose hub-level system subjects
   to the edge device.
4. The leaf node's JetStream domain MUST be isolated to the org's namespace
   (see `rfc-section-tenant-isolation.md` Section TI.6).

### S.7.5 Rate Limiting and DDoS Protection

To prevent network abuse and ensure fair resource allocation:

1. **Per-org rate limits** MUST be enforced at the NATS account level:
   - `max_data`: Maximum bytes per second (RECOMMENDED: 10 MB/s for small
     orgs, 100 MB/s for enterprise)
   - `max_payload`: Maximum single message size (RECOMMENDED: 1 MB)
   - `max_subscriptions`: Maximum concurrent subscriptions (RECOMMENDED: 1000)
   - `max_connections`: Maximum concurrent connections (RECOMMENDED: 100)

2. **Cross-org rate limits** MUST be enforced on the `manufacturing-commons`
   system account's import configuration:
   - Maximum events per org per second on shared subjects (RECOMMENDED: 100/s)
   - Burst allowance for initial connection (RECOMMENDED: 10x sustained rate
     for 30 seconds)

3. **DDoS protection at hub ingress**:
   - Connection rate limiting per source IP (RECOMMENDED: 10 connections/s)
   - JWT validation before resource allocation (unauthenticated connections
     MUST be rejected within 5 seconds)
   - Slow-loris protection: connection timeout of 30 seconds for TLS handshake

4. Rate limit violations MUST be logged with the violating org ID, subject
   pattern, and violation type.
5. Sustained rate limit violations (>10 minutes) SHOULD trigger automated
   capacity reduction for the violating org's account until the org contacts
   support.

### S.7.6 Zero Trust Boundaries

The metropolitan network applies Zero Trust principles [ZERO-TRUST] at
organization boundaries:

| Boundary | Trust Level | Verification |
|----------|-------------|-------------|
| **Within an org (edge <-> edge)** | High -- same operator, same account | NATS account credential |
| **Within an org (edge <-> cloud)** | High -- TLS + account credential | Mutual TLS + JWT |
| **Cross-org (account <-> account)** | Zero -- untrusted | Export/import only; no direct message path |
| **Platform <-> org** | Limited -- platform operates infrastructure | Operator key != account key; data access requires explicit grant |

**Zero Trust requirements**:

1. Cross-organization messages MUST transit through the `manufacturing-commons`
   system account, never directly between org accounts.
2. The platform operator MUST NOT have read access to org account data by
   default (S.7.2).
3. All inter-node communication MUST use TLS 1.3 (S.6.1).
4. Every request MUST be authenticated and authorized regardless of network
   origin. Internal network position does NOT confer trust.

---

## S.8 Security Compliance

### S.8.1 IEC 62443 (Industrial Cybersecurity) Mapping

IEC 62443 [IEC-62443] defines security levels (SL) for industrial automation
and control systems. The TMNL platform maps to IEC 62443 as follows:

| IEC 62443 Requirement | SL-1 (Basic) | SL-2 (Standard) | SL-3 (Enhanced) | TMNL Implementation |
|-----------------------|--------------|-----------------|-----------------|---------------------|
| FR 1: Identification & Auth | Username/password | Role-based + MFA | Certificate-based mTLS | NATS JWT (all tiers) + mTLS (Tier 3-4) |
| FR 2: Use Control | Basic RBAC | Granular RBAC | Attribute-based AC | Subject-level RBAC (S.5.1) + RPC middleware (S.5.2) |
| FR 3: System Integrity | Checksum validation | Signed firmware | TPM attestation | Device attestation (S.4.3, Tier 3-4 only) |
| FR 4: Data Confidentiality | TLS for transport | TLS + encrypt at rest | Per-org encryption keys | TLS 1.3 (S.6.1) + AES-256-GCM at rest (S.6.3) |
| FR 5: Restricted Data Flow | Network segmentation | Zone-based isolation | App-level filtering | NATS account isolation (S.7.1) + subject perms (S.5.1) |
| FR 6: Timely Response | Event logging | Real-time alerting | Automated response | EventLog audit trail + rate limit auto-enforcement (S.7.5) |
| FR 7: Resource Availability | Basic redundancy | N+1 redundancy | Geographic redundancy | NATS cluster + JetStream replication |

**Target**: The platform SHOULD achieve SL-2 for all organizations and SL-3
for organizations that deploy Tier 3-4 edge devices with TPM attestation.

### S.8.2 NIST Cybersecurity Framework Alignment

| NIST CSF Function | TMNL Implementation |
|-------------------|---------------------|
| **Identify** | Asset inventory via entity registry; ISA-95 hierarchy maps all devices and sensors |
| **Protect** | NATS account isolation, TLS 1.3, RBAC, subject-scoped permissions |
| **Detect** | Rate limit violation logging, clock anomaly detection (S.8.5), trust score monitoring |
| **Respond** | Automated account capacity reduction, JWT revocation, export revocation within 60s |
| **Recover** | JetStream replication, edge-first data sovereignty, offline-capable operation |

### S.8.3 SOC 2 Type II Requirements

For organizations requiring SOC 2 Type II compliance:

1. **Access control**: Per-org RBAC with JWT-based authentication provides
   auditable access control.
2. **Audit logging**: All entity state changes, operator actions, and
   cross-org interactions are logged via EventLog.
3. **Data encryption**: TLS 1.3 in transit, AES-256-GCM at rest.
4. **Availability**: NATS cluster redundancy with JetStream replication.
5. **Change management**: Entity state changes are event-sourced with
   immutable audit trails.

### S.8.4 FDA 21 CFR Part 11 Compliance

For organizations in regulated industries (pharmaceutical, food, medical
devices) [FDA-CFR11]:

1. **Electronic signatures** (Section 11.50-11.70): State change events MUST
   carry operator identity when the change was initiated by a human operator.
   Implemented via `OperatorEvents`
   (`lib/iiot/schemas/events/regulatory/operator-events.ts`).
2. **Audit trail immutability** (Section 11.10(e)): Entity event streams in
   JetStream MUST be configured with `deny_delete: true` and
   `deny_purge: true` to prevent retroactive modification.
3. **Timestamp integrity** (Section 11.10(a)): Both `originTimestamp` and
   `networkTimestamp` MUST be preserved for all regulatory events. Neither
   MAY be modified after initial recording.
4. **Access controls** (Section 11.10(d)): Limited system access to
   authorized individuals enforced via NATS JWT RBAC (S.5.1).

### S.8.5 ISA-18.2 Alarm Records

For alarm events subject to ISA-18.2 [ISA-18.2]:

1. The complete alarm lifecycle (triggered -> acknowledged -> cleared) MUST be
   recorded as an ordered sequence.
2. Alarm sequence ordering MUST be provably correct (G-1 enforcement via
   JetStream per-subject ordering).
3. Alarm records MUST be retained for the period specified by the
   organization's regulatory requirements (configurable stream `max_age`).
4. The `AlarmState` literal type (`lib/iiot/schemas/alarms.ts`) encodes the
   full ISA-18.2 lifecycle: `unacknowledged`, `acknowledged`, `shelved`,
   `suppressed`, `cleared`, `out_of_service`.

### S.8.6 ITAR Handling for Defense Manufacturers

Organizations subject to International Traffic in Arms Regulations (ITAR):

1. ITAR-controlled data MUST NOT leave the organization's NATS account under
   any circumstances. All cross-org exports MUST be disabled for ITAR accounts.
2. The edge JetStream domain provides ITAR data residency by default -- data
   remains on the edge device within the organization's physical facility.
3. Cloud mirroring for ITAR accounts MUST target US-only cloud regions with
   ITAR-compliant hosting (FedRAMP Moderate or higher).
4. ITAR accounts SHOULD be flagged in the account JWT metadata to enable
   automated export prevention at the NATS account level.

### S.8.7 Edge Device Trust Boundaries

#### S.8.7.1 Untrusted Timestamps

Edge device clocks are untrusted for cross-org purposes (per Section X.6 of
`rfc-section-two-domain-consistency.md`). Additional protections:

1. Events with `originTimestamp` more than 24 hours in the future or past
   relative to `networkTimestamp` SHOULD be flagged as `SuspiciousTimestamp`.
2. Events with monotonically decreasing `originTimestamp` for the same entity
   SHOULD be flagged as `ClockRegression`.
3. Flagged events MUST still be delivered (G-8) but SHOULD carry a warning
   annotation for consumers.

#### S.8.7.2 Device Attestation (Future)

For enhanced security, edge devices MAY support device attestation:

1. TPM-based attestation of software integrity.
2. Signed boot measurements included in connection JWT.
3. Periodic re-attestation during long-lived connections.

This is RECOMMENDED for large facilities (Tier 3-4) but NOT REQUIRED for small
shops (Earl's $50 Tier 1 edge device will not have a TPM).

---

## S.9 Codebase Grounding

File paths are relative to `packages/tmnl/`.

### S.9.1 Authentication & Transport Layer

**File**: `src/lib/iiot/realtime/holonet-bridge.ts`

The HolonetBridge (service tag at line 88) is the NATS transport layer through
which all inter-node and edge-cloud communication flows. Outbound publishes
(lines 102-128) use `NatsPubSubService.publish()` with `Effect.ignoreLogged` for
fire-and-forget semantics. Inbound subscriptions (lines 136-182) use scoped
streams. In the multi-tenant architecture, the HolonetBridge operates within the
org's NATS account, making all its publishes and subscriptions account-scoped.
This is the enforcement point for S.4.1 (NATS JWT auth) and S.7.1 (account
isolation).

**File**: `src/lib/iiot/realtime/websocket-server.ts`

The WebSocket server at `/ws/iiot` provides the per-session delivery channel.
In the multi-tenant context, WebSocket connections are authenticated per S.4.4
and scoped to the org's NATS account. The `RpcSerialization.layerJson` ensures
browser-compatible serialization.

**File**: `src/lib/iiot/realtime/layers.ts`

The Layer composition for runner-to-runner communication. This is where SPIFFE
X.509-SVIDs (S.4.5) would be provided as the mTLS certificate source for
`@effect/cluster` inter-node communication.

### S.9.2 Authorization Enforcement Points

**File**: `src/lib/iiot/realtime/iiot-subjects.ts`

Four subject specs (lines 39, 61, 83, 105) define the `iiot.{type}.{entityId}`
pattern. These subjects form the authorization namespace that NATS JWT
permissions (S.5.1) control. Each `createSubjectSpec` produces `resolve()` for
concrete subjects and `wildcardPattern()` for subscriptions.

**File**: `src/lib/iiot/entity/EntityStack.ts`

`EntityHandlersLayer = Layer.mergeAll(...)` (lines 54-67) composes all 12 entity
handlers. Each entity handler in this stack is the boundary where:
- FDA 21 CFR Part 11 audit trail requirements (S.8.4) are enforced
- Entity-level authorization (S.5.3) verifies orgId before processing
- EventLog writes create immutable audit records

### S.9.3 Regulatory Event Schemas

**File**: `src/lib/iiot/schemas/events/regulatory/operator-events.ts`

Five FDA 21 CFR Part 11 operator audit events: `OperatorLogin`, `OperatorLogout`,
`ParameterOverride`, `ManualAcknowledgment`, `ShiftHandoff`. Each event carries
branded identifiers and an `AuthMethod` literal (`'badge' | 'password' | 'biometric'`).
These satisfy S.8.4 item 1 (electronic signatures carry operator identity).

**File**: `src/lib/iiot/schemas/events/regulatory/quality-events.ts`

Five ISO 9001 quality events: `InspectionCompleted`, `NCROpened`, `NCRClosed`,
`CAPACreated`, `CAPAResolved`. The NCR-CAPA linking creates an auditable
corrective action chain.

**File**: `src/lib/iiot/schemas/events/regulatory/batch-events.ts`

Four FDA 21 CFR Part 11 batch record events: `BatchStarted`, `ParameterRecorded`,
`BatchCompleted`, `BatchDeviation`. Each carries `electronicSignature` and
`auditTrailId` for complete batch traceability.

**File**: `src/lib/iiot/infrastructure/eventlog-layer.ts`

The EventLog layer (lines 46-50) composes the complete audit schema:
`IIoTEventLogSchema = EventLog.schema(StructuralEvents, OperationalEvents, AlarmEvents)`.
All entity handlers write through this EventLog, producing the immutable,
append-only audit trail required by S.8.4 and S.8.5.

### S.9.4 Edge Device Ingestion

**File**: `src/lib/iiot/adapters/sparkplug-adapter.ts`

The Sparkplug B protocol adapter provides the ingestion trust boundary for edge
devices. The `AliasRegistry` resolves metric name/alias mappings from device
BIRTH messages. This adapter is the first point where edge device data enters
the platform -- the enforcement point for S.8.7.1 (untrusted timestamps),
S.8.7.2 (device attestation), and S.4.3 (device identity validation).

### S.9.5 Alarm Lifecycle Security

**File**: `src/lib/iiot/schemas/alarms.ts`

The `AlarmState` literal type (lines 32-45) encodes the full ISA-18.2 alarm
lifecycle. This Schema-based definition provides compile-time safety and runtime
validation for alarm state transitions (S.8.5).

**File**: `src/lib/iiot/entity/AlarmEntity.ts`

Implements ISA-18.2 compliant alarm lifecycle management using `@effect/cluster`
Entity + `@effect/experimental` Machine. Events are recorded via EventLog,
providing the immutable audit trail required by S.8.5.

**File**: `src/lib/iiot/machines/AlarmMachine.ts`

The state machine definition (`makeAlarmMachine`) enforces valid ISA-18.2
transitions. Invalid transitions are rejected at the Machine level.

### S.9.6 Summary: Security Concept to File Mapping

| Security Concept | Implementation File | Status |
|-----------------|---------------------|--------|
| NATS JWT auth (S.4.1) | `src/lib/iiot/realtime/holonet-bridge.ts` | Implemented |
| WebSocket auth (S.4.4) | `src/lib/iiot/realtime/websocket-server.ts` | Implemented |
| SPIFFE mTLS (S.4.5) | `src/lib/iiot/realtime/layers.ts` | Integration point ready |
| Subject permissions (S.5.1) | `src/lib/iiot/realtime/iiot-subjects.ts` | Implemented |
| Entity authorization (S.5.3) | `src/lib/iiot/entity/EntityStack.ts` | Implemented |
| FDA audit trail (S.8.4) | `src/lib/iiot/schemas/events/regulatory/*.ts` | Implemented |
| EventLog immutability (S.8.4) | `src/lib/iiot/infrastructure/eventlog-layer.ts` | Implemented |
| ISA-18.2 lifecycle (S.8.5) | `src/lib/iiot/schemas/alarms.ts` | Implemented |
| Alarm audit trail (S.8.5) | `src/lib/iiot/entity/AlarmEntity.ts` | Implemented |
| Edge device trust (S.8.7) | `src/lib/iiot/adapters/sparkplug-adapter.ts` | Implemented |
| Schema redaction (S.5.4) | `src/lib/iiot/schemas/assets/*.ts` | Schema ready; export boundary not deployed |

---

## References

All references use canonical keys from the project bibliography
(`docs/specifications/bibliography.md`).

### Normative

- [RFC2119] -- Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [FDA-CFR11] -- U.S. FDA, 21 CFR Part 11. Electronic Records; Electronic Signatures.
- [ISA-18.2] -- ANSI/ISA-18.2-2016. Management of Alarm Systems.
- [IEC-62443] -- IEC 62443. Industrial Communication Networks -- Network and System Security.

### NATS / Security

- [NATS-ACCOUNTS] -- Synadia. "NATS Account-Based Security."
- [NATS-JWT] -- Synadia. "In-Depth JWT Guide for NATS."
- [NATS-DECENTRALIZED] -- Synadia. "NATS Decentralized JWT Authentication."
- [NATS-LEAFNODE] -- Synadia. "NATS Leaf Nodes."
- [JETSTREAM] -- Synadia. "NATS JetStream."

### Security Standards

- [ZERO-TRUST] -- Rose, S., et al. "Zero Trust Architecture." NIST SP 800-207, 2020.
- [SPIFFE] -- CNCF. "Secure Production Identity Framework for Everyone (SPIFFE)."
- [OAUTH2] -- Hardt, D. "The OAuth 2.0 Authorization Framework." RFC 6749.
- [SPARKPLUG-B] -- Eclipse Foundation. "Eclipse Sparkplug Specification v3.0.0."

### Architecture

- [EFFECT-CLUSTER] -- Effect Contributors. "@effect/cluster -- Distributed Entity Management."
- [EFFECT-RPCMIDDLEWARE] -- Effect Contributors. "@effect/rpc/RpcMiddleware."

### Companion Sections

- `rfc-section-trust-model.md` -- Trust scoring, anti-fraud, reputation
- `rfc-section-tenant-isolation.md` -- Data isolation, compute isolation, audit
- `rfc-section-two-domain-consistency.md` -- Normative ordering guarantees (G-1 through G-8)
- `rfc-section-edge-architecture.md` -- Edge-first deployment topology
- `rfc-section-consistency-guarantees.md` -- Implementation mapping
