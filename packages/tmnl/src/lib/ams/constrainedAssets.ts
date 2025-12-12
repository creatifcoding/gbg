import * as Schema from "effect/Schema"

/**
 * ===========================================================================
 *  BASE CONSTRAINTS FOR GENERICS
 * ===========================================================================
 *
 * These three interfaces are the *constraints* for the generics used
 * further down in the Schema.Class hierarchy.
 *
 * - M extends AssetMetaBase      (descriptive metadata)
 * - L extends AssetLocationBase  (where the asset "lives")
 * - B extends AssetBehaviorBase  (how the asset behaves operationally)
 */

export interface AssetMetaBase {
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly label: string
  readonly description?: string
}

export interface AssetLocationBase {
  readonly siteId: string
  readonly sectorId?: string
  readonly containerId?: string
}

export type AssetCriticality = "low" | "medium" | "high"

export interface AssetBehaviorBase {
  readonly kind: string           // e.g. "HAND_TOOL", "VEHICLE", "DATASET"
  readonly criticality: AssetCriticality
  readonly priority: number       // higher => “more important”
}

/**
 * ===========================================================================
 *  GENERIC BASE ASSET SCHEMA
 * ===========================================================================
 *
 * BaseAssetSchema<M, L, B> is the *generic* abstract base.
 *
 * Key trick:
 * - We use Schema.Class<BaseAssetSchema<M, L, B>> to tie the schema to the
 *   TypeScript class, but the *fields* "meta", "location", and "behavior"
 *   are declared as `Schema.Unknown as Schema.Schema<M>` etc.
 *
 *   This is the “hairy” part: Schema.Unknown is a Schema<unknown>, and we
 *   coerce it to Schema.Schema<M>. Concrete subclasses *override* these
 *   fields with more specific schemas.
 */

export abstract class BaseAssetSchema<
  M extends AssetMetaBase,
  L extends AssetLocationBase,
  B extends AssetBehaviorBase
> extends Schema.Class<BaseAssetSchema<M, L, B>>("BaseAsset")({
  // Stable identifier
  id: Schema.String,

  // These three are "generic slots" that subclasses will refine
  // by extending this class and replacing them with concrete schemas.
  meta: Schema.Unknown as unknown as Schema.Schema<M>,
  location: Schema.Unknown as unknown as Schema.Schema<L>,
  behavior: Schema.Unknown as unknown as Schema.Schema<B>
}) {
  /**
   * Abstract hook that all concrete asset types must implement.
   * Can use the generic types M, L, B safely.
   */
  abstract describe(): string

  /**
   * Simple helper using metadata generics.
   * (Implementation uses the fact that M extends AssetMetaBase.)
   */
  touch(): void {
    // NOTE: At runtime this is fine; at type-level, we know M has updatedAt.
    this.meta = {
      ...this.meta,
      updatedAt: new Date()
    }
  }

  /**
   * Example convenience using behavior generics.
   */
  isHighPriority(): boolean {
    return this.behavior.priority >= 7
  }
}

/**
 * ===========================================================================
 *  INTERMEDIATE ABSTRACT LAYER (STILL GENERIC)
 * ===========================================================================
 *
 * InventoryAssetSchema<M, L, B> adds common inventory fields (sku, tags)
 * but remains generic in its metadata, location, and behavior.
 *
 * It extends the schema of BaseAssetSchema using the Schema.Class.extend API.
 */

export abstract class InventoryAssetSchema<
  M extends AssetMetaBase,
  L extends AssetLocationBase,
  B extends AssetBehaviorBase
> extends BaseAssetSchema<M, L, B>.extend<
  InventoryAssetSchema<M, L, B>
>("InventoryAsset")({
  sku: Schema.String,
  category: Schema.String,
  tags: Schema.Array(Schema.String)
}) {
  /**
   * All inventory assets must be able to tell which inventory "type"
   * they belong to (physical, digital, virtual, etc.).
   */
  abstract getInventoryType(): string

  hasTag(tag: string): boolean {
    return this.tags.includes(tag)
  }
}

/**
 * ===========================================================================
 *  CONCRETE IMPLEMENTATIONS FOR ASSET GENERICS
 * ===========================================================================
 *
 * Here we define concrete types and schemas for:
 * - PhysicalMeta / DigitalMeta    (M)
 * - WarehouseLocation / CloudLocation (L)
 * - PassiveBehavior / ActiveBehavior  (B)
 *
 * These are just *one possible* set of concrete instantiations; the
 * key pattern is that each concrete asset class picks a specific triple
 * <M, L, B> and provides matching schemas.
 */

/**
 * ------------------------
 *  META TYPES (M)
 * ------------------------
 */

export interface PhysicalAssetMeta extends AssetMetaBase {
  readonly weightKg: number
  readonly volumeM3: number
}

export interface DigitalAssetMeta extends AssetMetaBase {
  readonly fileSizeBytes: number
  readonly contentType: string
}

/**
 * Concrete schemas for meta types.
 */

export const PhysicalAssetMetaSchema = Schema.Struct({
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  label: Schema.String,
  description: Schema.optional(Schema.String),
  weightKg: Schema.Number,
  volumeM3: Schema.Number
})
export type PhysicalAssetMetaSchema = Schema.Schema.Type<typeof PhysicalAssetMetaSchema>

export const DigitalAssetMetaSchema = Schema.Struct({
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  label: Schema.String,
  description: Schema.optional(Schema.String),
  fileSizeBytes: Schema.Number,
  contentType: Schema.String
})
export type DigitalAssetMetaSchema = Schema.Schema.Type<typeof DigitalAssetMetaSchema>

/**
 * ------------------------
 *  LOCATION TYPES (L)
 * ------------------------
 */

export interface WarehouseLocation extends AssetLocationBase {
  readonly aisle: string
  readonly bin: string
}

export interface CloudLocation extends AssetLocationBase {
  readonly provider: string
  readonly region: string
  readonly uri: string
}

/**
 * Concrete schemas for location types.
 */

export const WarehouseLocationSchema = Schema.Struct({
  siteId: Schema.String,
  sectorId: Schema.optional(Schema.String),
  containerId: Schema.optional(Schema.String),
  aisle: Schema.String,
  bin: Schema.String
})
export type WarehouseLocationSchema = Schema.Schema.Type<typeof WarehouseLocationSchema>

export const CloudLocationSchema = Schema.Struct({
  siteId: Schema.String,
  sectorId: Schema.optional(Schema.String),
  containerId: Schema.optional(Schema.String),
  provider: Schema.String,
  region: Schema.String,
  uri: Schema.String
})
export type CloudLocationSchema = Schema.Schema.Type<typeof CloudLocationSchema>

/**
 * ------------------------
 *  BEHAVIOR TYPES (B)
 * ------------------------
 */

export interface PassiveAssetBehavior extends AssetBehaviorBase {
  readonly kind: "PHYSICAL"
  readonly inspectionIntervalDays: number
}

export interface ActiveAssetBehavior extends AssetBehaviorBase {
  readonly kind: "DIGITAL"
  readonly refreshIntervalMinutes: number
}

/**
 * Concrete schemas for behavior types.
 */

export const PassiveAssetBehaviorSchema = Schema.Struct({
  kind: Schema.Literal("PHYSICAL"),
  criticality: Schema.Union(
    Schema.Literal("low"),
    Schema.Literal("medium"),
    Schema.Literal("high")
  ),
  priority: Schema.Number,
  inspectionIntervalDays: Schema.Number
})
export type PassiveAssetBehaviorSchema = Schema.Schema.Type<
  typeof PassiveAssetBehaviorSchema
>

export const ActiveAssetBehaviorSchema = Schema.Struct({
  kind: Schema.Literal("DIGITAL"),
  criticality: Schema.Union(
    Schema.Literal("low"),
    Schema.Literal("medium"),
    Schema.Literal("high")
  ),
  priority: Schema.Number,
  refreshIntervalMinutes: Schema.Number
})
export type ActiveAssetBehaviorSchema = Schema.Schema.Type<
  typeof ActiveAssetBehaviorSchema
>

/**
 * ===========================================================================
 *  CONCRETE ASSET CLASSES
 * ===========================================================================
 *
 * 1) PhysicalAsset
 *    - M = PhysicalAssetMeta
 *    - L = WarehouseLocation
 *    - B = PassiveAssetBehavior
 *
 * 2) DigitalAsset
 *    - M = DigitalAssetMeta
 *    - L = CloudLocation
 *    - B = ActiveAssetBehavior
 *
 * Note the pattern:
 *
 *   class ConcreteAsset extends InventoryAssetSchema<M, L, B>.extend<ConcreteAsset>("Name")({
 *     meta: <Schema for M>,
 *     location: <Schema for L>,
 *     behavior: <Schema for B>
 *   }) { ... }
 *
 * The generic "slots" in BaseAssetSchema are now *fully locked in*.
 */

/**
 * Physical asset stored in a warehouse.
 */
export class PhysicalAsset extends InventoryAssetSchema<
  PhysicalAssetMeta,
  WarehouseLocation,
  PassiveAssetBehavior
>.extend<PhysicalAsset>("PhysicalAsset")({
  // Here we override the generic "meta/location/behavior" slots with
  // their concrete schemas. This is the key Schema.Class.extend pattern.
  meta: PhysicalAssetMetaSchema,
  location: WarehouseLocationSchema,
  behavior: PassiveAssetBehaviorSchema
}) {
  describe(): string {
    return `${this.sku} (${this.meta.label}) @ aisle ${this.location.aisle}, bin ${this.location.bin}`
  }

  getInventoryType(): string {
    return "physical"
  }

  /**
   * Example of a domain-specific helper that uses all three generics.
   */
  needsInspectionSoon(now: Date = new Date()): boolean {
    const msPerDay = 24 * 60 * 60 * 1000
    const last = this.meta.updatedAt.getTime()
    const daysSince = (now.getTime() - last) / msPerDay
    return daysSince >= this.behavior.inspectionIntervalDays
  }
}
export type PhysicalAsset = Schema.Schema.Type<typeof PhysicalAsset>

/**
 * Digital asset stored in the cloud.
 */
export class DigitalAsset extends InventoryAssetSchema<
  DigitalAssetMeta,
  CloudLocation,
  ActiveAssetBehavior
>.extend<DigitalAsset>("DigitalAsset")({
  meta: DigitalAssetMetaSchema,
  location: CloudLocationSchema,
  behavior: ActiveAssetBehaviorSchema
}) {
  describe(): string {
    return `${this.sku} (${this.meta.label}) -> ${this.location.provider}:${this.location.region}:${this.location.uri}`
  }

  getInventoryType(): string {
    return "digital"
  }

  /**
   * A behavior-focused helper: how "stale" is this asset based on
   * its refresh interval?
   */
  isStale(now: Date = new Date()): boolean {
    const msPerMinute = 60 * 1000
    const last = this.meta.updatedAt.getTime()
    const minutesSince = (now.getTime() - last) / msPerMinute
    return minutesSince >= this.behavior.refreshIntervalMinutes
  }
}
export type DigitalAsset = Schema.Schema.Type<typeof DigitalAsset>

/**
 * ===========================================================================
 *  USAGE NOTE (non-executable comment)
 * ===========================================================================
 *
 * new PhysicalAsset({
 *   id: "asset-001",
 *   sku: "HAMMER-001",
 *   category: "tools",
 *   tags: ["hand-tool", "steel"],
 *   meta: {
 *     createdAt: new Date(),
 *     updatedAt: new Date(),
 *     label: "16oz Claw Hammer",
 *     description: "General purpose hammer",
 *     weightKg: 0.8,
 *     volumeM3: 0.002
 *   },
 *   location: {
 *     siteId: "site-01",
 *     sectorId: "sector-A",
 *     containerId: "rack-01",
 *     aisle: "A1",
 *     bin: "B3"
 *   },
 *   behavior: {
 *     kind: "PHYSICAL",
 *     criticality: "medium",
 *     priority: 5,
 *     inspectionIntervalDays: 180
 *   }
 * })
 *
 * All of the generics M, L, B are fully inferred and locked to the
 * concrete schemas, while BaseAssetSchema and InventoryAssetSchema
 * remain reusable for other combinations.
 */
