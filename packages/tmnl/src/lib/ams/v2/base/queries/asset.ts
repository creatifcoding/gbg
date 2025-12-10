/**
 * Asset Queries
 *
 * CQRS read operations for assets using Schema.TaggedRequest.
 * Queries return data without producing events.
 *
 * @module @gbg/tmnl/ams/v2/base/queries/asset
 */

import { Schema } from 'effect'
import {
  AssetId,
  AssetKind,
  SiteId,
  SectorId,
  ContainerId,
  PropertyKey,
  Tags,
  Tag,
} from '../../core/schemas/identifiers'
import { Asset, AssetStatus, AssetSummary } from '../schemas/asset'
import { AssetProperty } from '../schemas/property'
import { AssetNotFoundError } from '../commands/asset'

// ─────────────────────────────────────────────────────────────────────────────
// Query Error Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query returned no results (not an error, but typed return)
 */
export class AssetQueryEmpty extends Schema.TaggedClass<AssetQueryEmpty>()(
  'AssetQueryEmpty',
  {
    query: Schema.String,
    message: Schema.optional(Schema.String),
  }
) {}

/**
 * Query error union
 */
export const AssetQueryError = Schema.Union(AssetNotFoundError, AssetQueryEmpty)
export type AssetQueryError = typeof AssetQueryError.Type

// ─────────────────────────────────────────────────────────────────────────────
// Pagination Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cursor-based pagination input
 */
export class PaginationInput extends Schema.TaggedClass<PaginationInput>()(
  'PaginationInput',
  {
    /** Number of items per page (default: 20) */
    limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
    /** Cursor for next page (opaque string) */
    cursor: Schema.optional(Schema.String),
    /** Sort field */
    sortBy: Schema.optional(Schema.String),
    /** Sort direction */
    sortDirection: Schema.optional(Schema.Literal('asc', 'desc')),
  }
) {
  static readonly Default = new PaginationInput({})
}

/**
 * Page info for cursor-based pagination
 */
export class PageInfo extends Schema.TaggedClass<PageInfo>()('PageInfo', {
  /** Cursor for next page (null if no more) */
  nextCursor: Schema.NullOr(Schema.String),
  /** Whether there are more results */
  hasNextPage: Schema.Boolean,
  /** Total count (if available) */
  totalCount: Schema.optional(Schema.Number),
}) {}

/**
 * Paginated result wrapper
 */
export const PaginatedAssets = Schema.Struct({
  _tag: Schema.Literal('PaginatedAssets'),
  items: Schema.Array(AssetSummary),
  pageInfo: PageInfo,
})
export type PaginatedAssets = typeof PaginatedAssets.Type

// ─────────────────────────────────────────────────────────────────────────────
// Single Asset Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a single asset by ID
 */
export class GetAsset extends Schema.TaggedRequest<GetAsset>()('GetAsset', {
  failure: AssetNotFoundError,
  success: Asset,
  payload: {
    assetId: AssetId,
  },
}) {}

/**
 * Get asset summary by ID (lightweight)
 */
export class GetAssetSummary extends Schema.TaggedRequest<GetAssetSummary>()(
  'GetAssetSummary',
  {
    failure: AssetNotFoundError,
    success: AssetSummary,
    payload: {
      assetId: AssetId,
    },
  }
) {}

/**
 * Check if asset exists
 */
export class AssetExists extends Schema.TaggedRequest<AssetExists>()('AssetExists', {
  failure: Schema.Never,
  success: Schema.Boolean,
  payload: {
    assetId: AssetId,
  },
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// List/Search Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List assets by site
 */
export class ListAssetsBySite extends Schema.TaggedRequest<ListAssetsBySite>()(
  'ListAssetsBySite',
  {
    failure: Schema.Never,
    success: PaginatedAssets,
    payload: {
      siteId: SiteId,
      /** Optional status filter */
      status: Schema.optional(AssetStatus),
      /** Optional kind filter */
      kind: Schema.optional(AssetKind),
      /** Pagination */
      pagination: Schema.optional(PaginationInput),
    },
  }
) {}

/**
 * List assets by sector
 */
export class ListAssetsBySector extends Schema.TaggedRequest<ListAssetsBySector>()(
  'ListAssetsBySector',
  {
    failure: Schema.Never,
    success: PaginatedAssets,
    payload: {
      siteId: SiteId,
      sectorId: SectorId,
      /** Optional status filter */
      status: Schema.optional(AssetStatus),
      /** Pagination */
      pagination: Schema.optional(PaginationInput),
    },
  }
) {}

/**
 * List assets by container
 */
export class ListAssetsByContainer extends Schema.TaggedRequest<ListAssetsByContainer>()(
  'ListAssetsByContainer',
  {
    failure: Schema.Never,
    success: PaginatedAssets,
    payload: {
      containerId: ContainerId,
      /** Pagination */
      pagination: Schema.optional(PaginationInput),
    },
  }
) {}

/**
 * Search assets by text (label, description)
 */
export class SearchAssets extends Schema.TaggedRequest<SearchAssets>()('SearchAssets', {
  failure: Schema.Never,
  success: PaginatedAssets,
  payload: {
    /** Search query text */
    query: Schema.String.pipe(Schema.minLength(1)),
    /** Scope search to site (optional) */
    siteId: Schema.optional(SiteId),
    /** Filter by status (optional) */
    status: Schema.optional(AssetStatus),
    /** Filter by kind (optional) */
    kind: Schema.optional(AssetKind),
    /** Filter by tags (optional, AND logic) */
    tags: Schema.optional(Tags),
    /** Pagination */
    pagination: Schema.optional(PaginationInput),
  },
}) {}

/**
 * List assets by tag
 */
export class ListAssetsByTag extends Schema.TaggedRequest<ListAssetsByTag>()(
  'ListAssetsByTag',
  {
    failure: Schema.Never,
    success: PaginatedAssets,
    payload: {
      tag: Tag,
      /** Scope to site (optional) */
      siteId: Schema.optional(SiteId),
      /** Pagination */
      pagination: Schema.optional(PaginationInput),
    },
  }
) {}

/**
 * List assets by kind
 */
export class ListAssetsByKind extends Schema.TaggedRequest<ListAssetsByKind>()(
  'ListAssetsByKind',
  {
    failure: Schema.Never,
    success: PaginatedAssets,
    payload: {
      kind: AssetKind,
      /** Scope to site (optional) */
      siteId: Schema.optional(SiteId),
      /** Pagination */
      pagination: Schema.optional(PaginationInput),
    },
  }
) {}

/**
 * List assets by status
 */
export class ListAssetsByStatus extends Schema.TaggedRequest<ListAssetsByStatus>()(
  'ListAssetsByStatus',
  {
    failure: Schema.Never,
    success: PaginatedAssets,
    payload: {
      status: AssetStatus,
      /** Scope to site (optional) */
      siteId: Schema.optional(SiteId),
      /** Pagination */
      pagination: Schema.optional(PaginationInput),
    },
  }
) {}

// ─────────────────────────────────────────────────────────────────────────────
// Property Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a specific property from an asset
 */
export class GetAssetProperty extends Schema.TaggedRequest<GetAssetProperty>()(
  'GetAssetProperty',
  {
    failure: AssetNotFoundError,
    success: Schema.NullOr(AssetProperty),
    payload: {
      assetId: AssetId,
      key: PropertyKey,
    },
  }
) {}

/**
 * Get all properties for an asset
 */
export class GetAssetProperties extends Schema.TaggedRequest<GetAssetProperties>()(
  'GetAssetProperties',
  {
    failure: AssetNotFoundError,
    success: Schema.Array(AssetProperty),
    payload: {
      assetId: AssetId,
    },
  }
) {}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset count result
 */
export const AssetCount = Schema.Struct({
  _tag: Schema.Literal('AssetCount'),
  count: Schema.Number,
  groupBy: Schema.optional(Schema.String),
  groupValue: Schema.optional(Schema.String),
})
export type AssetCount = typeof AssetCount.Type

/**
 * Count assets by site
 */
export class CountAssetsBySite extends Schema.TaggedRequest<CountAssetsBySite>()(
  'CountAssetsBySite',
  {
    failure: Schema.Never,
    success: AssetCount,
    payload: {
      siteId: SiteId,
      /** Optional status filter */
      status: Schema.optional(AssetStatus),
    },
  }
) {}

/**
 * Count assets grouped by status
 */
export class CountAssetsByStatus extends Schema.TaggedRequest<CountAssetsByStatus>()(
  'CountAssetsByStatus',
  {
    failure: Schema.Never,
    success: Schema.Array(AssetCount),
    payload: {
      /** Scope to site (optional) */
      siteId: Schema.optional(SiteId),
    },
  }
) {}

/**
 * Count assets grouped by kind
 */
export class CountAssetsByKind extends Schema.TaggedRequest<CountAssetsByKind>()(
  'CountAssetsByKind',
  {
    failure: Schema.Never,
    success: Schema.Array(AssetCount),
    payload: {
      /** Scope to site (optional) */
      siteId: Schema.optional(SiteId),
    },
  }
) {}

// ─────────────────────────────────────────────────────────────────────────────
// Query Union
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Union of all asset queries for pattern matching
 */
export const AssetQuery = Schema.Union(
  GetAsset,
  GetAssetSummary,
  AssetExists,
  ListAssetsBySite,
  ListAssetsBySector,
  ListAssetsByContainer,
  SearchAssets,
  ListAssetsByTag,
  ListAssetsByKind,
  ListAssetsByStatus,
  GetAssetProperty,
  GetAssetProperties,
  CountAssetsBySite,
  CountAssetsByStatus,
  CountAssetsByKind
)
export type AssetQuery = typeof AssetQuery.Type
