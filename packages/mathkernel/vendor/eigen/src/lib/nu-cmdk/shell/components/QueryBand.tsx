import { cloneElement, createContext, isValidElement, useContext, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Slot } from '@radix-ui/react-slot'
import { Command as CommandPrimitive } from 'cmdk'
import { NU_CMDK_TOKENS } from '../tokens'

export interface QueryBandProps {
  readonly query: string
  readonly placeholder?: string
  readonly escHint?: string
  readonly icon?: ReactNode | LucideIcon
  readonly onQueryChange: (query: string) => void
}

export interface QueryBandRootProps {
  readonly value?: string
  readonly defaultValue?: string
  readonly onValueChange?: (query: string) => void
  readonly children: ReactNode
}

export interface QueryBandIconProps {
  readonly icon?: ReactNode | LucideIcon
  readonly asChild?: boolean
  readonly children?: ReactNode
}

export interface QueryBandInputProps {
  readonly query?: string
  readonly placeholder?: string
  readonly onQueryChange?: (query: string) => void
}

export interface QueryBandEscHintProps {
  readonly hint?: string
  readonly children?: ReactNode
}

interface QueryBandContextValue {
  readonly query: string
  readonly setQuery: (query: string) => void
}

const QueryBandContext = createContext<QueryBandContextValue | null>(null)

const wrapperStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 10px',
  borderBottom: `1px solid ${NU_CMDK_TOKENS.border.subtle}`,
  backgroundColor: NU_CMDK_TOKENS.surface.band,
}

const inputStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: NU_CMDK_TOKENS.text.primary,
  fontFamily: NU_CMDK_TOKENS.typography.family.ui,
  fontSize: NU_CMDK_TOKENS.typography.size.sm,
  lineHeight: 1.2,
}

const iconStyle: CSSProperties = {
  width: '16px',
  height: '16px',
  color: NU_CMDK_TOKENS.text.secondary,
  opacity: 0.9,
  flexShrink: 0,
}

const escStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '30px',
  height: '24px',
  padding: '0 6px',
  borderRadius: NU_CMDK_TOKENS.border.radius.pill,
  border: `1px solid ${NU_CMDK_TOKENS.border.subtle}`,
  backgroundColor: NU_CMDK_TOKENS.surface.pill,
  color: NU_CMDK_TOKENS.text.secondary,
  fontFamily: NU_CMDK_TOKENS.typography.family.data,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  letterSpacing: '0.04em',
}

function useControllableQuery({
  value,
  defaultValue,
  onValueChange,
}: {
  value: string | undefined
  defaultValue: string
  onValueChange: ((query: string) => void) | undefined
}): [string, (query: string) => void] {
  const [internal, setInternal] = useState(defaultValue)
  const resolved = value ?? internal

  const setQuery = (next: string) => {
    if (value === undefined) {
      setInternal(next)
    }
    onValueChange?.(next)
  }

  return [resolved, setQuery]
}

function useQueryBandContext(): QueryBandContextValue {
  const ctx = useContext(QueryBandContext)
  if (!ctx) {
    throw new Error('QueryBand compound components must be used inside QueryBand.Root')
  }
  return ctx
}

function QueryBandRoot({
  value,
  defaultValue = '',
  onValueChange,
  children,
}: QueryBandRootProps) {
  const [query, setQuery] = useControllableQuery({
    value,
    defaultValue,
    onValueChange,
  })

  const ctx = useMemo<QueryBandContextValue>(
    () => ({ query, setQuery }),
    [query, setQuery],
  )

  return (
    <QueryBandContext.Provider value={ctx}>
      <div style={wrapperStyle} data-band='query' data-slot='query-root'>
        {children}
      </div>
    </QueryBandContext.Provider>
  )
}

function renderIcon(icon?: ReactNode | LucideIcon) {
  if (!icon) return null

  if (typeof icon === 'function') {
    const Icon = icon
    return <Icon style={iconStyle} />
  }

  if (isValidElement(icon)) {
    const el = icon as ReactElement<{ style?: CSSProperties }>
    return cloneElement(el, {
      style: {
        ...iconStyle,
        ...(el.props.style ?? {}),
      },
    })
  }

  return icon
}

function QueryBandIcon({ icon, asChild = false, children }: QueryBandIconProps) {
  if (asChild && children) {
    return (
      <Slot style={iconStyle} data-slot='query-icon'>
        {children}
      </Slot>
    )
  }

  if (children) {
    return <span data-slot='query-icon'>{children}</span>
  }

  const customIcon = renderIcon(icon)
  if (customIcon) {
    return <span data-slot='query-icon'>{customIcon}</span>
  }

  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.75'
      style={iconStyle}
      data-slot='query-icon'
    >
      <circle cx='11' cy='11' r='7' />
      <path d='M20 20l-3.6-3.6' />
    </svg>
  )
}

function QueryBandInput({
  query,
  placeholder = 'Type a command or search entities...',
  onQueryChange,
}: QueryBandInputProps) {
  const ctx = useQueryBandContext()

  const resolvedValue = query ?? ctx.query
  const resolvedOnChange = onQueryChange ?? ctx.setQuery

  return (
    <CommandPrimitive.Input
      value={resolvedValue}
      onValueChange={resolvedOnChange}
      placeholder={placeholder}
      autoFocus
      style={inputStyle}
      data-slot='query-input'
    />
  )
}

function QueryBandEscHint({ hint = 'ESC', children }: QueryBandEscHintProps) {
  return (
    <kbd style={escStyle} data-slot='query-esc'>
      {children ?? hint}
    </kbd>
  )
}

function QueryBandBase({
  query,
  placeholder = 'Type a command or search entities...',
  escHint = 'ESC',
  icon,
  onQueryChange,
}: QueryBandProps) {
  return (
    <QueryBandRoot value={query} onValueChange={onQueryChange}>
      <QueryBandIcon icon={icon} />
      <QueryBandInput placeholder={placeholder} />
      <QueryBandEscHint hint={escHint} />
    </QueryBandRoot>
  )
}

type QueryBandCompound = ((props: QueryBandProps) => JSX.Element) & {
  Root: typeof QueryBandRoot
  Icon: typeof QueryBandIcon
  Input: typeof QueryBandInput
  EscHint: typeof QueryBandEscHint
}

export const QueryBand = Object.assign(QueryBandBase, {
  Root: QueryBandRoot,
  Icon: QueryBandIcon,
  Input: QueryBandInput,
  EscHint: QueryBandEscHint,
}) as QueryBandCompound
