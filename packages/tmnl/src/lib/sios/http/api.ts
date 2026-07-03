/**
 * SIOS HttpApi Definition
 *
 * Composes all SIOS entity HttpApiGroups into a single HttpApi
 * using EntityProxy.toHttpApiGroup(). Each entity gets auto-generated
 * POST endpoints for every Rpc.make() operation.
 *
 * @module sios/http/api
 */

import { EntityProxy } from '@effect/cluster'
import { HttpApi } from '@effect/platform'
import { OpenApi } from '@effect/platform'
import { SiosHealthQueryGroup } from './query-api'

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
// SIOS HttpApi
// =============================================================================

/**
 * Combined SIOS HttpApi.
 */
export class SiosApi extends HttpApi.make('sios-api')
  .annotateContext(OpenApi.annotations({
    title: 'SIOS - Site Installation & Operations System',
    version: '1.0.0',
  }))
  .add(EntityProxy.toHttpApiGroup('projects', ProjectEntity).prefix('/api/sios/projects'))
  .add(EntityProxy.toHttpApiGroup('zones', ZoneEntity).prefix('/api/sios/zones'))
  .add(EntityProxy.toHttpApiGroup('work-packages', WorkPackageEntity).prefix('/api/sios/work-packages'))
  .add(EntityProxy.toHttpApiGroup('tasks', TaskEntity).prefix('/api/sios/tasks'))
  .add(EntityProxy.toHttpApiGroup('crews', CrewEntity).prefix('/api/sios/crews'))
  .add(EntityProxy.toHttpApiGroup('workers', WorkerEntity).prefix('/api/sios/workers'))
  .add(EntityProxy.toHttpApiGroup('issues', IssueEntity).prefix('/api/sios/issues'))
  .add(EntityProxy.toHttpApiGroup('checkpoints', CheckpointEntity).prefix('/api/sios/checkpoints'))
  .add(SiosHealthQueryGroup.prefix('/api/sios'))
{}
