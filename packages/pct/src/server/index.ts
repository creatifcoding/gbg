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
export {
  DEFAULT_PCT_NATS_CONTROL_PLANE_OPTIONS,
  PctNatsControlPlane,
  PctNatsSchemaNotFound,
  layer as natsControlPlaneLayer,
  make as makeNatsControlPlane,
  resolvePctNatsControlPlaneOptions,
  type PctNatsControlPlaneOptions,
  type PctNatsControlPlaneShape,
  type ResolvedPctNatsControlPlaneOptions,
} from "./NatsControlPlane.js"
export { Routes } from "./Routes.js"
export {
  type ErrorBody,
  ErrorBody as ErrorBodySchema,
  CapabilitiesGetRequest,
  GetSchemaParams,
  GetSchemaResponse,
  SchemaGetRequest,
  PublishedProcedureResponse,
  PublishProcedureGroupRequest,
  PublishProcedureGroupResponse,
  PublishProcedureRequest,
  PublishSchemaRequest,
  PublishSchemaResponse,
} from "./wire.js"
