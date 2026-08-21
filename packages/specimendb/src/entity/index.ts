/**
 * Catalog entity primitive. Entity is a stable ref, not a fat row.
 * Shape mined from tmnl iiot `entity/` — without ISA-95 Asset or Cluster.
 *
 * @module @tmnl/specimendb/entity
 */

export { CatalogEntity } from '../schemas/entity.js';
export type {
  CatalogRecord,
  DoctorPayload,
  ExportPayload,
  GetComponentsPayload,
  GetEntityPayload,
  ListEntitiesPayload,
  MintEntityPayload,
  ProjectPayload,
} from '../schemas/entity.js';
