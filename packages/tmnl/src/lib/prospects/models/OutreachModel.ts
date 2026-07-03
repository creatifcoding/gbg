/**
 * OutreachModel — Effect SQL Model for Outreach entity
 *
 * Tracks every outreach attempt per decision maker per channel.
 * Enables cadence tracking and response analytics.
 *
 * @module prospects/models/OutreachModel
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { OutreachChannel, OutreachStatus } from '../schemas/domain'

// =============================================================================
// Model Definition
// =============================================================================

export class OutreachModel extends Model.Class<OutreachModel>(
  'OutreachModel'
)({
  id: Schema.String,
  decisionMakerId: Schema.String,
  companyId: Schema.String,
  channel: OutreachChannel,
  status: OutreachStatus,
  subject: Model.FieldOption(Schema.String),
  body: Model.FieldOption(Schema.String),
  sentAt: Model.FieldOption(Schema.DateFromSelf),
  respondedAt: Model.FieldOption(Schema.DateFromSelf),
  notes: Model.FieldOption(Schema.String),
  createdAt: Model.DateTimeInsertFromDate,
  updatedAt: Model.DateTimeUpdateFromDate,
}) {}
