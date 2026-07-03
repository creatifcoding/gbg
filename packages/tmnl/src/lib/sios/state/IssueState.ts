/**
 * IssueState Service — Context.Tag + in-memory
 * @module sios/state/IssueState
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import { Issue, CreateIssueParams, type IssueStatus, type IssueSeverity } from '../schemas/issue'
import type { IssueId, ProjectId, ZoneId, WorkerId } from '../schemas/identifiers'

let issCounter = 0
const genIssueId = (): IssueId => `ISS-${Date.now().toString(36)}-${++issCounter}` as IssueId

export interface IssueFilter {
  readonly projectId?: ProjectId
  readonly zoneId?: ZoneId
  readonly severity?: IssueSeverity
  readonly status?: IssueStatus
  readonly assignedTo?: WorkerId
  readonly limit?: number
  readonly offset?: number
}

export class IssueStateNotFoundError {
  readonly _tag = 'IssueStateNotFoundError'
  constructor(readonly issueId: IssueId) {}
}

export interface IssueStateShape {
  readonly create: (params: CreateIssueParams) => Effect.Effect<Issue>
  readonly get: (id: IssueId) => Effect.Effect<Issue, IssueStateNotFoundError>
  readonly set: (issue: Issue) => Effect.Effect<void>
  readonly list: (filter: IssueFilter) => Effect.Effect<readonly Issue[]>
  readonly delete: (id: IssueId) => Effect.Effect<boolean>
  readonly exists: (id: IssueId) => Effect.Effect<boolean>
  readonly count: (filter: IssueFilter) => Effect.Effect<number>
}

export class IssueState extends Context.Tag('sios/IssueState')<IssueState, IssueStateShape>() {}

export const IssueStateInMemory: Layer.Layer<IssueState> = Layer.effect(
  IssueState,
  Ref.make(new Map<IssueId, Issue>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (i: Issue, f: IssueFilter): boolean => {
        if (f.projectId && i.projectId !== f.projectId) return false
        if (f.zoneId && (!Option.isSome(i.zoneId) || i.zoneId.value !== f.zoneId)) return false
        if (f.severity && i.severity !== f.severity) return false
        if (f.status && i.status !== f.status) return false
        if (f.assignedTo && (!Option.isSome(i.assignedTo) || i.assignedTo.value !== f.assignedTo)) return false
        return true
      }
      return {
        create: (params: CreateIssueParams) =>
          Effect.gen(function* () {
            const id = genIssueId()
            const now = yield* DateTime.now
            const issue = new Issue({
              id, projectId: params.projectId,
              zoneId: params.zoneId ? Option.some(params.zoneId) : Option.none(),
              workPackageId: params.workPackageId ? Option.some(params.workPackageId) : Option.none(),
              title: params.title, description: params.description,
              status: 'open', severity: params.severity, category: params.category,
              reportedBy: params.reportedBy,
              assignedTo: params.assignedTo ? Option.some(params.assignedTo) : Option.none(),
              evidence: params.evidence ?? [],
              slaDeadline: params.slaDeadline ? Option.some(params.slaDeadline) : Option.none(),
              resolvedAt: Option.none(), verifiedAt: Option.none(),
              resolution: Option.none(),
              createdAt: now, updatedAt: Option.none(), metadata: {},
            })
            yield* Ref.update(store, (m) => { const n = new Map(m); n.set(id, issue); return n })
            return issue
          }),
        get: (id: IssueId) =>
          Ref.get(store).pipe(Effect.flatMap((m) => {
            const i = m.get(id)
            return i ? Effect.succeed(i) : Effect.fail(new IssueStateNotFoundError(id))
          })),
        set: (issue: Issue) =>
          Ref.update(store, (m) => { const n = new Map(m); n.set(issue.id, issue); return n }),
        list: (filter: IssueFilter) =>
          Ref.get(store).pipe(Effect.map((m) => {
            let r = Array.from(m.values()).filter((i) => matchesFilter(i, filter))
            if (filter.offset) r = r.slice(filter.offset)
            if (filter.limit) r = r.slice(0, filter.limit)
            return r
          })),
        delete: (id: IssueId) =>
          Ref.modify(store, (m) => {
            if (m.has(id)) { const n = new Map(m); n.delete(id); return [true, n] as const }
            return [false, m] as const
          }),
        exists: (id: IssueId) => Ref.get(store).pipe(Effect.map((m) => m.has(id))),
        count: (filter: IssueFilter) =>
          Ref.get(store).pipe(Effect.map((m) =>
            Array.from(m.values()).filter((i) => matchesFilter(i, filter)).length
          )),
      } satisfies IssueStateShape
    })
  )
)
