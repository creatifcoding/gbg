Treat `AssetType` as “what it is + how we track it + how it behaves” – not just a label.

Below is a concrete scheme you can adopt and extend to cover hand tools, tape, cars, and esoterics.

---

## 1. AssetType design goals

For Selfcharts AMS, each `AssetType` should:

1. Be BFO-grounded (so we can reason formally).
2. Drive behavior:

   * inventory model (serial vs lot vs bulk)
   * lifecycle (consumable vs durable)
   * mobility (fixed vs moveable vs mobile)
   * safety/compliance
   * enrichment policy defaults
3. Be queryable along multiple axes (so TMS/WMS/etc. are just profiles over the same space).

---

## 2. Classification axes

You can define `AssetType` in terms of a few orthogonal dimensions.

### 2.1 BFO base

```ts
export type BfoBaseClass =
  | "material_entity"
  | "object"
  | "fiat_object_part"
  | "site"
  | "process"
  | "quality"
  | "role"
  | "function";
```

For typical physical assets:

* Hand tools, cars, tape rolls → `"object"` (subclass of `material_entity`).
* Built-in structures (warehouse shelving, mounting points) → `"fiat_object_part"` or `"site"`.

### 2.2 Functional family

High-level “what it’s for”:

```ts
export type AssetFamily =
  | "HAND_TOOL"
  | "POWER_TOOL"
  | "MEASURING_INSTRUMENT"
  | "CONSUMABLE"
  | "VEHICLE"
  | "MOBILE_EQUIPMENT"
  | "FIXED_EQUIPMENT"
  | "IT_EQUIPMENT"
  | "STORAGE_HANDLING"
  | "SAFETY_PPE"
  | "MATERIAL_STOCK"
  | "ESOTERIC";
```

Examples:

* Hand tools: `"HAND_TOOL"`
* Tape (masking, duct, electrical): `"CONSUMABLE"`
* Cars, trucks, forklifts: `"VEHICLE"` or `"MOBILE_EQUIPMENT"`
* RF front ends, benches, test rigs: `"FIXED_EQUIPMENT"` or `"IT_EQUIPMENT"` depending on context.

### 2.3 Lifecycle class

How it behaves over time in inventory:

```ts
export type LifecycleClass =
  | "CONSUMABLE"     // depleted
  | "DURABLE"        // long-lived, maintainable
  | "CAPITAL"        // tracked as capital equipment
  | "SPARE_PART";    // used to repair other assets
```

* Tape rolls → `CONSUMABLE`.
* Hand tools → `DURABLE`.
* Cars → `CAPITAL` (also durable but capital-tracked).
* Spare motors/PCBs → `SPARE_PART`.

### 2.4 Mobility and location behavior

```ts
export type MobilityClass =
  | "FIXED"          // bolted down
  | "MOVEABLE"       // can be moved but isn’t self-propelled
  | "MOBILE_SELF";   // has its own locomotion

export type TrackingMode =
  | "FUNGIBLE"       // any unit is interchangeable (tape, bolts)
  | "BATCHED"        // tracked by lot/batch
  | "SERIALIZED";    // each unit has unique identity
```

Examples:

* Hand tools:

  * `MobilityClass = "MOVEABLE"`
  * `TrackingMode = "SERIALIZED"` (if issued to specific people) or `"FUNGIBLE"` (if bucketed).
* Tape:

  * `MobilityClass = "MOVEABLE"`
  * `TrackingMode = "FUNGIBLE"` or `"BATCHED"` (per lot).
* Cars:

  * `MobilityClass = "MOBILE_SELF"`
  * `TrackingMode = "SERIALIZED"`.

### 2.5 Safety/compliance and enrichment hints

```ts
export interface SafetyProfile {
  isHazardous: boolean;
  requiresCertification?: boolean;
  requiresInspectionIntervalDays?: number;
  regulatoryTags?: string[]; // e.g. ["DOT", "OSHA", "ITAR"]
}
```

Enrichment:

```ts
export type EnrichmentMode = "manual" | "automated" | "hybrid";

export interface EnrichmentHints {
  mode: EnrichmentMode;
  preferredAgents: string[];      // e.g. OpenScout agent IDs
  refreshIntervalHours?: number;  // suggested cadence
  highValue?: boolean;            // bias CBO towards richer info
}
```

---

## 3. AssetType interface

This folds the above into a single, reusable definition.

```ts
export interface AssetType {
  id: string;                    // "HAND_TOOL_HAMMER_CLAWHAMMER"
  label: string;                 // "Claw Hammer"
  description?: string;

  bfoBaseClass: BfoBaseClass;    // usually "object"
  family: AssetFamily;
  lifecycle: LifecycleClass;
  mobility: MobilityClass;
  tracking: TrackingMode;

  defaultUnit?: string;          // "unit", "roll", "kg", "meter"
  // Which base inventory properties are required or optional
  basePropertyProfile: {
    requiresSerial?: boolean;
    requiresBatch?: boolean;
    requiresCalibration?: boolean;
    // any other flags you want to drive form/UI behavior
  };

  safety?: SafetyProfile;
  enrichment?: EnrichmentHints;

  // For ontology-level constraints / conditional props:
  propertyDefinitionIds?: string[]; // keys into AssetPropertyDefinition[]
}
```

This is your *type-of-type*.

AMS then stores concrete `Asset` instances referencing `assetTypeId`.

---

## 4. Example AssetTypes

Below is a starter catalog covering your mentioned spread.

```ts
export const HAND_TOOL_CLAW_HAMMER: AssetType = {
  id: "HAND_TOOL_CLAW_HAMMER",
  label: "Claw Hammer",
  description: "General purpose claw hammer for light fabrication and maintenance.",

  bfoBaseClass: "object",
  family: "HAND_TOOL",
  lifecycle: "DURABLE",
  mobility: "MOVEABLE",
  tracking: "SERIALIZED",

  defaultUnit: "unit",
  basePropertyProfile: {
    requiresSerial: true,      // if you assign tools to individuals
    requiresBatch: false,
    requiresCalibration: false,
  },

  safety: {
    isHazardous: false,
  },

  enrichment: {
    mode: "manual",
    preferredAgents: [],
    highValue: false,
  },

  propertyDefinitionIds: ["MANUFACTURER", "MODEL", "HANDLE_MATERIAL"],
};

export const CONSUMABLE_TAPE_MASKING: AssetType = {
  id: "CONSUMABLE_TAPE_MASKING",
  label: "Masking Tape",
  description: "Paper-based masking tape, various widths.",

  bfoBaseClass: "object",
  family: "CONSUMABLE",
  lifecycle: "CONSUMABLE",
  mobility: "MOVEABLE",
  tracking: "BATCHED",

  defaultUnit: "roll",
  basePropertyProfile: {
    requiresSerial: false,
    requiresBatch: true,
    requiresCalibration: false,
  },

  safety: {
    isHazardous: false,
  },

  enrichment: {
    mode: "hybrid",
    preferredAgents: ["agent:openscout:catalog"],
    refreshIntervalHours: 24,
  },

  propertyDefinitionIds: ["TAPE_WIDTH_MM", "ADHESIVE_TYPE", "TEMPERATURE_RATING_C"],
};

export const VEHICLE_PASSENGER_CAR: AssetType = {
  id: "VEHICLE_PASSENGER_CAR",
  label: "Passenger Car",
  description: "Standard passenger car used for on-site/off-site transport.",

  bfoBaseClass: "object",
  family: "VEHICLE",
  lifecycle: "CAPITAL",
  mobility: "MOBILE_SELF",
  tracking: "SERIALIZED",

  defaultUnit: "unit",
  basePropertyProfile: {
    requiresSerial: true,
    requiresBatch: false,
    requiresCalibration: false,
  },

  safety: {
    isHazardous: true,
    requiresCertification: true,
    requiresInspectionIntervalDays: 180,
    regulatoryTags: ["DOT"],
  },

  enrichment: {
    mode: "automated",
    preferredAgents: ["agent:openscout:telematics", "agent:openscout:dmv"],
    highValue: true,
  },

  propertyDefinitionIds: [
    "VIN",
    "PLATE_NUMBER",
    "ENGINE_TYPE",
    "ODOMETER_KM",
    "FUEL_TYPE",
    "INSURANCE_POLICY_ID",
  ],
};

// A catch-all for “esoterics”
export const ESOTERIC_RITUAL_OBJECT: AssetType = {
  id: "ESOTERIC_RITUAL_OBJECT",
  label: "Esoteric Ritual Object",
  description:
    "Special-purpose object with non-standard operational semantics (psychospiritual, experimental, etc.).",

  bfoBaseClass: "object",
  family: "ESOTERIC",
  lifecycle: "DURABLE",
  mobility: "MOVEABLE",
  tracking: "SERIALIZED",

  defaultUnit: "unit",
  basePropertyProfile: {
    requiresSerial: true,
  },

  safety: {
    isHazardous: false,
  },

  enrichment: {
    mode: "manual",
    preferredAgents: [],
  },

  propertyDefinitionIds: ["ORIGIN_STORY", "RITUAL_CONTEXT", "SENSORY_PROFILE"],
};
```

---

## 5. How this plugs into AMS

1. **OntologySchema per Site**
   Each Site publishes a list of `AssetType` definitions like the above.
2. **Asset creation / ingestion**

   * UI, APIs, or agents must choose an `assetTypeId`.
   * `Asset`’s required props are inferred from that `AssetType`.
3. **Profiles (TMS/WMS/etc.)**

   * TMS: focus on `family ∈ {"VEHICLE", "MOBILE_EQUIPMENT"}`.
   * WMS: focus on `family ∈ {"HAND_TOOL", "CONSUMABLE", "MATERIAL_STOCK", "STORAGE_HANDLING"}`.
4. **CBO/Budget**

   * Enrichment hints (`highValue`, `mode`, `preferredAgents`) are inputs to your constraints-based optimizer.

If you want, the next step is to define `AssetPropertyDefinition` for a few key families (hand tools, consumables, vehicles) so that the ontology is actually executable for validation and UI generation.
