# TMNL Infrastructure Requirements Questionnaire

**Session Date**: 2024-12-15
**Purpose**: Scope Kubernetes cluster architecture for TMNL deployment
**Method**: Systematic requirement gathering across all infrastructure layers

---

## SECTION 1: Database Layer (PostgreSQL)

### 1.1 PostgreSQL Version & Extensions

- [ ] **Target PostgreSQL version?** (14, 15, 16, 17?)
    We're targetting the latest version
- [ ] **Required extensions?**
  - [x] PostGIS (spatial data)
  - [x] pg_stat_statements (query analytics)
  - [x] TimescaleDB (time-series)
  - [x] pgvector (vector embeddings)
  - [x] pgcrypto (encryption)
  - [ ] Other: **\_\_\_**
      Yes, https://github.com/Mooncake-Labs/pg_mooncake, as well.
      Did I mention, ElectricSQL.

### 1.2 Deployment Strategy

- [x] **StatefulSet** (manual management)
- [ ] **Operator** (CloudNativePG, Zalando, Crunchy)
  operator-managed. this is where we can leverage the pepr rust sdk
- [ ] **Restore time objective (RTO)?** (minutes, hours)
- [x] **External managed** (RDS, CloudSQL, Neon, Supabase)
- [x] **Hybrid** (dev: k3d, prod: external) Likely neon, but frankly

### 1.3 High Availability

- [x] **Single instance** (dev only)
- [ ] **Primary + read replicas** (how many replicas?)
- [ ] **Multi-master** (Patroni/Stolon)
- [x] **Connection pooling** (PgBouncer, pgcat, Supavisor)

### 1.4 Persistence

- [ ] **Volume size per instance?** (10Gi, 50Gi, 100Gi+)
  I think you can make this decision for me.
- [ ] **Storage class?** (local-path, ceph, longhorn, cloud provider)
  I think you can make this decision for me.
- [x] **Backup strategy?** (pg_dump, WAL archiving, operator-managed)
  operator-managed. this is where we can leverage the pepr rust sdk
- [ ] **Restore time objective (RTO)?** (minutes, hours)

### 1.5 Schema Management

- [ ] **Migration tool?** (Effect SQL, Drizzle, Kysely, raw SQL)
  effect sql.
- [ ] **Schema versioning?** (git-tracked, migration tool internal)
  git tracked.
- [ ] **Multiple databases?** (per-service, shared, both)
  both. 

---

## SECTION 2: Message Bus (NATS/JetStream)

### 2.1 Use Cases

- [x] **Event sourcing** (domain events, event store)
- [x] **Service-to-service pub/sub** (which services communicate?)
- [x] **Work queues** (background jobs, task processing)
- [x] **Real-time streams** (WebSocket backend, live updates)
- [x] **Request-reply** (RPC alternative to gRPC)
- [ ] **Not needed** (skip this section)

### 2.2 NATS Deployment

- [ ] **Single NATS server** (dev only)
- [ ] **NATS cluster** (3+ nodes for HA)
- [ ] **NATS operator** (Helm chart, NATS Kubernetes operator)
  operator-managed. this is where we can leverage the pepr rust sdk we're going to develop a custom NATS operator.
- [ ] **External NATS** (managed service, separate cluster)

### 2.3 JetStream Configuration

- [ ] **Stream count estimate?** (1-5, 5-20, 20+)
  We're going to be supporting dynamic, ephemeral stream instantiation.
- [ ] **Message retention?** (limits, age, interest-based)
  operator-managed. this is where we can leverage the pepr rust sdk we're going to develop a custom NATS operator.
- [ ] **Storage backend?** (memory, file, both)
  operator-managed. this is where we can leverage the pepr rust sdk we're going to develop a custom NATS operator.
- [ ] **Replication factor?** (1, 3, 5)
  operator-managed. this is where we can leverage the pepr rust sdk we're going to develop a custom NATS operator.

NEX WILL BE USED PROFUSELY 
NEX WILL BE USED PROFUSELY 
NEX WILL BE USED PROFUSELY 
NEX WILL BE USED PROFUSELY 
NEX WILL BE USED PROFUSELY 
NEX WILL BE USED PROFUSELY 
NEX WILL BE USED PROFUSELY 
NEX WILL BE USED PROFUSELY 
NEX WILL BE USED PROFUSELY 
NEX WILL BE USED PROFUSELY 

### 2.4 Integration Points

- [x] **AVA gRPC services** (event publishing)
- [x] **Cosmo GraphQL** (subscriptions backend)
- [x] **Effect services** (stream consumption)
  likely interfaced via typescript durable streams per electricsql, once we cross that hurdle.
- [ ] **Tauri backend** (local IPC alternative)

---

## SECTION 3: Rust Service Architecture

### 3.1 Existing Rust Services

**AVA API** (src-ava/):

- [x] **Deploy to k8s?** (yes/no)
- [x] **Container registry?** (ghcr.io, dockerhub, private)
 Private. With that being said, an artifact repository will be required, among other things, likely in a non application based cluster or network.
- [ ] **Replicas?** (1, 2-3, auto-scaled)
 auto-scaled

### 3.2 New Rust Services (Candidates)

- [ ] **High-throughput data ingestion** (why: async Tokio, low memory)
  Probably covering this with NATS/Arroyo. Don't mind creating some middleware services however. I think many of the questions and infra we've instantiated already addresses this.
- [ ] **gRPC gateway** (Tonic server aggregating multiple backends)
- [ ] **WebSocket server** (why: connection pooling efficiency)
  May neeed a gateway tbh. Many services will have their particular implementation of websockets, and we don't want to take ownership of that, or tamper.
- [x] **Background job processor** (why: fearless concurrency)
I'm down. We'll flesh it out later
- [ ] **Metrics aggregator** (why: performance-critical)
This kind of service will be provided via Wasmcloud, which is going to be a key technology architectural stack resident
- [ ] **Cache layer** (Redis alternative in Rust?)
Lol. The caching will be built from the ground up via NATS and iceberg shenanigans. Yes, Rust will be utilized.
- [ ] **Other**: **\_\_\_**

### 3.3 Rust vs TypeScript Decision Criteria

When choosing Rust for a new service, what's the threshold?

- [x] **Always prefer Rust** (when possible)
- [x] **Performance critical** (>10k req/s, <10ms p99)
- [x] **Low latency required** (<5ms p50)
- [x] **Memory constrained** (<100MB footprint)
- [x] **Type safety critical** (financial, safety-critical)
- [ ] **Prefer TypeScript** (unless compelling reason)

---

## SECTION 4: GraphQL Federation (Cosmo)

### 4.1 Current State

**CosmoRouter** - ✅ Pepr operator deployed
**CosmoSubgraph** - ✅ CRD defined

### 4.2 Subgraph Strategy

- [ ] **How many subgraphs?** (current + planned)
You tell me. This number will evolve.

### 4.3 Router Configuration

- [ ] **Replicas?** (1, 2-3, auto-scaled)
- [ ] **Ingress?** (Traefik, Nginx, Istio, k3d port-forward)
- [ ] **TLS?** (cert-manager, external LB, none for dev)
- [ ] **Rate limiting?** (per-client, global, none)

### 4.4 Schema Management

- [ ] **Rover CLI** (schema push/check)
- [x] **Git-tracked schemas** (version control)
Ideally we leverage the ecosystem.
- [ ] **Auto-generated** (from Rust/TS services)
- [x] **Schema registry** (Cosmo cloud, self-hosted)
self-hosted.

### 4.5 Cosmo Connect.

The answer is yes.
---

## SECTION 5: Observability Stack

### 5.1 Metrics

- [x] **Prometheus** (scraping, storage)
- [x] **OpenTelemetry Collector** (push-based)
Effect has pretty rich OTel support. On the rust side I imagine so as well.
- [ ] **Grafana** (dashboards)
- [ ] **VictoriaMetrics** (Prometheus alternative)
- [ ] **External** (Datadog, New Relic)

### 5.2 Logging

I wouldn't mind a custom logging service. Rust/Typescript. That's probably actually a major requirement, tbh. 

- [ ] **Loki** (Grafana stack)
- [ ] **Elasticsearch/OpenSearch** (ELK/EFK)
- [x] **Fluentd/Fluent Bit** (log forwarding)
- [ ] **Cloud provider** (CloudWatch, Stackdriver)
- [ ] **Stdout only** (kubectl logs)

### 5.3 Tracing

- [ ] **Jaeger** (OpenTelemetry backend)
- [ ] **Tempo** (Grafana stack)
- [ ] **Zipkin** (alternative)
- [x] **Effect tracing** (built-in spans, export to?)
We need somethintg custom.
- [ ] **Not needed yet**

### 5.4 Alerting

- [x] **Prometheus Alertmanager** (rule-based)
This is fine for now, but again we neeed something custom.
- [ ] **Grafana alerts** (dashboard-based)
- [ ] **PagerDuty/Opsgenie** (on-call)
- [ ] **Slack/Discord webhooks**
- [ ] **Not needed yet**

---

## SECTION 6: Service Mesh & Networking

### 6.1 Service Mesh

- [ ] **None** (direct service-to-service)
- [ ] **Linkerd** (lightweight, Rust-based)
- [ ] **Istio** (full-featured, complex)
- [x] **Cilium** (eBPF-based, network security)
- [ ] **Consul** (HashiCorp stack integration)

### 6.2 Ingress Strategy

- [ ] **k3d built-in Traefik** (dev)
- [ ] **Nginx Ingress Controller** (prod-ready)
- [ ] **Istio Gateway** (if using Istio)
- [ ] **Cloud provider LB** (ELB, GCP LB)

### 6.3 DNS & Service Discovery

- [ ] **CoreDNS** (k8s default, good enough?)
- [ ] **External DNS** (cloud provider DNS integration)
- [x] **Consul** (service mesh + DNS)

---

## SECTION 7: Storage & Caching

### 7.1 Object Storage

- [ ] **MinIO** (S3-compatible, in-cluster)
- [x] **Cloud provider** (S3, GCS, Azure Blob)
Need something for local, though.
- [ ] **Not needed**

Use cases:

- [x] File uploads (user assets)
- [x] Backup storage (DB dumps, logs)
- [x] Large blob storage (media, archives)

### 7.2 Cache Layer

- [ ] **Redis/Valkey** (key-value, pub/sub)
- [ ] **Dragonfly** (Redis alternative, faster)
- [ ] **In-memory only** (app-level caching)
- [ ] **Not needed**

Use cases:

- [ ] Session storage
- [ ] Rate limiting
- [ ] Query result caching
- [ ] Pub/sub (alternative to NATS)

### 7.3 Distributed Storage

- [ ] **Longhorn** (cloud-native block storage)
- [ ] **Ceph/Rook** (object, block, file)
- [ ] **Local volumes** (hostPath, local-path-provisioner)
- [ ] **Cloud provider** (EBS, GCE PD)

---

## SECTION 8: Deployment & CI/CD

### 8.1 Container Image Strategy

- [ ] **Nix derivations** (reproducible, minimal)
- [ ] **Dockerfiles** (standard, larger images)
- [ ] **Hybrid** (Nix for dev, Docker for prod)

### 8.2 Registry

- [ ] **GitHub Container Registry** (ghcr.io)
- [ ] **Docker Hub** (public/private)
- [ ] **In-cluster registry** (k3d built-in, Harbor)
- [ ] **Cloud provider** (ECR, GCR, ACR)

### 8.3 Deployment Tool

- [ ] **Pepr CRDs** (custom operators for everything)
- [ ] **Helm charts** (packaged deployments)
- [ ] **Kustomize** (overlay-based)
- [ ] **ArgoCD** (GitOps)
- [ ] **FluxCD** (GitOps alternative)
- [ ] **kubectl apply** (manual, simple)

### 8.4 Environment Strategy

- [ ] **Single k3d cluster** (dev only)
- [ ] **Multi-cluster** (dev k3d, prod cloud)
- [ ] **Namespaces per env** (dev/staging/prod in same cluster)

---

## SECTION 9: Security & Secrets

### 9.1 Secrets Management

- [ ] **Kubernetes Secrets** (base64, sufficient?)
- [ ] **External Secrets Operator** (AWS Secrets Manager, Vault)
- [ ] **Sealed Secrets** (Bitnami, git-trackable)
- [ ] **SOPS** (encrypted files, Nix-friendly)
- [ ] **Vault** (HashiCorp)

### 9.2 TLS Certificates

- [ ] **cert-manager** (Let's Encrypt, automatic renewal)
- [ ] **Manual certificates** (self-signed, imported)
- [ ] **Cloud provider** (managed certs)
- [ ] **Not needed** (dev only, no TLS)

### 9.3 RBAC & Auth

- [ ] **Default service accounts** (minimal)
- [ ] **Custom RBAC** (per-service permissions)
- [ ] **Pod Security Policies/Standards**
- [ ] **Network Policies** (restrict pod-to-pod)
- [ ] **OAuth/OIDC** (user authentication)

---

## SECTION 10: Development Workflow

### 10.1 Local Development

- [ ] **k3d cluster** (matches prod topology)
- [ ] **Docker Compose** (simpler, non-k8s services)
- [ ] **Nix devShell** (all tools, no cluster)
- [ ] **Hybrid** (some services local, some k3d)

### 10.2 Hot Reload Strategy

- [ ] **Skaffold** (auto-rebuild on code change)
- [ ] **Tilt** (smart rebuilds, UI)
- [ ] **Telepresence** (proxy local code to cluster)
- [ ] **Manual** (rebuild + kubectl apply)

### 10.3 Testing Strategy

- [ ] **Unit tests** (vitest, bun test, cargo test)
- [ ] **Integration tests** (against k3d cluster)
- [ ] **E2E tests** (Playwright, Cypress)
- [ ] **Contract tests** (gRPC/GraphQL schemas)
- [ ] **Load tests** (k6, Locust)

---

## SECTION 11: Nix Integration

### 11.1 Nix Use Cases

- [ ] **Container images** (dockerTools.buildImage)
- [ ] **Binary artifacts** (Rust builds via naersk/crane)
- [ ] **Config generation** (k8s manifests from Nix)
- [ ] **Dev environments** (flake.nix devShells)
- [ ] **Deployment automation** (NixOps, deploy-rs)

### 11.2 Nix Derivation Strategy

For Rust services (AVA):

- [ ] **naersk** (simple, works)
- [ ] **crane** (incremental builds, caching)
- [ ] **buildRustPackage** (nixpkgs standard)

For TypeScript services:

- [ ] **buildNpmPackage** (nixpkgs)
- [ ] **dream2nix** (language-agnostic)
- [ ] **Manual derivation** (bun, custom)

### 11.3 Cluster Provisioning

- [ ] **Keep current k8s.nix** (scripts for k3d lifecycle)
- [ ] **Expand to Terraform** (cloud provisioning)
- [ ] **NixOps** (declarative infrastructure)
- [ ] **Tofu** (OpenTofu, Terraform alternative)

---

## SECTION 12: Pepr Operator Expansion

### 12.1 Current Pepr CRDs

- [x] **CosmoRouter** (GraphQL federation router)
- [x] **CosmoSubgraph** (federated GraphQL services)

### 12.2 New Pepr CRD Candidates

What should get custom operators?

- [ ] **PostgreSQL** (schema management, migration runner)
- [ ] **NATS Stream** (declarative JetStream config)
- [ ] **AVA View** (ViewProfileSpec → k8s resources)
- [ ] **Effect Service** (TypeScript service with Layer deps)
- [ ] **Background Job** (cron-like scheduling)
- [ ] **Data Pipeline** (ETL workflow orchestration)
- [ ] **Other**: **\_\_\_**

### 12.3 Pepr Philosophy

- [ ] **Pepr for domain logic** (TMNL-specific resources)
- [ ] **Helm for infrastructure** (Postgres, NATS, etc.)
- [ ] **Mix both** (Pepr wraps/configures Helm charts)

---

## SECTION 13: Performance & Scaling

### 13.1 Expected Load (Current Phase)

- [ ] **Users**: <10 (dev), 10-100 (alpha), 100-1k (beta), 1k+ (prod)
- [ ] **Requests/sec**: <10, 10-100, 100-1k, 1k+
- [ ] **Data volume**: <1GB, 1-10GB, 10-100GB, 100GB+

### 13.2 Autoscaling Strategy

- [ ] **Horizontal Pod Autoscaler** (CPU/memory-based)
- [ ] **KEDA** (event-driven, NATS queue depth, etc.)
- [ ] **Vertical Pod Autoscaler** (right-size resources)
- [ ] **Manual scaling** (fixed replicas)

### 13.3 Resource Limits

Default pod resources:

- [ ] **Rust services**: **_m CPU, _**Mi memory
- [ ] **TypeScript services**: **_m CPU, _**Mi memory
- [ ] **Databases**: **_m CPU, _**Gi memory
- [ ] **Let k8s decide** (no limits initially)

---

## SECTION 14: Disaster Recovery & Business Continuity

### 14.1 Backup Scope

- [ ] **Database only** (PostgreSQL dumps)
- [ ] **Persistent volumes** (snapshots, Velero)
- [ ] **Cluster state** (etcd backups)
- [ ] **Git is source of truth** (redeploy from code)

### 14.2 Recovery Time Objective (RTO)

- [ ] **Minutes** (HA required, zero downtime)
- [ ] **Hours** (acceptable downtime)
- [ ] **Days** (dev/hobby project)

### 14.3 Recovery Point Objective (RPO)

- [ ] **Zero data loss** (synchronous replication)
- [ ] **Minutes** (frequent backups)
- [ ] **Hours/days** (acceptable data loss)

---

## SECTION 15: Cost Optimization (if cloud)

### 15.1 Compute Strategy

- [ ] **Spot/preemptible instances** (80% cheaper, evictable)
- [ ] **Reserved instances** (commitment discounts)
- [ ] **Burstable instances** (T-series, cost-effective for low CPU)
- [ ] **On-demand** (pay-as-you-go)

### 15.2 Storage Strategy

- [ ] **Object storage lifecycle** (S3 Glacier, cold storage)
- [ ] **Volume snapshots** (incremental, cheaper than live volumes)
- [ ] **Compression** (at-rest, in-transit)

### 15.3 Network Strategy

- [ ] **Private networking** (no egress charges)
- [ ] **CDN** (CloudFlare, edge caching)
- [ ] **Avoid cross-region** (minimize data transfer costs)

---

## SECTION 16: Open Questions & Special Requirements

### 16.1 Unconventional Requirements

Is there anything unique to TMNL that doesn't fit above categories?

- [ ] **GPU workloads** (AI/ML inference, rendering)
- [x] **IoT device integration** (MQTT, edge computing)
- [x] **Blockchain/Web3** (contract interaction, indexing)
- [x] **Real-time collaboration** (CRDT, OT)
- [x] **Geospatial** (PostGIS, tile servers)
- [ ] **Other**: **\_\_\_**

### 16.2 Timeline

- [ ] **Immediate** (this week)
- [ ] **Short-term** (this month)
- [ ] **Mid-term** (this quarter)
- [ ] **Long-term** (6+ months)

### 16.3 Team Size

- [ ] **Solo** (you)
- [ ] **2-5 people**
- [ ] **5+ people**

(Affects RBAC complexity, workflow tooling, etc.)

---

## SECTION 17: Decision Summary (Val's Synthesis)

After answering above, Val will synthesize:

1. **Minimal Viable Cluster** (what to deploy first)
2. **Phased Rollout Plan** (what to add when)
3. **Nix Derivation Strategy** (what to build with Nix)
4. **Pepr CRD Roadmap** (custom operators to write)
5. **Architecture Diagram** (visual representation)


## SECTION X: TRINO

Yea, we need it asap.

Local dvelopment cluster. Client based interface to clusters. Multi tier approach. line vs plant, etc. no need for device level cluster, just leaf virtualization or deployment via NATS.
---

## How to Use This Questionnaire

**Option A: Complete entire questionnaire**
Go through each section, check boxes, fill in values.

**Option B: Highlight priorities**
Mark 3-5 sections as "critical path" and skip the rest for now.

**Option C: Conversational approach**
Val asks questions one section at a time, you answer conversationally.

**Prime, which approach do you prefer?**
