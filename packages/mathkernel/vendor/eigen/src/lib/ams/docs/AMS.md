**Selfcharts AMS** = Asset Management System as base layer, with TMS/WMS/etc as views/profiles on top of the same ontology + spatial model.

---

## 1. Definition

> **Selfcharts AMS** is a BFO-grounded, location-aware asset management core where:
>
> * “Asset” is the primary citizen.
> * “Location” spans sites, sectors, containers, and moving carriers.
> * TMS, WMS, MRO/CMMS, FMS, etc. are **profiles** (constraint sets + workflows) over the same primitives.

TMS/WMS/etc then just pick:

* Which asset types they care about.
* Which location/flow patterns they use.
* Which views and workflows are exposed.

---

## 2. Core meta-model

At the center:

* **Asset**: anything inventoryable or operationally relevant.
* **Location**: a BFO-compatible “site” hierarchy (Site → Sector → Container → Carrier).
* **State**: time-indexed snapshots of properties + provenance.
* **Ontology**: per-Site schema for AssetTypes, LocationTypes, Relations.
* **Policy**: enrichment, mutability, budget/cost.

### 2.1 Entities

* `Site`

  * Root context, owns OntologySchema and base geospatial frame.
* `Sector`

  * Logical partition of Site, with polygon + uncertainty.
* `Container`

  * Localized storage/aggregation unit; typed.
* `Carrier`

  * Mobile container (truck, drone, forklift, AGV).
* `Asset`

  * Typed instance, with invariant identity via DID.

Relationships:

* `Asset --in--> Container --in--> Sector --in--> Site`
* `Container` may be static (rack) or mobile (Carrier).
* `LogicalLocation → PhysicalGeolocation` via mapping + uncertainty model.

### 2.2 Properties & provenance

* Base inventory properties:

  * `quantity`, `weight`, `dimensions`, `status`, `serials`, etc.
* Extended properties via ontology:

  * Defined by `AssetPropertyDefinition` with conditions:

    * e.g. `requires(assetType ∈ RF_FRONT_END)` or `requires(containerType.supportsColdChain)`.
* Every property value:

  * `value`
  * `provenance` (source, agent, timestamp, confidence, chain proof)
  * optional `mutable` flag + policy key.

### 2.3 Policies & agents

* **EnrichmentPolicy**:

  * Mode: `manual | automated | hybrid`.
  * Allowed agents (OpenScout etc.).
  * Triggers (event, schedule, ad-hoc).
  * Max spend per window (ties into budget).

* **BudgetPool + CBO**:

  * Pools: per Site, per Sector, per Aggregate (asset cluster).
  * CBO decides which enrichment to run under constraints:

    * risk, uncertainty, lastUpdated, importance, cache locality, etc.

---

## 3. TMS / WMS / others as profiles

Use **profiles** = configuration of:

* Allowed AssetTypes
* Allowed Location patterns
* View templates
* Workflow templates

Examples:

### 3.1 WMS profile

* Focus:

  * Assets in **storage** containers within a Site.
* Locations:

  * `Site → Sector (zone/aisle) → Container (rack/bin/pallet)`.
* Views:

  * Birds-eye warehouse map, sector view, replenishment heatmaps.
* Workflows:

  * Putaway, picking, cycle counts, slotting.

### 3.2 TMS profile

* Focus:

  * Assets in **transit**, carriers as primary containers.
* Locations:

  * `Carrier` + route geometry instead of fixed polygon only.
* Views:

  * Fleet maps, route/ETA, load plans, handoff points as temporary Sectors.
* Workflows:

  * Dispatch, loading, routing, proof of delivery, cross-docking.

### 3.3 AMS superset

AMS defines:

* Common Asset identity + properties.
* Common Location and Snapshot model.
* Query surface:

  * by asset type/instance
  * by container type/instance
  * by sector type/instance
  * by status, enrichment state, etc.
* Specialized apps just filter + add workflow semantics.

---

## 4. Mapping your checklist into AMS

* Birds-eye inventory:

  * `SiteMap` model: 2D polygonal representation of Sectors + Container clusters.
* Polygons with labels/class types:

  * `SectorType` & `ContainerType` drive styling.
* Link assets → container → sector → site:

  * Containment graph as first-class.
* Site map → sector view:

  * `SectorView = SiteMap.filter(sectorId)`, plus Asset density overlays.
* Interactions (search):

  * One unified `AssetQuery` API with facets for type/instance & location types/instances.
* Logical → physical location:

  * `LogicalLocation` map to `GeoPolygon` + `LocationUncertainty`.
* BFO-derived AssetTypes:

  * Per-Site `OntologySchema` with BFO base classes and generated managers.
* Inventoryable base props with conditional dependencies:

  * `AssetPropertyDefinition` + per-asset `AssetPropertyValue` with conditions enforced.
* Enrichment policy:

  * Each Asset/AssetType has `EnrichmentPolicy` referencing OpenScout, etc.
* Provenance:

  * Every property value includes provenance record, optionally DID/Sui anchored.
* AssetViewPanel (2D/3D):

  * `AssetStateSnapshot` → Gaussian splat scene → view-only panel, gated writes via policy.
* DID + Sui:

  * DIDs as IDs; optional Sui integration for high-value asset state attestations.
* Budget/CBO:

  * Budget pools per Site/Sector/Portfolio.
  * CBO scheduler determines enrichment and agent runs.

---

## 5. Concise TypeScript skeleton for AMS core

This is intentionally compact, to be refined:

```ts
export type DID = `did:selfcharts:${string}`;

export type SiteId = DID;
export type SectorId = DID;
export type ContainerId = DID;
export type CarrierId = DID;
export type AssetId = DID;

export type BfoBaseClass =
  | "material_entity"
  | "object"
  | "site"
  | "fiat_object_part"
  | "process"
  | "quality"
  | "role"
  | "function";

export type EnrichmentMode = "manual" | "automated" | "hybrid";

export interface OntologyTypeBase {
  id: string;
  label: string;
  description?: string;
  bfoBaseClass: BfoBaseClass;
}

export interface AssetType extends OntologyTypeBase {
  categoryPath: string[];
}

export interface ContainerType extends OntologyTypeBase {
  isMobile: boolean; // true => Carrier-like
}

export interface SectorType extends OntologyTypeBase {}

export interface OntologySchema {
  siteId: SiteId;
  version: string;
  assetTypes: AssetType[];
  containerTypes: ContainerType[];
  sectorTypes: SectorType[];
}

export interface GeoPoint {
  lat: number;
  lon: number;
  elevationM?: number;
}

export interface GeoPolygon {
  vertices: GeoPoint[];
}

export interface LocationUncertainty {
  radiusM?: number;
  altHypotheses?: { point: GeoPoint; probability: number }[];
}

export interface Site {
  id: SiteId;
  name: string;
  geoFrame: {
    crs: string;
    origin: GeoPoint;
  };
  ontology: OntologySchema;
}

export interface Sector {
  id: SectorId;
  siteId: SiteId;
  sectorTypeId: string;
  name: string;
  footprint: GeoPolygon;
  uncertainty?: LocationUncertainty;
}

export interface Container {
  id: ContainerId;
  siteId: SiteId;
  sectorId: SectorId;
  containerTypeId: string;
  label: string;
  // for mobile, also link Carrier
  carrierId?: CarrierId;
}

export interface PropertyProvenance {
  sourceType: "manual" | "sensor" | "ingestion_agent" | "external_system";
  sourceId?: string;     // agent DID, sensor id, etc.
  timestamp: string;
  confidence?: number;   // 0..1
  attestationRef?: string; // e.g. Sui object id
}

export interface AssetPropertyValue {
  defId: string;
  value: unknown;
  provenance: PropertyProvenance;
  mutable: boolean;
}

export interface AssetPropertyCondition {
  type: "assetTypeIs" | "containerTypeSupports" | "custom";
  expr: string; // DSL / predicate id
}

export interface AssetPropertyDefinition {
  id: string;
  key: string;
  valueType: "string" | "number" | "boolean" | "json";
  required?: boolean;
  conditions?: AssetPropertyCondition[];
}

export interface EnrichmentPolicy {
  id: string;
  mode: EnrichmentMode;
  allowedAgentIds: DID[];
  maxSpendPerHour: number;
  strategy: "refresh" | "fill_missing" | "risk_based";
}

export interface Asset {
  id: AssetId;
  siteId: SiteId;
  assetTypeId: string;
  containerId: ContainerId;
  status: "available" | "reserved" | "in_transit" | "maintenance" | "retired";
  baseProperties: {
    quantity: number;
    weightKg?: number;
    dimensionsMm?: { l: number; w: number; h: number };
  };
  properties: AssetPropertyValue[];
  enrichmentPolicyId?: string;
}

export interface AssetStateSnapshot {
  id: string;
  assetId: AssetId;
  capturedAt: string;
  siteId: SiteId;
  sectorId: SectorId;
  containerId: ContainerId;
  properties: AssetPropertyValue[];
}

export interface AssetQuery {
  siteId?: SiteId;
  assetTypeIds?: string[];
  assetIds?: AssetId[];
  containerIds?: ContainerId[];
  containerTypeIds?: string[];
  sectorIds?: SectorId[];
  sectorTypeIds?: string[];
  status?: Asset["status"][];
}
```

This is the AMS core.

Next refinement steps, if you want to continue:

* Define the **profile** model (how TMS/WMS/etc select subsets of this).
* Define the **AssetViewPanel** data contract (what the Gaussian-splat renderer consumes).
* Define **manager interfaces** (`AssetManager`, `LocationManager`, `EnrichmentScheduler`) that are generated or configured from the `OntologySchema`.
