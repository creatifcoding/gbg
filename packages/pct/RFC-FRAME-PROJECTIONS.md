# RFC: Frame Projections over LNK + TimescaleDB

Status: draft / first compiler slice implemented
Related artifacts:

- `src/frames/FrameProjectionSpec.ts`
- `src/frames/TimescaleProjectionCompiler.ts`
- `test/frame-projections.test.ts`
- visual explainer: `/home/getbygenius/.agent/diagrams/timescale-frame-projections.html`

## Thesis

Source streams should stay pure: one typed message kind per stream. Operational
consumers normally need coherent records assembled from several source facts, so
we should model those coherent records as explicit **frames**.

A frame is not a transport batch. A frame is a semantic read model:

```text
vitals.heart_rate      -> HeartRateReading
vitals.spo2            -> Spo2Reading
vitals.temperature     -> TemperatureReading
                         ↓
frames.vitals.snapshot -> VitalsSnapshotFrame
                         ↓
vitals_snapshot_frames hypertable
```

The projection worker is the semantic bridge. PCT declares the projection, LNK/MSH
supply durable source streams, and TimescaleDB stores queryable source facts and
materialized frame tables.

## Why not just SQL joins?

TimescaleDB continuous aggregates are excellent, but not a general-purpose
multi-source semantic assembler.

From the Timescale/Tiger docs:

- continuous aggregates are incrementally refreshed materialized hypertables;
- real-time aggregates can combine materialized data with the raw tail, but are
  disabled by default in TimescaleDB 2.13+;
- refresh policies intentionally exclude the latest incomplete bucket unless
  real-time aggregation is enabled;
- JOIN support exists, but the safe documented shape is one hypertable joined to
  standard dimension tables, not arbitrary joins across several changing
  hypertables;
- gapfill/LOCF/interpolation are excellent for analytic continuity, but imputed
  fields must not masquerade as observed coherent facts.

Therefore:

```text
Use SQL/CAGGs for acceleration and rollups.
Use a projection worker for semantic frame assembly.
```

## Ownership

```text
PCT
  owns FrameProjectionSpec and output frame schemas
  owns registry/discovery of projection contracts
  owns deterministic SQL plan compilation

LNK
  owns durable stream consumption and optional frame output stream append
  may host the ProjectionWorker runtime

TimescaleDB
  owns source fact hypertables, frame hypertables, indexes, policies, CAGGs

MSH
  substrate only: NATS/JetStream/KV/connection/micro seams
```

## Compiler pipeline

```text
FrameProjectionSpec
      ↓ compileTimescaleProjection
ProjectionPlan
      ↓ migration tooling applies statements
Timescale support tables + frame hypertable
      ↓ ProjectionWorker writes rows
Queryable frame read model + optional LNK frame stream
```

The first implemented slice is intentionally a compiler, not a database client.
It emits deterministic SQL for review, migration, and future apply tooling.

## Implemented spec shape

`FrameProjectionSpec` is Effect Schema-backed and contains:

- `id` — stable projection id such as `vitals.snapshot@1.0.0`;
- `sources` — pure source stream bindings;
- `frame` — time bucket, required parts, lateness, timeout policy;
- `output` — frame table, output schema id, optional frame stream, SQL columns;
- `timescale` — support table names and compression/retention options.

Example:

```ts
FrameProjectionSpec.make({
  id: "vitals.snapshot@1.0.0",
  sources: [
    {
      streamId: "vitals.heart_rate",
      schemaId: "vitals.heart_rate@1.0.0",
      as: "heartRate",
      timeField: ["observedAt"],
      keyFields: [["patientId"]],
    },
    {
      streamId: "vitals.spo2",
      schemaId: "vitals.spo2@1.0.0",
      as: "spo2",
      timeField: ["observedAt"],
      keyFields: [["patientId"]],
    },
    {
      streamId: "vitals.temperature",
      schemaId: "vitals.temperature@1.0.0",
      as: "temperature",
      timeField: ["observedAt"],
      keyFields: [["patientId"]],
    },
  ],
  frame: {
    timeBucket: "5 seconds",
    required: ["heartRate", "spo2", "temperature"],
    allowedLatenessMs: 2_000,
    onTimeout: "emit-partial",
  },
  output: {
    table: "vitals_snapshot_frames",
    streamId: "frames.vitals.snapshot",
    schemaId: "frames.vitals.snapshot@1.0.0",
    mode: "hybrid-wide",
    columns: [
      { column: "patient_id", sqlType: "text", path: ["patientId"], nullable: false, role: "key" },
      { column: "heart_rate_bpm", sqlType: "double precision", path: ["heartRate", "bpm"], role: "value" },
      { column: "spo2_percent", sqlType: "double precision", path: ["spo2", "percent"], role: "value" },
      { column: "temperature_celsius", sqlType: "double precision", path: ["temperature", "celsius"], role: "value" },
    ],
  },
  timescale: {
    compressAfter: "7 days",
    retainFor: "180 days",
  },
})
```

## Generated table families

### `metric_observations`

Medium-layout source fact hypertable. One row per source message, with stream
and schema provenance.

Purpose:

- durable analytical source facts;
- replay/audit from source stream offsets;
- common sink for many pure metric streams.

### `frame_projection_state`

Small mutable assembly workspace.

Purpose:

- hold arrived parts by `projection_id + frame_id`;
- track deadlines;
- support out-of-order completion and timeout policy.

### `frame_part_ledger`

Idempotency/provenance ledger.

Purpose:

- reject duplicate source offsets after replay/restart;
- trace frame parts back to source stream offsets;
- support audit and late-arrival logic.

### `<projection output table>`

Large Timescale hypertable for materialized frames.

Purpose:

- operational read model;
- direct dashboard/service consumption;
- Timescale compression/retention;
- future continuous aggregates over already-coherent frames.

## Materialization modes

| Mode | Description | Use |
| --- | --- | --- |
| `wide` | Promoted columns only | stable narrow operational schemas |
| `jsonb` | full payload/provenance JSONB | exploratory or tenant-defined frames |
| `hybrid-wide` | promoted columns + full payload/provenance | recommended default |

The compiler currently emits common frame metadata columns and promoted columns;
`payload` and `provenance` are always retained for audit/evolution.

## Runtime sketch

```text
for each source message:
  decode using source schema
  compute frame_id = projection_id + entity key + time_bucket(observed_at)
  insert source fact into metric_observations
  insert source offset into frame_part_ledger
  upsert part into frame_projection_state
  if required parts are present:
    assemble complete frame
    upsert frame hypertable row
    optionally append frames.<name> stream
    mark state complete

for each expired active frame:
  if onTimeout = emit-partial:
    assemble partial frame
    write frame hypertable row with complete=false, missing_parts=[...]
  if onTimeout = dead-letter:
    write diagnostic/dead-letter record
  if onTimeout = drop-partial:
    mark state complete without frame emission
```

## Guardrails

- Source streams remain pure; frame semantics never hide inside a metric stream.
- Frame streams/tables must be obvious by name and metadata.
- Every frame row carries:
  - `projection_id`;
  - `projection_version`;
  - `output_schema_id`;
  - `complete`;
  - `missing_parts`;
  - `imputed_parts`;
  - `payload`;
  - `provenance`.
- Gapfilled/interpolated values must mark `imputed_parts`; imputation is not an
  observed fact.
- SQL identifiers are validated before DDL generation.

## First implemented slice

Implemented:

- `FrameProjectionSpec` schemas;
- `ProjectionPlan` schemas;
- `compileTimescaleProjection(spec)`;
- deterministic DDL generation for support tables, frame hypertable, indexes,
  compression and retention policies;
- tests covering vitals DDL, support-table omission, unsafe identifier rejection,
  and duplicate column rejection.

Validation:

```bash
cd packages/pct
bunx vitest run test/frame-projections.test.ts --reporter verbose
bunx tsc --noEmit --pretty false
```

## Next slices

1. **Schema-to-column compiler**
   - infer candidate promoted columns from output Effect Schema;
   - allow explicit overrides for names/types/nullability;
   - preserve JSONB fallback.

2. **Migration preview/apply CLI**
   - `pact frames plan <projection-id>`;
   - `pact frames migrate <projection-id>`;
   - diff generated plan against installed table metadata.

3. **ProjectionWorker runtime**
   - source stream tailing;
   - frame state upserts;
   - ledger idempotency;
   - timeout sweeper;
   - Timescale writer;
   - optional LNK frame stream writer.

4. **Timescale integration tests**
   - start Postgres/Timescale test container;
   - apply generated DDL;
   - write source facts;
   - assert frame table shape and policies.

5. **Continuous aggregates over frame tables**
   - hourly/daily summary CAGGs on completed frames;
   - refresh policy defaults;
   - explicit imputation/completeness filters.

## References

- Timescale/Tiger — continuous aggregates and JOIN constraints:
  <https://docs.timescale.com/use-timescale/latest/continuous-aggregates/about-continuous-aggregates/>
- Timescale/Tiger — wide/narrow/medium layouts:
  <https://docs2.tigerdata.com/docs/learn/data-model/wide-narrow-medium-tables>
- Timescale/Tiger — refresh policies:
  <https://docs.timescale.com/use-timescale/latest/continuous-aggregates/refresh-policies/>
- Timescale/Tiger — gapfilling/interpolation:
  <https://docs.tigerdata.com/use-timescale/latest/hyperfunctions/gapfilling-interpolation>
