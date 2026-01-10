# GEOINT Event Architecture Design Record

> Design session: 2026-01-10
> Participants: Val (AI), Prime (Human)

---

## Part 1: Architecture Understanding

### Q1.1: Transport to Cluster
**Q**: When you run a search from the browser, which transport connects to the cluster?
**A**: AtomRpc (WebSocket RPC)

### Q1.2: RPC Types
**Q**: What's the difference between search(query) vs streamSearch(query)?
**A**: Response vs Stream - `search` returns all at once; `streamSearch` emits events progressively

### Q1.3: Sharding
**Q**: In the fan-out/fan-in pattern, which shard handles aggregation?
**A**: `search-coordinator` - dedicated coordinator shard for aggregation

### Q1.4: Graceful Degradation
**Q**: What happens if DurableStreamClient is not provided to the handlers?
**A**: Graceful degradation - search works, but no reconnection/replay support

---

## Part 2: Data Flow Verification

### Q2.1: Entry Point
**Q**: Where does the browser client actually connect?
**A**: SearchRpcServer.ts (WebSocket server on port 8081)
**Insight**: "IT seems we're still connecting to SearchRpcServer, even though, theoretically, cluster-node is to be utilized"

### Q2.2: Error Handling
**Q**: When source-osm fails (Overpass API timeout), what happens to the search?
**A**: Other sources continue - error captured in response, partial results returned

### Q2.3: Concurrency
**Q**: How are source queries parallelized in AggregatedSearch?
**A**: Concurrency: 2 (two sources at a time to limit memory pressure)
**Note**: User answered "All at once" - this was corrected

### Q2.4: DurableStreams Status
**Q**: Current DurableStreams usage in SearchEntityHandlers is?
**A**: Fire-and-forget - events published but not awaited, errors swallowed
**Note**: User answered "Full integration" - this was corrected

---

## Part 3: Architecture Gap Discovery

### Key Finding: Duplication
SearchRpcServer.ts and SearchEntityHandlers.ts are **parallel implementations**:
- SearchRpcServer: Original, handles everything locally, no cluster awareness
- SearchEntityHandlers: New, designed for distributed processing, has cluster awareness
- They are NOT connected

### Q3.1: Integration Path
**Q**: The cluster is built but not wired. What's the priority?
**A**: "I need to build and sync understanding with you. My understanding is that cluster-node was leveraging whatever SearchRpcServer WAS, and that was the entrypoint. This is obviously a messy understanding."

### Resolution
Clarified that:
1. cluster-node.ts imports SearchEntityHandlers.ts (not SearchRpcServer.ts)
2. Both contain similar logic (API calls, repo queries)
3. They're duplicates, not connected
4. Target: RpcServer becomes thin proxy to Cluster via Sharding.send()

---

## Part 4: Handler Logic Verification

### Q4.1: Cluster handlers have real logic?
**Q**: Does cluster-node truly possess the proper logic? Are we utilizing per-source encapsulation?
**A**: Yes, confirmed. SearchEntityHandlers.ts imports:
- ExternalApiClient.ts (OpenSky, Overpass API calls)
- persistence/ (PostGIS repositories)
- DurableStreamClient (for publishing)

### Dependency Graph Verified
```
SearchEntityHandlers.ts
├── ../api/ExternalApiClient (API services + transformers)
├── ../persistence (PostGIS/SQL repositories)
└── ../../durable-streams/service (append-only log)
```

---

## Part 5: DurableStreams Integration Deep Dive

### Q5.1: Where is DurableStreams used?
**A**: In SearchEntityHandlers.ts at three points:
1. Line 996: AggregatedSearch publishes SearchCompleted
2. Line 1104: StreamSearch publishes SearchPartialResults
3. Line 1140: StreamSearch publishes SearchCompleted

### Q5.2: DurableStreams Mental Model Gap
**User observation**: "The durable stream integration is pretty shallow. I was expecting for this to be the primary place where events, results, everything is published, per the canonical entities. On the backend, the raw is passed around through the application layer."

**Gap Identified**: Current implementation treats DS as side-effect; user expects DS as primary event bus.

---

## Part 6: Event-Sourcing Readiness Assessment

### Inventory Results

| Component | Status | Notes |
|-----------|--------|-------|
| DurableStreams | Ready | Full implementation (append, subscribe, SSE) |
| Schemas | Ready | All use TaggedClass with _tag |
| Materializer | Ready | Event → PostGIS bridge exists |
| TrackStore | Ready | Fully event-sourced |
| Ingesters | Gap | Write directly to DB, skip streams |
| Search Events | Gap | Exist but not persisted |
| Checkpoints | Gap | In-memory only |

### Readiness Score: 60-70%

---

## Part 7: Target Architecture Decisions

### Q7.1: Architecture Direction
**Q**: Which architecture do you want to move towards?
**A**: Event-sourced

### Q7.2: API Access in Search Handlers
**Q**: Should search handlers still call external APIs on cache miss?
**A**: "Queries only, handoff to ingestion if data is stale/missing"

### Q7.3: Stream Granularity
**Q**: What's the stream granularity for ingested data?
**A**: "Durable streams need to be at the frontend not as a source of truth. The source of truth is the actual raw and canonical database tables."

### Mental Model Clarification
**Confirmed**: This is CQRS pattern, not pure event-sourcing:
- DATABASE = Source of Truth (raw.* + entity.* tables)
- DURABLE STREAMS = Frontend Event Bus (real-time, replay, reconnection)
- Flow: API → Ingester → DB (commit) → publish to stream (notify frontend)

### Q7.4: Special Considerations
**A**: "Will need adaptations and provisions for a Geointelligence platform. In particular, we are ingesting data from multisources, all in the effort of creating robust canonical entities."

---

## Part 8: Stale Data Handoff Pattern

### Q8.1: Pattern Selection
**Q**: Which stale data handoff pattern fits GEOINT needs?
**A**: Custom stream-first hybrid

### Pattern Description
```
Search Request → Return Stale Immediately
        ↓
Subscribe Client to entity streams
        ↓
Trigger Ingestion → DB Commit → Stream Publish
        ↓
Client receives live update via stream subscription
        ↓
UI updates in-place (no refresh needed)
```

---

## Part 9: Multi-Source Conflict Resolution

### Q9.1: Conflict Handling
**Q**: How should canonical entities handle conflicting multi-source data?
**A**: "Design needed, will need a full metadata/provenance model. Confidence scores likely generated."

### Requirements Captured
- [ ] Provenance tracking (which source contributed what)
- [ ] Confidence scores (how reliable is each contribution)
- [ ] Merge strategy (how to combine multi-source data)
- [ ] Conflict resolution rules (source priority, recency, confidence)

---

## Open Design Questions

1. **Provenance Model**: What metadata should each entity carry?
2. **Confidence Scoring**: How are scores calculated per source?
3. **Stream Granularity**: Per-source or per-entity streams?
4. **Ingestion Trigger**: How does search request trigger ingestion?
5. **Client Subscription**: How does frontend subscribe to entity updates?

---

## Part 10: Canonical Entity Schema Design

### Q10.1: Provenance Granularity
**Q**: What level of provenance granularity do you need?
**A**: Per-record. Hybrid. Something that supports either/or.

### Q10.2: Raw Audit Storage
**Q**: Should raw data references be stored for audit?
**A**: Yes always. Note, we need a robust entity base class that all of our canonical entities derive from. All the shared behavior, the modeling for the database, etc. Then the traits (components) can be attached accordingly, per the need.

### Design Direction: ECS-Like Pattern
- **Base Entity Class**: Shared behavior, DB modeling, provenance
- **Traits/Components**: Attached per entity type (Spatial, Temporal, Classified, etc.)
- **Raw Audit**: Always store reference to raw ingested data

### Q10.3: Trait Composition
**Q**: How should traits be composed with the base entity?
**A**: Embedded objects + Schema.extend

### Q10.4: Additional Traits
**Q**: What other traits do you anticipate needing?
**A**: Current traits (Spatial, Temporal, Kinetic, Classified, Identifiable) + Weather + Imagery. Design more as needed.

### Trait Catalog (Initial)

| Trait | Fields | Use Case |
|-------|--------|----------|
| SpatialTrait | position, geometry, bounds | Anything with location |
| TemporalTrait | validFrom, validTo, observedAt | Time-bounded entities |
| KineticTrait | heading, speed, verticalRate | Moving entities |
| ClassifiedTrait | classification, objectType, allegiance | IFF entities |
| IdentifiableTrait | externalIds, callsign, name | Multi-ID entities |
| WeatherTrait | temperature, humidity, pressure, conditions | Weather observations |
| ImageryTrait | cloudCover, gsd, acquired, provider | Satellite imagery |

### Composition Pattern
```typescript
// BaseEntity with embedded traits via Schema.extend
export class FlightEntity extends BaseEntity.extend<FlightEntity>(
  'FlightEntity'
)({
  // Embedded trait objects
  spatial: SpatialTrait,
  temporal: TemporalTrait,
  kinetic: KineticTrait,
  identifiable: IdentifiableTrait,
  // Flight-specific fields
  icao24: Schema.String,
  originCountry: Schema.String,
  onGround: Schema.Boolean,
}) {}
```

### Q10.5: Canonical Entity Types
**Q**: What canonical entity types do you need for GEOINT?
**A**: Flight, POI, Track, Weather

### Q10.6: Database Mapping
**Q**: How should entities map to database tables?
**A**: Hybrid - core table + trait tables for ECS efficiency

### Database Schema (ECS-Optimized)

```sql
-- Core entity table (all entities)
CREATE TABLE entity.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,  -- 'flight', 'poi', 'track', 'weather'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revision INTEGER NOT NULL DEFAULT 1,
  confidence FLOAT NOT NULL DEFAULT 0.5,
  is_stale BOOLEAN NOT NULL DEFAULT false,
  ttl_seconds INTEGER NOT NULL DEFAULT 300,
  -- JSONB for sources/provenance (flexible)
  sources JSONB NOT NULL DEFAULT '[]'
);

-- Spatial trait table (PostGIS)
CREATE TABLE entity.spatial (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  position GEOMETRY(PointZ, 4326),  -- lon, lat, alt
  geometry GEOMETRY(Geometry, 4326),  -- optional complex geometry
  bounds BOX2D
);
CREATE INDEX idx_spatial_position ON entity.spatial USING GIST(position);
CREATE INDEX idx_spatial_geometry ON entity.spatial USING GIST(geometry);

-- Temporal trait table
CREATE TABLE entity.temporal (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_temporal_valid ON entity.temporal (valid_from, valid_to);

-- Kinetic trait table
CREATE TABLE entity.kinetic (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  heading FLOAT NOT NULL,  -- 0-360
  speed FLOAT NOT NULL,    -- m/s
  vertical_rate FLOAT DEFAULT 0
);

-- Classified trait table
CREATE TABLE entity.classified (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  classification TEXT NOT NULL,  -- 'friendly', 'hostile', 'neutral', 'unknown'
  object_type TEXT NOT NULL,
  allegiance TEXT
);

-- Identifiable trait table
CREATE TABLE entity.identifiable (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  external_ids JSONB NOT NULL DEFAULT '{}',  -- { "icao24": "abc123", "osm_id": "123456" }
  callsign TEXT,
  name TEXT
);

-- Weather trait table
CREATE TABLE entity.weather (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  temperature FLOAT,
  humidity FLOAT,
  pressure FLOAT,
  conditions TEXT,
  wind_speed FLOAT,
  wind_direction FLOAT
);

-- Imagery trait table
CREATE TABLE entity.imagery (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  cloud_cover FLOAT,
  gsd FLOAT,  -- ground sample distance (meters)
  acquired TIMESTAMPTZ,
  provider TEXT,  -- 'planet', 'sentinel'
  collection TEXT
);

-- Raw audit table (all raw data references)
CREATE TABLE entity.raw_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity.entities(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  stream_offset TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_raw_audit_entity ON entity.raw_audit(entity_id);
```

### ECS Query Pattern
```sql
-- Find all flights in bounds with kinetic data
SELECT e.*, s.position, k.heading, k.speed, i.callsign
FROM entity.entities e
JOIN entity.spatial s ON e.id = s.entity_id
JOIN entity.kinetic k ON e.id = k.entity_id
LEFT JOIN entity.identifiable i ON e.id = i.entity_id
WHERE e.entity_type = 'flight'
  AND ST_Within(s.position, ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326));
```

---

## Next Steps

- [ ] Design provenance/confidence model for multi-source entities
- [ ] Define canonical entity schema with metadata
- [ ] Wire SearchRpcServer.ts to Cluster via Sharding.send()
- [ ] Add stream publishing to ingesters
- [ ] Implement stale data detection + ingestion handoff
