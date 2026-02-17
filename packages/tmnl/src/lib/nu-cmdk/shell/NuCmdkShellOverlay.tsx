import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { NuCmdkShell } from './NuCmdkShell'
import { type NuCmdkItemActionIntent, type NuCmdkItemModel } from './item-contract'
import type { NuCmdkShellKind } from './types'
import { useNuCmdkCommandProviderContext } from './providers'

export interface NuCmdkShellOverlayProps {
  readonly onClose?: () => void
}

const kinds: ReadonlyArray<NuCmdkShellKind> = ['all', 'pipeline', 'entity', 'action', 'view']

export function NuCmdkShellOverlay({ onClose }: NuCmdkShellOverlayProps) {
  const [query, setQuery] = useState('')
  const [activeKind, setActiveKind] = useState<NuCmdkShellKind>('all')

  const provider = useNuCmdkCommandProviderContext({ query })
  const providerItems = useAtomValue(provider.context.atoms.items)
  const providerSections = useAtomValue(provider.context.atoms.sections)

  useEffect(() => {
    void Effect.runPromise(
      provider.context.effects.query(query).pipe(
        Effect.catchAll(() => Effect.void),
      ),
    )
  }, [provider.context.effects, query])

  const items = useMemo<ReadonlyArray<NuCmdkItemModel>>(() => {
    if (activeKind === 'all') {
      return providerItems
    }

    return providerItems.filter((item) => item.semantic.kind === activeKind)
  }, [activeKind, providerItems])

  const handleSelectItem = useCallback(
    (item: NuCmdkItemModel) => {
      void Effect.runPromise(
        provider.context.effects.execute(item.semantic.itemId).pipe(
          Effect.catchAll(() => Effect.void),
        ),
      )

      onClose?.()
    },
    [onClose, provider.context.effects],
  )

  const handleActionIntent = useCallback(
    (item: NuCmdkItemModel, action: NuCmdkItemActionIntent) => {
      switch (action.kind) {
        case 'execute':
          return provider.context.effects.execute(item.semantic.itemId)
        case 'preview':
          return provider.context.effects.preview(item.semantic.itemId)
        default:
          return provider.context.effects.preview(item.semantic.itemId)
      }
    },
    [provider.context.effects],
  )

  return (
    <NuCmdkShell
      mode='command'
      query={query}
      activeKind={activeKind}
      kinds={kinds}
      items={items}
      sections={providerSections}
      isStreaming={provider.isSearching}
      statusText={provider.isSearching ? 'searching' : `${items.length} results`}
      path={['System', 'Data Grid', 'Global Search']}
      placeholder='Type a command or search entities (e.g. V-4821)...'
      onQueryChange={setQuery}
      onKindChange={setActiveKind}
      onSelectItem={handleSelectItem}
      onActionIntent={handleActionIntent}
    />
  )
}
