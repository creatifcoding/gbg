/**
 * Chronicle Identifiers — Branded String Types
 *
 * Type-safe identifiers for all Chronicle domain entities.
 * DayId doubles as DateKey ("2026-01-15" format).
 *
 * @module @chronicle/schemas/identifiers
 */

import { Schema } from 'effect'

// ─── Day Identifier ─────────────────────────────────────────────────────────

/**
 * Day identifier — ISO date string "YYYY-MM-DD".
 * Serves as both the day's primary key and its DateKey.
 */
export const DayId = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}$/),
  Schema.brand('DayId'),
  Schema.annotations({
    identifier: '@chronicle/DayId',
    description: 'Chronicle day identifier (ISO date string)',
  }),
)
export type DayId = typeof DayId.Type

// ─── Sub-Entity Identifiers ─────────────────────────────────────────────────

export const NoteId = Schema.String.pipe(
  Schema.brand('NoteId'),
  Schema.annotations({ identifier: '@chronicle/NoteId' }),
)
export type NoteId = typeof NoteId.Type

export const CardId = Schema.String.pipe(
  Schema.brand('CardId'),
  Schema.annotations({ identifier: '@chronicle/CardId' }),
)
export type CardId = typeof CardId.Type

export const DayTaskId = Schema.String.pipe(
  Schema.brand('DayTaskId'),
  Schema.annotations({ identifier: '@chronicle/DayTaskId' }),
)
export type DayTaskId = typeof DayTaskId.Type

export const LinkId = Schema.String.pipe(
  Schema.brand('LinkId'),
  Schema.annotations({ identifier: '@chronicle/LinkId' }),
)
export type LinkId = typeof LinkId.Type

export const AttachmentId = Schema.String.pipe(
  Schema.brand('AttachmentId'),
  Schema.annotations({ identifier: '@chronicle/AttachmentId' }),
)
export type AttachmentId = typeof AttachmentId.Type
