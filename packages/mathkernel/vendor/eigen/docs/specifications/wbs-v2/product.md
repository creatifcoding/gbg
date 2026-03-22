# WBS V2 — Product Strategy, Market Scope & Manufacturing Process Support

**Domain**: Product Architecture
**RFC Sections**: S31 (Atlanta Manufacturing Market), S32 (Manufacturing Process Scope & Legacy Equipment), S33 (Product Strategy)
**Author**: product-architect
**Date**: 2026-02-13
**Revision**: 8 (OnboardingSession ownership resolution — DX owns entity, PR consumes via RPC)

---

## Category Legend

| Tag | Meaning |
|-----|---------|
| `CODE` | Effect-TS services, schemas, layers |
| `TEST` | Test files — schema roundtrip, model, DDL, repo, error, service, RPC, HTTP, streaming, Machine, Entity |
| `REACT` | React components, UI patterns |
| `INTEGRATION` | External API adapters, protocol bridges |
| `BUSINESS` | GTM execution, partnerships, pricing validation |
| `DESIGN` | UI/UX design, interaction patterns, wireframes |

---

## Entity Tier Classification

### Tier 1: Machine-Backed (12-layer stack)

Entities with state machine lifecycles, distributed via `@effect/cluster/Entity`, use `@effect/experimental/Machine`.

| Entity | States | Justification |
|--------|--------|---------------|
| **OnboardingSession** | `CREATED` -> `CREDENTIALS_PROVIDED` -> `CONNECTED` -> `DISCOVERING` -> `DEVICES_CONFIRMED` -> `DATA_FLOWING` -> `COMPLETE` / `TIMED_OUT` / `ABANDONED` | **DX-08 owns full 12-layer entity stack** (9-state model). PR consumes via DX RPCs. 15-minute SLA timer, step validation gates, resumable/abandonable |
| **ProtocolAdapter** | `disconnected` -> `connecting` -> `connected` -> `error` -> `reconnecting` -> `degraded` | Runtime connection lifecycle. Streaming RPC emits health events on state transitions. Follows EquipmentState pattern |

### Tier 2: CRUD (8-layer stack)

Data records without state machines.

| Entity | Justification |
|--------|---------------|
| **PricingConfig** | Configuration record — tiers don't transition |
| **UsageRecord** | Time-series append-only data |
| **ProtocolConversion** | Reference data — protocol mapping rules |
| **EquipmentRegistry** | Equipment inventory records with tier classification |
| **IntegrationPlaybook** | Reference data — step sequences per process type |
| **DataVolumeEstimate** | Calculated projection records |

### Test Budget Per Entity Tier

| Tier | Test Files | SP Budget | Note |
|------|-----------|-----------|------|
| Machine-backed | 12+ | 5 SP | Valid/invalid transitions, ES handler, Entity lifecycle, Observer emission, streaming RPC roundtrip |
| CRUD | 8 | 2-3 SP | Schema roundtrip, model, DDL, repo, error, L2 service, RPC roundtrip, HTTP endpoint |

**PubSub tests**: MUST use `it()` + `Effect.runPromise` wrapper, NOT `it.effect()` or `it.scoped()` — they timeout with PubSub + Stream.fromPubSub + Effect.fork.

### Machine.changes Architecture (RFC S12)

All Machine-backed entities participate in real-time via the same pipeline:

```
Machine.changes (Stream<State>)
  -> Stream.zipWithPrevious  (NOT Stream.pairwise — doesn't exist)
    -> makeEntityObserver()  (platform-owned, PL Epics 34-37)
      -> EntityStateChanged event
        -> EventDistribution channel (iiot:entity-changes, 5th channel)
          -> Streaming RPCs -> WebSocket clients
          -> HolonetBridge -> NATS -> distributed fan-out
```

**Product domain entities REGISTER with the observer infrastructure — they do NOT rebuild it.**

- `Machine.changes` is a `Stream<State>` emitted by `@effect/experimental/Machine`
- `Stream.zipWithPrevious` returns `[Option<PreviousState>, CurrentState]` — first emission has `Option.none()` for previous (handle as "initialized" action)
- `makeEntityObserver()` is platform-owned infrastructure (PL Epics 34-37) — product entities call it during entity activation to register a scoped observer fiber
- `EntityStateChanged` is the shared event schema (platform-owned) — carries entityType, entityId, fromState, toState, timestamp
- The 5th EventDistribution channel (`iiot:entity-changes`) handles fan-out — zero per-entity custom streaming logic needed

---

## E2E Stack Coverage Matrix

| Layer | Pricing (CRUD) | Protocol Conversion (CRUD) | Protocol Adapter (MACHINE) | Onboarding Session (MACHINE — **DX-08 owned**) | Capacity (CRUD) | Equipment Registry (CRUD) |
|-------|---------------|---------------------------|---------------------------|------------------------------|-----------------|--------------------------|
| 1. Schema | PR-04.1.1 | PR-03.1.2-PR-03.1.3 | PR-03.1.4 | **DX-08** | PR-12.1.1 | PR-03.1.1 |
| 1T. Schema Test | PR-04.T1 | PR-03.T1 | PR-03.T2 | **DX-08** | PR-12.T1 | PR-03.T1 (shared) |
| 2. Model | PR-15.1.1 | PR-15.1.2 | PR-15.1.5 | **DX-08** | PR-15.1.4 | PR-15.1.2 (shared) |
| 2T. Model Test | PR-15.T1 | PR-15.T2 | PR-15.T3 | **DX-08** | PR-15.T5 | PR-15.T2 (shared) |
| 3. DDL | PR-16.1.1 | PR-16.1.2 | PR-16.1.4 | **DX-08** | PR-16.1.3 | PR-16.1.2 (shared) |
| 3T. DDL Test | PR-16.T1 | PR-16.T2 | PR-16.T3 | **DX-08** | PR-16.T5 | PR-16.T2 (shared) |
| 4. Repository | PR-16.2.1 | PR-16.2.2 | PR-16.2.4 | **DX-08** | PR-16.2.3 | PR-16.2.2 (shared) |
| 4T. Repo Test | PR-16.T6 | PR-16.T7 | PR-16.T8 | **DX-08** | PR-16.T10 | PR-16.T7 (shared) |
| 5. Errors | PR-17.1.1 | PR-17.1.2 | PR-17.1.2 (shared) | **DX-08** | PR-17.1.4 | PR-17.1.2 (shared) |
| 5T. Error Test | PR-17.T1 | PR-17.T2 | PR-17.T2 (shared) | **DX-08** | PR-17.T4 | PR-17.T2 (shared) |
| 6. L2 Service | PR-04.1.2-PR-04.1.3 | PR-03.1.3 (mapping) | PR-03.1.4 | **DX-08** | PR-12.1.2 | PR-03.1.1 (shared) |
| 6T. Service Test | PR-04.T2 | PR-03.T3 | PR-03.T4 | **DX-08** | PR-12.T2 | PR-03.T3 (shared) |
| 7. **Machine** | N/A | N/A | **PR-22.1.1** | **DX-08** | N/A | N/A |
| 7T. Machine Test | N/A | N/A | **PR-22.T1-PR-22.T2** | **DX-08** | N/A | N/A |
| 8. **ES Handler** | N/A | N/A | **PR-22.1.2** | **DX-08** | N/A | N/A |
| 8T. ES Handler Test | N/A | N/A | **PR-22.T3** | **DX-08** | N/A | N/A |
| 9. **Entity** | N/A | N/A | **PR-22.1.3** | **DX-08** | N/A | N/A |
| 9T. Entity Test | N/A | N/A | **PR-22.T4** | **DX-08** | N/A | N/A |
| 10. **Observer** (wire into PL) | N/A | N/A | **PR-22.1.4** (register) | **DX-08** | N/A | N/A |
| 10T. Observer Test | N/A | N/A | **PR-22.T5** (Machine.changes) | **DX-08** | N/A | N/A |
| 11. RPC Group | PR-18.1.1 | PR-18.1.2 | PR-18.1.2 (shared) | PR-23.1.1 (consumer proxy) | PR-18.1.4 | PR-18.1.2 (shared) |
| 11T. RPC Test | PR-18.T1 | PR-18.T2 | PR-18.T2 (shared) | PR-23.T1 | PR-18.T4 | PR-18.T2 (shared) |
| 12. HTTP Route | PR-19.1.1 | PR-19.1.2 | PR-19.1.2 (shared) | PR-23.1.2 (consumer proxy) | PR-19.1.4 | PR-19.1.2 (shared) |
| 12T. HTTP Test | PR-19.T1 | PR-19.T2 | PR-19.T2 (shared) | PR-23.T2 | PR-19.T4 | PR-19.T2 (shared) |
| Streaming RPC | PR-20.1.1 | N/A | **PR-20.1.2** | PR-23.1.3 (subscribes DX stream) | N/A | N/A |
| Streaming Test | PR-20.T1 | N/A | **PR-20.T2** | PR-23.T3 | N/A | N/A |

---

## Phase 8: Schema & Process Extensions (Sprints 1-2) — 37 SP

### Epic PR-01: SensorType & MeasurementUnit Schema Extensions — 10 SP

Extends existing `SensorType` and `MeasurementUnit` Schema.Literal enums per S32.11 gap analysis.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-01.1.1 | Add `particulate`, `composition`, `displacement`, `spectral` to SensorType Schema.Literal (17 -> 21 literals) | CODE | 2 |
| ⏳ | PR-01.1.2 | Add `ppm`, `ppb`, `count_per_m3`, `uS_cm`, `degrees`, `micron`, `spm` to MeasurementUnit Schema.Literal (24 -> 31 literals) | CODE | 2 |
| ⏳ | PR-01.1.3 | Update SensorReading validation pipeline and tests for new types | CODE | 2 |
| ⏳ | PR-01.1.4 | Add vertical-specific sensor profile schemas (CNC, injection molding, food/bev, chemical, automotive, electronics, pharma, metal fab, plastics, packaging) | CODE | 2 |
| ⏳ | PR-01.T1 | **Schema roundtrip tests**: Decode/encode roundtrip for each new SensorType literal, each new MeasurementUnit literal, and each vertical sensor profile schema. Verify Schema.is() rejects invalid literals | TEST | 2 |

**Dependencies**: None (leaf node — extends existing schemas in `src/lib/iiot/schemas/`)
**RFC Sections**: S32.3 (Sensor Profiles), S32.11 (Schema Gap Analysis)
**Cross-Domain**: data-architect (schema compat), platform-architect (SensorType/MeasurementUnit extensions)

---

### Epic PR-02: ISA-95 Process Type Classification — 10 SP

Models ISA-95 process types (Discrete, Batch, Repetitive, Continuous) and maps verticals to their primary process type.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-02.1.1 | Define `ProcessType` Schema.Literal (`discrete`, `batch`, `repetitive`, `continuous`) and `ProcessTypeConfig` Schema.TaggedStruct | CODE | 2 |
| ⏳ | PR-02.1.2 | Define `ManufacturingVertical` Schema.TaggedStruct with NAICS code, process type, sensor profile reference, and priority tier (P1-P4) | CODE | 3 |
| ⏳ | PR-02.1.3 | Create `ProcessTypeDetection` Effect.Service — auto-detect process type from sensor data patterns (sampling rate, value distribution, batch markers) | CODE | 3 |
| ⏳ | PR-02.T1 | **Schema + service tests**: ProcessType/ProcessTypeConfig decode/encode roundtrip, ManufacturingVertical schema validation. ProcessTypeDetection service unit test — feed known sensor patterns for each ISA-95 type, verify correct classification | TEST | 2 |

**Dependencies**: Epic PR-01 (sensor type extensions)
**RFC Sections**: S32.1 (ISA-95 Classification), S32.2 (Priority Ordering), S32.3 (Sensor Profiles)
**Cross-Domain**: data-architect (entity schemas), platform-architect (service patterns)

---

### Epic PR-03: Legacy Equipment Taxonomy & Protocol Adapters — 17 SP

Models the 6-tier legacy equipment taxonomy and protocol conversion matrix from S32.5-S32.8.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-03.1.1 | Define `EquipmentTier` Schema.Literal (0-5) with `LegacyEquipment` Schema.TaggedStruct (tier, protocol, conversion complexity, typical sensors) | CODE | 2 |
| ⏳ | PR-03.1.2 | Define `ProtocolType` Schema.Literal covering all S32.6 protocols (4-20mA, Modbus RTU/TCP, Profibus, DeviceNet, EtherNet/IP, PROFINET, OPC UA, MTConnect, MQTT, Sparkplug B) | CODE | 2 |
| ⏳ | PR-03.1.3 | Create `ProtocolConversion` Schema.TaggedStruct with source protocol, gateway requirements, quality code mapping, data type mapping, and conversion gotchas | CODE | 3 |
| ⏳ | PR-03.1.4 | Create `ProtocolAdapter` Effect.Service — abstract adapter interface with `connect`, `read`, `subscribe`, `healthCheck` methods | CODE | 3 |
| ⏳ | PR-03.1.5 | Implement Modbus RTU/TCP adapter (highest priority — 35% market share per S32.6) | INTEGRATION | 3 |
| ⏳ | PR-03.T1 | **Schema roundtrip tests**: EquipmentTier/LegacyEquipment decode/encode, ProtocolType decode/encode, ProtocolConversion decode/encode. Verify Schema.is() rejects invalid tier values (>5) and unsupported protocols | TEST | 1 |
| ⏳ | PR-03.T2 | **Schema roundtrip test**: ProtocolAdapter schema decode/encode, verify adapter config validation | TEST | 1 |
| ⏳ | PR-03.T3 | **L2 Service test**: ProtocolConversion mapping service — verify `getConversionPath(Modbus_RTU, Sparkplug_B)` returns correct gateway + quality mapping. Test unknown protocol pair returns `ConversionPathNotFoundError` | TEST | 1 |
| ⏳ | PR-03.T4 | **L2 Service test**: ProtocolAdapter service — mock adapter `connect` -> `read` -> `subscribe` lifecycle. Verify `healthCheck` returns status. Test timeout handling on failed connect | TEST | 1 |

**Dependencies**: Epic PR-01 (sensor types for adapter output)
**RFC Sections**: S32.5 (Legacy Taxonomy), S32.6 (Protocol Landscape), S32.7 (Conversion Matrix), S32.8 (Quality Code Mapping)
**Cross-Domain**: infra-architect (gateway hardware), platform-architect (service patterns)

---

## Phase 9: Pricing & Business Services (Sprints 3-4) — 29 SP

### Epic PR-04: Pricing Engine Service — 16 SP

4-tier pricing model from S33.5 with usage metering and billing calculation.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-04.1.1 | Define `PricingTier` Schema.Literal (`starter`, `professional`, `enterprise`, `data_license`) with `PricingConfig` Schema.TaggedStruct (base price, per-sensor price, included sensors, features) | CODE | 2 |
| ⏳ | PR-04.1.2 | Create `PricingCalculation` Effect.Service — calculate monthly cost from tier + sensor count + add-ons | CODE | 3 |
| ⏳ | PR-04.1.3 | Create `UsageMetering` Effect.Service — track sensor-hours, data volume, API calls per billing period | CODE | 5 |
| ⏳ | PR-04.1.4 | Define pricing validation test suite — verify S33.5 reference prices (Starter $61.50/mo for 3 sensors, Professional $372.50/mo for 25 sensors, Enterprise $3,012-$4,212/mo) | CODE | 3 |
| ⏳ | PR-04.T1 | **Schema roundtrip test**: PricingTier/PricingConfig decode/encode roundtrip, UsageRecord schema validation, verify Schema.is() rejects invalid tier names | TEST | 1 |
| ⏳ | PR-04.T2 | **L2 Service tests**: PricingCalculation — verify monthly cost for each tier at various sensor counts against S33.5 reference data. UsageMetering — record usage, query billing summary, verify rollup accuracy. Test `UsageQuotaExceededError` fires at threshold | TEST | 2 |

**Dependencies**: None (standalone service)
**RFC Sections**: S33.5 (Pricing Model), S33.5.1 (Tier Details), S33.5.5 (Competitive Landscape)
**Cross-Domain**: None

---

### Epic PR-05: ERP Integration Services — 13 SP

Adapter services for QuickBooks (Earl persona), JobBOSS/ProShop (Diana), and SAP S/4HANA (Kim/Boeing).

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-05.1.1 | Define `ErpIntegration` Effect.Service interface — abstract adapter with `syncWorkOrders`, `pushAlerts`, `pullInventory`, `pushQualityData` | CODE | 3 |
| ⏳ | PR-05.1.2 | Implement QuickBooks Online adapter (REST API, OAuth 2.0) — work order cost sync, downtime cost attribution | INTEGRATION | 3 |
| ⏳ | PR-05.1.3 | Implement JobBOSS adapter (ODBC/REST) — job scheduling sync, machine utilization reporting | INTEGRATION | 3 |
| ⏳ | PR-05.1.4 | Define SAP S/4HANA adapter interface stub (IDoc/BAPI) — enterprise tier, deferred implementation | INTEGRATION | 2 |
| ⏳ | PR-05.T1 | **Integration adapter tests**: ErpIntegration service interface — mock adapter exercising all 4 methods. QuickBooks adapter — mock OAuth flow + work order sync roundtrip. JobBOSS adapter — mock ODBC read + scheduling sync. SAP stub — verify stub returns `NotImplementedError` | TEST | 2 |

**Dependencies**: None (adapters consume existing entity schemas)
**RFC Sections**: S33.8 (ERP Integration), S33.8.1 (Earl/QuickBooks), S33.8.2 (Diana/JobBOSS), S33.8.3 (Kim/SAP)
**Cross-Domain**: data-architect (entity schema compat for work orders, inventory)

---

## Phase 9.5: Model, DDL, Repository & Error Layers (Sprints 4-5) — 50.5 SP

### Epic PR-15: Model Derivation for Product Domains — 15 SP

Runtime model types derived from product domain schemas, following the `AlarmModel` / `SensorReadingModel` pattern in `src/lib/iiot/models/`.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-15.1.1 | Create `PricingModel` — derives from `PricingConfig` schema with computed fields: `effectiveRate` (per-sensor/mo), `annualProjection`, `tierDisplayName`; `UsageMeteringModel` with `billingPeriodSummary`, `usagePercentage` computed views | CODE | 2 |
| ⏳ | PR-15.1.2 | Create `ProtocolConversionModel` — derives from `ProtocolConversion` schema with `complexityScore` (computed from gateway + quality mapping), `estimatedSetupHours`, `compatibleGateways` list view. Shared with EquipmentRegistry model | CODE | 2 |
| ~~⏳~~ | ~~PR-15.1.3~~ | ~~OnboardingSessionModel~~ — **Removed (Rev 8): DX-08 owns full entity stack including model layer** | ~~CODE~~ | ~~2~~ → 0 |
| ⏳ | PR-15.1.4 | Create `DataVolumeModel` — derives from `DataVolumeEstimate` schema with `monthlyStorageCostUsd`, `bandwidthRequirementMbps`, `retentionDays` computed views for capacity estimator | CODE | 2 |
| ⏳ | PR-15.1.5 | Create `ProtocolAdapterModel` — derives from `ProtocolAdapter` schema with `connectionDurationMs`, `lastErrorTimestamp`, `uptimePercentage`, `currentStateDisplay` computed views for adapter health dashboard | CODE | 2 |
| ⏳ | PR-15.T1 | **Model test**: PricingModel — verify `effectiveRate` computed correctly for each tier, `annualProjection` = monthly * 12, UsageMeteringModel `usagePercentage` derived from usage/quota | TEST | 1 |
| ⏳ | PR-15.T2 | **Model test**: ProtocolConversionModel — verify `complexityScore` computation, `estimatedSetupHours` per tier, `compatibleGateways` list. EquipmentRegistryModel shared test | TEST | 1 |
| ⏳ | PR-15.T3 | **Model test**: ProtocolAdapterModel — verify `connectionDurationMs` from timestamps, `uptimePercentage` calculation, `currentStateDisplay` mapping from Machine state | TEST | 1 |
| ~~⏳~~ | ~~PR-15.T4~~ | ~~OnboardingSessionModel test~~ — **Removed (Rev 8): DX-08 owns model + tests** | ~~TEST~~ | ~~1~~ → 0 |
| ⏳ | PR-15.T5 | **Model test**: DataVolumeModel — verify `monthlyStorageCostUsd` from bytes * cost-per-byte, `bandwidthRequirementMbps` from sampling rates, `retentionDays` policy | TEST | 1 |

**Dependencies**: Epics PR-03, PR-04, PR-06, PR-12 (schemas must exist first)
**RFC Sections**: All — model layer spans all product domains
**Cross-Domain**: data-architect (model derivation patterns from `src/lib/iiot/models/`)

---

### Epic PR-16: DDL & Repository for Product Domains — 23.5 SP

SQL tables, indexes, constraints, and CRUD repositories following patterns in `src/lib/iiot/models/*.ddl.ts` and `src/lib/iiot/repositories/`.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-16.1.1 | `PricingConfig` DDL — `iiot.pricing_configs` table (tier, base_price, per_sensor_price, features JSONB), `iiot.usage_records` hypertable (entity_id, period_start, sensor_hours, data_bytes, api_calls) with TimescaleDB continuous aggregate for billing rollups | CODE | 3 |
| ⏳ | PR-16.1.2 | `ProtocolConversion` DDL — `iiot.protocol_conversions` table (source_protocol, target_protocol, gateway_type, quality_mapping JSONB, gotchas TEXT[]), `iiot.equipment_registry` table (equipment_id, tier, protocol, site_id FK) with indexes on (site_id, tier) | CODE | 3 |
| ⏳ | PR-16.1.3 | `DataVolumeEstimate` DDL — `iiot.capacity_estimates` table (site_id, tier_distribution JSONB, projected_daily_bytes, projected_monthly_bytes), materialized view for aggregated site capacity | CODE | 2 |
| ⏳ | PR-16.1.4 | `ProtocolAdapter` DDL — `iiot.protocol_adapters` table (adapter_id, site_id, protocol, gateway_id, current_state, last_connected_at, error_count, created_at), `iiot.adapter_state_transitions` event log table (adapter_id, from_state, to_state, transitioned_at, reason) | CODE | 2 |
| ~~⏳~~ | ~~PR-16.1.5~~ | ~~OnboardingSession DDL~~ — **Removed (Rev 8): DX-08 owns DDL layer** | ~~CODE~~ | ~~2~~ → 0 |
| ⏳ | PR-16.2.1 | `PricingRepository` — CRUD for pricing_configs + usage_records; `getCurrentTier(orgId)`, `recordUsage(record)`, `getBillingPeriodSummary(orgId, period)` with Effect SQL patterns | CODE | 2 |
| ⏳ | PR-16.2.2 | `ProtocolConversionRepository` — CRUD for protocol_conversions + equipment_registry; `findByProtocol(protocol)`, `getEquipmentBySite(siteId)`, `getConversionPath(source, target)` | CODE | 1 |
| ⏳ | PR-16.2.3 | `CapacityEstimateRepository` — CRUD for capacity_estimates; `getEstimateBySite(siteId)`, `getAggregatedCapacity(orgId)` | CODE | 1 |
| ⏳ | PR-16.2.4 | `ProtocolAdapterRepository` — CRUD for protocol_adapters + state transitions; `getAdaptersBySite(siteId)`, `recordTransition(adapterId, from, to, reason)`, `getAdapterHistory(adapterId)` | CODE | 1 |
| ~~⏳~~ | ~~PR-16.2.5~~ | ~~OnboardingSessionRepository~~ — **Removed (Rev 8): DX-08 owns repository layer** | ~~CODE~~ | ~~1~~ → 0 |
| ⏳ | PR-16.T1 | **DDL migration test**: `pricing_configs` table exists, constraints enforce valid tier values; `usage_records` hypertable created, continuous aggregate materializes | TEST | 1 |
| ⏳ | PR-16.T2 | **DDL migration test**: `protocol_conversions` table exists with JSONB constraints; `equipment_registry` table with FK to sites, index on (site_id, tier) | TEST | 0.5 |
| ⏳ | PR-16.T3 | **DDL migration test**: `protocol_adapters` table exists, `adapter_state_transitions` event log table with FK, index on (adapter_id, transitioned_at) | TEST | 0.5 |
| ~~⏳~~ | ~~PR-16.T4~~ | ~~OnboardingSession DDL test~~ — **Removed (Rev 8): DX-08 owns DDL tests** | ~~TEST~~ | ~~0.5~~ → 0 |
| ⏳ | PR-16.T5 | **DDL migration test**: `capacity_estimates` table exists, materialized view `site_capacity_summary` materializes correctly | TEST | 0.5 |
| ⏳ | PR-16.T6 | **Repo integration test**: PricingRepository — create config, record usage, query billing summary, verify `getCurrentTier` returns correct tier, `getBillingPeriodSummary` aggregates correctly | TEST | 1 |
| ⏳ | PR-16.T7 | **Repo integration test**: ProtocolConversionRepository — CRUD cycle, `findByProtocol` returns expected conversions, `getConversionPath` resolves multi-hop. EquipmentRegistry — `getEquipmentBySite` filters by site | TEST | 0.5 |
| ⏳ | PR-16.T8 | **Repo integration test**: ProtocolAdapterRepository — create adapter, `recordTransition` writes event, `getAdapterHistory` returns ordered transitions, `getAdaptersBySite` filters correctly | TEST | 0.5 |
| ~~⏳~~ | ~~PR-16.T9~~ | ~~OnboardingSessionRepository test~~ — **Removed (Rev 8): DX-08 owns repo tests** | ~~TEST~~ | ~~0.5~~ → 0 |
| ⏳ | PR-16.T10 | **Repo integration test**: CapacityEstimateRepository — create estimate, `getEstimateBySite` returns correct projection, `getAggregatedCapacity` sums across sites | TEST | 0.5 |

**Dependencies**: Epic PR-15 (models), existing DDL patterns in `src/lib/iiot/models/`
**RFC Sections**: S33.5 (Pricing persistence), S32.7 (Protocol conversion persistence), S32.9 (Capacity data)
**Cross-Domain**: data-architect (DDL conventions, migration ordering), infra-architect (TimescaleDB hypertable config)

---

### Epic PR-17: Error Schemas for Product Domains — 12 SP

Domain-specific TaggedError types per product entity, following the pattern in `src/lib/iiot/errors/alarm.ts`.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-17.1.1 | Create `src/lib/iiot/errors/pricing.ts` — `PricingTierNotFoundError`, `UsageQuotaExceededError`, `BillingPeriodNotFoundError`, `InvalidPricingConfigError`; union type `PricingError` | CODE | 2 |
| ⏳ | PR-17.1.2 | Create `src/lib/iiot/errors/protocol.ts` — `ProtocolNotSupportedError`, `GatewayConnectionError`, `ConversionPathNotFoundError`, `AdapterTimeoutError`, `QualityCodeMappingError`, `InvalidAdapterTransitionError`; union type `ProtocolError`. Covers both CRUD ProtocolConversion and Machine-backed ProtocolAdapter errors | CODE | 2 |
| ~~⏳~~ | ~~PR-17.1.3~~ | ~~OnboardingSession error schemas~~ — **Removed (Rev 8): DX-08 owns error layer. PR re-exports DX error types for wizard UI error handling** | ~~CODE~~ | ~~3~~ → 0 |
| ⏳ | PR-17.1.4 | Create `src/lib/iiot/errors/capacity.ts` — `CapacityEstimateNotFoundError`, `InvalidTierDistributionError`; union type `CapacityError`. Update `src/lib/iiot/errors/index.ts` barrel export with all new error modules | CODE | 3 |
| ⏳ | PR-17.T1 | **Error schema test**: Pricing errors — construct each variant, verify `_tag` discrimination, verify `PricingError` union type covers all variants. Test `Effect.catchTags` exhaustive matching | TEST | 0.5 |
| ⏳ | PR-17.T2 | **Error schema test**: Protocol errors — construct each variant including `InvalidAdapterTransitionError` with transition context. Verify union exhaustiveness. Test `Effect.catchTags` for both CRUD and Machine error paths | TEST | 0.5 |
| ~~⏳~~ | ~~PR-17.T3~~ | ~~OnboardingSession error tests~~ — **Removed (Rev 8): DX-08 owns error tests** | ~~TEST~~ | ~~0.5~~ → 0 |
| ⏳ | PR-17.T4 | **Error schema test**: Capacity errors — construct variants, verify union. Verify barrel export `src/lib/iiot/errors/index.ts` re-exports all 4 new modules | TEST | 0.5 |

**Dependencies**: Epics PR-03, PR-04, PR-06, PR-12 (schemas define error contexts)
**RFC Sections**: All — error layer spans all product domains
**Cross-Domain**: platform-architect (error handling patterns, Effect.catchTags convention)

---

## Phase 10: Machine-Backed Entities & Persona Dashboards (Sprints 5-7) — 79 SP

### Epic PR-22: ProtocolAdapter Machine Entity — 18 SP

**TIER 1: Machine-backed.** Protocol adapters have runtime connection lifecycle states. Follows the `AlarmEntity` + `AlarmMachine` pattern.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-22.1.1 | Create `ProtocolAdapterMachine` — state machine definition with states (`disconnected`, `connecting`, `connected`, `error`, `reconnecting`, `degraded`) and transitions. State graph in `machines/graphs/protocol-adapter-graph.ts`. Includes reconnect backoff logic, health check heartbeat, quality degradation detection | CODE | 5 |
| ⏳ | PR-22.1.2 | Create `ProtocolAdapterHandlers` — ES command handlers: `Connect(adapterId, config)`, `Disconnect(adapterId)`, `ReportError(adapterId, error)`, `HealthCheck(adapterId)`. Handlers delegate to Machine via `actor.send()`. Event log records all state transitions for audit trail | CODE | 3 |
| ⏳ | PR-22.1.3 | Create `ProtocolAdapterEntity` — `Entity.make('ProtocolAdapter', [...])` with Rpc.make definitions for all operations. Wire Machine boot in handler layer, distribute via `@effect/cluster` | CODE | 3 |
| ⏳ | PR-22.1.4 | **Wire observer**: Register ProtocolAdapter with platform's `makeEntityObserver('ProtocolAdapter', machine.changes)` during entity activation. The scoped observer fiber subscribes to `Machine.changes`, pipes through `Stream.zipWithPrevious` (handle `Option.none()` first emission as "initialized"), and publishes `EntityStateChanged` to the 5th EventDistribution channel (`iiot:entity-changes`). Zero custom streaming logic — uses platform infrastructure from PL Epics 34-37 | CODE | 2 |
| ⏳ | PR-22.T1 | **Machine valid transition test**: Exercise all valid transitions: `disconnected -> connecting -> connected`, `connected -> error -> reconnecting -> connected`, `connected -> degraded`, `degraded -> reconnecting -> connected`, `* -> disconnected`. Verify state after each transition | TEST | 1 |
| ⏳ | PR-22.T2 | **Machine invalid transition test**: Attempt invalid transitions: `disconnected -> connected` (must go through connecting), `connecting -> degraded` (not a valid path), `error -> connected` (must go through reconnecting). Verify `InvalidAdapterTransitionError` raised | TEST | 1 |
| ⏳ | PR-22.T3 | **ES Handler test**: Send `Connect` command, verify `AdapterConnected` event emitted + state persisted. Send `ReportError`, verify `AdapterErrorOccurred` event. Send `Disconnect`, verify `AdapterDisconnected` event. Full command -> events -> state roundtrip | TEST | 1 |
| ⏳ | PR-22.T4 | **Entity.make integration test**: Boot ProtocolAdapterEntity, send Create RPC, verify entity registered in cluster. Send Connect + HealthCheck RPCs via `RpcTest.makeClient`, verify responses. Test entity shutdown/recovery | TEST | 1 |
| ⏳ | PR-22.T5 | **Machine.changes + observer wiring test**: Boot entity, trigger state transitions via `actor.send()`, verify `Machine.changes` stream emits new state. Verify `Stream.zipWithPrevious` produces correct `[Option<prev>, current]` pairs (first emission has `Option.none()`). Verify `EntityStateChanged` events published to EventDistribution channel (`iiot:entity-changes`). Use `it()` + `Effect.runPromise` (NOT `it.effect()`) for PubSub roundtrip. Verify event payload: `{ entityType: 'ProtocolAdapter', entityId, fromState, toState, timestamp }` | TEST | 1 |

**Dependencies**: Epic PR-03 (ProtocolAdapter schema + service), Epic PR-17 (error schemas), **PL Epics 34-37 (observer infrastructure — `makeEntityObserver`, EntityStateChanged schema, 5th EventDistribution channel)**
**RFC Sections**: S32.6 (Protocol Landscape), S32.7 (Conversion Matrix), **S12 (Observer Pattern & Entity Integration)**
**Cross-Domain**: platform-architect (Machine patterns from `src/lib/iiot/machines/AlarmMachine.ts`, **observer infrastructure from PL Epics 34-37**), infra-architect (gateway hardware lifecycle)
**Canonical Pattern**: `src/lib/iiot/entity/AlarmEntity.ts` (Machine boot + handler delegation)

---

### Epic PR-23: OnboardingSession Consumer Integration — 6 SP

**CONSUMER EPIC.** OnboardingSession entity is **owned by DX-08** (devex domain) with a full 12-layer stack and canonical 9-state model. Product domain consumes the entity via DX RPCs for wizard UI, support dashboards, and onboarding progress streaming.

**DX-08 canonical 9-state model**: `CREATED` -> `CREDENTIALS_PROVIDED` -> `CONNECTED` -> `DISCOVERING` -> `DEVICES_CONFIRMED` -> `DATA_FLOWING` -> `COMPLETE` / `TIMED_OUT` / `ABANDONED`

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-23.1.1 | Create `OnboardingConsumerRpcs` — product-side RPC proxy that calls DX-08 entity RPCs: `GetOnboardingSession(sessionId)`, `GetOnboardingMetrics(orgId)`, `GetPlaybookForVertical(vertical)`. Wraps DX RPC client with product-specific error mapping | CODE | 2 |
| ⏳ | PR-23.1.2 | Create `OnboardingConsumerHttpGroup` — `GET /api/onboarding/:id` (proxy to DX entity), `GET /api/onboarding/playbooks/:vertical`, `GET /api/onboarding/metrics/:orgId`. Register in `IIoTApi` composition | CODE | 2 |
| ⏳ | PR-23.1.3 | Create `SubscribeOnboardingProgress` streaming RPC — subscribes to DX-08's OnboardingSession entity state change stream via EventDistribution channel. Used by support dashboards monitoring 15-minute SLA compliance. Use `it()` + `Effect.runPromise` for PubSub roundtrip | CODE | 1 |
| ⏳ | PR-23.T1 | **RPC consumer test**: `GetOnboardingSession` returns session state from DX mock, `GetOnboardingMetrics` returns SLA compliance stats, `GetPlaybookForVertical` returns correct playbook. Test error mapping from DX errors to product-friendly responses | TEST | 0.5 |
| ⏳ | PR-23.T2 | **HTTP consumer test**: `GET /api/onboarding/:id` proxies correctly, `GET /api/onboarding/playbooks/cnc_discrete` returns playbook. Test 404 on unknown session/vertical | TEST | 0.5 |
| ⏳ | PR-23.T3 | **Streaming consumer test**: `SubscribeOnboardingProgress` — subscribe to session, verify DX state change events propagate to product consumer stream. Use `it()` + `Effect.runPromise` for PubSub roundtrip | TEST | 0 |

**Dependencies**: **DX-08 (OnboardingSession entity — full 12-layer stack)**, Epic PR-03 (protocol detection for auto-discovery UX)
**RFC Sections**: S33.7.1 (15-minute onboarding SLA), S32.12 (Brownfield Playbooks)
**Cross-Domain**: **devex-architect (DX-08 owns entity, PR-23 consumes via RPC)**, platform-architect (RPC proxy patterns)
**Note**: All Machine, Handler, Entity, Observer, Schema, Model, DDL, Repository, and Error layers are DX-08 owned. PR-23 is a pure consumer integration.

---

### Epic PR-06: Onboarding Wizard — 7 SP

Multi-step React compound component targeting 15-minute SLA from S33.7 GTM Phase 1. **Consumes DX-08 OnboardingSession entity via RPCs** (schema, model, DDL, repo, Machine, Handler, Entity, Observer all owned by DX-08).

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ~~⏳~~ | ~~PR-06.1.1~~ | ~~OnboardingStep/OnboardingSession schema definition~~ — **Removed (Rev 8): DX-08 owns schemas. Wizard imports DX schema types for UI rendering** | ~~CODE~~ | ~~2~~ → 0 |
| ⏳ | PR-06.1.2 | Build wizard compound component — step navigation, progress indicator, validation gates, SLA countdown timer. **Calls DX-08 RPCs** (`StartOnboarding`, `AdvanceStep`, `DiscoverSensors`, `AbandonOnboarding`, `CompleteOnboarding`) for all state mutations. Subscribes to DX 9-state model for UI display | REACT | 3 |
| ⏳ | PR-06.1.3 | Implement sensor auto-discovery step — scan network, identify protocols, suggest equipment tier classification. **Triggers DX-08 `DiscoverSensors` RPC** which transitions entity CONNECTED -> DISCOVERING | REACT | 3 |
| ~~⏳~~ | ~~PR-06.T1~~ | ~~Schema roundtrip test~~ — **Removed (Rev 8): DX-08 owns schema tests** | ~~TEST~~ | ~~0.5~~ → 0 |
| ⏳ | PR-06.T2 | **Service test**: Sensor auto-discovery — mock DX-08 `DiscoverSensors` RPC response, verify correct equipment tier classification and protocol type detection in wizard UI | TEST | 1 |

**Dependencies**: **DX-08 (OnboardingSession entity)**, Epic PR-03 (protocol detection for auto-discovery)
**RFC Sections**: S33.7.1 (GTM Phase 1 — 15-minute onboarding SLA), S32.12 (Brownfield Playbooks)
**Cross-Domain**: **devex-architect (DX-08 owns entity, PR-06 consumes via RPC)**, infra-architect (network scanning)

---

### Epic PR-07: Persona Dashboard — Earl (Shop Owner) — 8 SP

Simple, high-signal dashboard for owner of 1-5 CNC machines. Gloved-hand interaction, traffic-light status.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-07.1.1 | Design Earl dashboard wireframe — single-screen KPI (OEE, active alarms, daily output), traffic-light status per machine | DESIGN | 2 |
| ⏳ | PR-07.1.2 | Build `ShopOverview` compound component — machine status grid, alarm summary, daily production counter | REACT | 3 |
| ⏳ | PR-07.1.3 | Build `QuickAlertCard` component — large-format alarm with 48px touch targets, swipe-to-acknowledge on mobile | REACT | 3 |

**Dependencies**: None (consumes existing alarm/equipment entities)
**RFC Sections**: S33.1.1 (Earl Persona), S33.9 (Factory-Floor UX), S33.9.1 (Gloved-Hand Interaction)
**Cross-Domain**: None

---

### Epic PR-08: Persona Dashboard — Diana (Operations Manager) — 8 SP

Multi-line operations view with shift scheduling, throughput trends, and downtime tracking.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-08.1.1 | Design Diana dashboard wireframe — multi-line status, shift timeline, throughput sparklines, downtime Pareto | DESIGN | 2 |
| ⏳ | PR-08.1.2 | Build `OpsOverview` compound component — line status cards, shift selector, production vs target gauge | REACT | 3 |
| ⏳ | PR-08.1.3 | Build `DowntimeAnalysis` component — Pareto chart of downtime causes, drill-down to equipment/shift | REACT | 3 |

**Dependencies**: None (consumes existing entities)
**RFC Sections**: S33.1.2 (Diana Persona), S33.3 (Diana Journey)
**Cross-Domain**: None

---

### Epic PR-09: Factory-Floor UX Components — 10 SP

Shared interaction patterns for rugged tablet / wall-mounted displays per S33.9.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-09.1.1 | Define `FactoryFloorTheme` — 48px minimum touch targets, high-contrast colors, large fonts (16px+ body, 20px+ headings), gloved-hand safe spacing | DESIGN | 2 |
| ⏳ | PR-09.1.2 | Build `NfcAuthGate` component — NFC badge tap authentication, fallback to PIN entry | REACT | 3 |
| ⏳ | PR-09.1.3 | Build `AlarmManagement` compound component — ISA-18.2 state machine visualization (normal -> unacknowledged -> acknowledged -> return-to-normal), shelving controls | REACT | 3 |
| ⏳ | PR-09.1.4 | Build `EnvironmentalAdaptive` layout — detect ambient light (bright factory floor), auto-adjust contrast; detect noise level, switch to visual-only alerts | REACT | 2 |

**Dependencies**: None
**RFC Sections**: S33.9 (Factory-Floor UX), S33.9.1 (Gloved-Hand), S33.9.2 (Noise Analysis), S33.9.3 (Device Matrix), S33.9.4 (Alarm UX)
**Cross-Domain**: infra-architect (rugged device specs)

---

### Epic PR-10: Persona Dashboards — Raj & Carlos — 8 SP

Quality engineer (Raj) and maintenance manager (Carlos) views.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-10.1.1 | Build `QualityDashboard` compound component — SPC charts, control limits, non-conformance tracker, certificate compliance status | REACT | 3 |
| ⏳ | PR-10.1.2 | Build `MaintenanceDashboard` compound component — equipment health scores, predictive maintenance alerts, spare parts inventory, MTBF/MTTR metrics | REACT | 3 |
| ⏳ | PR-10.1.3 | Design shared metric card system — reusable KPI cards with trend indicators, threshold alerts, drill-down links | DESIGN | 2 |

**Dependencies**: Epic PR-07 (shared component patterns)
**RFC Sections**: S33.1.3 (Raj Persona), S33.1.4 (Carlos Persona)
**Cross-Domain**: data-architect (quality/maintenance entity schemas)

---

## Phase 11: Brownfield Integration & Onboarding (Sprints 8-9) — 21 SP

### Epic PR-11: Brownfield Integration Playbooks — 11 SP

Codified Day 0-30 onboarding sequences per process type from S32.12-S32.13.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-11.1.1 | Define `IntegrationPlaybook` Schema.TaggedStruct — steps, prerequisites, estimated duration, equipment tier compatibility, vertical applicability | CODE | 2 |
| ⏳ | PR-11.1.2 | Implement CNC Discrete playbook — Day 0 (survey), Day 1-3 (gateway install), Day 4-7 (protocol config), Day 8-14 (baseline), Day 15-30 (optimize) | CODE | 2 |
| ⏳ | PR-11.1.3 | Implement Injection Molding playbook — includes batch start/end detection, cycle time extraction, SPC parameter mapping | CODE | 2 |
| ⏳ | PR-11.1.4 | Implement Food/Bev playbook — includes HACCP critical control points, temperature chain validation, sanitation cycle detection | CODE | 2 |
| ⏳ | PR-11.1.5 | Implement Pharma playbook — includes 21 CFR Part 11 compliance checks, cleanroom particulate monitoring, batch record integration | CODE | 2 |
| ⏳ | PR-11.T1 | **Schema + playbook validation test**: IntegrationPlaybook decode/encode roundtrip. Verify each playbook (CNC, Injection Molding, Food/Bev, Pharma) — steps ordered correctly, prerequisites reference valid equipment tiers, estimated durations match S32.13 timelines | TEST | 1 |

**Dependencies**: Epic PR-02 (process type classification), Epic PR-03 (protocol adapters)
**RFC Sections**: S32.12 (Brownfield Playbooks), S32.13 (Onboarding Timelines)
**Cross-Domain**: devex-architect (onboarding wizard integration), infra-architect (gateway installation procedures)

---

### Epic PR-12: Data Volume & Capacity Planning Service — 10 SP

Data volume estimation and capacity planning from S32.9.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-12.1.1 | Define `DataVolumeEstimate` Schema.TaggedStruct — sensors per tier, sampling rates, bytes per reading, daily/monthly volume projections | CODE | 2 |
| ⏳ | PR-12.1.2 | Create `CapacityPlanning` Effect.Service — estimate storage/bandwidth requirements from equipment tier + sensor count + sampling rates | CODE | 3 |
| ⏳ | PR-12.1.3 | Build `CapacityEstimator` React component — interactive calculator showing projected data volume, storage costs, bandwidth requirements by tier | REACT | 3 |
| ⏳ | PR-12.T1 | **Schema roundtrip test**: DataVolumeEstimate decode/encode, verify Schema.is() rejects negative sensor counts and zero sampling rates | TEST | 1 |
| ⏳ | PR-12.T2 | **L2 Service test**: CapacityPlanning — verify storage estimate for known tier distribution matches S32.9 reference data. Test edge cases: all Tier 0 (minimal data), all Tier 5 (maximum data), mixed distribution | TEST | 1 |

**Dependencies**: Epic PR-03 (equipment tier definitions)
**RFC Sections**: S32.9 (Data Volume Estimation)
**Cross-Domain**: infra-architect (storage infrastructure sizing)

---

## Phase 11.5: RPC, HTTP & Streaming Layers (Sprints 9-10) — 33 SP

### Epic PR-18: RPC Groups for Product Domains — 11 SP

RPC definitions following the `AlarmRpcs` / `RealtimeRpcs` pattern in `src/lib/iiot/rpc/`.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-18.1.1 | Create `PricingRpcs` — `GetPricingTier`, `CalculateQuote` (request/response), `GetUsageSummary`, `QueryUsageHistory` (stream: true for billing period records) | CODE | 2 |
| ⏳ | PR-18.1.2 | Create `ProtocolRpcs` — stateless query RPCs: `GetConversionPath(source, target)`, `ListSupportedProtocols`, `GetEquipmentRegistry(siteId)`. Entity RPCs for ProtocolAdapter auto-generated via `EntityProxy.toRpcGroup(ProtocolAdapterEntity)` | CODE | 2 |
| ~~⏳~~ | ~~PR-18.1.3~~ | ~~OnboardingRpcs via EntityProxy~~ — **Removed (Rev 8): Replaced by PR-23.1.1 consumer RPC proxy. DX-08 owns entity RPCs** | ~~CODE~~ | ~~2~~ → 0 |
| ⏳ | PR-18.1.4 | Create `CapacityRpcs` — `GetCapacityEstimate(siteId)`, `CalculateProjection(tierDistribution)`, `GetAggregatedCapacity(orgId)` | CODE | 2 |
| ⏳ | PR-18.T1 | **RPC roundtrip test**: PricingRpcs — `RpcTest.makeClient` for `GetPricingTier` (verify tier returned), `CalculateQuote` (verify cost calculation), `GetUsageSummary`. Need `Effect.scoped` before `Effect.provide`, `RpcSerialization.layerJson` required | TEST | 1 |
| ⏳ | PR-18.T2 | **RPC roundtrip test**: ProtocolRpcs — `GetConversionPath` returns valid path, `ListSupportedProtocols` returns all 10+ protocols, `GetEquipmentRegistry` returns site equipment. Test EntityProxy-generated RPCs for ProtocolAdapter entity | TEST | 1 |
| ~~⏳~~ | ~~PR-18.T3~~ | ~~OnboardingRpcs EntityProxy test~~ — **Removed (Rev 8): Replaced by PR-23.T1 consumer test** | ~~TEST~~ | ~~0.5~~ → 0 |
| ⏳ | PR-18.T4 | **RPC roundtrip test**: CapacityRpcs — `GetCapacityEstimate` returns projection, `CalculateProjection` from tier distribution, `GetAggregatedCapacity` sums sites | TEST | 0.5 |

**Dependencies**: Epics PR-04, PR-03, PR-06, PR-12 (services), Epic PR-17 (error schemas), Epics PR-22, PR-23 (Machine entities for EntityProxy)
**RFC Sections**: All — RPC layer exposes all product domain services
**Cross-Domain**: platform-architect (RpcGroup patterns, `Rpc.make` conventions, `EntityProxy.toRpcGroup` pattern)
**Note**: RPC tests use `RpcTest.makeClient` which creates nested objects for dotted tags (e.g., `client.Pricing.GetTier()`). Need `Effect.scoped` before `Effect.provide`, `RpcSerialization.layerJson` must be provided.

---

### Epic PR-19: HTTP API Endpoints for Product Domains — 11 SP

REST endpoints wrapping RPC groups, following the `EntityProxy.toHttpApiGroup` / `HttpApiGroup` pattern in `src/lib/iiot/http/api.ts`.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-19.1.1 | Create `PricingHttpGroup` — `POST /api/pricing/quote`, `GET /api/pricing/tiers`, `GET /api/pricing/usage/:orgId`, `GET /api/pricing/usage/:orgId/history` wrapping `PricingRpcs` | CODE | 2 |
| ⏳ | PR-19.1.2 | Create `ProtocolHttpGroup` — `GET /api/protocols`, `GET /api/protocols/conversion/:source/:target`, `GET /api/equipment/:siteId`. ProtocolAdapter entity endpoints via `EntityProxy.toHttpApiGroup('adapters', ProtocolAdapterEntity).prefix('/api/adapters')` | CODE | 2 |
| ~~⏳~~ | ~~PR-19.1.3~~ | ~~OnboardingHttpGroup via EntityProxy~~ — **Removed (Rev 8): Replaced by PR-23.1.2 consumer HTTP proxy. DX-08 owns entity HTTP endpoints** | ~~CODE~~ | ~~2~~ → 0 |
| ⏳ | PR-19.1.4 | Create `CapacityHttpGroup` — `GET /api/capacity/:siteId`, `POST /api/capacity/projection`, `GET /api/capacity/aggregate/:orgId`. Register all groups in `IIoTApi` composition in `src/lib/iiot/http/api.ts` | CODE | 2 |
| ⏳ | PR-19.T1 | **HTTP endpoint test**: PricingHttpGroup — `POST /api/pricing/quote` returns 200 with cost, `GET /api/pricing/tiers` returns all 4 tiers, `GET /api/pricing/usage/:orgId` returns summary. Test 400 on invalid tier, 404 on unknown org | TEST | 1 |
| ⏳ | PR-19.T2 | **HTTP endpoint test**: ProtocolHttpGroup — `GET /api/protocols` returns list, `GET /api/protocols/conversion/Modbus_RTU/Sparkplug_B` returns path. EntityProxy endpoints `POST /api/adapters` creates adapter, `GET /api/adapters/:id` returns state | TEST | 1 |
| ~~⏳~~ | ~~PR-19.T3~~ | ~~OnboardingHttpGroup test~~ — **Removed (Rev 8): Replaced by PR-23.T2 consumer HTTP test** | ~~TEST~~ | ~~0.5~~ → 0 |
| ⏳ | PR-19.T4 | **HTTP endpoint test**: CapacityHttpGroup — `GET /api/capacity/:siteId` returns estimate, `POST /api/capacity/projection` accepts tier distribution, `GET /api/capacity/aggregate/:orgId` sums sites. Test 400 on invalid input | TEST | 0.5 |

**Dependencies**: Epic PR-18 (RPC groups must exist)
**RFC Sections**: All — HTTP layer exposes RPCs as REST
**Cross-Domain**: platform-architect (HttpApi composition pattern), security-architect (auth middleware applicability)

---

### Epic PR-20: Streaming RPC Definitions — 11 SP

Real-time streaming subscriptions for product domains, following the `RealtimeRpcs` pattern in `src/lib/iiot/rpc/RealtimeRpcs.ts`.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-20.1.1 | Create `SubscribePricingUsage` streaming RPC — emit usage events in real-time as sensor-hours/data-bytes accumulate, with throttle support. Add to `RealtimeRpcs` group or separate `PricingRealtimeRpcs` | CODE | 3 |
| ⏳ | PR-20.1.2 | Create `SubscribeProtocolAdapterStatus` streaming RPC — emit adapter health events (connected, disconnected, error, quality_degraded) for all active protocol adapters at a site. Backed by ProtocolAdapterObserver (Epic PR-22.1.4) via EventDistribution channel | CODE | 3 |
| ~~⏳~~ | ~~PR-20.1.3~~ | ~~SubscribeOnboardingProgress streaming RPC~~ — **Removed (Rev 8): Replaced by PR-23.1.3 consumer streaming subscription. DX-08 owns entity observer + stream** | ~~CODE~~ | ~~2~~ → 0 |
| ⏳ | PR-20.T1 | **Streaming RPC test**: `SubscribePricingUsage` — subscribe, emit usage event, verify client receives event with correct payload. Test throttle parameter reduces event frequency. Use `it()` + `Effect.runPromise` (NOT `it.effect()`) for PubSub roundtrip | TEST | 1 |
| ⏳ | PR-20.T2 | **Streaming RPC test**: `SubscribeProtocolAdapterStatus` — subscribe to site, trigger adapter state change, verify client receives `EntityStateChanged` event with adapterId + state. Use `it()` + `Effect.runPromise` for PubSub roundtrip | TEST | 1 |
| ⏳ | PR-20.T3 | **Streaming RPC test**: `SubscribeOnboardingProgress` — subscribe to session, advance step, verify client receives step completion event with sessionId + completionPercentage. Use `it()` + `Effect.runPromise` for PubSub roundtrip. Verify SLA timer events are published when deadline approaches | TEST | 1 |

**Dependencies**: Epics PR-22, PR-23 (Machine entities + observer wiring feed streaming RPCs), **PL Epics 34-37 (observer infrastructure)**, existing `RealtimeRpcs` pattern
**RFC Sections**: S33.5 (usage tracking), S32.7 (protocol health), S33.7.1 (onboarding SLA monitoring), **S12 (Observer Pattern — Machine.changes pipeline)**
**Cross-Domain**: platform-architect (streaming RPC patterns, WebSocket transport, EventDistribution channel integration, **Machine.changes -> makeEntityObserver -> EntityStateChanged pipeline**)
**Note**: Capacity planning is request/response only — N/A for streaming. PubSub tests MUST use `it()` + `Effect.runPromise` per MEMORY.md.
**Architecture**: Streaming RPCs PR-20.1.2 and PR-20.1.3 subscribe to the 5th EventDistribution channel (`iiot:entity-changes`) — they do NOT build custom per-entity streaming. `Machine.changes` feeds `makeEntityObserver()` which publishes `EntityStateChanged` events. The streaming RPC handler calls `Stream.fromPubSub(entityChangesChannel)` filtered by entityType.

---

## Phase 12: Cross-Domain Smoke Tests & GTM (Sprints 10-12) — 26 SP

### Epic PR-21: Cross-Domain Integration Smoke Tests — 5 SP

Cross-domain smoke tests verifying the full product stack works end-to-end. Per-entity layer tests are now distributed across Epics PR-01 to PR-20 (T-suffixed tasks). This epic tests cross-entity interactions only.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-21.1.1 | **Cross-domain smoke test**: Onboarding-to-pricing flow — start onboarding session, discover sensors, complete wizard, verify pricing tier auto-assigned based on sensor count. Exercises: OnboardingSession Machine + PricingCalculation service + UsageMetering service | TEST | 2 |
| ⏳ | PR-21.1.2 | **Cross-domain smoke test**: Protocol-to-capacity flow — register equipment with protocol adapters, connect adapters, verify capacity estimate auto-updates based on connected sensor count. Exercises: ProtocolAdapter Machine + EquipmentRegistry CRUD + CapacityPlanning service | TEST | 2 |
| ⏳ | PR-21.1.3 | **Cross-domain smoke test**: ERP sync flow — create alarm event, verify it propagates to QuickBooks adapter mock with correct cost attribution. Exercises: Alarm entity (existing) + ERP integration adapter + pricing service for cost calculation | TEST | 1 |

**Dependencies**: All prior epics — full E2E stack must exist
**RFC Sections**: All
**Cross-Domain**: devex-architect (test infrastructure, vitest patterns)

---

### Epic PR-13: GTM Cold-Start Execution — 13 SP

Business operations for the 4-phase GTM strategy from S33.7.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-13.1.1 | Phase 1 — GaMEP partnership activation: formal MOU, joint pilot program structure, co-branded materials | BUSINESS | 3 |
| ⏳ | PR-13.1.2 | Phase 1 — Recruit 3 founding shops (target: Earl-type discrete manufacturers, <50 employees, CNC-heavy) from named accounts (Dalton CNC, Peachtree Precision, Southwire) | BUSINESS | 3 |
| ⏳ | PR-13.1.3 | Phase 2 — Boeing supplier network entry: Identify procurement champion, map Tier 2/3 supplier requirements, AS9100 compliance pathway | BUSINESS | 2 |
| ⏳ | PR-13.1.4 | Phase 3 — Community network effects: Deploy neighborhood mesh between proximate shops, cross-referral incentive program | BUSINESS | 3 |
| ⏳ | PR-13.1.5 | Phase 4 — Scale & geographic expansion: Replicate playbook to Greenville-Spartanburg, Birmingham, Chattanooga corridors | BUSINESS | 2 |

**Dependencies**: Epic PR-06 (onboarding wizard for Phase 1 pilots)
**RFC Sections**: S33.7 (GTM Cold-Start), S33.7.1-S33.7.4 (Phases 1-4)
**Cross-Domain**: None (business operations)

---

### Epic PR-14: Competitive Positioning & Sales Enablement — 8 SP

Artifacts derived from S33.10 competitive positioning matrix.

| Status | Task | Description | Category | SP |
|--------|------|-------------|----------|----|
| ⏳ | PR-14.1.1 | Build competitive battle cards — TMNL vs MachineMetrics, Sight Machine, Tulip, Ignition, Plex, Xometry with differentiation on DePIN economics, mesh networking, community ownership | BUSINESS | 3 |
| ⏳ | PR-14.1.2 | Define ROI calculator schemas and service — per-persona ROI projections (Earl: $18K->$54K annual savings, Diana: $45K->$135K, Raj: scrap reduction 15-25%) | CODE | 3 |
| ⏳ | PR-14.1.3 | Build `RoiCalculator` interactive component — input shop size/vertical/current monitoring, output projected savings with payback period | REACT | 2 |

**Dependencies**: Epic PR-04 (pricing for ROI calculations)
**RFC Sections**: S33.10 (Competitive Positioning), S33.1 (Persona ROI data)
**Cross-Domain**: None

---

## Summary

| Phase | Sprints | SP | Epics |
|-------|---------|-----|-------|
| Phase 8: Schema & Process Extensions | 1-2 | 37 | PR-01, PR-02, PR-03 |
| Phase 9: Pricing & Business Services | 3-4 | 29 | PR-04, PR-05 |
| Phase 9.5: Model, DDL, Repo & Error Layers | 4-5 | 50.5 | PR-15, PR-16, PR-17 |
| Phase 10: Machine Entities & Dashboards | 5-7 | 79 | PR-22, PR-23, PR-06, PR-07, PR-08, PR-09, PR-10 |
| Phase 11: Brownfield Integration & Onboarding | 8-9 | 21 | PR-11, PR-12 |
| Phase 11.5: RPC, HTTP & Streaming Layers | 9-10 | 33 | PR-18, PR-19, PR-20 |
| Phase 12: Cross-Domain Smoke Tests & GTM | 10-12 | 26 | PR-21, PR-13, PR-14 |
| **TOTAL** | **1-12** | **275.5** | **23 epics** |

### Category Breakdown

| Category | SP | % |
|----------|-----|---|
| CODE (schemas, models, DDL, repos, errors, machines, handlers, entities, observers, RPCs, HTTP, streaming) | 149 | 54.1% |
| TEST (per-entity at each layer + cross-domain smoke) | 53.5 | 19.4% |
| REACT (Components, dashboards, UX) | 34 | 12.3% |
| INTEGRATION (ERP adapters, protocol bridges) | 11 | 4.0% |
| BUSINESS (GTM, partnerships, sales) | 16 | 5.8% |
| DESIGN (Wireframes, UX patterns) | 8 | 2.9% |
| CODE+REACT mixed (capacity planner, ROI calc) | 4 | 1.5% |

### Test Task Summary

| Entity | Tier | Test Tasks | Test SP | Test Locations |
|--------|------|-----------|---------|----------------|
| PricingConfig + UsageRecord | CRUD | 8 | 8.5 | PR-04.T1-T2, PR-15.T1, PR-16.T1+T6, PR-17.T1, PR-18.T1, PR-19.T1 |
| ProtocolConversion + EquipmentRegistry | CRUD | 7 | 6 | PR-03.T1+T3, PR-15.T2, PR-16.T2+T7, PR-17.T2, PR-18.T2, PR-19.T2 |
| ProtocolAdapter | Machine | 12 | 12 | PR-03.T2+T4, PR-15.T3, PR-16.T3+T8, PR-17.T2, PR-18.T2, PR-19.T2, PR-20.T2, PR-22.T1-T5 |
| OnboardingSession | Machine | 12 | 11.5 | PR-06.T1-T2, PR-15.T4, PR-16.T4+T9, PR-17.T3, PR-18.T3, PR-19.T3, PR-20.T3, PR-23.T1-T5 |
| DataVolumeEstimate | CRUD | 7 | 6 | PR-12.T1-T2, PR-15.T5, PR-16.T5+T10, PR-17.T4, PR-18.T4, PR-19.T4 |
| IntegrationPlaybook | CRUD | 1 | 1 | PR-11.T1 |
| Cross-domain | Smoke | 3 | 5 | PR-21.1.1-PR-21.1.3 |
| **TOTAL** | | **50** | **50** | |

### Revision History

| Rev | SP | Epics | Change |
|-----|-----|-------|--------|
| 1 | 134 | 14 | Initial WBS |
| 2 | 196 | 20 | +E2E stack layers (Model, DDL, Repo, Error, RPC, HTTP, Streaming, Tests) |
| 3 | 228 | 22 | +Machine/CRUD classification: OnboardingSession + ProtocolAdapter get full 12-layer stack |
| 4 | 267 | 22 | +Per-entity test tasks distributed across all epics. +39 SP (50 test tasks). Epic 50 reduced to cross-domain smoke only (-5 SP). PubSub tests use `it()` + `Effect.runPromise` per MEMORY.md |
| 5 | 267 | 22 | Machine.changes observer wiring clarification. Observer tasks reframed as registration into platform's `makeEntityObserver()`. Added PL Epics 34-37 dependency. Documented `Stream.zipWithPrevious` (not `Stream.pairwise`). Streaming RPCs consume EventDistribution channel |
| 6 | 275.5 | 23 | PR- prefix renumbering (phase-ordered) + SP corrections. Fixed header/task-sum discrepancies |
| 7 | 275.5 | 23 | **PR- prefix renumbering — team-lead prescribed mapping.** Re-applied with original-epic-number ordering (30=PR-01, 31=PR-02, ..., 51=PR-22, 52=PR-23). SP totals unchanged from Rev 6 |

**Rev 7 renumbering map (old -> new):**

| Old | New | Epic Name |
|-----|-----|-----------|
| 30 | PR-01 | SensorType & MeasurementUnit Schema Extensions |
| 31 | PR-02 | ISA-95 Process Type Classification |
| 32 | PR-03 | Legacy Equipment Taxonomy & Protocol Adapters |
| 33 | PR-04 | Pricing Engine Service |
| 34 | PR-05 | ERP Integration Services |
| 35 | PR-06 | Onboarding Wizard |
| 36 | PR-07 | Persona Dashboard — Earl |
| 37 | PR-08 | Persona Dashboard — Diana |
| 38 | PR-09 | Factory-Floor UX Components |
| 39 | PR-10 | Persona Dashboards — Raj & Carlos |
| 40 | PR-11 | Brownfield Integration Playbooks |
| 41 | PR-12 | Data Volume & Capacity Planning Service |
| 42 | PR-13 | GTM Cold-Start Execution |
| 43 | PR-14 | Competitive Positioning & Sales Enablement |
| 44 | PR-15 | Model Derivation for Product Domains |
| 45 | PR-16 | DDL & Repository for Product Domains |
| 46 | PR-17 | Error Schemas for Product Domains |
| 47 | PR-18 | RPC Groups for Product Domains |
| 48 | PR-19 | HTTP API Endpoints for Product Domains |
| 49 | PR-20 | Streaming RPC Definitions |
| 50 | PR-21 | Cross-Domain Integration Smoke Tests |
| 51 | PR-22 | ProtocolAdapter Machine Entity |
| 52 | PR-23 | OnboardingSession Machine Entity |

### Entity Tier Summary

| Entity | Tier | Layers | Test Files | Test SP | Justification |
|--------|------|--------|-----------|---------|---------------|
| OnboardingSession | Machine | 12 | 12 | 11.5 | Lifecycle: not_started -> discovering -> configuring -> validating -> completed/failed/abandoned. 15-min SLA timer, resumable |
| ProtocolAdapter | Machine | 12 | 12 | 12 | Lifecycle: disconnected -> connecting -> connected -> error -> reconnecting -> degraded. Runtime health monitoring |
| PricingConfig + UsageRecord | CRUD | 8 | 8 | 8.5 | Configuration record + time-series append-only data |
| ProtocolConversion + EquipmentRegistry | CRUD | 8 | 7 | 6 | Reference data + inventory records (shared model/DDL/repo) |
| IntegrationPlaybook | CRUD | 8 | 1 | 1 | Reference data — minimal test surface, validated via playbook content tests |
| DataVolumeEstimate | CRUD | 8 | 7 | 6 | Calculated projections |

### Dependency Graph

```
Epic PR-01 (Schema Extensions)
  |-->  Epic PR-02 (Process Type Classification)
  |     '-->  Epic PR-11 (Brownfield Playbooks)
  '-->  Epic PR-03 (Legacy Equipment & Protocol Adapters)
        |-->  Epic PR-06 (Onboarding Wizard Schema)
        |-->  Epic PR-11 (Brownfield Playbooks)
        '-->  Epic PR-12 (Data Volume & Capacity)

Epic PR-04 (Pricing Engine) -->  Epic PR-14 (Competitive Positioning)
Epic PR-05 (ERP Integration) -- Independent

                        +-- Epic PR-15 (Models)
Epics PR-01..05,06,12 -+
                        '-- Epic PR-17 (Errors)

Epic PR-15 -------------+-- Epic PR-16 (DDL + Repos)
                        |
                        +-- Epic PR-22 (ProtocolAdapter MACHINE)
                        |     '-- Machine + Handler + Entity + Observer
                        |
                        '-- Epic PR-23 (OnboardingSession MACHINE)
                              '-- Machine + Handler + Entity + Observer

Epics PR-22, PR-23 ----+-- Epic PR-18 (RPCs -- uses EntityProxy.toRpcGroup)
                        |
                        '-- Epic PR-20 (Streaming -- backed by Observers)

Epic PR-18 ---------------- Epic PR-19 (HTTP -- uses EntityProxy.toHttpApiGroup)

Epics PR-19, PR-20 -------- Epic PR-21 (Cross-Domain Smoke Tests)

Epic PR-07 (Earl Dashboard) -->  Epic PR-10 (Raj & Carlos Dashboards)
Epic PR-08 (Diana Dashboard) -- Independent
Epic PR-09 (Factory-Floor UX) -- Independent
```

### E2E Stack Layer N/A Declarations

| Layer | Domain | N/A Reason |
|-------|--------|------------|
| Machine + Handler + Entity + Observer | PricingConfig, UsageRecord | CRUD only — no state lifecycle |
| Machine + Handler + Entity + Observer | ProtocolConversion, EquipmentRegistry | CRUD only — reference/inventory data |
| Machine + Handler + Entity + Observer | IntegrationPlaybook | CRUD only — reference data |
| Machine + Handler + Entity + Observer | DataVolumeEstimate | CRUD only — calculated projections |
| Streaming RPCs | Capacity Planning | Request/response only — no live data feed needed |
| Streaming RPCs | PricingConfig, ProtocolConversion, EquipmentRegistry, IntegrationPlaybook | CRUD entities — no state change stream |
| ~~DDL + Repository for OnboardingSession~~ | ~~N/A~~ | **REVERSED in Rev 3**: OnboardingSession now persisted for SLA tracking, session resume, and audit trail |

### Cross-Domain Dependencies

| This Epic | Depends On | Domain |
|-----------|-----------|--------|
| Epic PR-01 | SensorType/MeasurementUnit extension coordination | platform-architect |
| Epic PR-01 | Schema compatibility verification | data-architect |
| Epic PR-03 | Gateway hardware specifications | infra-architect |
| Epic PR-05 | Work order / inventory entity schemas | data-architect |
| Epic PR-06 | Onboarding UX flow design | devex-architect |
| Epic PR-09 | Rugged device specifications | infra-architect |
| Epic PR-10 | Quality/maintenance entity schemas | data-architect |
| Epic PR-11 | Onboarding wizard integration | devex-architect |
| Epic PR-11 | Gateway installation procedures | infra-architect |
| Epic PR-12 | Storage infrastructure sizing | infra-architect |
| Epic PR-15 | Model derivation patterns | data-architect |
| Epic PR-16 | DDL conventions, migration ordering, TimescaleDB config | data-architect, infra-architect |
| Epic PR-17 | Error handling patterns (Effect.catchTags) | platform-architect |
| Epic PR-18 | RpcGroup/Rpc.make/EntityProxy.toRpcGroup conventions | platform-architect |
| Epic PR-19 | HttpApi composition, EntityProxy.toHttpApiGroup, auth middleware | platform-architect, security-architect |
| Epic PR-20 | Streaming RPC patterns, WebSocket transport, EventDistribution channels | platform-architect |
| Epic PR-21 | Test infrastructure, vitest patterns | devex-architect |
| Epic PR-22 | Machine patterns (AlarmMachine), Entity patterns (AlarmEntity), **Observer infrastructure (PL Epics 34-37): `makeEntityObserver()`, EntityStateChanged schema, 5th EventDistribution channel** | platform-architect |
| Epic PR-23 | Machine patterns, Entity patterns, **Observer infrastructure (PL Epics 34-37): `makeEntityObserver()`, EntityStateChanged schema, 5th EventDistribution channel**, SLA timer fiber patterns | platform-architect |
| Epic PR-20 | **Machine.changes -> makeEntityObserver -> EntityStateChanged pipeline (PL Epics 34-37)**, streaming RPC patterns, WebSocket transport | platform-architect |

### Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema extensions break existing SensorReading pipeline | HIGH | Epic PR-01 includes validation test update (PR-01.1.3) + schema roundtrip test (PR-01.T1) |
| ERP API rate limits / authentication complexity | MEDIUM | Start with QuickBooks (simplest OAuth 2.0), defer SAP to stub. Adapter tests (PR-05.T1) mock external APIs |
| 15-minute onboarding SLA unrealistic for Tier 0-1 equipment | HIGH | Playbooks differentiate by tier — Tier 0 targets Day 1-3 gateway install, not instant. SLA timer test (PR-23.T2) verifies timeout behavior |
| Factory-floor ambient conditions degrade NFC auth | MEDIUM | PIN fallback in Epic PR-09.1.2 |
| GTM Phase 1 — GaMEP partnership timeline uncertain | MEDIUM | Parallel outreach to GMA and academic channels |
| Pricing validation against competitors — market may shift | LOW | Competitive battle cards (Epic PR-14) include regular refresh cadence |
| DDL migration ordering conflicts with other domains | MEDIUM | Coordinate migration sequence numbers with data-architect. DDL tests (PR-16.T1-T5) catch constraint violations |
| ProtocolAdapter Machine complexity — reconnect backoff + health check | MEDIUM | Follow EquipmentStateMachine pattern. Machine transition tests (PR-22.T1-T2) verify all valid/invalid paths |
| OnboardingSession SLA timer as scheduled fiber — resource leak risk | MEDIUM | Use Effect.timeout with Scope cleanup. SLA timer test (PR-23.T2) verifies timeout + cleanup |
| Machine entities increase cluster coordination overhead | LOW | Same sharding pattern as existing Alarm/WorkOrder/EquipmentState entities. Entity lifecycle tests (PR-22.T4, PR-23.T4) verify cluster behavior |
| PubSub roundtrip tests timeout with `it.effect()` | HIGH | Per MEMORY.md: ALL streaming/observer tests (PR-20.T1-T3, PR-22.T5, PR-23.T5) use `it()` + `Effect.runPromise`, NOT `it.effect()` or `it.scoped()` |
| `Stream.pairwise` does not exist — use `Stream.zipWithPrevious` | MEDIUM | Per platform-architect deepwiki verification: `Stream.zipWithPrevious` returns `[Option<A>, A]`. First emission has `Option.none()` for previous state — handle as "initialized" action. Tests PR-22.T5 and PR-23.T5 verify this behavior |
| Observer infrastructure dependency on PL Epics 34-37 | HIGH | Product domain Machine entities (OnboardingSession, ProtocolAdapter) cannot wire observers until platform delivers `makeEntityObserver()` factory and the 5th EventDistribution channel. Coordinate timeline with platform-architect |
