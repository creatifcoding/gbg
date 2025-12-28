/**
 * Connection Ports ↔ Kori Integration
 *
 * Bridges Connection Ports streams with kori ECS World.
 * Enables reactive data binding: stream → entities → React.
 *
 * @module connection-ports/kori
 */

export {
  StreamToWorld,
  StreamToWorldLive,
  makeStreamToWorld,
  type StreamToWorldOps,
  type TraitData,
  type StreamToTraitsMapper,
  type EntityIdExtractor,
  type MaterializeOptions,
  type MaterializationResult,
  type MaterializationStats,
} from './StreamToWorld'
