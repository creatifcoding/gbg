# RFC-001 Section: Operational Runbooks

```
Section:       Operational Runbooks
RFC:           001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        failure-runbook-writer (Val)
Created:       2026-02-09
Companion:     docs/specifications/rfc-section-failure-modes.md
Bibliography:  docs/specifications/bibliography.md
```

---

## RB.1 Scope

This section defines the operational procedures for deploying, maintaining, and
operating the TMNL metropolitan-scale IIoT event distribution system. It covers
the full operational lifecycle from initial org onboarding (Day-1) through
steady-state operations (Day-2), incident response, maintenance windows,
capacity planning, backup/recovery, and compliance operations.

Each runbook procedure specifies:
- **Prerequisites**: What must be true before starting
- **Steps**: Numbered, imperative, copy-pasteable commands where applicable
- **Verification**: How to confirm the procedure succeeded
- **Rollback**: How to undo if something goes wrong

This section is informative for general procedures and normative where
marked with [RFC2119] keywords.

---

## RB.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119] and [RFC8174].

File paths are relative to `packages/tmnl/` and use the `src/` prefix.

**Command notation**:
- `$` prefix: shell commands run by operator
- `nats>` prefix: NATS CLI commands
- `psql>` prefix: PostgreSQL commands
- `[PLACEHOLDER]` values MUST be substituted with environment-specific values

---

## RB.3 Day-1 Operations

### RB.3.1 New Organization Onboarding

**Prerequisites**:
- Cloud NATS cluster operational
- `@effect/cluster` runner pool healthy
- PostgreSQL database accessible
- Organization details: name, geographic region, subscription tier

**Procedure**:

1. **Create NATS Account for the organization**

   Generate an operator-signed JWT [NATS-JWT] with appropriate limits:

   ```
   $ nsc add account --name [ORG_ID]
   $ nsc edit account --name [ORG_ID] \
       --js-mem-storage [TIER_MEM_LIMIT] \
       --js-disk-storage [TIER_DISK_LIMIT] \
       --js-streams [TIER_STREAM_LIMIT] \
       --js-consumer [TIER_CONSUMER_LIMIT]
   ```

   Account limits by subscription tier:

   | Tier | Memory | Disk | Streams | Consumers |
   |------|--------|------|---------|-----------|
   | Starter | 256 MB | 1 GB | 10 | 50 |
   | Professional | 1 GB | 10 GB | 50 | 500 |
   | Enterprise | 8 GB | 100 GB | 500 | 5000 |

2. **Create JetStream streams for the organization**

   Four streams per org (see `rfc-section-consistency-guarantees.md` Y.4):

   ```
   $ nats stream add iiot-readings-[ORG_ID] \
       --subjects "iiot.readings.>" \
       --storage file \
       --retention limits \
       --max-age 24h \
       --max-bytes [TIER_DISK_LIMIT] \
       --discard old \
       --replicas 3

   $ nats stream add iiot-alarms-[ORG_ID] \
       --subjects "iiot.alarms.>" \
       --storage file \
       --retention limits \
       --max-age 720h \
       --max-bytes 2G \
       --discard new \
       --replicas 3

   $ nats stream add iiot-equipment-[ORG_ID] \
       --subjects "iiot.equipment.>" \
       --storage file \
       --retention limits \
       --max-age 720h \
       --max-bytes 2G \
       --discard new \
       --replicas 3

   $ nats stream add iiot-invalidations-[ORG_ID] \
       --subjects "iiot.invalidations.>" \
       --storage file \
       --retention limits \
       --max-age 1h \
       --max-bytes 500M \
       --discard old \
       --replicas 3
   ```

3. **Provision database schema**

   Create org-scoped tables in PostgreSQL:

   ```
   psql> CREATE SCHEMA IF NOT EXISTS org_[ORG_ID];
   psql> SET search_path TO org_[ORG_ID];
   -- Run migration scripts for entity state tables
   -- (12 state services: Alarm, WorkOrder, EquipmentState, Machine,
   --  Area, SensorAsset, Plant, Enterprise, Site, WorkCell, Line, Device)
   ```

   Ref: `src/lib/iiot/state/index.ts` lines 132-147 lists all 12 state
   services composed via `AllStateServicesInMemory` (production uses SQL
   equivalents).

4. **Create user credentials**

   Generate user JWTs with appropriate permissions:

   ```
   $ nsc add user --account [ORG_ID] --name [USER_ID] \
       --allow-pub "iiot.readings.[ORG_ID].>" \
       --allow-pub "iiot.alarms.[ORG_ID].>" \
       --allow-sub "iiot.*.>"
   ```

5. **Register organization in `@effect/cluster`**

   The first entity message for the org will trigger lazy entity creation.
   No explicit registration step needed -- the `EntityManager` pattern
   (`src/lib/iiot/entity/EntityStack.ts` lines 54-67) creates entities on
   first message via `Entity.build()`.

**Verification**:

```
$ nats account info [ORG_ID]
$ nats stream ls --account [ORG_ID]
$ nats sub "iiot.readings.[ORG_ID].test" --account [ORG_ID] &
$ nats pub "iiot.readings.[ORG_ID].test" "hello" --account [ORG_ID]
# Expect: message received on subscriber
```

**Rollback**:

```
$ nsc delete account --name [ORG_ID]
psql> DROP SCHEMA org_[ORG_ID] CASCADE;
```

### RB.3.2 Edge Device Provisioning

**Prerequisites**:
- Organization onboarded (RB.3.1)
- Device hardware prepared with Sparkplug-B firmware [SPARKPLUG-B]
- MQTT broker credentials available

**Procedure**:

1. **Generate device credentials**

   ```
   $ nsc add user --account [ORG_ID] --name device-[DEVICE_ID] \
       --allow-pub "spBv1.0/[GROUP_ID]/+/[EDGE_NODE_ID]/+" \
       --allow-sub "spBv1.0/[GROUP_ID]/NCMD/[EDGE_NODE_ID]/+"
   ```

2. **Configure device firmware**

   Device configuration parameters (mapped to `sparkplug-adapter.ts` line 367):

   | Parameter | Value | Source |
   |-----------|-------|--------|
   | `serverUrl` | `mqtt://[HUB_BROKER]:1883` | Hub-specific |
   | `groupId` | `[GROUP_ID]` | ISA-95 area mapping |
   | `edgeNodeId` | `[EDGE_NODE_ID]` | Unique per device |
   | `keepalive` | `65` | Match adapter config |
   | `reconnectPeriod` | `1000` | Match adapter config |
   | `connectTimeout` | `30000` | Match adapter config |
   | `cleanSession` | `true` | Sparkplug requirement |

3. **Register device in asset hierarchy**

   Create the device entity in the ISA-95 hierarchy:
   - Enterprise > Site > Area > Line > WorkCell > Device
   - Each level maps to state services in `src/lib/iiot/state/`

4. **Verify device birth sequence**

   ```
   $ nats sub "spBv1.0/[GROUP_ID]/NBIRTH/[EDGE_NODE_ID]/+" --timeout 120s
   # Power on device
   # Expect: NBIRTH message with metric definitions
   ```

**Verification**:
- NBIRTH received within 120s of power-on
- SparkplugAdapter alias registry populated for new device
- `IngestionHealth.connected` reflects `true` (via `healthRef`)
- First DDATA message flows through pipeline to EventDistribution

### RB.3.3 Initial Health Verification

After onboarding an org and provisioning devices, run the full health check:

**Procedure**:

1. **NATS connectivity**
   ```
   $ nats server check connection --server [NATS_URL]
   $ nats server check jetstream --server [NATS_URL]
   $ nats stream info iiot-readings-[ORG_ID]
   ```

2. **Event pipeline end-to-end**
   ```
   # Publish a test reading via device or simulator
   # Verify arrival in EventDistribution channel:
   #   iiot:readings channel (maxLag 10,000)
   # Verify arrival in WebSocket subscriber (if connected):
   #   /ws/iiot endpoint
   ```

3. **Entity cluster health**
   ```
   # Verify EntityManager can create entities for the org:
   # Send a test command to a device entity
   # Verify entity state created in state service
   ```

4. **Database connectivity**
   ```
   psql> SELECT 1;
   psql> SELECT count(*) FROM org_[ORG_ID].devices;
   ```

---

## RB.4 Day-2 Operations

### RB.4.1 Adding New Production Lines / Machines

**Prerequisites**:
- Organization onboarded and operational
- ISA-95 hierarchy defined for new equipment

**Procedure**:

1. Identify the parent in the ISA-95 hierarchy
   (Enterprise > Site > Area > Line > WorkCell > Machine > Device)
2. Create entity state records for each new level:
   - Line entity via `LineState` (`src/lib/iiot/state/LineState.ts`)
   - Machine entity via `MachineState` (`src/lib/iiot/state/MachineState.ts`)
   - Device entities via `DeviceState` (`src/lib/iiot/state/DeviceState.ts`)
3. Provision edge devices per RB.3.2
4. Verify event flow from new devices to EventDistribution channels

**No NATS reconfiguration needed**: New device subjects are created
automatically within the org's existing wildcard subscription
(`iiot.readings.>` covers all device IDs).

### RB.4.2 Scaling Entity Capacity

**Trigger**: Entity processing latency exceeds SLO, or runner CPU > 80%.

**Procedure**:

1. **Add `@effect/cluster` runner nodes**

   ```
   # Deploy additional runner instances
   # Runners auto-register with RunnerStorage on startup
   # HashRing rebalances automatically
   ```

2. **Monitor shard migration**

   Watch for entity migration events during `HashRing` [EFFECT-HASHRING]
   rebalance:
   - Entity `Scope` teardown on old runners
   - Entity `build()` on new runners
   - Verify no event loss during migration (see FM.9.1.3)

3. **Verify capacity improvement**
   - Entity processing latency returns below SLO
   - Runner CPU utilization below 70% across pool
   - No entity state corruption post-migration

**Scaling guidance**:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Runner CPU | > 80% sustained 5 min | Add runner |
| Entity mailbox depth | > 100 messages | Add runner |
| Entity processing latency p99 | > 500ms | Add runner |
| Runner count | < 3 | Minimum for fault tolerance |

### RB.4.3 NATS Cluster Scaling

**Trigger**: JetStream storage > 75%, or message throughput approaching
server limits.

**Procedure**:

1. **Add NATS server to cluster**

   ```
   # Deploy new NATS server with cluster config
   $ nats-server -c /etc/nats/nats-server.conf
   # Server auto-joins cluster via configured routes
   ```

2. **Verify cluster membership**

   ```
   $ nats server report connections
   $ nats server report jetstream
   ```

3. **Rebalance JetStream streams** (if needed)

   ```
   # Move stream replicas to include new server
   $ nats stream edit [STREAM] --replicas 3
   ```

**Scaling guidance**:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Storage utilization | > 75% | Add server or expand disk |
| CPU utilization | > 70% sustained | Add server |
| Message throughput | > 80% of server capacity | Add server |
| Raft leader elections | > 1 per hour (unexpected) | Investigate network |

### RB.4.4 @effect/cluster Runner Pool Scaling

**Trigger**: Runner pool needs adjustment for capacity or cost optimization.

**Scale-up procedure**:

1. Deploy new runner instance(s)
2. Runners register with `RunnerStorage` automatically
3. `HashRing` rebalance assigns shards to new runners
4. Monitor entity migration (FM.5.2)
5. Verify: entity processing latency improved

**Scale-down procedure** (REQUIRES graceful drain):

1. Mark runner for drain (stop accepting new shard assignments)
2. Wait for in-flight entity operations to complete
3. Runner releases shard locks in `RunnerStorage`
4. `HashRing` reassigns released shards to remaining runners
5. Terminate drained runner
6. Verify: all entities accessible, no orphaned shards

**Normative requirement**: Scale-down MUST use graceful drain. Abrupt
termination causes entity interruption and potential in-flight operation
failure (see FM.5.1).

---

## RB.5 Incident Response

### RB.5.1 Severity Definitions

| Severity | Label | Definition | Response Time | Resolution Target |
|----------|-------|------------|---------------|-------------------|
| **P1** | Critical | Total event distribution failure. No events flowing for multiple orgs. | < 5 min | < 30 min |
| **P2** | High | Single hub failure, degraded delivery, or entity cluster partial failure. | < 15 min | < 1 hour |
| **P3** | Medium | Individual org connectivity issues, single device failures. | < 1 hour | < 4 hours |
| **P4** | Low | Non-critical feature degradation, cosmetic issues, documentation bugs. | < 4 hours | < 24 hours |

### RB.5.2 P1 Runbook: Total Event Distribution Failure

**Symptoms**:
- All EventDistribution channels report zero throughput
- WebSocket subscribers receive no events
- Multiple orgs report service unavailability

**Diagnosis**:

```
Step 1: Check NATS cluster health
  $ nats server check connection
  $ nats server report jetstream
  → If NATS down: proceed to Step 2a
  → If NATS healthy: proceed to Step 2b

Step 2a: NATS cluster recovery
  $ nats server report connections
  # Identify failed servers
  # Restart failed NATS servers
  $ systemctl restart nats-server
  # Verify Raft consensus restored
  $ nats server report jetstream --json | jq '.cluster.leader'
  → Proceed to Step 3

Step 2b: Check @effect/cluster runners
  # Check runner heartbeats in RunnerStorage
  psql> SELECT runner_id, last_heartbeat
        FROM runner_storage
        WHERE last_heartbeat > NOW() - INTERVAL '30 seconds';
  → If no runners alive: restart runner pool
  → If runners alive: proceed to Step 2c

Step 2c: Check EventDistribution service
  # Check if EventDistribution channels are registered
  # Look for channel registration at event-distribution.ts lines 169-199
  # Verify PubSub.unbounded inlets are operational
  # Check ChannelService broadcast outlets
  → If channels missing: restart EventDistribution layer
  → If channels present: check downstream (WebSocket server)

Step 3: Verify recovery
  # Publish test event
  $ nats pub iiot.readings.[TEST_ORG].test-device '{"test": true}'
  # Verify arrival in EventDistribution
  # Verify WebSocket delivery
  # Monitor for 5 minutes to confirm stability
```

**Escalation**: If not resolved within 30 minutes, escalate to on-call
infrastructure lead.

### RB.5.3 P2 Runbook: Single Hub Failure

**Symptoms**:
- One hub's devices report disconnection
- Other hubs operating normally
- Cross-hub event delivery delayed

**Diagnosis**:

```
Step 1: Identify the failed hub
  $ nats server report connections
  # Look for leaf node with zero or degraded connections

Step 2: Check hub NATS leaf node
  $ ssh [HUB_HOST] systemctl status nats-server
  → If down: restart
  → If up: check network connectivity to cloud cluster

Step 3: Check network path
  $ ssh [HUB_HOST] nats server check connection --server [CLOUD_NATS_URL]
  → If unreachable: network partition (see FM.4.3)
  → If reachable: check leaf node configuration

Step 4: Verify hub recovery
  # Monitor leaf node reconnection
  $ nats server report connections --filter [HUB_HOST]
  # Verify device NBIRTH messages resume
  # Monitor cross-hub event delivery convergence
```

### RB.5.4 P3 Runbook: Individual Org Connectivity

**Symptoms**:
- Single org reports service degradation
- Other orgs unaffected
- Org-specific metrics show anomalies

**Diagnosis**:

```
Step 1: Check org's NATS account
  $ nats account info [ORG_ID]
  # Verify: not suspended, within limits

Step 2: Check org's JetStream streams
  $ nats stream info iiot-readings-[ORG_ID]
  $ nats stream info iiot-alarms-[ORG_ID]
  # Verify: streams not full, consumers active

Step 3: Check org's device connectivity
  # Query SparkplugAdapter healthRef for org's devices
  # Check for sustained NDEATH certificates without rebirth

Step 4: Check org's entity instances
  # Verify entity state accessible
  psql> SELECT count(*) FROM org_[ORG_ID].devices WHERE status = 'active';
```

### RB.5.5 P4 Runbook: Non-Critical Degradation

**Symptoms**:
- Feature works but with degraded performance or cosmetic issues
- No data loss, no safety impact

**Response**:
1. Log issue in tracking system
2. Assess root cause at next business day
3. Schedule fix in next maintenance window if applicable
4. Monitor for escalation to higher severity

---

## RB.6 Maintenance Windows

### RB.6.1 NATS Server Rolling Upgrade

**Prerequisites**:
- New NATS server version tested in staging
- Cluster has 3+ servers (Raft requires majority)
- Maintenance window communicated to affected orgs

**Procedure**:

```
# Upgrade one server at a time, never more than minority at once

Step 1: Identify servers and current leader
  $ nats server report jetstream --json | jq '.cluster'

Step 2: Upgrade non-leader server first
  $ ssh [NON_LEADER_HOST]
  $ systemctl stop nats-server
  $ [Install new version]
  $ systemctl start nats-server
  # Verify: server rejoins cluster
  $ nats server check connection --server [NON_LEADER_HOST]:4222

Step 3: Wait for Raft sync
  # Verify server has caught up with Raft log
  $ nats server report jetstream
  # Wait until all streams report full replica count

Step 4: Repeat for remaining non-leader servers

Step 5: Upgrade leader (triggers leader election)
  # Leader step-down triggers clean election
  $ nats server request leader-stepdown
  # Wait for new leader elected
  $ nats server report jetstream --json | jq '.cluster.leader'
  # Upgrade old leader (now follower)
  $ ssh [OLD_LEADER_HOST]
  $ systemctl stop nats-server
  $ [Install new version]
  $ systemctl start nats-server

Step 6: Verify cluster health post-upgrade
  $ nats server check jetstream
  $ nats server report connections
```

**Rollback**: If upgraded server fails to rejoin, restore previous binary
and restart. Raft consensus maintains data integrity during rollback.

### RB.6.2 @effect/cluster Version Upgrade

**Prerequisites**:
- New version tested in staging with entity migration tests
- Runner pool has headroom for rolling restart

**Procedure**:

1. Deploy new runner version alongside existing pool
2. Drain old runners one at a time (RB.4.4 scale-down procedure)
3. Monitor entity migration during each drain
4. Verify: entity state preserved across version boundary
5. Remove all old runners once new pool is stable

**Rollback**: Deploy old version runners, drain new runners.

### RB.6.3 Database Migration

**Prerequisites**:
- Migration scripts tested in staging
- Database backup taken (RB.8.1)
- Maintenance window communicated

**Procedure**:

```
Step 1: Take pre-migration backup
  $ pg_dump -h [DB_HOST] -U [DB_USER] -d [DB_NAME] \
      -F custom -f backup-pre-migration-$(date +%Y%m%d).dump

Step 2: Apply migration in transaction
  psql> BEGIN;
  psql> -- Run migration script
  psql> -- Verify: schema changes applied
  psql> COMMIT;
  -- OR: ROLLBACK if verification fails

Step 3: Verify entity state services
  # Run state service integration tests against migrated schema
  # Verify: all 12 state services can read/write
  # Ref: src/lib/iiot/state/index.ts lines 132-147

Step 4: Monitor for errors
  # Watch application logs for SQL errors
  # Monitor entity handler success rate
```

**Rollback**: `pg_restore` from pre-migration backup.

### RB.6.4 Edge Device Firmware Update Rollout

**Prerequisites**:
- New firmware tested on pilot devices
- OTA update mechanism available
- Rollback firmware version available

**Procedure**:

1. **Canary rollout** (5% of devices)
   - Push firmware to canary group
   - Monitor for 24 hours: NBIRTH/DDATA/NDEATH patterns
   - Verify: no increase in protocol errors, no alias registry corruption

2. **Progressive rollout** (25% -> 50% -> 100%)
   - Each stage: push firmware, monitor 4 hours minimum
   - Gate criteria: error rate < baseline + 1%
   - Abort if: sustained protocol errors or device offline rate > 5%

3. **Verification per device**:
   - NBIRTH received post-update with new firmware version in metrics
   - DDATA messages maintain expected schema
   - SparkplugAdapter alias registry consistent

**Rollback**: OTA push of previous firmware version to affected devices.

---

## RB.7 Capacity Planning

### RB.7.1 When to Add Hub Servers

Monitor these metrics and act when thresholds are exceeded:

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Leaf node connections | > 80% capacity | > 95% | Add hub NATS leaf node |
| Hub-to-cloud bandwidth | > 70% link | > 90% | Upgrade link or add hub |
| Device count per hub | > 5,000 | > 8,000 | Split hub or add capacity |
| Message throughput | > 100K msg/s per hub | > 150K msg/s | Add hub |

**Planning formula**:
```
Required hubs = ceil(total_devices / 5000)
Required bandwidth = total_devices * avg_msg_size * avg_msg_rate * 1.5 (headroom)
```

### RB.7.2 When to Add @effect/cluster Runners

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Runner CPU average | > 70% | > 85% | Add runner |
| Entity mailbox depth p99 | > 50 msgs | > 100 msgs | Add runner |
| Entity processing latency p99 | > 200ms | > 500ms | Add runner |
| Active entities per runner | > 10,000 | > 20,000 | Add runner |

**Planning formula**:
```
Required runners = ceil(total_entities / 10000)
Minimum runners = 3 (fault tolerance)
Target runners = max(required, minimum) * 1.3 (30% headroom)
```

### RB.7.3 Storage Growth Projections

**JetStream storage per org**:

| Event Type | Avg Size | Rate | Daily Volume | 30d Volume |
|------------|----------|------|-------------|------------|
| Readings | 200 bytes | 10/s per device | 172 MB / 100 devices | 5.2 GB |
| Alarms | 500 bytes | 0.1/s per device | 4.3 MB / 100 devices | 129 MB |
| Equipment state | 300 bytes | 0.01/s per device | 0.26 MB / 100 devices | 7.8 MB |
| Invalidations | 100 bytes | 1/s per org | 8.6 MB / org | 259 MB |

**Aggregate planning for 200K orgs** (assuming 100 devices avg per org):

```
Daily readings:  200K orgs * 172 MB = 34.4 TB
30d readings:    200K orgs * 5.2 GB = 1.04 PB
30d alarms:      200K orgs * 129 MB = 25.8 TB
```

**Mitigation**: Stream `max_age` retention prevents unbounded growth.
Readings at 24h retention = 34.4 TB total (manageable across cluster).

### RB.7.4 Network Bandwidth Planning

**Per-hub bandwidth estimation**:

```
Inbound (devices -> hub):
  5000 devices * 10 msg/s * 200 bytes = 10 MB/s = 80 Mbps

Outbound (hub -> cloud):
  Same volume forwarded to cloud cluster
  10 MB/s * 1.2 (protocol overhead) = 96 Mbps

Hub-to-hub (cross-org, if applicable):
  Typically < 10% of total = 10 Mbps
```

**Recommended hub link**: 1 Gbps dedicated for IIoT traffic (10x headroom).

---

## RB.8 Backup and Recovery

### RB.8.1 Database Backup Strategy

**Frequency**:

| Backup Type | Frequency | Retention | Method |
|-------------|-----------|-----------|--------|
| Full backup | Daily | 30 days | `pg_dump` or streaming replica |
| Incremental WAL | Continuous | 7 days | WAL archiving to object storage |
| Pre-migration snapshot | Before each migration | Until migration verified | `pg_dump -F custom` |

**Procedure** (daily full backup):

```
$ pg_dump -h [DB_HOST] -U [DB_USER] -d [DB_NAME] \
    -F custom -Z 5 \
    -f /backups/tmnl-$(date +%Y%m%d-%H%M%S).dump

# Verify backup integrity
$ pg_restore --list /backups/tmnl-[TIMESTAMP].dump | head -20

# Upload to object storage
$ aws s3 cp /backups/tmnl-[TIMESTAMP].dump \
    s3://[BACKUP_BUCKET]/postgres/tmnl-[TIMESTAMP].dump
```

### RB.8.2 JetStream Snapshot Procedures

**Frequency**: Daily for critical streams (alarms, equipment state).

**Procedure**:

```
# Snapshot specific stream
$ nats stream backup iiot-alarms-[ORG_ID] /backups/jetstream/[ORG_ID]/alarms/

# Verify snapshot
$ nats stream restore --dry-run /backups/jetstream/[ORG_ID]/alarms/

# For bulk backup across all orgs:
$ for org in $(nats stream ls --json | jq -r '.[].name'); do
    nats stream backup $org /backups/jetstream/$org/
  done
```

**Retention**: 7 days for stream snapshots. Older snapshots archived to
object storage.

### RB.8.3 Entity State Backup via NATS KV Snapshots

If NATS KV is used for entity state caching:

```
# List KV buckets
$ nats kv ls

# Backup specific bucket
$ nats kv dump [BUCKET_NAME] > /backups/kv/[BUCKET_NAME]-$(date +%Y%m%d).json

# Restore from backup
$ nats kv restore [BUCKET_NAME] < /backups/kv/[BUCKET_NAME]-[DATE].json
```

**Note**: NATS KV keys use dot (`.`) separators, not colons.
Example: `host.abc-123` not `host:abc-123` [NATS-SUBJECTS].

### RB.8.4 Disaster Recovery: Full Metro Rebuild

**Scenario**: Complete loss of cloud NATS cluster and database.

**Prerequisites**:
- Database backup available (RB.8.1)
- JetStream snapshots available (RB.8.2)
- Infrastructure automation scripts (Nix flakes, container images)

**Procedure**:

```
Phase 1: Infrastructure (target: 30 min)
─────────────────────────────────────────
1. Provision new NATS cluster (3+ servers)
   $ nix develop .#tmnl-core
   # Deploy NATS servers via container orchestration
   # Ref: nix/modules/core.nix (nats-server in devShells)

2. Verify NATS cluster health
   $ nats server check connection
   $ nats server check jetstream

Phase 2: Data Restoration (target: 1 hour)
──────────────────────────────────────────
3. Restore database from latest backup
   $ pg_restore -h [NEW_DB_HOST] -U [DB_USER] -d [DB_NAME] \
       /backups/tmnl-[LATEST].dump

4. Restore JetStream streams from snapshots
   $ for stream_dir in /backups/jetstream/*/; do
       nats stream restore $stream_dir
     done

5. Restore NATS account JWTs
   $ nsc push --all

Phase 3: Service Recovery (target: 30 min)
──────────────────────────────────────────
6. Deploy @effect/cluster runner pool
   # Runners connect to new NATS cluster
   # EntityManager re-creates entities on first message

7. Deploy WebSocket server layer
   # Mount at /ws/iiot
   # Ref: src/lib/iiot/realtime/websocket-server.ts

8. Deploy EventDistribution
   # 4 channels re-registered
   # Ref: src/lib/iiot/realtime/event-distribution.ts lines 169-199

Phase 4: Verification (target: 30 min)
──────────────────────────────────────
9. Run health verification (RB.3.3)
10. Verify org accounts accessible
11. Verify device connections resuming
12. Monitor event flow for 15 min stability
```

**RTO (Recovery Time Objective)**: 2.5 hours
**RPO (Recovery Point Objective)**: Last backup (daily) + WAL replay (continuous)

---

## RB.9 Compliance Operations

### RB.9.1 Audit Log Review Procedures

**Frequency**: Monthly for routine review; on-demand for incidents.

**What to review**:

| Audit Category | Source | Review Frequency |
|---------------|--------|------------------|
| Entity state changes | Event journal (JetStream) | Monthly |
| Cross-org data sharing | NATS Account export logs | Monthly |
| User authentication | NATS JWT issuance logs | Monthly |
| Work order lifecycle | WorkOrderEntity audit trail [FDA-CFR11] | Per work order completion |
| Alarm acknowledgments | AlarmEntity state transitions [ISA-18.2] | Weekly |
| Trust score changes | Trust service event log | Monthly |

**Procedure**:

```
Step 1: Extract audit events for review period
  $ nats stream view iiot-alarms-[ORG_ID] \
      --start-time [START] --end-time [END] \
      --count 1000

Step 2: Verify alarm lifecycle compliance (ISA-18.2)
  # Every alarm MUST follow: Triggered → Acknowledged → Cleared
  # Check for: unacknowledged alarms older than SLA
  # Check for: cleared alarms without acknowledgment (violation)
  # Ref: src/lib/iiot/machines/AlarmMachine.ts (ISA-18.2 state graph)

Step 3: Verify work order compliance (FDA 21 CFR Part 11)
  # Every work order state transition MUST have:
  # - Operator identity (electronic signature)
  # - Timestamp
  # - Reason for change
  # Ref: src/lib/iiot/entity/WorkOrderEntity.ts (dual-write audit trail)

Step 4: Generate compliance report
  # Aggregate findings into standard report format
  # Flag violations for remediation
```

### RB.9.2 Data Retention Enforcement

**Normative requirement**: Data retention MUST comply with the org's
jurisdictional requirements. The system provides configurable retention
at the JetStream stream level.

| Data Type | Minimum Retention | Maximum Retention | Enforcement |
|-----------|-------------------|-------------------|-------------|
| Sensor readings | Per org policy | 7 years (FDA) | Stream `max_age` |
| Alarm events | 1 year [ISA-18.2] | 7 years [FDA-CFR11] | Stream `max_age` |
| Work order records | 2 years | Indefinite [FDA-CFR11] | Database retention policy |
| Equipment state | 1 year | 5 years | Stream `max_age` |
| Audit logs | 3 years | 7 years | Immutable append-only store |

**Procedure**:

```
# Review current retention settings
$ nats stream info iiot-alarms-[ORG_ID] --json | jq '.config.max_age'

# Update retention for compliance
$ nats stream edit iiot-alarms-[ORG_ID] --max-age 8760h  # 1 year

# Verify purge is not running on compliance-protected streams
$ nats stream info iiot-alarms-[ORG_ID] --json | jq '.state'
```

### RB.9.3 Right to Erasure Execution

**Trigger**: Org requests data deletion under GDPR Article 17 or equivalent.

**Procedure**:

```
Step 1: Identify all data for the requesting org
  - NATS Account: [ORG_ID]
  - JetStream streams: iiot-*-[ORG_ID]
  - Database schema: org_[ORG_ID]
  - Entity state in @effect/cluster
  - Cross-org references (exports, marketplace listings)

Step 2: Revoke cross-org data sharing
  $ nsc edit account [ORG_ID] --rm-export "iiot.*.>"
  # Wait for export revocation propagation

Step 3: Purge JetStream streams
  $ nats stream purge iiot-readings-[ORG_ID] --force
  $ nats stream purge iiot-alarms-[ORG_ID] --force
  $ nats stream purge iiot-equipment-[ORG_ID] --force
  $ nats stream purge iiot-invalidations-[ORG_ID] --force

Step 4: Delete database records
  psql> DROP SCHEMA org_[ORG_ID] CASCADE;

Step 5: Delete NATS account
  $ nsc delete account --name [ORG_ID]

Step 6: Verify deletion
  $ nats account info [ORG_ID]
  # Expect: account not found
  psql> SELECT schema_name FROM information_schema.schemata
        WHERE schema_name = 'org_[ORG_ID]';
  # Expect: no rows

Step 7: Generate erasure certificate
  # Document: what was deleted, when, by whom
  # Retain certificate for compliance records (exempt from erasure)
```

**Exceptions**: Audit logs related to cross-org interactions MAY be retained
in anonymized form for regulatory compliance, even after org erasure. The
org's identifying information MUST be replaced with a one-way hash.

### RB.9.4 Regulatory Report Generation

**FDA 21 CFR Part 11 reports**:

```
# Work order audit trail for specific work order
psql> SELECT * FROM org_[ORG_ID].work_order_audit
      WHERE work_order_id = [WO_ID]
      ORDER BY timestamp ASC;

# Electronic signature verification
psql> SELECT wo.id, wo.state, audit.operator_id, audit.signature_hash,
             audit.timestamp, audit.reason
      FROM org_[ORG_ID].work_orders wo
      JOIN org_[ORG_ID].work_order_audit audit ON wo.id = audit.work_order_id
      WHERE wo.completed_at BETWEEN [START] AND [END];
```

**ISA-18.2 alarm management reports**:

```
# Alarm rate analysis (alarms per hour)
$ nats stream info iiot-alarms-[ORG_ID] --json \
    | jq '.state.messages / (.state.last_ts - .state.first_ts) * 3600'

# Unacknowledged alarm duration analysis
# (requires application-level query against AlarmState)
psql> SELECT alarm_id, triggered_at,
             COALESCE(acknowledged_at, NOW()) - triggered_at AS time_to_ack
      FROM org_[ORG_ID].alarms
      WHERE triggered_at > NOW() - INTERVAL '30 days'
      ORDER BY time_to_ack DESC;
```

---

## RB.10 Codebase Grounding

### RB.10.1 Key Files for Operational Procedures

| File | Operational Domain | Relevant Procedures |
|------|--------------------|---------------------|
| `src/lib/iiot/realtime/event-distribution.ts` | Event channels | RB.3.3 health check, RB.5.2 P1 diagnosis, RB.8.4 DR restoration |
| `src/lib/iiot/realtime/holonet-bridge.ts` | NATS transport | RB.5.3 hub failure, RB.6.1 NATS upgrade verification |
| `src/lib/iiot/realtime/websocket-server.ts` | WebSocket delivery | RB.3.3 health check, RB.8.4 DR restoration |
| `src/lib/iiot/adapters/sparkplug-adapter.ts` | Edge device connectivity | RB.3.2 device provisioning, RB.6.4 firmware update |
| `src/lib/iiot/adapters/ingestion-service.ts` | Ingestion pipeline | RB.3.3 health check (`healthCheck` method) |
| `src/lib/iiot/entity/EntityStack.ts` | Entity composition | RB.3.1 org onboarding (lazy entity creation) |
| `src/lib/iiot/state/index.ts` | State services | RB.3.1 database provisioning (12 state services) |
| `src/lib/iiot/entity/AlarmEntity.ts` | Alarm lifecycle | RB.9.1 audit review (ISA-18.2 compliance) |
| `src/lib/iiot/entity/WorkOrderEntity.ts` | Work order lifecycle | RB.9.1 audit review (FDA 21 CFR Part 11) |
| `src/lib/iiot/machines/AlarmMachine.ts` | Alarm state graph | RB.9.1 alarm lifecycle compliance |
| `src/lib/iiot/workflow/AlarmLifecycleWorkflow.ts` | Workflow retry | RB.5.2 P1 diagnosis (Activity retry) |
| `nix/modules/core.nix` | Dev environment | RB.8.4 infrastructure provisioning (nats-server) |
| `src/lib/streams/constructs/ChannelService.ts` | Channel management | RB.5.2 P1 diagnosis (channel health) |

### RB.10.2 Infrastructure Configuration Files

| File / Module | Purpose | Relevant Procedures |
|---------------|---------|---------------------|
| `nix/modules/core.nix` | Core dev shell (includes `nats-server`) | RB.8.4 Phase 1 |
| `nix/modules/tauri.nix` | Tauri dev shell | N/A (desktop app) |
| `nix/modules/rust.nix` | Rust toolchain (includes `nats-server`) | RB.8.4 Phase 1 |
| `nix/default.nix` | Flake module composition | All infrastructure procedures |

### RB.10.3 Monitoring Endpoints

The following services expose health and metrics information referenced
by operational procedures:

| Service | Health Check | Metrics | Codebase Reference |
|---------|-------------|---------|-------------------|
| IngestionService | `healthCheck` method | `IngestionHealth` struct | `src/lib/iiot/adapters/ingestion-service.ts` line 92 |
| SparkplugAdapter | `healthRef` (Ref-backed) | `connected`, `errorCount` | `src/lib/iiot/adapters/sparkplug-adapter.ts` line 416 |
| EventDistribution | `Ref<DistributionMetrics>` | Per-channel publish counts, subscriber counts | `src/lib/iiot/realtime/event-distribution.ts` line 267 |
| NATS cluster | `nats server check` CLI | `$SYS.SERVER.*.STATSZ` | External (NATS server) |
| PostgreSQL | `SELECT 1` health probe | `pg_stat_activity` | External (database) |

---

## References

### Normative

- [RFC2119] -- Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [RFC8174] -- Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words."
- [ISA-18.2] -- ANSI/ISA-18.2-2016. "Management of Alarm Systems for the Process Industries."
- [FDA-CFR11] -- U.S. FDA, 21 CFR Part 11. "Electronic Records; Electronic Signatures."

### NATS / JetStream

- [JETSTREAM] -- Synadia. "NATS JetStream."
- [NATS-ACCOUNTS] -- Synadia. "NATS Account-Based Security."
- [NATS-JWT] -- Synadia. "In-Depth JWT Guide for NATS."
- [NATS-SUBJECTS] -- Synadia. "NATS Subject-Based Messaging."
- [NATS-ADAPTIVE-EDGE] -- Synadia. "Synadia Adaptive Edge Architecture."

### Effect-TS

- [EFFECT-CLUSTER] -- Effect Contributors. "@effect/cluster -- Distributed Entity Management."
- [EFFECT-HASHRING] -- Effect Contributors. "effect/HashRing -- Consistent Hashing."

### Protocols

- [SPARKPLUG-B] -- Eclipse Foundation. "Eclipse Sparkplug Specification v3.0.0."

### Companion Sections

- `rfc-section-failure-modes.md` -- Failure classification and recovery sequences
- `rfc-section-consistency-guarantees.md` -- Guarantee implementation mapping
- `rfc-section-two-domain-consistency.md` -- Normative ordering guarantees
- `rfc-section-security-trust.md` -- Security, trust, and tenant isolation
