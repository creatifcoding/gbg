/**
 * SIOS EntityProxyServer Handlers
 *
 * Creates HttpApi handler layers for all SIOS entities using
 * EntityProxyServer.layerHttpApi(). Each handler routes HTTP
 * requests through the cluster to entity actors.
 *
 * @module sios/http/proxy-handlers
 */

import { EntityProxyServer } from '@effect/cluster'
import { Layer } from 'effect'
import { SiosApi } from './api'

// Entity imports - direct imports to avoid barrel name collisions
import { ProjectEntity } from '../entity/ProjectEntity'
import { ZoneEntity } from '../entity/ZoneEntity'
import { WorkPackageEntity } from '../entity/WorkPackageEntity'
import { TaskEntity } from '../entity/TaskEntity'
import { CrewEntity } from '../entity/CrewEntity'
import { WorkerEntity } from '../entity/WorkerEntity'
import { IssueEntity } from '../entity/IssueEntity'
import { CheckpointEntity } from '../entity/CheckpointEntity'

// =============================================================================
// Proxy Handler Layers
// =============================================================================

/**
 * Combined proxy handler layer for all SIOS entities.
 *
 * Group names must match those used in SiosApi.add() calls.
 */
export const ProxyHandlers = Layer.mergeAll(
  EntityProxyServer.layerHttpApi(SiosApi, 'projects', ProjectEntity),
  EntityProxyServer.layerHttpApi(SiosApi, 'zones', ZoneEntity),
  EntityProxyServer.layerHttpApi(SiosApi, 'work-packages', WorkPackageEntity),
  EntityProxyServer.layerHttpApi(SiosApi, 'tasks', TaskEntity),
  EntityProxyServer.layerHttpApi(SiosApi, 'crews', CrewEntity),
  EntityProxyServer.layerHttpApi(SiosApi, 'workers', WorkerEntity),
  EntityProxyServer.layerHttpApi(SiosApi, 'issues', IssueEntity),
  EntityProxyServer.layerHttpApi(SiosApi, 'checkpoints', CheckpointEntity),
)
