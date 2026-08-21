/**
 * SpecimenRail — Workbench `/rail` route.
 * Phase 0: the Variant HTML as one page. No extraction. No bind.
 *
 * @module @tmnl/specimendb/ui
 */

import type { CatalogSurface } from './catalog-stx.js';
import { ImportedWorkbench } from './ImportedWorkbench.js';

export type SpecimenRailProps = {
  readonly catalog?: CatalogSurface;
};

export function SpecimenRail(_props: SpecimenRailProps = {}) {
  return <ImportedWorkbench />;
}
