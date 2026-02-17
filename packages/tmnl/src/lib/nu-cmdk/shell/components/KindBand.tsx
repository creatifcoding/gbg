import {
  createContext,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { NuCmdkShellKind } from '../types'
import { NU_CMDK_TOKENS } from '../tokens'

export interface KindBandProps {
  readonly kinds: ReadonlyArray<NuCmdkShellKind>
  readonly activeKind: NuCmdkShellKind
  readonly onKindChange: (kind: NuCmdkShellKind) => void
}

export interface KindBandRootProps {
  readonly value?: NuCmdkShellKind
  readonly defaultValue?: NuCmdkShellKind
  readonly onValueChange?: (kind: NuCmdkShellKind) => void
  readonly children: ReactNode
}

export interface KindBandListProps {
  readonly children: ReactNode
  readonly ariaLabel?: string
}

export interface KindBandTabProps {
  readonly value: NuCmdkShellKind
  readonly disabled?: boolean
  readonly children?: ReactNode
}

interface KindBandContextValue {
  readonly value: NuCmdkShellKind
  readonly setValue: (kind: NuCmdkShellKind) => void
}

const KindBandContext = createContext<KindBandContextValue | null>(null)

const rootStyle: CSSProperties = {
  borderBottom: `1px solid ${NU_CMDK_TOKENS.border.subtle}`,
  backgroundColor: NU_CMDK_TOKENS.surface.band,
}

const listStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  padding: '0 10px',
  overflowX: 'auto',
}

const tabBase: CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  color: NU_CMDK_TOKENS.text.secondary,
  fontFamily: NU_CMDK_TOKENS.typography.family.heading,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  padding: '7px 0 8px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  textTransform: 'none',
}

function useControllableValue({
  value,
  defaultValue,
  onValueChange,
}: {
  value: NuCmdkShellKind | undefined
  defaultValue: NuCmdkShellKind
  onValueChange: ((kind: NuCmdkShellKind) => void) | undefined
}): [NuCmdkShellKind, (kind: NuCmdkShellKind) => void] {
  const [internal, setInternal] = useState<NuCmdkShellKind>(defaultValue)
  const resolved = value ?? internal

  const setValue = (next: NuCmdkShellKind) => {
    if (value === undefined) {
      setInternal(next)
    }
    onValueChange?.(next)
  }

  return [resolved, setValue]
}

const formatKind = (kind: NuCmdkShellKind): string => {
  switch (kind) {
    case 'all':
      return 'All'
    case 'pipeline':
      return 'Pipelines'
    case 'entity':
      return 'Entities'
    case 'action':
      return 'Actions'
    case 'view':
      return 'Views'
    default:
      return kind
  }
}

function getTabs(currentTab: HTMLElement): Array<HTMLButtonElement> {
  const tablist = currentTab.closest('[role="tablist"]')
  if (!tablist) return []

  return Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'))
}

function moveFocus(currentTab: HTMLElement, direction: 'next' | 'prev' | 'first' | 'last') {
  const tabs = getTabs(currentTab)
  if (tabs.length === 0) return

  const currentIndex = tabs.findIndex((tab) => tab === currentTab)
  if (currentIndex < 0) return

  let nextIndex = currentIndex
  if (direction === 'next') nextIndex = (currentIndex + 1) % tabs.length
  if (direction === 'prev') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
  if (direction === 'first') nextIndex = 0
  if (direction === 'last') nextIndex = tabs.length - 1

  tabs[nextIndex]?.focus()
  tabs[nextIndex]?.click()
}

function useKindBandContext(): KindBandContextValue {
  const ctx = useContext(KindBandContext)
  if (!ctx) {
    throw new Error('KindBand compound components must be used inside KindBand.Root')
  }
  return ctx
}

function KindBandRoot({
  value,
  defaultValue = 'all',
  onValueChange,
  children,
}: KindBandRootProps) {
  const [current, setCurrent] = useControllableValue({
    value,
    defaultValue,
    onValueChange,
  })

  const ctx = useMemo<KindBandContextValue>(
    () => ({ value: current, setValue: setCurrent }),
    [current, setCurrent],
  )

  return (
    <KindBandContext.Provider value={ctx}>
      <div style={rootStyle} data-band='kind' data-slot='kind-root'>
        {children}
      </div>
    </KindBandContext.Provider>
  )
}

function KindBandList({ children, ariaLabel = 'Search result kinds' }: KindBandListProps) {
  return (
    <div role='tablist' aria-label={ariaLabel} style={listStyle} data-slot='kind-list'>
      {children}
    </div>
  )
}

function KindBandTab({ value, disabled = false, children }: KindBandTabProps) {
  const ctx = useKindBandContext()
  const active = ctx.value === value

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(event.currentTarget, 'next')
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(event.currentTarget, 'prev')
        break
      case 'Home':
        event.preventDefault()
        moveFocus(event.currentTarget, 'first')
        break
      case 'End':
        event.preventDefault()
        moveFocus(event.currentTarget, 'last')
        break
      default:
        break
    }
  }

  return (
    <button
      type='button'
      role='tab'
      aria-selected={active}
      aria-controls={`kind-panel-${value}`}
      data-value={value}
      data-slot='kind-tab'
      data-state={active ? 'active' : 'inactive'}
      disabled={disabled}
      tabIndex={active ? 0 : -1}
      onClick={() => ctx.setValue(value)}
      onKeyDown={handleKeyDown}
      style={{
        ...tabBase,
        color: active ? NU_CMDK_TOKENS.accent.cyan : tabBase.color,
        borderBottomColor: active ? NU_CMDK_TOKENS.accent.cyan : 'transparent',
      }}
    >
      {children ?? formatKind(value)}
    </button>
  )
}

function KindBandBase({ kinds, activeKind, onKindChange }: KindBandProps) {
  return (
    <KindBandRoot value={activeKind} onValueChange={onKindChange}>
      <KindBandList>
        {kinds.map((kind) => (
          <KindBandTab key={kind} value={kind} />
        ))}
      </KindBandList>
    </KindBandRoot>
  )
}

type KindBandCompound = ((props: KindBandProps) => JSX.Element) & {
  Root: typeof KindBandRoot
  List: typeof KindBandList
  Tab: typeof KindBandTab
}

export const KindBand = Object.assign(KindBandBase, {
  Root: KindBandRoot,
  List: KindBandList,
  Tab: KindBandTab,
}) as KindBandCompound
