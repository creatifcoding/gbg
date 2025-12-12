import * as Schema from 'effect/Schema';

/**
 * Base BFO entity fields
 */

export const EntityIdentifier = Schema.String.pipe(
  Schema.brand(
    '@selfcharts/ams/v1/schemas/BfoEntity/v1/fields/EntityIdentifier'
  ),
  Schema.annotations({
    description: 'Stable identifier for a BFO entity (DID, etc.).',
  })
);
export type EntityIdentifier = Schema.Schema.Type<typeof EntityIdentifier>;

export const CreatedAt = Schema.Date.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/BfoEntity/v1/fields/CreatedAt'),
  Schema.annotations({
    description: 'The date the entity was created.',
  })
);
export type CreatedAt = Schema.Schema.Type<typeof CreatedAt>;

export const UpdatedAt = Schema.Date.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/BfoEntity/v1/fields/UpdatedAt'),
  Schema.annotations({
    description: 'The date the entity was last updated.',
  })
);
export type UpdatedAt = Schema.Schema.Type<typeof UpdatedAt>;

/**
 * BFO base class field
 */

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
    description:
      'BFO base class for this entity (material_entity, object, fiat_object_part, site, process, quality, role, function).',
  })
);
export type BfoBaseClass = Schema.Schema.Type<typeof BfoBaseClass>;

/**
 * BFO entity hierarchy
 */

export class BfoEntity extends Schema.Class<BfoEntity>('BfoEntity')({
  id: EntityIdentifier,
  created_at: CreatedAt,
  updated_at: UpdatedAt,
}) {}
export type BfoEntity = Schema.Schema.Type<typeof BfoEntity>;

export class Continuant extends BfoEntity.extend<Continuant>('Continuant')({
  bfo_base_class: BfoBaseClass,
}) {}
export type Continuant = Schema.Schema.Type<typeof Continuant>;

export class Occurent extends BfoEntity.extend<Occurent>('Occurent')({
  bfo_base_class: BfoBaseClass,
}) {}
export type Occurent = Schema.Schema.Type<typeof Occurent>;

/**
 * Asset identifiers and references
 */

export const AssetIdentifier = EntityIdentifier.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetIdentifier'),
  Schema.annotations({
    description: 'Identifier for an Asset (DID or similar).',
  })
);
export type AssetIdentifier = Schema.Schema.Type<typeof AssetIdentifier>;

export const SiteIdentifier = EntityIdentifier.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/SiteIdentifier'),
  Schema.annotations({
    description: 'Identifier for a Site in which an Asset is located.',
  })
);
export type SiteIdentifier = Schema.Schema.Type<typeof SiteIdentifier>;

export const SectorIdentifier = EntityIdentifier.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/SectorIdentifier'),
  Schema.annotations({
    description: 'Identifier for a Sector within a Site.',
  })
);
export type SectorIdentifier = Schema.Schema.Type<typeof SectorIdentifier>;

export const ContainerIdentifier = EntityIdentifier.pipe(
  Schema.brand(
    '@selfcharts/ams/v1/schemas/Asset/v1/fields/ContainerIdentifier'
  ),
  Schema.annotations({
    description: 'Identifier for a Container holding an Asset.',
  })
);
export type ContainerIdentifier = Schema.Schema.Type<
  typeof ContainerIdentifier
>;

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

export const TraitIdentifier = Schema.String.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/TraitIdentifier'),
  Schema.annotations({
    description: 'Identifier of a trait definition applied to an Asset.',
  })
);
export type TraitIdentifier = Schema.Schema.Type<typeof TraitIdentifier>;

export const PropertyKey = Schema.String.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyKey'),
  Schema.annotations({
    description: 'Property key for an Asset property value.',
  })
);
export type PropertyKey = Schema.Schema.Type<typeof PropertyKey>;

/**
 * Asset human-readable fields
 */

export const AssetLabel = Schema.String.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetLabel'),
  Schema.annotations({
    description: 'Human-readable label for the asset.',
  })
);
export type AssetLabel = Schema.Schema.Type<typeof AssetLabel>;

export const AssetDescriptionField = Schema.String.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetDescription'),
  Schema.annotations({
    description: 'Optional human-readable description of the asset.',
  })
);
export type AssetDescriptionField = Schema.Schema.Type<
  typeof AssetDescriptionField
>;

export const AssetTag = Schema.String.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetTag'),
  Schema.annotations({
    description: 'Tag used for flexible faceted search and profiling.',
  })
);
export type AssetTag = Schema.Schema.Type<typeof AssetTag>;

export const AssetTags = Schema.Array(AssetTag).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetTags'),
  Schema.annotations({
    description: 'Tags associated with the asset.',
  })
);
export type AssetTags = Schema.Schema.Type<typeof AssetTags>;

export const AssetKind = Schema.String.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/AssetKind'),
  Schema.annotations({
    description: 'Opaque asset kind code, e.g. HAND_TOOL, VEHICLE, TAPE, etc.',
  })
);
export type AssetKind = Schema.Schema.Type<typeof AssetKind>;

/**
 * Provenance fields for properties
 */

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
  Schema.brand(
    '@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertySourceIdentifier'
  ),
  Schema.annotations({
    description: 'Identifier of the source (agent, sensor, external system).',
  })
);
export type PropertySourceIdentifier = Schema.Schema.Type<
  typeof PropertySourceIdentifier
>;

export const PropertyConfidence = Schema.Number.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyConfidence'),
  Schema.annotations({
    description: 'Confidence score 0..1 for this property value.',
  })
);
export type PropertyConfidence = Schema.Schema.Type<typeof PropertyConfidence>;

export const PropertyAttestationRef = Schema.String.pipe(
  Schema.brand(
    '@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyAttestationRef'
  ),
  Schema.annotations({
    description:
      'Optional reference to an attestation (e.g. on-chain object id).',
  })
);
export type PropertyAttestationRef = Schema.Schema.Type<
  typeof PropertyAttestationRef
>;

export const PropertyProvenance = Schema.Struct({
  source_type: PropertySourceType,
  source_id: Schema.optional(PropertySourceIdentifier),
  timestamp: CreatedAt,
  confidence: Schema.optional(PropertyConfidence),
  attestation_ref: Schema.optional(PropertyAttestationRef),
}).pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyProvenance'),
  Schema.annotations({
    description: 'Provenance for a given property value.',
  })
);
export type PropertyProvenance = Schema.Schema.Type<typeof PropertyProvenance>;

/**
 * Asset property schemas
 */

export const PropertyValue = Schema.Unknown.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyValue'),
  Schema.annotations({
    description:
      'Raw property value as unknown; to be interpreted and validated via an external registry.',
  })
);
export type PropertyValue = Schema.Schema.Type<typeof PropertyValue>;

export const PropertyMutable = Schema.Boolean.pipe(
  Schema.brand('@selfcharts/ams/v1/schemas/Asset/v1/fields/PropertyMutable'),
  Schema.annotations({
    description: 'Whether this property is mutable under current policy.',
  })
);
export type PropertyMutable = Schema.Schema.Type<typeof PropertyMutable>;

export const AssetPropertyValue = Schema.Struct({
  key: PropertyKey,
  value: PropertyValue,
  provenance: PropertyProvenance,
  mutable: PropertyMutable,
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

/**
 * Asset trait schemas
 */

export const TraitParams = Schema.Record(Schema.String, Schema.Unknown).pipe(
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

/**
 * Monolithic Asset class
 */

export class Asset extends Continuant.extend<Asset>('Asset')({
  id: AssetIdentifier,
  bfo_base_class: BfoBaseClass,
  label: AssetLabel,
  description: Schema.optional(AssetDescriptionField),
  site_id: SiteIdentifier,
  sector_id: Schema.optional(SectorIdentifier),
  container_id: Schema.optional(ContainerIdentifier),
  kind: AssetKind,
  tags: AssetTags,
  traits: AssetTraits,
  properties: AssetProperties,
  policy_ids: Schema.optional(PolicyIdentifiers),
}) {}
export type Asset = Schema.Schema.Type<typeof Asset>;
