import { useMemo } from 'react'
import type { CSSProperties, PropsWithChildren } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Effect } from 'effect'
import { FooterBand } from './components/FooterBand'
import { KindBand } from './components/KindBand'
import { ModeBand } from './components/ModeBand'
import { QueryBand } from './components/QueryBand'
import { ResultsBand } from './components/ResultsBand'
import type { ResultsBandItemSlotOverrides } from './components/ResultsBand'
import type {
  NuCmdkItemActionIntent,
  NuCmdkItemModel,
  NuCmdkItemSection,
} from './item-contract'
import type { NuCmdkShellKind, NuCmdkShellMode, NuCmdkShellRow } from './types'

export interface NuCmdkShellProps {
  readonly mode: NuCmdkShellMode
  readonly query: string
  readonly activeKind: NuCmdkShellKind
  readonly kinds: ReadonlyArray<NuCmdkShellKind>
  readonly rows?: ReadonlyArray<NuCmdkShellRow>
  readonly items?: ReadonlyArray<NuCmdkItemModel>
  readonly sections?: ReadonlyArray<NuCmdkItemSection>
  readonly isStreaming?: boolean
  readonly statusText?: string
  readonly placeholder?: string
  readonly path?: ReadonlyArray<string>
  readonly onQueryChange: (query: string) => void
  readonly onKindChange: (kind: NuCmdkShellKind) => void
  readonly onSelectRow?: (rowId: string) => void
  readonly onSelectItem?: (item: NuCmdkItemModel) => void
  readonly onActionIntent?: (
    item: NuCmdkItemModel,
    action: NuCmdkItemActionIntent,
  ) => Effect.Effect<void, unknown, never>
  readonly itemSlots?: ResultsBandItemSlotOverrides
}

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  minHeight: '680px',
  backgroundColor: '#05070c',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 30px 90px rgba(0, 0, 0, 0.55)',
}

const shellStyles = `
.nu-cmdk-item {
  transition: background-color 140ms ease, border-color 140ms ease, transform 120ms ease;
}

.nu-cmdk-item[data-selected='true'] {
  background: linear-gradient(90deg, rgba(8, 47, 73, 0.75), rgba(8, 47, 73, 0.25));
  border-left-color: #22d3ee !important;
  border-color: rgba(34, 211, 238, 0.2) !important;
}

.nu-cmdk-item:hover {
  background-color: rgba(255, 255, 255, 0.035);
}
`

type NuCmdkShellCompound = ((props: NuCmdkShellProps) => JSX.Element) & {
  ModeBand: typeof ModeBand
  QueryBand: typeof QueryBand
  KindBand: typeof KindBand
  ResultsBand: typeof ResultsBand
  FooterBand: typeof FooterBand
}

function NuCmdkShellBase({
  mode,
  query,
  activeKind,
  kinds,
  rows = [],
  items,
  sections,
  isStreaming = false,
  statusText = 'ready',
  placeholder = 'Type a command or search entities (e.g. V-4821)...',
  path,
  onQueryChange,
  onKindChange,
  onSelectRow,
  onSelectItem,
  onActionIntent,
  itemSlots,
  children,
}: PropsWithChildren<NuCmdkShellProps>) {
  const status = useMemo(
    () => (isStreaming ? `${statusText} · streaming` : statusText),
    [isStreaming, statusText],
  )

  return (
    <CommandPrimitive shouldFilter={false} style={rootStyle} label='NuCmdk Shell'>
      <style>{shellStyles}</style>

      {children ?? (
        <>
          <ModeBand mode={mode} statusText={status} path={path} />
          <QueryBand query={query} placeholder={placeholder} onQueryChange={onQueryChange} />
          <KindBand kinds={kinds} activeKind={activeKind} onKindChange={onKindChange} />
          <ResultsBand
            rows={rows}
            items={items}
            sections={sections}
            onSelectRow={onSelectRow}
            onSelectItem={onSelectItem}
            onActionIntent={onActionIntent}
            itemSlots={itemSlots}
          />
          <FooterBand />
        </>
      )}
    </CommandPrimitive>
  )
}

export const NuCmdkShell = Object.assign(NuCmdkShellBase, {
  ModeBand,
  QueryBand,
  KindBand,
  ResultsBand,
  FooterBand,
}) as NuCmdkShellCompound
