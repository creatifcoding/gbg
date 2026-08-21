/**
 * EVA: Entity View Agent at the catalog seam. Postgres SourceAdapter only.
 * Do not import tmnl. Do not rebuild DataFusion.
 *
 * @module @tmnl/specimendb/eva
 */

export { emptyArrowTable, rowsToArrow, columnValues } from './arrow.js';
export { SourceError } from './errors.js';
export { PostgresSqlSource } from './postgres.js';
export { SOURCE_KIND_VALUES, type SourceAdapterShape, type SourceKind } from './source.js';
