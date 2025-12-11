Think of AMS as “full-fidelity Asset,” and WMS/TMS as **domain sections** that:

* Project from the full Asset.
* Optionally add derived/enriched fields.
* Enforce domain-specific invariants.

Same truck, different sections.

---

## 1. Core idea

* AMS Asset = one monolithic, maximally expressive representation of the truck (VIN, capacity, telematics, roles, traits, provenance, etc.).
* WMS section = “truck as movable storage + yard resource”.
* TMS section = “truck as carrier in a route network”.

Profiles don’t change the Asset; they define **views** with their own schemas and logic.

---

## 2. Domain profile abstraction

Minimal abstraction:

```ts
import * as Schema from "@effect/schema/Schema"
import type { Asset } from "./Asset" // monolithic AMS Asset

export type Domain = "WMS" | "TMS";

export interface ProfileDescriptor<V> {
  readonly id: string;
  readonly domain: Domain;
  readonly label: string;

  // project a full Asset into this domain-specific view
  project(asset: Asset): V | null;
}

// pattern for strongly typed views
export type ProfileView<S extends Schema.Schema.Any> = Schema.Schema.Type<S>;
```

Each domain defines:

* A view schema `S` (for that section).
* A `project` function turning `Asset → S | null`.

---

## 3. WMS view of a truck

### 3.1 What WMS cares about

For a truck in WMS, it is primarily:

* A **container** / movable storage:

  * current site/sector/container (yard slot, dock door).
  * usable capacity (weight/volume).
  * current load (manifest summary).
* A **yard resource**:

  * status: `available | loading | unloading | maintenance`.
  * assignment: which dock, wave, pick/put operation.

### 3.2 Schema

```ts
// WMS-specific enums
export const WmsTruckStatus = Schema.Union(
  Schema.Literal("available"),
  Schema.Literal("loading"),
  Schema.Literal("unloading"),
  Schema.Literal("yard_move"),
  Schema.Literal("maintenance")
);
export type WmsTruckStatus = Schema.Schema.Type<typeof WmsTruckStatus>;

export const WmsTruckViewSchema = Schema.Struct({
  // AMS identity
  assetId: Schema.String,                 // Asset.id
  vin: Schema.optional(Schema.String),    // from properties["VIN"]

  // Location “inside” the site (yard)
  siteId: Schema.String,
  sectorId: Schema.optional(Schema.String),   // yard / dock sector
  containerId: Schema.optional(Schema.String),// which yard slot / door / bay

  // Capacity + loaded utilization
  maxWeightKg: Schema.Number,
  maxVolumeM3: Schema.Number,
  loadWeightKg: Schema.Number,            // aggregated from shipments
  loadVolumeM3: Schema.Number,
  utilizationPct: Schema.Number,          // derived

  // Operational state in WMS
  status: WmsTruckStatus,
  assignedDock: Schema.optional(Schema.String),
  activeWaveId: Schema.optional(Schema.String),
  lastYardMoveAt: Schema.optional(Schema.Date)
});
export type WmsTruckView = Schema.Schema.Type<typeof WmsTruckViewSchema>;
```

### 3.3 Projection

```ts
import { WmsTruckViewSchema, WmsTruckStatus } from "./WmsViews";
import type { Asset } from "./Asset";

export const WmsTruckProfile: ProfileDescriptor<WmsTruckView> = {
  id: "profile:wms:truck",
  domain: "WMS",
  label: "WMS Truck View",

  project(asset: Asset): WmsTruckView | null {
    // 1. Filter: only trucks that make sense here
    const kindOk = asset.kind === "VEHICLE" || asset.tags.includes("truck");
    if (!kindOk) return null;

    // 2. Pull core capacity from properties
    const props = Object.fromEntries(asset.properties.map(p => [p.key, p.value]));

    const vin = props["VIN"] as string | undefined;
    const maxWeightKg = Number(props["MAX_WEIGHT_KG"] ?? 0);
    const maxVolumeM3 = Number(props["MAX_VOLUME_M3"] ?? 0);

    // 3. Enriched WMS-only data (from WMS tables / caches)
    const loadWeightKg = Number(props["WMS_LOAD_WEIGHT_KG"] ?? 0);
    const loadVolumeM3 = Number(props["WMS_LOAD_VOLUME_M3"] ?? 0);
    const status = (props["WMS_TRUCK_STATUS"] as WmsTruckStatus | undefined) ?? "available";

    const utilizationDenom = maxWeightKg > 0 ? maxWeightKg : 1;
    const utilizationPct = (loadWeightKg / utilizationDenom) * 100;

    return {
      assetId: asset.id,
      vin,
      siteId: asset.site_id,
      sectorId: asset.sector_id,
      containerId: asset.container_id,
      maxWeightKg,
      maxVolumeM3,
      loadWeightKg,
      loadVolumeM3,
      utilizationPct,
      status,
      assignedDock: props["WMS_ASSIGNED_DOCK"] as string | undefined,
      activeWaveId: props["WMS_ACTIVE_WAVE_ID"] as string | undefined,
      lastYardMoveAt: props["WMS_LAST_YARD_MOVE_AT"] as Date | undefined
    };
  }
};
```

WMS “section” = a projection that:

* **Reduces**: ignores TMS concepts (route, ETA, consignees).
* **Enriches**: adds WMS-only notions (waves, yard moves) pulled from WMS properties / joins.

---

## 4. TMS view of the same truck

### 4.1 What TMS cares about

For the same physical truck, TMS treats it as a **carrier**:

* Network-level location and routing:

  * planned route, current stop, ETA.
  * origin/destination, legs.
* Compliance and utilization at trip-level:

  * driver, hours-of-service, permits, inspections.
* Telemetry:

  * GPS, speed, last ping, remaining drive time.

### 4.2 Schema

```ts
export const TmsTripStatus = Schema.Union(
  Schema.Literal("unassigned"),
  Schema.Literal("planned"),
  Schema.Literal("en_route"),
  Schema.Literal("arrived"),
  Schema.Literal("completed"),
  Schema.Literal("cancelled")
);
export type TmsTripStatus = Schema.Schema.Type<typeof TmsTripStatus>;

export const TmsTruckViewSchema = Schema.Struct({
  assetId: Schema.String,
  vin: Schema.optional(Schema.String),

  // Network-level identifiers
  carrierId: Schema.String,            // asset as carrier in TMS
  primaryDriverId: Schema.optional(Schema.String),
  trailerIds: Schema.Array(Schema.String),

  // Current trip
  tripId: Schema.optional(Schema.String),
  tripStatus: TmsTripStatus,
  plannedOrigin: Schema.optional(Schema.String),
  plannedDestination: Schema.optional(Schema.String),
  currentStopSequence: Schema.optional(Schema.Number),
  totalStops: Schema.optional(Schema.Number),

  // Telemetry / ETA
  lastGpsLat: Schema.optional(Schema.Number),
  lastGpsLon: Schema.optional(Schema.Number),
  lastGpsAt: Schema.optional(Schema.Date),
  etaAtDestination: Schema.optional(Schema.Date),
  remainingDriveMinutes: Schema.optional(Schema.Number)
});
export type TmsTruckView = Schema.Schema.Type<typeof TmsTruckViewSchema>;
```

### 4.3 Projection

```ts
import { TmsTruckViewSchema, TmsTripStatus } from "./TmsViews";
import type { Asset } from "./Asset";

export const TmsTruckProfile: ProfileDescriptor<TmsTruckView> = {
  id: "profile:tms:truck",
  domain: "TMS",
  label: "TMS Truck View",

  project(asset: Asset): TmsTruckView | null {
    // Same underlying filter; we might require additional traits like ROLE__CARRIER
    const kindOk = asset.kind === "VEHICLE" || asset.tags.includes("truck");
    if (!kindOk) return null;

    const props = Object.fromEntries(asset.properties.map(p => [p.key, p.value]));

    const vin = props["VIN"] as string | undefined;

    // Misc IDs
    const carrierId = (props["TMS_CARRIER_ID"] as string | undefined) ?? asset.id;
    const primaryDriverId = props["TMS_PRIMARY_DRIVER_ID"] as string | undefined;
    const trailerIds = (props["TMS_TRAILER_IDS"] as string[] | undefined) ?? [];

    // Trip information
    const tripId = props["TMS_TRIP_ID"] as string | undefined;
    const tripStatus = (props["TMS_TRIP_STATUS"] as TmsTripStatus | undefined) ?? "unassigned";
    const plannedOrigin = props["TMS_PLANNED_ORIGIN"] as string | undefined;
    const plannedDestination = props["TMS_PLANNED_DESTINATION"] as string | undefined;
    const currentStopSequence = props["TMS_CURRENT_STOP_SEQ"] as number | undefined;
    const totalStops = props["TMS_TOTAL_STOPS"] as number | undefined;

    // Telemetry
    const lastGpsLat = props["TMS_LAST_GPS_LAT"] as number | undefined;
    const lastGpsLon = props["TMS_LAST_GPS_LON"] as number | undefined;
    const lastGpsAt = props["TMS_LAST_GPS_AT"] as Date | undefined;
    const etaAtDestination = props["TMS_ETA_AT_DESTINATION"] as Date | undefined;
    const remainingDriveMinutes = props["TMS_REMAINING_DRIVE_MIN"] as number | undefined;

    return {
      assetId: asset.id,
      vin,
      carrierId,
      primaryDriverId,
      trailerIds,
      tripId,
      tripStatus,
      plannedOrigin,
      plannedDestination,
      currentStopSequence,
      totalStops,
      lastGpsLat,
      lastGpsLon,
      lastGpsAt,
      etaAtDestination,
      remainingDriveMinutes
    };
  }
};
```

TMS “section”:

* Ignores WMS yard/dock concerns.
* Enriches with route, trip, telemetry, driver relationships.

---

## 5. Section-level semantics

You’re distinguishing:

* **Asset level**: single source of truth

  * identity, BFO grounding, canonical properties and traits, provenance.
* **Section level (profile)**:

  * what fields matter for that domain (schema).
  * how to compute them (projection/enrichment).
  * what invariants to enforce.

Some invariants you can encode per profile:

* WMS truck must have:

  * `MATERIAL_ENTITY`, `VEHICLE` traits.
  * capacity fields populated.
* TMS truck must have:

  * `ROLE__CARRIER`, `MOBILE_SELF`, telematics trait.

In TypeScript, this lives in profile-specific validation; in ontology, these traits would be roles/functions attached to the same material entity.

---

## 6. Summary for the truck

* **AMS Asset**: one truck, one DID, full set of traits/properties.
* **WMS profile**: “truck-as-container/inventory resource at a site”.
* **TMS profile**: “truck-as-carrier moving through a route network”.

Profiles are **pure views** over the same Asset, with their own schemas and constraints. The truck doesn’t change; only the section you’re looking at does.
