/**
 * Actor Services - Barrel Export
 *
 * @module lib/actors/services
 */

export {
  ActorPersistence,
  ActorPersistenceLive,
  ActorPersistenceLayer,
  SqliteLive,
  type ActorPersistenceShape,
} from './ActorPersistence'

export {
  WorkspaceService,
  WorkspaceServiceLive,
  type WorkspaceServiceShape,
  type CreateBufferOptions,
} from './WorkspaceService'

export {
  SessionService,
  SessionServiceFactory,
  SessionServiceFactoryLive,
  type SessionServiceShape,
  type SessionServiceFactoryShape,
  type CreateTabOptions,
  type UpdateTabOptions,
  type UpdateWindowOptions,
} from './SessionService'
