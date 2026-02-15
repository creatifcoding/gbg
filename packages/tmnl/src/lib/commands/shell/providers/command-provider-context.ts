import { Atom } from '@effect-atom/atom'
import { RegistryContext, useAtomValue } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { COMMAND_PROVIDER_ID } from '../../CommandProvider'
import { CommandService } from '../../service'
import {
  adaptersFromProviderRegistry,
  makeNuCmdkSearchBroker,
  type NuCmdkSearchBroker,
  type QueryRow,
  type Theta,
} from '../../nu-cmdk/slices'
import {
  shellRowToItemModel,
  type NuCmdkItemModel,
  type NuCmdkItemProviderContextContract,
  type NuCmdkItemProviderDescriptor,
  type NuCmdkItemSection,
} from '../item-contract'
import type { NuCmdkShellKind, NuCmdkShellRow } from '../types'

const commandProviderDescriptor: NuCmdkItemProviderDescriptor = {
  providerId: 'commands',
  contractVersion: 1,
  emits: ['command', 'pipeline', 'entity', 'action', 'view'],
  extensionNamespace: 'commands',
}

const commandProviderItemsAtom = Atom.make<ReadonlyArray<NuCmdkItemModel>>([])
const commandProviderSectionsAtom = Atom.make<ReadonlyArray<NuCmdkItemSection>>([])
const commandProviderSelectedItemIdAtom = Atom.make<string | null>(null)
const commandProviderBrokerAtom = Atom.make<NuCmdkSearchBroker | null>(null)
const commandProviderAdapterFingerprintAtom = Atom.make('')
const commandProviderActiveQueryIdAtom = Atom.make<string | null>(null)
const commandProviderQuerySerialAtom = Atom.make(0)
const commandProviderIsSearchingAtom = Atom.make(false)

const defaultTheta: Theta = {
  publish_budget_base: 4,
  publish_budget_degraded: 2,
  rank_weight: { provider: 0.45, lexical: 0.35, semantic: 0.2, recency: 0 },
  stability_epsilon: 0.015,
  stability_window_ms: 120,
  quality_budget: {
    max_fallback_ratio: 0.35,
    max_decode_drop_ratio: 0.1,
    max_resolver_deny_ratio: 0,
  },
  cacheguard: {
    singleflight_ttl_ms: 250,
    checkpoint_wal_pages: 1000,
  },
}

const mapResultKindToShellKind = (
  row: QueryRow,
): NuCmdkShellKind => {
  if (row.sectionKey === 'suggested-actions') {
    return 'pipeline'
  }

  switch (row.category) {
    case 'entity':
      return 'entity'
    case 'navigation':
      return 'view'
    case 'command':
    case 'action':
    case 'terminal':
    case 'workflow':
    case 'agent':
    case 'history':
    case 'file':
    case 'docs':
    case 'generic':
      return 'action'
    default:
      return 'action'
  }
}

const normalizeBadgeTone = (
  tone: 'neutral' | 'warn' | 'success' | 'error' | 'info' | undefined,
): 'neutral' | 'warn' | 'success' | 'error' | 'info' | null =>
  tone ?? null

const rowToShellRow = (row: QueryRow): NuCmdkShellRow => ({
  rowId: row.rowId,
  label: row.label ?? row.rowId,
  description: row.description ?? null,
  kind: mapResultKindToShellKind(row),
  score: row.score,
  rendererToken: row.rendererToken,
  resolverIdentity: row.resolverIdentity,
  badges: (row.badges ?? []).map((badge) => ({
    text: badge.text,
    tone: normalizeBadgeTone(badge.tone),
  })),
  shortcuts: row.shortcuts ?? [],
  sectionKey: row.sectionKey,
  sectionTitle: row.sectionTitle,
  sectionPriority: row.sectionPriority,
})

const buildSectionsFromRows = (rows: ReadonlyArray<NuCmdkShellRow>): ReadonlyArray<NuCmdkItemSection> => {
  const byId = new Map<string, NuCmdkItemSection>()

  for (const row of rows) {
    const sectionId = row.sectionKey ?? 'results'
    const title = row.sectionTitle ?? row.sectionKey ?? 'Results'
    const order = row.sectionPriority ?? 99

    if (!byId.has(sectionId)) {
      byId.set(sectionId, {
        sectionId,
        title,
        order,
        hint: null,
      })
      continue
    }

    const prev = byId.get(sectionId)!
    if (order < prev.order) {
      byId.set(sectionId, {
        ...prev,
        order,
      })
    }
  }

  if (byId.size === 0) {
    return [
      {
        sectionId: 'results',
        title: 'Results',
        order: 99,
        hint: null,
      },
    ]
  }

  return Array.from(byId.values()).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}

const toItems = (rows: ReadonlyArray<NuCmdkShellRow>): ReadonlyArray<NuCmdkItemModel> =>
  rows.map((row) =>
    shellRowToItemModel(row, {
      providerId: commandProviderDescriptor.providerId,
      laneId: 'command-search',
    }),
  )

export interface UseNuCmdkCommandProviderContextOptions {
  readonly query: string
}

export interface UseNuCmdkCommandProviderContextResult {
  readonly context: NuCmdkItemProviderContextContract
  readonly isSearching: boolean
}

/**
 * Command provider runtime bridge backed by NuCmdk broker/session slices.
 *
 * State surfaces are atom-first (`context.atoms`), and command surfaces are effect-first (`context.effects`).
 */
export const useNuCmdkCommandProviderContext = (
  _options: UseNuCmdkCommandProviderContextOptions,
): UseNuCmdkCommandProviderContextResult => {
  const registry = useContext(RegistryContext)
  const isSearching = useAtomValue(commandProviderIsSearchingAtom)

  const ensureBroker = useCallback(
    () =>
      Effect.gen(function* () {
        const adapters = adaptersFromProviderRegistry({
          include: (provider) => provider.id === COMMAND_PROVIDER_ID,
        })
        const nextFingerprint = adapters.map((adapter) => adapter.adapterId).sort().join('|')

        const existing = registry.get(commandProviderBrokerAtom as never) as NuCmdkSearchBroker | null
        const previousFingerprint = registry.get(commandProviderAdapterFingerprintAtom as never) as string

        if (existing && previousFingerprint === nextFingerprint) {
          return existing
        }

        if (existing) {
          yield* existing.stopAll.pipe(Effect.catchAll(() => Effect.void))
        }

        const broker = yield* makeNuCmdkSearchBroker({
          theta: defaultTheta,
          runId: 'nu-cmdk-shell-runtime',
          registry: registry as never,
          onEvent: (event) => {
            if (import.meta.env.DEV) {
              console.debug('[NuCmdk broker]', event.event, event)
            }
          },
          adapters,
        })

        registry.set(commandProviderBrokerAtom as never, broker as never)
        registry.set(commandProviderAdapterFingerprintAtom as never, nextFingerprint as never)
        return broker
      }),
    [registry],
  )

  useEffect(() => {
    return () => {
      const activeQueryId = registry.get(commandProviderActiveQueryIdAtom as never) as string | null
      const broker = registry.get(commandProviderBrokerAtom as never) as NuCmdkSearchBroker | null

      if (activeQueryId && broker) {
        void Effect.runPromise(
          broker.stopQuery(activeQueryId).pipe(
            Effect.catchAll(() => Effect.void),
          ),
        )
      }

      registry.set(commandProviderActiveQueryIdAtom as never, null as never)
      registry.set(commandProviderIsSearchingAtom as never, false as never)
    }
  }, [registry])

  const queryEffect = useCallback(
    (query: string) =>
      Effect.gen(function* () {
        registry.set(commandProviderIsSearchingAtom as never, true as never)

        const broker = yield* ensureBroker()

        const previousQueryId = registry.get(commandProviderActiveQueryIdAtom as never) as string | null
        if (previousQueryId) {
          yield* broker.stopQuery(previousQueryId).pipe(
            Effect.catchAll(() => Effect.void),
          )
        }

        const serial = registry.get(commandProviderQuerySerialAtom as never) as number
        const nextSerial = serial + 1
        registry.set(commandProviderQuerySerialAtom as never, nextSerial as never)

        const queryId = `nu-cmdk-ui:${Date.now()}:${nextSerial}`
        registry.set(commandProviderActiveQueryIdAtom as never, queryId as never)

        yield* broker.startQuery({
          queryId,
          queryText: query,
          scope: 'global',
          scenarioId: 'NU-CMDK-UI',
        })

        yield* broker.runAdapters(queryId, query)
        const snapshot = yield* broker.snapshot(queryId)

        const orderedRows = snapshot.rankedRowIds
          .map((rowId) => snapshot.rowsById[rowId])
          .filter((row): row is QueryRow => Boolean(row))

        const shellRows = orderedRows.map(rowToShellRow)
        const items = toItems(shellRows)
        const sections = buildSectionsFromRows(shellRows)

        registry.set(commandProviderItemsAtom as never, items as never)
        registry.set(commandProviderSectionsAtom as never, sections as never)

        const selected = registry.get(commandProviderSelectedItemIdAtom as never) as string | null
        if (selected && !items.some((item) => item.semantic.itemId === selected)) {
          registry.set(commandProviderSelectedItemIdAtom as never, null as never)
        }
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            registry.set(commandProviderIsSearchingAtom as never, false as never)
          }),
        ),
      ),
    [ensureBroker, registry],
  )

  const executeEffect = useCallback(
    (itemId: string) =>
      Effect.gen(function* () {
        const service = yield* CommandService
        yield* service.execute(itemId)
        registry.set(commandProviderSelectedItemIdAtom as never, itemId as never)
      }).pipe(Effect.provide(CommandService.Default)),
    [registry],
  )

  const previewEffect = useCallback(
    (itemId: string) => Effect.logDebug(`NuCmdk preview action: ${itemId}`),
    [],
  )

  const trackImpressionEffect = useCallback(
    (item: NuCmdkItemModel) => Effect.logDebug(`NuCmdk impression: ${item.telemetry.impressionId}`),
    [],
  )

  const context = useMemo<NuCmdkItemProviderContextContract>(
    () => ({
      descriptor: commandProviderDescriptor,
      atoms: {
        items: commandProviderItemsAtom,
        sections: commandProviderSectionsAtom,
        selectedItemId: commandProviderSelectedItemIdAtom,
      },
      effects: {
        query: queryEffect,
        execute: executeEffect,
        preview: previewEffect,
        trackImpression: trackImpressionEffect,
      },
    }),
    [executeEffect, previewEffect, queryEffect, trackImpressionEffect],
  )

  return {
    context,
    isSearching,
  }
}
