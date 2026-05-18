/**
 * @tmnl/pct/server — HTTP routes layer for PCT.
 *
 * Adds `/capabilities`, `/schemas/:schemaId`, `/publish`,
 * `/publish/procedure`, and `/publish/group` to a shared
 * `HttpRouter`. Designed to compose with other route layers (e.g.
 * `@tmnl/lnk`'s) on one HTTP host.
 *
 * @module @tmnl/pct/server
 */

export { layerFromConfig as journalLayerFromConfig } from "./Journal.js"
export { Routes } from "./Routes.js"
export {
  type ErrorBody,
  ErrorBody as ErrorBodySchema,
  GetSchemaParams,
  GetSchemaResponse,
  PublishedProcedureResponse,
  PublishProcedureGroupRequest,
  PublishProcedureGroupResponse,
  PublishProcedureRequest,
  PublishSchemaRequest,
  PublishSchemaResponse,
} from "./wire.js"
