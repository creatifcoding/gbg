/**
 * Tagged catalog errors. Re-export of Schema.TaggedErrorClass types.
 * Shape mined from tmnl iiot `errors/`.
 *
 * @module @tmnl/specimendb/errors
 */

export {
  ActivityAppendError,
  CatalogError,
  EntityNotFoundError,
  IntakeError,
  SpecimenNotFoundError,
  type ActivityRpcError,
  type CatalogRpcError,
  type SpecimenRpcError,
} from '../schemas/errors.js';
