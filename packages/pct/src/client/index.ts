/**
 * @tmnl/pct/client — typed proxy for remote PCT instances.
 *
 * @module @tmnl/pct/client
 */

export {
  type PactClientShape,
  type PublishResult,
  PactClient,
  PactClientError,
  SchemaNotFound,
  layer,
  make,
} from "./PactClient.js"
export {
  layer as schemaResolverLayer,
  layerFromPactClient as schemaResolverLayerFromPactClient,
} from "./SchemaResolverLayer.js"
