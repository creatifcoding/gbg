````text
You are an expert TypeScript and Effect Schema (v3) engineer.

Generate a SINGLE TypeScript module that defines a **monolithic Asset schema** for a Selfcharts-style Asset Management System.

Use **@effect/schema/Schema** as `Schema` and follow this exact pattern:

- Define **field schemas** as named `const` exports, each using:
  
  ```ts
  export const CreatedAt = Schema.Date.pipe(
    Schema.brand('@gbg/tmnl/v1/schemas/BfoEntity/v1/fields/CreatedAt'),
    Schema.annotations({
      description: 'The date the opportunity was created',
    })
  );

  export type CreatedAt = Schema.Schema.Type<typeof CreatedAt>;
````

* Define **entity classes** using `Schema.Class` and `extend`:

  ```ts
  export class BfoEntity extends Schema.Class<BfoEntity>('BfoEntity')({
    id: EntityIdentifier,
    created_at: CreatedAt,
    updated_at: UpdatedAt,
  }) {}

  export type BfoEntity = Schema.Schema.Type<typeof BfoEntity>;

  export class Continuant extends BfoEntity.extend<Continuant>('Continuant')({}) {}
  export type Continuant = Schema.Schema.Type<typeof Continuant>;

  export class Occurent extends BfoEntity.extend<Occurent>('Occurent')({}) {}
  export type Occurent = Schema.Schema.Type<typeof Occurent>;
  ```

Use these patterns consistently for all fields, classes, and type aliases.

────────────────────────────────

1. Imports and base setup
   ────────────────────────────────

2. Import:

```ts
import * as Schema from '@effect/schema/Schema';
```

2. Define these **base fields** as named exports with brands and annotations:

* `EntityIdentifier`: `Schema.String` with a DID-like brand (e.g. `did:selfcharts:...`).
* `CreatedAt`: `Schema.Date`.
* `UpdatedAt`: `Schema.Date`.

Follow the pattern:

```ts
export const EntityIdentifier = Schema.String.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/BfoEntity/v1/fields/EntityIdentifier'),
  Schema.annotations({
    description: 'Stable identifier for a BFO entity (DID, etc.).',
  })
);
export type EntityIdentifier = Schema.Schema.Type<typeof EntityIdentifier>;
```

Do the same for `CreatedAt` and `UpdatedAt`.

────────────────────────────────
2. BFO base classes with inheritance
────────────────────────────────

Define:

* `BfoBaseClass` as a **field schema** using `Schema.Literal` over:

  * `"material_entity" | "object" | "fiat_object_part" | "site" | "process" | "quality" | "role" | "function"`

Example:

```ts
export const BfoBaseClass = Schema.Union(
  Schema.Literal('material_entity'),
  Schema.Literal('object'),
  Schema.Literal('fiat_object_part'),
  Schema.Literal('site'),
  Schema.Literal('process'),
  Schema.Literal('quality'),
  Schema.Literal('role'),
  Schema.Literal('function')
).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/BfoEntity/v1/fields/BfoBaseClass'),
  Schema.annotations({
    description: 'BFO base class for this entity.',
  })
);
export type BfoBaseClass = Schema.Schema.Type<typeof BfoBaseClass>;
```

Now define these **classes** using `Schema.Class` and `extend`:

1. `BfoEntity` (base for everything):

```ts
export class BfoEntity extends Schema.Class<BfoEntity>('BfoEntity')({
  id: EntityIdentifier,
  created_at: CreatedAt,
  updated_at: UpdatedAt,
}) {}
export type BfoEntity = Schema.Schema.Type<typeof BfoEntity>;
```

2. `Continuant` and `Occurent` (BFO hierarchy roots):

```ts
export class Continuant extends BfoEntity.extend<Continuant>('Continuant')({
  bfo_base_class: BfoBaseClass, // constrained at runtime to appropriate continuant values
}) {}
export type Continuant = Schema.Schema.Type<typeof Continuant>;

export class Occurent extends BfoEntity.extend<Occurent>('Occurent')({
  bfo_base_class: BfoBaseClass, // constrained at runtime to appropriate occurrent values
}) {}
export type Occurent = Schema.Schema.Type<typeof Occurent>;
```

Use the exact spelling `Occurent` as above.

────────────────────────────────
3. Monolithic Asset fields
────────────────────────────────

Define the **monolithic Asset** as a single class extending `Continuant`.

First, define the field-level schemas (each as a named export + type alias):

1. IDs and references (branded strings):

* `AssetIdentifier` (alias for `EntityIdentifier` brand, or a more specific brand).
* `SiteIdentifier`
* `SectorIdentifier`
* `ContainerIdentifier`
* `PolicyIdentifier`
* `TraitIdentifier`
* `PropertyKey`

Each is a `Schema.String.pipe(Schema.brand(...), Schema.annotations(...))` with its own brand and type alias:

```ts
export const AssetIdentifier = EntityIdentifier.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetIdentifier'),
  Schema.annotations({
    description: 'Identifier for an Asset (DID or similar).',
  })
);
export type AssetIdentifier = Schema.Schema.Type<typeof AssetIdentifier>;
```

Define similar fields for `SiteIdentifier`, `SectorIdentifier`, `ContainerIdentifier`, `PolicyIdentifier`, `TraitIdentifier`, and `PropertyKey`.

2. Human-readable fields:

* `AssetLabel`: `Schema.String` with suitable annotations.
* `AssetDescription`: `Schema.String` (or `Schema.optional(Schema.String)` if you prefer optional at field-level).
* `AssetKind`: `Schema.String` (opaque “kind” such as 'HAND_TOOL', 'VEHICLE', etc.).
* `AssetTag`: `Schema.String`.
* `AssetTags`: `Schema.Array(AssetTag)`.

Example:

```ts
export const AssetLabel = Schema.String.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetLabel'),
  Schema.annotations({
    description: 'Human-readable label for the asset.',
  })
);
export type AssetLabel = Schema.Schema.Type<typeof AssetLabel>;

export const AssetTags = Schema.Array(
  Schema.String.pipe(
    Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetTag'),
    Schema.annotations({
      description: 'Tag used for flexible faceted search and profiling.',
    })
  )
).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetTags'),
  Schema.annotations({
    description: 'Tags associated with the asset.',
  })
);
export type AssetTags = Schema.Schema.Type<typeof AssetTags>;
```

3. Provenance fields:

Define:

* `PropertySourceType`: union literal `"manual" | "sensor" | "ingestion_agent" | "external_system"`.
* `PropertySourceIdentifier`: branded string.
* `PropertyTimestamp`: just reuse `CreatedAt` or define a separate Date.
* `PropertyConfidence`: `Schema.Number` between 0 and 1.
* `PropertyAttestationRef`: optional branded string.

Then define a **PropertyProvenance** schema:

```ts
export const PropertySourceType = Schema.Union(
  Schema.Literal('manual'),
  Schema.Literal('sensor'),
  Schema.Literal('ingestion_agent'),
  Schema.Literal('external_system')
).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertySourceType'),
  Schema.annotations({
    description: 'Source type for a property value.',
  })
);
export type PropertySourceType = Schema.Schema.Type<typeof PropertySourceType>;

export const PropertySourceIdentifier = Schema.String.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertySourceIdentifier'),
  Schema.annotations({
    description: 'Identifier of the source (agent, sensor, external system).',
  })
);
export type PropertySourceIdentifier = Schema.Schema.Type<typeof PropertySourceIdentifier>;

export const PropertyConfidence = Schema.Number.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyConfidence'),
  Schema.annotations({
    description: 'Confidence score 0..1 for this property value.',
  })
);
export type PropertyConfidence = Schema.Schema.Type<typeof PropertyConfidence>;

// Provenance struct
export const PropertyProvenance = Schema.Struct({
  source_type: PropertySourceType,
  source_id: Schema.optional(PropertySourceIdentifier),
  timestamp: CreatedAt,
  confidence: Schema.optional(PropertyConfidence),
  attestation_ref: Schema.optional(
    Schema.String.pipe(
      Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyAttestationRef')
    )
  ),
}).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyProvenance'),
  Schema.annotations({
    description: 'Provenance for a given property value.',
  })
);
export type PropertyProvenance = Schema.Schema.Type<typeof PropertyProvenance>;
```

4. Property value schema:

* `AssetPropertyValue` with fields:

  * `key: PropertyKey`
  * `value: Schema.Unknown` (or a JSON-like `Schema.Any` / `Schema.Json` schema)
  * `provenance: PropertyProvenance`
  * `mutable: Schema.Boolean`

```ts
export const AssetPropertyValue = Schema.Struct({
  key: Schema.String.pipe(
    Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyKey'),
    Schema.annotations({ description: 'Property key.' })
  ),
  value: Schema.Unknown.pipe(
    Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyValue'),
    Schema.annotations({ description: 'Raw property value as unknown; interpreted via registry.' })
  ),
  provenance: PropertyProvenance,
  mutable: Schema.Boolean.pipe(
    Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyMutable'),
    Schema.annotations({ description: 'Whether this property is mutable under current policy.' })
  ),
}).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetPropertyValue'),
  Schema.annotations({
    description: 'A single property value with provenance.',
  })
);
export type AssetPropertyValue = Schema.Schema.Type<typeof AssetPropertyValue>;

export const AssetProperties = Schema.Array(AssetPropertyValue).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetProperties'),
  Schema.annotations({
    description: 'List of properties attached to an Asset.',
  })
);
export type AssetProperties = Schema.Schema.Type<typeof AssetProperties>;
```

5. Trait instance schema:

Define:

* `TraitIdentifier`: branded string.
* `TraitParams`: `Schema.Record(Schema.String, Schema.Unknown)`.

```ts
export const TraitIdentifier = Schema.String.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/TraitIdentifier'),
  Schema.annotations({
    description: 'Identifier of a trait definition applied to an Asset.',
  })
);
export type TraitIdentifier = Schema.Schema.Type<typeof TraitIdentifier>;

export const TraitParams = Schema.Record(
  Schema.String,
  Schema.Unknown
).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/TraitParams'),
  Schema.annotations({
    description: 'Arbitrary parameter map for a trait instance.',
  })
);
export type TraitParams = Schema.Schema.Type<typeof TraitParams>;

export const AssetTraitInstance = Schema.Struct({
  trait_id: TraitIdentifier,
  params: Schema.optional(TraitParams),
}).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetTraitInstance'),
  Schema.annotations({
    description: 'A single trait instance attached to an Asset.',
  })
);
export type AssetTraitInstance = Schema.Schema.Type<typeof AssetTraitInstance>;

export const AssetTraits = Schema.Array(AssetTraitInstance).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetTraits'),
  Schema.annotations({
    description: 'List of traits attached to an Asset.',
  })
);
export type AssetTraits = Schema.Schema.Type<typeof AssetTraits>;
```

6. Policy identifiers:

```ts
export const PolicyIdentifier = Schema.String.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PolicyIdentifier'),
  Schema.annotations({
    description: 'Identifier for an enrichment, access, or inspection policy.',
  })
);
export type PolicyIdentifier = Schema.Schema.Type<typeof PolicyIdentifier>;

export const PolicyIdentifiers = Schema.Array(PolicyIdentifier).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PolicyIdentifiers'),
  Schema.annotations({
    description: 'Policies associated with this Asset.',
  })
);
export type PolicyIdentifiers = Schema.Schema.Type<typeof PolicyIdentifiers>;
```

────────────────────────────────
4. Asset class (monolithic Asset)
────────────────────────────────

Now define the **monolithic Asset** as a single class extending `Continuant`:

Fields to include:

* `id: AssetIdentifier` (or reuse `EntityIdentifier` but branded for Asset).
* `bfo_base_class: BfoBaseClass` (should be a continuant-compatible value such as `"object"` or `"material_entity"`).
* `label: AssetLabel`
* `description: AssetDescription` (optional via `Schema.optional`)
* `site_id: SiteIdentifier`
* `sector_id: SectorIdentifier` (optional)
* `container_id: ContainerIdentifier` (optional)
* `kind: Schema.String` (e.g. `'HAND_TOOL'`, `'VEHICLE'`, etc.)
* `tags: AssetTags`
* `traits: AssetTraits`
* `properties: AssetProperties`
* `policy_ids: PolicyIdentifiers` (optional)

Use the same pattern as the other classes:

```ts
export class Asset extends Continuant.extend<Asset>('Asset')({
  id: AssetIdentifier,
  bfo_base_class: BfoBaseClass,
  label: AssetLabel,
  description: Schema.optional(
    Schema.String.pipe(
      Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetDescription'),
      Schema.annotations({ description: 'Optional human-readable description of the asset.' })
    )
  ),
  site_id: SiteIdentifier,
  sector_id: Schema.optional(SectorIdentifier),
  container_id: Schema.optional(ContainerIdentifier),
  kind: Schema.String.pipe(
    Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetKind'),
    Schema.annotations({
      description: 'Opaque asset kind code, e.g. HAND_TOOL, VEHICLE, TAPE, etc.',
    })
  ),
  tags: AssetTags,
  traits: AssetTraits,
  properties: AssetProperties,
  policy_ids: Schema.optional(PolicyIdentifiers),
}) {}
export type Asset = Schema.Schema.Type<typeof Asset>;
```

Make sure:

* All field schemas are **named exports** with their **own type aliases** using `Schema.Schema.Type<typeof FieldName>`.
* All classes (`BfoEntity`, `Continuant`, `Occurent`, `Asset`) have corresponding `export type` aliases using `Schema.Schema.Type<typeof ClassName>`.

────────────────────────────────
5. Code style
────────────────────────────────

* Use **named exports only** (no default export).
* Keep the module self-contained: all types and fields should be defined in this file.
* Add meaningful `Schema.annotations` descriptions to all major fields and classes to make the schema self-documenting.

Output: **only the TypeScript code** for this module, nothing else.

```
```
