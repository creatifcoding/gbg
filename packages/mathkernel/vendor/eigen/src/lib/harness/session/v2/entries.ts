/**
 * Session Entry Schemas
 *
 * Append-only tree entries — the atoms of session state.
 * Each entry has { id, parentId, timestamp } forming a tree via parentId chains.
 *
 * Ported from pi's SessionEntry union, extended with TMNL-specific types.
 * Uses Schema.TaggedStruct for compile-time discriminated union safety.
 *
 * Reference: docs/architecture/SESSION-RESEARCH-FRONTIERS.md §1.2
 *
 * @module harness/session/v2/entries
 */

import { Schema } from 'effect'
import { EntryId } from './identity'

// =============================================================================
// Entry Base — shared fields for all tree entries
// =============================================================================

/** Fields common to every session tree entry. */
const EntryBase = {
  /** Unique entry identifier */
  id: EntryId,
  /** Parent entry ID (null for root entries) */
  parentId: Schema.NullOr(EntryId),
  /** ISO-8601 timestamp */
  timestamp: Schema.String.pipe(Schema.nonEmptyString()),
}

// =============================================================================
// Message Roles & Content
// =============================================================================

/** Message roles in conversation */
export const MessageRole = Schema.Literal('user', 'assistant', 'system', 'tool')
export type MessageRole = typeof MessageRole.Type

/** Text content block */
export const TextContent = Schema.Struct({
  type: Schema.Literal('text'),
  text: Schema.String,
})

/** Image content block */
export const ImageContent = Schema.Struct({
  type: Schema.Literal('image'),
  url: Schema.String,
  alt: Schema.optional(Schema.String),
})

/** Tool call content block */
export const ToolCallContent = Schema.Struct({
  type: Schema.Literal('tool_call'),
  toolCallId: Schema.String,
  toolName: Schema.String,
  args: Schema.Unknown,
})

/** Tool result content block */
export const ToolResultContent = Schema.Struct({
  type: Schema.Literal('tool_result'),
  toolCallId: Schema.String,
  result: Schema.Unknown,
  isError: Schema.optional(Schema.Boolean),
})

/** Thinking content block */
export const ThinkingContent = Schema.Struct({
  type: Schema.Literal('thinking'),
  text: Schema.String,
})

/** Content block union */
export const ContentBlock = Schema.Union(
  TextContent,
  ImageContent,
  ToolCallContent,
  ToolResultContent,
  ThinkingContent,
)
export type ContentBlock = typeof ContentBlock.Type

/** A complete message in the session tree */
export const SessionMessage = Schema.Struct({
  role: MessageRole,
  content: Schema.Union(Schema.String, Schema.Array(ContentBlock)),
  /** Provider-specific message ID (if any) */
  providerMessageId: Schema.optional(Schema.String),
})
export type SessionMessage = typeof SessionMessage.Type

// =============================================================================
// Thinking Level
// =============================================================================

export const ThinkingLevel = Schema.Literal('off', 'minimal', 'low', 'medium', 'high')
export type ThinkingLevel = typeof ThinkingLevel.Type

// =============================================================================
// Entry Types — the discriminated union members
// =============================================================================

/** A conversation message entry */
export const MessageEntry = Schema.TaggedStruct('MessageEntry', {
  ...EntryBase,
  message: SessionMessage,
})
export type MessageEntry = typeof MessageEntry.Type

/** Thinking level change entry */
export const ThinkingLevelChangeEntry = Schema.TaggedStruct('ThinkingLevelChangeEntry', {
  ...EntryBase,
  thinkingLevel: ThinkingLevel,
})
export type ThinkingLevelChangeEntry = typeof ThinkingLevelChangeEntry.Type

/** Model/provider change entry */
export const ModelChangeEntry = Schema.TaggedStruct('ModelChangeEntry', {
  ...EntryBase,
  provider: Schema.String,
  modelId: Schema.String,
})
export type ModelChangeEntry = typeof ModelChangeEntry.Type

/** Context compaction entry — summarizes old messages */
export const CompactionEntry = Schema.TaggedStruct('CompactionEntry', {
  ...EntryBase,
  /** LLM-generated summary of compacted messages */
  summary: Schema.String,
  /** First entry ID that's still "live" after compaction */
  firstKeptEntryId: EntryId,
  /** Token count before compaction (for analytics) */
  tokensBefore: Schema.Number.pipe(Schema.nonNegative()),
  /** Extension-specific compaction data */
  details: Schema.optional(Schema.Unknown),
  /** True if extension-generated, false/undefined if system-generated */
  fromHook: Schema.optional(Schema.Boolean),
})
export type CompactionEntry = typeof CompactionEntry.Type

/** Branch summary entry — summarizes an abandoned branch */
export const BranchSummaryEntry = Schema.TaggedStruct('BranchSummaryEntry', {
  ...EntryBase,
  /** The entry we branched from */
  fromId: EntryId,
  /** LLM summary of the abandoned path */
  summary: Schema.String,
  /** Extension-specific data (not sent to LLM) */
  details: Schema.optional(Schema.Unknown),
  /** True if extension-generated */
  fromHook: Schema.optional(Schema.Boolean),
})
export type BranchSummaryEntry = typeof BranchSummaryEntry.Type

/** Extension state entry — NOT sent to LLM context */
export const CustomEntry = Schema.TaggedStruct('CustomEntry', {
  ...EntryBase,
  /** Extension type discriminator */
  customType: Schema.String,
  /** Extension-specific payload */
  data: Schema.optional(Schema.Unknown),
})
export type CustomEntry = typeof CustomEntry.Type

/** Extension message entry — IS sent to LLM context */
export const CustomMessageEntry = Schema.TaggedStruct('CustomMessageEntry', {
  ...EntryBase,
  /** Extension type discriminator */
  customType: Schema.String,
  /** Content sent to LLM */
  content: Schema.Union(Schema.String, Schema.Array(Schema.Union(TextContent, ImageContent))),
  /** Extension metadata (not sent to LLM) */
  details: Schema.optional(Schema.Unknown),
  /** Show in UI? */
  display: Schema.Boolean,
})
export type CustomMessageEntry = typeof CustomMessageEntry.Type

/** Label/bookmark entry on any tree node */
export const LabelEntry = Schema.TaggedStruct('LabelEntry', {
  ...EntryBase,
  /** Which entry is labeled */
  targetId: EntryId,
  /** Label text (undefined clears the label) */
  label: Schema.UndefinedOr(Schema.String),
})
export type LabelEntry = typeof LabelEntry.Type

/** Session metadata entry (display name, etc.) */
export const SessionInfoEntry = Schema.TaggedStruct('SessionInfoEntry', {
  ...EntryBase,
  /** User-defined session display name */
  name: Schema.optional(Schema.String),
})
export type SessionInfoEntry = typeof SessionInfoEntry.Type

// =============================================================================
// Session Entry Union
// =============================================================================

/**
 * The complete session entry discriminated union.
 *
 * Pattern match on _tag:
 * - 'MessageEntry' — conversation message
 * - 'ThinkingLevelChangeEntry' — thinking level change
 * - 'ModelChangeEntry' — model/provider switch
 * - 'CompactionEntry' — context compaction
 * - 'BranchSummaryEntry' — abandoned branch summary
 * - 'CustomEntry' — extension state (not in LLM context)
 * - 'CustomMessageEntry' — extension message (in LLM context)
 * - 'LabelEntry' — bookmark on a tree node
 * - 'SessionInfoEntry' — session metadata
 */
export const SessionEntry = Schema.Union(
  MessageEntry,
  ThinkingLevelChangeEntry,
  ModelChangeEntry,
  CompactionEntry,
  BranchSummaryEntry,
  CustomEntry,
  CustomMessageEntry,
  LabelEntry,
  SessionInfoEntry,
)
export type SessionEntry = typeof SessionEntry.Type

/**
 * All known entry tags for exhaustive matching.
 */
export const SESSION_ENTRY_TAGS = [
  'MessageEntry',
  'ThinkingLevelChangeEntry',
  'ModelChangeEntry',
  'CompactionEntry',
  'BranchSummaryEntry',
  'CustomEntry',
  'CustomMessageEntry',
  'LabelEntry',
  'SessionInfoEntry',
] as const
export type SessionEntryTag = (typeof SESSION_ENTRY_TAGS)[number]
