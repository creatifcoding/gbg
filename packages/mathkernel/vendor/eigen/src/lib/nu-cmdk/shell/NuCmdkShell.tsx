import { useMemo } from 'react'
import type { CSSProperties, PropsWithChildren } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Effect } from 'effect'
import { FooterBand } from './components/FooterBand'
import { KindBand } from './components/KindBand'
import { ModeBand } from './components/ModeBand'
import { QueryBand } from './components/QueryBand'
import { ResultsBand } from './components/ResultsBand'
import { NU_CMDK_TOKENS } from './tokens'
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
  height: 'clamp(340px, 52vh, 500px)',
  minHeight: '340px',
  maxHeight: '500px',
  background: NU_CMDK_TOKENS.surface.panel,
  border: `1px solid ${NU_CMDK_TOKENS.border.medium}`,
  borderRadius: NU_CMDK_TOKENS.border.radius.shell,
  overflow: 'hidden',
  boxShadow: NU_CMDK_TOKENS.shadow.shell,
}

const shellStyles = `
.nu-cmdk-item {
  transition: background-color 140ms ease, border-color 140ms ease, transform 120ms ease, box-shadow 120ms ease;
}

.nu-cmdk-item[data-selected='true'] {
  background: ${NU_CMDK_TOKENS.surface.rowSelected};
  border-left-color: ${NU_CMDK_TOKENS.accent.cyan} !important;
  border-color: ${NU_CMDK_TOKENS.border.accent} !important;
  box-shadow: ${NU_CMDK_TOKENS.shadow.selectedInset};
}

.nu-cmdk-item:hover {
  background-color: ${NU_CMDK_TOKENS.surface.rowHover};
}

[data-slot='query-input']::placeholder {
  color: ${NU_CMDK_TOKENS.misc.placeholder};
}

[data-slot='results-section-header'] span:last-child {
  border: 1px solid ${NU_CMDK_TOKENS.border.subtle};
  background: ${NU_CMDK_TOKENS.surface.pill};
  border-radius: ${NU_CMDK_TOKENS.misc.chipRadius};
  padding: 2px 8px;
  font-size: ${NU_CMDK_TOKENS.typography.size.xs};
  letter-spacing: 0.08em;
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
