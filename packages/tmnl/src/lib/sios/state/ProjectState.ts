/**
 * ProjectState Service — Context.Tag + in-memory
 * @module sios/state/ProjectState
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import { Project, CreateProjectParams, type ProjectStatus, type ProjectType, type SiteCondition } from '../schemas/project'
import type { ProjectId } from '../schemas/identifiers'

let prjCounter = 0
const genProjectId = (): ProjectId => `PRJ-${Date.now().toString(36)}-${++prjCounter}` as ProjectId

export interface ProjectFilter {
  readonly status?: ProjectStatus
  readonly projectType?: ProjectType
  readonly siteCondition?: SiteCondition
  readonly limit?: number
  readonly offset?: number
}

export class ProjectStateNotFoundError {
  readonly _tag = 'ProjectStateNotFoundError'
  constructor(readonly projectId: ProjectId) {}
}

export interface ProjectStateShape {
  readonly create: (params: CreateProjectParams) => Effect.Effect<Project>
  readonly get: (id: ProjectId) => Effect.Effect<Project, ProjectStateNotFoundError>
  readonly set: (project: Project) => Effect.Effect<void>
  readonly list: (filter: ProjectFilter) => Effect.Effect<readonly Project[]>
  readonly delete: (id: ProjectId) => Effect.Effect<boolean>
  readonly exists: (id: ProjectId) => Effect.Effect<boolean>
  readonly count: (filter: ProjectFilter) => Effect.Effect<number>
}

export class ProjectState extends Context.Tag('sios/ProjectState')<ProjectState, ProjectStateShape>() {}

export const ProjectStateInMemory: Layer.Layer<ProjectState> = Layer.effect(
  ProjectState,
  Ref.make(new Map<ProjectId, Project>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (p: Project, f: ProjectFilter): boolean => {
        if (f.status && p.status !== f.status) return false
        if (f.projectType && p.projectType !== f.projectType) return false
        if (f.siteCondition && p.siteCondition !== f.siteCondition) return false
        return true
      }

      return {
        create: (params: CreateProjectParams) =>
          Effect.gen(function* () {
            const id = genProjectId()
            const now = yield* DateTime.now
            const project = new Project({
              id, name: params.name, code: params.code, status: 'bidding',
              client: params.client,
              integrator: params.integrator ? Option.some(params.integrator) : Option.none(),
              projectType: params.projectType, deliveryMethod: params.deliveryMethod,
              siteCondition: params.siteCondition,
              location: params.location ? Option.some(params.location) : Option.none(),
              shiftWindow: params.shiftWindow ? Option.some(params.shiftWindow) : Option.none(),
              timezone: params.timezone ? Option.some(params.timezone) : Option.none(),
              startDate: params.startDate ? Option.some(params.startDate) : Option.none(),
              endDate: params.endDate ? Option.some(params.endDate) : Option.none(),
              actualStartDate: Option.none(), actualEndDate: Option.none(),
              budgetedCost: params.budgetedCost,
              holdReason: Option.none(),
              description: params.description ? Option.some(params.description) : Option.none(),
              createdAt: now, updatedAt: Option.none(), metadata: {},
            })
            yield* Ref.update(store, (m) => { const n = new Map(m); n.set(id, project); return n })
            return project
          }),
        get: (id: ProjectId) =>
          Ref.get(store).pipe(Effect.flatMap((m) => {
            const p = m.get(id)
            return p ? Effect.succeed(p) : Effect.fail(new ProjectStateNotFoundError(id))
          })),
        set: (project: Project) =>
          Ref.update(store, (m) => { const n = new Map(m); n.set(project.id, project); return n }),
        list: (filter: ProjectFilter) =>
          Ref.get(store).pipe(Effect.map((m) => {
            let r = Array.from(m.values()).filter((p) => matchesFilter(p, filter))
            if (filter.offset) r = r.slice(filter.offset)
            if (filter.limit) r = r.slice(0, filter.limit)
            return r
          })),
        delete: (id: ProjectId) =>
          Ref.modify(store, (m) => {
            if (m.has(id)) { const n = new Map(m); n.delete(id); return [true, n] as const }
            return [false, m] as const
          }),
        exists: (id: ProjectId) => Ref.get(store).pipe(Effect.map((m) => m.has(id))),
        count: (filter: ProjectFilter) =>
          Ref.get(store).pipe(Effect.map((m) =>
            Array.from(m.values()).filter((p) => matchesFilter(p, filter)).length
          )),
      } satisfies ProjectStateShape
    })
  )
)
