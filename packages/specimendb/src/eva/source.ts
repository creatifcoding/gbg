/**
 * EVA SourceAdapter at the catalog seam.
 * Shape mined from packages/tmnl/src-ava ava-domain (kind + id + query → Arrow).
 * Do not import tmnl. Do not rebuild DataFusion. No wasm gate.
 *
 * @module @tmnl/specimendb/eva/source
 */

import type { Table } from 'apache-arrow';
import type * as Effect from 'effect/Effect';
import type { SourceError } from './errors.js';

/** Kind-local discriminator matching ava-domain SourceKind. */
export const SOURCE_KIND_VALUES = [
  'sql',
  'stream',
  'api',
  'graph',
  'lake',
  'cache',
] as const;
export type SourceKind = (typeof SOURCE_KIND_VALUES)[number];

export interface SourceAdapterShape {
  readonly kind: SourceKind;
  readonly id: string;
  readonly query: (sqlText: string) => Effect.Effect<Table, SourceError>;
  readonly schema: () => Effect.Effect<Table, SourceError>;
}
