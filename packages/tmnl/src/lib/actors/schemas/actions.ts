/**
 * Action Parameter Schemas
 *
 * Effect Schema definitions for validating action parameters
 * before calling actor actions via hooks.
 *
 * @module lib/actors/schemas/actions
 */

import { Schema, Effect } from 'effect'

// Define BufferType locally to avoid circular import
// (index.ts re-exports from actions.ts, so we can't import from index.ts)
const BufferType = Schema.Literal('document', 'terminal', 'webview', 'widget', 'canvas')

// =============================================================================
// Workspace Action Parameters
// =============================================================================

/**
 * Parameters for createBuffer action
 */
export const CreateBufferParams = Schema.Struct({
  userId: Schema.String,
  type: BufferType,
  name: Schema.NonEmptyString,
  uri: Schema.String,
  options: Schema.optional(
    Schema.Struct({
      ysweetDocId: Schema.optional(Schema.String),
      documentId: Schema.optional(Schema.String),
      filePath: Schema.optional(Schema.String),
      mimeType: Schema.optional(Schema.String),
    })
  ),
})
export type CreateBufferParams = typeof CreateBufferParams.Type

/**
 * Parameters for openBuffer action
 */
export const OpenBufferParams = Schema.Struct({
  userId: Schema.String,
  bufferId: Schema.String,
})
export type OpenBufferParams = typeof OpenBufferParams.Type

/**
 * Parameters for closeBuffer action
 */
export const CloseBufferParams = Schema.Struct({
  userId: Schema.String,
  bufferId: Schema.String,
})
export type CloseBufferParams = typeof CloseBufferParams.Type

/**
 * Parameters for getBuffer action
 */
export const GetBufferParams = Schema.Struct({
  bufferId: Schema.String,
})
export type GetBufferParams = typeof GetBufferParams.Type

/**
 * Parameters for getByUri action
 */
export const GetByUriParams = Schema.Struct({
  uri: Schema.String,
})
export type GetByUriParams = typeof GetByUriParams.Type

// =============================================================================
// Session Action Parameters
// =============================================================================

/**
 * Parameters for createTab action
 */
export const CreateTabParams = Schema.Struct({
  name: Schema.NonEmptyString,
  options: Schema.optional(
    Schema.Struct({
      layout: Schema.optional(Schema.Unknown),
      isPinned: Schema.optional(Schema.Boolean),
    })
  ),
})
export type CreateTabParams = typeof CreateTabParams.Type

/**
 * Parameters for setActiveTab action
 */
export const SetActiveTabParams = Schema.Struct({
  tabId: Schema.String,
})
export type SetActiveTabParams = typeof SetActiveTabParams.Type

/**
 * Parameters for closeTab action
 */
export const CloseTabParams = Schema.Struct({
  tabId: Schema.String,
})
export type CloseTabParams = typeof CloseTabParams.Type

/**
 * Parameters for updateTab action
 */
export const UpdateTabParams = Schema.Struct({
  tabId: Schema.String,
  updates: Schema.Struct({
    name: Schema.optional(Schema.String),
    layout: Schema.optional(Schema.Unknown),
    isPinned: Schema.optional(Schema.Boolean),
  }),
})
export type UpdateTabParams = typeof UpdateTabParams.Type

/**
 * Parameters for reorderTabs action
 */
export const ReorderTabsParams = Schema.Struct({
  newOrder: Schema.Array(Schema.String),
})
export type ReorderTabsParams = typeof ReorderTabsParams.Type

/**
 * Parameters for createWindow action
 */
export const CreateWindowParams = Schema.Struct({
  bufferId: Schema.String,
  majorMode: Schema.optional(Schema.String),
})
export type CreateWindowParams = typeof CreateWindowParams.Type

/**
 * Parameters for focusWindow action
 */
export const FocusWindowParams = Schema.Struct({
  windowId: Schema.String,
})
export type FocusWindowParams = typeof FocusWindowParams.Type

/**
 * Parameters for updateWindow action
 */
export const UpdateWindowParams = Schema.Struct({
  windowId: Schema.String,
  updates: Schema.Struct({
    scroll: Schema.optional(
      Schema.Struct({
        x: Schema.Number,
        y: Schema.Number,
      })
    ),
    cursor: Schema.optional(
      Schema.Struct({
        offset: Schema.Number,
        line: Schema.optional(Schema.Number),
        column: Schema.optional(Schema.Number),
      })
    ),
    mode: Schema.optional(
      Schema.Struct({
        major: Schema.String,
        minor: Schema.Array(Schema.String),
      })
    ),
  }),
})
export type UpdateWindowParams = typeof UpdateWindowParams.Type

/**
 * Parameters for closeWindow action
 */
export const CloseWindowParams = Schema.Struct({
  windowId: Schema.String,
})
export type CloseWindowParams = typeof CloseWindowParams.Type

/**
 * Parameters for restoreSnapshot action
 */
export const RestoreSnapshotParams = Schema.Struct({
  snapshot: Schema.Struct({
    tabs: Schema.optional(Schema.Unknown),
    windows: Schema.optional(Schema.Unknown),
    activeTabId: Schema.optional(Schema.NullOr(Schema.String)),
    focusedWindowId: Schema.optional(Schema.NullOr(Schema.String)),
    tabOrder: Schema.optional(Schema.Array(Schema.String)),
  }),
})
export type RestoreSnapshotParams = typeof RestoreSnapshotParams.Type

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate action parameters before calling actor action.
 * Returns Effect that fails with parse error if invalid.
 *
 * @example
 * ```typescript
 * const params = yield* validateParams(CreateBufferParams)({
 *   userId: 'user-1',
 *   type: 'document',
 *   name: 'New Buffer',
 *   uri: 'ydoc://test',
 * })
 * ```
 */
export const validateParams =
  <A, I>(schema: Schema.Schema<A, I>) =>
  (params: unknown): Effect.Effect<A, Schema.ParseError> =>
    Schema.decodeUnknown(schema)(params)

/**
 * Synchronous validation - throws on error.
 * Use in React callbacks where async is inconvenient.
 *
 * @example
 * ```typescript
 * const params = validateParamsSync(CreateBufferParams)({
 *   userId: 'user-1',
 *   type: 'document',
 *   name: 'New Buffer',
 *   uri: 'ydoc://test',
 * })
 * ```
 */
export const validateParamsSync =
  <A, I>(schema: Schema.Schema<A, I>) =>
  (params: unknown): A =>
    Schema.decodeUnknownSync(schema)(params)
