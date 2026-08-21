/**
 * EVA SourceAdapter at the catalog seam.
 * Shape mined from packages/tmnl/src-ava ava-domain. Do not import tmnl.
 * Do not rebuild DataFusion. No wasm gate.
 *
 * @module @tmnl/specimendb/eva/source
 */

import type { Table } from 'apache-arrow';
import type * as Effect from 'effect/Effect';
import type { SourceError } from './errors.js';

export type SourceKind = 'sql';

export interface SourceAdapterShape {
  readonly kind: SourceKind;
  readonly id: string;
  readonly query: (sqlText: string) => Effect.Effect<Table, SourceError>;
  readonly schema: () => Effect.Effect<Table, SourceError>;
}
