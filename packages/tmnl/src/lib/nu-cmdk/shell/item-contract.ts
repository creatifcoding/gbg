import { Atom } from '@effect-atom/atom'
import { Effect, Schema } from 'effect'
import { NuCmdkShellBadge, NuCmdkShellKind, type NuCmdkShellRow } from './types'

const EXTENSION_KEY_PATTERN = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9_.-]*$/i

const ExtensionKey = Schema.String.pipe(Schema.pattern(EXTENSION_KEY_PATTERN))

export const NuCmdkItemExtensions = Schema.Record({
  key: ExtensionKey,
  value: Schema.Unknown,
})
export type NuCmdkItemExtensions = typeof NuCmdkItemExtensions.Type

export const NuCmdkItemSemantic = Schema.Struct({
  itemId: Schema.String,
  label: Schema.String,
  description: Schema.NullOr(Schema.String),
  kind: NuCmdkShellKind,
  status: Schema.NullOr(Schema.String),
})
export type NuCmdkItemSemantic = typeof NuCmdkItemSemantic.Type

export const NuCmdkItemActionKind = Schema.Literal('execute', 'preview', 'secondary')
export type NuCmdkItemActionKind = typeof NuCmdkItemActionKind.Type

export const NuCmdkItemActionIntent = Schema.Struct({
  actionId: Schema.String,
  kind: NuCmdkItemActionKind,
  label: Schema.String,
  resolverIdentity: Schema.String,
  payload: Schema.NullOr(Schema.Unknown),
})
export type NuCmdkItemActionIntent = typeof NuCmdkItemActionIntent.Type

export const NuCmdkItemDisplay = Schema.Struct({
  iconToken: Schema.NullOr(Schema.String),
  badges: Schema.Array(NuCmdkShellBadge),
  emphasis: Schema.Literal('normal', 'muted', 'accent', 'critical'),
  shortcuts: Schema.Array(Schema.String),
})
export type NuCmdkItemDisplay = typeof NuCmdkItemDisplay.Type

export const NuCmdkItemLayoutHints = Schema.Struct({
  sectionKey: Schema.NullOr(Schema.String),
  sectionPriority: Schema.Int,
  density: Schema.Literal('comfortable', 'compact'),
  compactMeta: Schema.Boolean,
  pinTop: Schema.Boolean,
})
export type NuCmdkItemLayoutHints = typeof NuCmdkItemLayoutHints.Type

export const NuCmdkItemTelemetry = Schema.Struct({
  providerId: Schema.String,
  laneId: Schema.String,
  traceId: Schema.String,
  impressionId: Schema.String,
  attributes: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
export type NuCmdkItemTelemetry = typeof NuCmdkItemTelemetry.Type

export const NuCmdkItemModel = Schema.Struct({
  version: Schema.Literal(1),
  semantic: NuCmdkItemSemantic,
  actions: Schema.Array(NuCmdkItemActionIntent),
  display: NuCmdkItemDisplay,
  layout: NuCmdkItemLayoutHints,
  telemetry: NuCmdkItemTelemetry,
  extensions: NuCmdkItemExtensions,
})
export type NuCmdkItemModel = typeof NuCmdkItemModel.Type

export const NuCmdkItemSection = Schema.Struct({
  sectionId: Schema.String,
  title: Schema.String,
  order: Schema.Int,
  hint: Schema.NullOr(Schema.String),
})
export type NuCmdkItemSection = typeof NuCmdkItemSection.Type

export const NuCmdkItemProviderDescriptor = Schema.Struct({
  providerId: Schema.String,
  contractVersion: Schema.Literal(1),
  emits: Schema.Array(NuCmdkShellKind),
  extensionNamespace: Schema.String.pipe(
    Schema.pattern(/^[a-z0-9][a-z0-9-]*$/i),
  ),
})
export type NuCmdkItemProviderDescriptor = typeof NuCmdkItemProviderDescriptor.Type

/**
 * Provider contract: state surfaces MUST be Atoms, command surfaces MUST be Effects.
 */
export interface NuCmdkItemProviderAtoms {
  readonly items: Atom.Atom<ReadonlyArray<NuCmdkItemModel>>
  readonly sections: Atom.Atom<ReadonlyArray<NuCmdkItemSection>>
  readonly selectedItemId: Atom.Atom<string | null>
}

/**
 * Provider contract: imperative operations are Effect-returning APIs.
 */
export interface NuCmdkItemProviderEffects {
  readonly query: (query: string) => Effect.Effect<void, unknown, never>
  readonly execute: (itemId: string) => Effect.Effect<void, unknown, never>
  readonly preview: (itemId: string) => Effect.Effect<void, unknown, never>
  readonly trackImpression: (item: NuCmdkItemModel) => Effect.Effect<void, unknown, never>
}

export interface NuCmdkItemProviderContextContract {
  readonly descriptor: NuCmdkItemProviderDescriptor
  readonly atoms: NuCmdkItemProviderAtoms
  readonly effects: NuCmdkItemProviderEffects
}

export const NuCmdkItemDecodeMode = Schema.Literal('strict', 'drop-invalid')
export type NuCmdkItemDecodeMode = typeof NuCmdkItemDecodeMode.Type

export const NuCmdkItemDecodeViolation = Schema.Struct({
  index: Schema.Int,
  input: Schema.Unknown,
  error: Schema.Unknown,
})
export type NuCmdkItemDecodeViolation = typeof NuCmdkItemDecodeViolation.Type

export interface NuCmdkItemDecodeOptions {
  readonly mode?: NuCmdkItemDecodeMode
  readonly onViolation?: (violation: NuCmdkItemDecodeViolation) => Effect.Effect<void, unknown, never>
}

const invalidExtensionKeysFromUnknown = (input: unknown): ReadonlyArray<string> => {
  if (!input || typeof input !== 'object') {
    return []
  }

  const record = input as Record<string, unknown>
  const extensions = record.extensions

  if (!extensions || typeof extensions !== 'object') {
    return []
  }

  const extensionRecord = extensions as Record<string, unknown>
  return Object.keys(extensionRecord).filter((key) => !EXTENSION_KEY_PATTERN.test(key))
}

export const decodeItemModelUnknown = (
  input: unknown,
): Effect.Effect<NuCmdkItemModel, unknown, never> =>
  Effect.gen(function* () {
    const invalidExtensionKeys = invalidExtensionKeysFromUnknown(input)
    if (invalidExtensionKeys.length > 0) {
      return yield* Effect.fail({
        _tag: 'NuCmdkItemInvalidExtensions',
        invalidExtensionKeys,
        input,
      })
    }

    return yield* Schema.decodeUnknown(NuCmdkItemModel)(input)
  })

export const decodeItemModelsUnknown = (
  inputs: ReadonlyArray<unknown>,
  options: NuCmdkItemDecodeOptions = {},
): Effect.Effect<ReadonlyArray<NuCmdkItemModel>, unknown, never> =>
  Effect.gen(function* () {
    const mode = options.mode ?? 'drop-invalid'
    const decoded: Array<NuCmdkItemModel> = []

    for (let index = 0; index < inputs.length; index++) {
      const input = inputs[index]

      if (mode === 'strict') {
        const item = yield* decodeItemModelUnknown(input)
        decoded.push(item)
        continue
      }

      const maybeItem = yield* decodeItemModelUnknown(input).pipe(
        Effect.map((item) => item as NuCmdkItemModel | null),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            const violation: NuCmdkItemDecodeViolation = {
              index,
              input,
              error,
            }

            if (options.onViolation) {
              yield* options.onViolation(violation).pipe(Effect.catchAll(() => Effect.void))
            }

            return null
          }),
        ),
      )

      if (maybeItem) {
        decoded.push(maybeItem)
      }
    }

    return decoded as ReadonlyArray<NuCmdkItemModel>
  })

export const shellRowToItemModel = (
  row: NuCmdkShellRow,
  params?: { providerId?: string; laneId?: string },
): NuCmdkItemModel => {
  const providerId = params?.providerId ?? 'legacy-shell'
  const laneId = params?.laneId ?? 'legacy-lane'

  return {
    version: 1,
    semantic: {
      itemId: row.rowId,
      label: row.label,
      description: row.description,
      kind: row.kind,
      status: row.badges.find((badge) => badge.tone === 'warn' || badge.tone === 'error')?.text ?? null,
    },
    actions: [
      {
        actionId: `${row.rowId}:execute`,
        kind: 'execute',
        label: 'Execute',
        resolverIdentity: row.resolverIdentity,
        payload: null,
      },
    ],
    display: {
      iconToken: null,
      badges: row.badges,
      emphasis: 'normal',
      shortcuts: row.shortcuts,
    },
    layout: {
      sectionKey: row.sectionKey ?? null,
      sectionPriority: row.sectionPriority ?? 0,
      density: 'comfortable',
      compactMeta: false,
      pinTop: false,
    },
    telemetry: {
      providerId,
      laneId,
      traceId: `${providerId}:${row.rowId}`,
      impressionId: `${providerId}:${row.rowId}:impression`,
      attributes: {
        rendererToken: row.rendererToken,
        score: row.score,
      },
    },
    extensions: {},
  }
}
