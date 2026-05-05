/**
 * @tmnl/pct/publish — bridge from Procedure values to registry events.
 *
 * `Pact.publish(group)` decomposes each procedure into Schema-Registered
 * and Operation-Registered events, written to the registry's EventLog.
 *
 * @module @tmnl/pct/publish
 */

export {
  type DeprecateOptions,
  type PublishedProcedure,
  type PublishOptions,
  type PublishResult,
  deprecateOperation,
  deprecateSchema,
  publish,
  publishProcedure,
} from "./Publish.js"
