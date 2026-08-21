/**
 * EVA: Entity View Agent at the catalog seam. Postgres SourceAdapter only.
 * Do not import tmnl. Do not rebuild DataFusion.
 *
 * @module @tmnl/specimendb/eva
 */

export { columnValues, emptyArrowTable, rowsToArrow } from './arrow.js';
export { SourceError } from './errors.js';
export { PostgresSqlSource } from './postgres.js';
export type { SourceAdapterShape, SourceKind } from './source.js';
