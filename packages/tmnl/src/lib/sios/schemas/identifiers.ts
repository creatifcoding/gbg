/**
 * SIOS — Branded Identifiers
 *
 * Every entity gets a branded ID type for compile-time safety.
 * You cannot pass a WorkerId where a CrewId is expected.
 *
 * Pattern: Schema.String → Schema.brand → re-export type.
 *
 * @module sios/schemas/identifiers
 */

import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Core Entity IDs
// ─────────────────────────────────────────────────────────────────────────────

export const ProjectId = Schema.String.pipe(
  Schema.brand('ProjectId'),
  Schema.minLength(1)
)
export type ProjectId = typeof ProjectId.Type

export const ZoneId = Schema.String.pipe(
  Schema.brand('ZoneId'),
  Schema.minLength(1)
)
export type ZoneId = typeof ZoneId.Type

export const WorkPackageId = Schema.String.pipe(
  Schema.brand('WorkPackageId'),
  Schema.minLength(1)
)
export type WorkPackageId = typeof WorkPackageId.Type

export const TaskId = Schema.String.pipe(
  Schema.brand('TaskId'),
  Schema.minLength(1)
)
export type TaskId = typeof TaskId.Type

export const CrewId = Schema.String.pipe(
  Schema.brand('CrewId'),
  Schema.minLength(1)
)
export type CrewId = typeof CrewId.Type

export const WorkerId = Schema.String.pipe(
  Schema.brand('WorkerId'),
  Schema.minLength(1)
)
export type WorkerId = typeof WorkerId.Type

export const TimeEntryId = Schema.String.pipe(
  Schema.brand('TimeEntryId'),
  Schema.minLength(1)
)
export type TimeEntryId = typeof TimeEntryId.Type

export const IssueId = Schema.String.pipe(
  Schema.brand('IssueId'),
  Schema.minLength(1)
)
export type IssueId = typeof IssueId.Type

export const CheckpointId = Schema.String.pipe(
  Schema.brand('CheckpointId'),
  Schema.minLength(1)
)
export type CheckpointId = typeof CheckpointId.Type
