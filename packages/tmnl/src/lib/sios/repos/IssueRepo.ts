/**
 * IssueRepo - Repository for IssueModel
 * @module sios/repos/IssueRepo
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { IssueId, ProjectId } from '../schemas/identifiers'
import { IssueModel } from '../models/IssueModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

export type IssueRepoError = SqlError.SqlError | ParseResult.ParseError

export interface IssueRepository {
  readonly findById: (id: IssueId) => Effect.Effect<Option.Option<IssueModel>, IssueRepoError>
  readonly findByProject: (projectId: ProjectId) => Effect.Effect<readonly IssueModel[], IssueRepoError>
  readonly findBySeverity: (severity: string) => Effect.Effect<readonly IssueModel[], IssueRepoError>
  readonly findOverdueSLA: () => Effect.Effect<readonly IssueModel[], IssueRepoError>
  readonly insert: (issue: typeof IssueModel.insert.Type) => Effect.Effect<IssueModel, IssueRepoError>
  readonly update: (issue: typeof IssueModel.update.Type) => Effect.Effect<IssueModel, IssueRepoError>
}

export class IssueRepo extends Context.Tag('sios/IssueRepo')<
  IssueRepo,
  IssueRepository
>() {}

export const IssueRepoLive = Layer.effect(
  IssueRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const selectColumns = sql`
      id,
      project_id AS "projectId",
      zone_id AS "zoneId",
      work_package_id AS "workPackageId",
      title,
      description,
      status,
      severity,
      category,
      reported_by AS "reportedBy",
      assigned_to AS "assignedTo",
      evidence,
      sla_deadline AS "slaDeadline",
      resolved_at AS "resolvedAt",
      verified_at AS "verifiedAt",
      resolution,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: IssueId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.issues
          WHERE id = ${id}
          LIMIT 1
        `

        return yield* decodeOptional(IssueModel)(rows)
      })

    const findByProject = (projectId: ProjectId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.issues
          WHERE project_id = ${projectId}
          ORDER BY created_at DESC
        `

        return yield* decodeRows(IssueModel)(rows)
      })

    const findBySeverity = (severity: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.issues
          WHERE severity = ${severity}
          ORDER BY created_at DESC
        `

        return yield* decodeRows(IssueModel)(rows)
      })

    const findOverdueSLA = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.issues
          WHERE sla_deadline IS NOT NULL
            AND sla_deadline < NOW()
            AND status NOT IN ('resolved', 'verified', 'closed', 'wont_fix')
          ORDER BY sla_deadline ASC
        `

        return yield* decodeRows(IssueModel)(rows)
      })

    const insert = (issue: typeof IssueModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO sios.issues (
            id,
            project_id,
            zone_id,
            work_package_id,
            title,
            description,
            status,
            severity,
            category,
            reported_by,
            assigned_to,
            evidence,
            sla_deadline,
            resolved_at,
            verified_at,
            resolution,
            metadata
          )
          VALUES (
            ${issue.id},
            ${issue.projectId},
            ${Option.getOrNull(issue.zoneId)},
            ${Option.getOrNull(issue.workPackageId)},
            ${issue.title},
            ${issue.description},
            ${issue.status},
            ${issue.severity},
            ${issue.category},
            ${issue.reportedBy},
            ${Option.getOrNull(issue.assignedTo)},
            ${JSON.stringify(issue.evidence)},
            ${Option.getOrNull(issue.slaDeadline)},
            ${Option.getOrNull(issue.resolvedAt)},
            ${Option.getOrNull(issue.verifiedAt)},
            ${Option.getOrNull(issue.resolution)},
            ${Option.match(issue.metadata, { onNone: () => null, onSome: (value) => JSON.stringify(value) })}
          )
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(IssueModel)(rows)
      })

    const update = (issue: typeof IssueModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(issue, {
          jsonbFields: ['evidence', 'metadata'],
        })

        const rows = yield* sql`
          UPDATE sios.issues
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${issue.id}
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(IssueModel)(rows)
      })

    return {
      findById,
      findByProject,
      findBySeverity,
      findOverdueSLA,
      insert,
      update,
    } satisfies IssueRepository
  })
)
