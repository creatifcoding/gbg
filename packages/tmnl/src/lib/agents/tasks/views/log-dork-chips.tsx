import React, {
  createContext,
  useContext,
  type HTMLAttributes,
  type PropsWithChildren,
} from 'react'
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from 'framer-motion'
import type { ParsedQuery } from '../../../search/query'
import { type DorkChip } from './log-dork-chips-model'
import { useLogDorkChips } from './use-log-dork-chips'

interface LogDorkChipsContextValue {
  readonly chips: ReadonlyArray<DorkChip>
  readonly activeChipId: string | null
  readonly setActiveChipId: React.Dispatch<React.SetStateAction<string | null>>
  readonly removeChip: (chip: DorkChip) => void
  readonly reduceMotion: boolean
}

const LogDorkChipsContext = createContext<LogDorkChipsContextValue | null>(null)

const useLogDorkChipsContext = (): LogDorkChipsContextValue => {
  const ctx = useContext(LogDorkChipsContext)
  if (ctx) return ctx
  throw new Error('LogDorkChips subcomponents must be used inside <LogDorkChips>')
}

export interface LogDorkChipsProps extends PropsWithChildren {
  readonly query: ParsedQuery | Partial<ParsedQuery> | null | undefined
  readonly onQueryChange: (next: ParsedQuery) => void
}

export interface LogDorkChipRowProps extends HTMLAttributes<HTMLDivElement> {}

export interface LogDorkChipProps {
  readonly chip: DorkChip
  readonly children?: React.ReactNode
}

export interface LogDorkChipTypeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly chip: DorkChip
}

export interface LogDorkChipTokenProps extends HTMLAttributes<HTMLSpanElement> {
  readonly chip: DorkChip
}

export interface LogDorkChipRemoveProps {
  readonly chip: DorkChip
}

const DefaultLogDorkChipsLayout = () => {
  const { chips } = useLogDorkChipsContext()

  return (
    <LogDorkChips.Row data-slot="log-filter-dork-chips">
      <AnimatePresence initial={false}>
        {chips.map((chip) => (
          <LogDorkChips.Chip key={chip.id} chip={chip} />
        ))}
      </AnimatePresence>
    </LogDorkChips.Row>
  )
}

function LogDorkChipsRoot({ query, onQueryChange, children }: LogDorkChipsProps) {
  const reduceMotion = !!useReducedMotion()
  const state = useLogDorkChips(query, onQueryChange)

  if (state.chips.length === 0 && !children) return null

  return (
    <LogDorkChipsContext.Provider
      value={{
        chips: state.chips,
        activeChipId: state.activeChipId,
        setActiveChipId: state.setActiveChipId,
        removeChip: state.removeChip,
        reduceMotion,
      }}
    >
      <LayoutGroup id="log-dork-chip-layout">
        {children ?? <DefaultLogDorkChipsLayout />}
      </LayoutGroup>
    </LogDorkChipsContext.Provider>
  )
}

function LogDorkChipRow({ className, children, ...rest }: LogDorkChipRowProps) {
  return (
    <div
      {...rest}
      className={className ? `at-log-filter-bar__dork-row ${className}` : 'at-log-filter-bar__dork-row'}
      aria-label="Active dork filters"
    >
      {children}
    </div>
  )
}

function LogDorkChipItem({ chip, children }: LogDorkChipProps) {
  const ctx = useLogDorkChipsContext()

  return (
    <motion.span
      layout="position"
      className="at-log-filter-bar__dork-chip"
      data-kind={chip.kind}
      data-exclude={chip.kind === 'field' && chip.excluded ? '' : undefined}
      data-slot="log-filter-dork-chip"
      tabIndex={0}
      onMouseEnter={() => ctx.setActiveChipId(chip.id)}
      onMouseLeave={() => {
        ctx.setActiveChipId((current) => (current === chip.id ? null : current))
      }}
      onFocusCapture={() => ctx.setActiveChipId(chip.id)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          ctx.setActiveChipId((current) => (current === chip.id ? null : current))
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault()
          ctx.removeChip(chip)
        }
      }}
      transition={
        ctx.reduceMotion
          ? { duration: 0 }
          : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
      }
    >
      {children ?? (
        <>
          <LogDorkChips.ChipType chip={chip} />
          <LogDorkChips.ChipToken chip={chip} />
          <LogDorkChips.ChipRemove chip={chip} />
        </>
      )}
    </motion.span>
  )
}

function LogDorkChipType({ chip, className, children, ...rest }: LogDorkChipTypeProps) {
  return (
    <span
      {...rest}
      className={
        className
          ? `at-log-filter-bar__dork-chip-type ${className}`
          : 'at-log-filter-bar__dork-chip-type'
      }
    >
      {children ?? chip.label}
    </span>
  )
}

function LogDorkChipToken({ chip, className, children, ...rest }: LogDorkChipTokenProps) {
  return (
    <span
      {...rest}
      className={
        className
          ? `at-log-filter-bar__dork-chip-token ${className}`
          : 'at-log-filter-bar__dork-chip-token'
      }
    >
      {children ?? chip.token}
    </span>
  )
}

function LogDorkChipRemove({ chip }: LogDorkChipRemoveProps) {
  const ctx = useLogDorkChipsContext()
  const active = ctx.activeChipId === chip.id

  return (
    <AnimatePresence initial={false} mode="wait">
      {active && (
        <motion.span
          key={`${chip.id}-close-wrap`}
          className="at-log-filter-bar__dork-chip-close-wrap"
          initial={ctx.reduceMotion ? { opacity: 0 } : { width: 0, opacity: 0 }}
          animate={ctx.reduceMotion ? { opacity: 1 } : { width: 16, opacity: 1 }}
          exit={ctx.reduceMotion ? { opacity: 0 } : { width: 0, opacity: 0 }}
          transition={
            ctx.reduceMotion
              ? { duration: 0 }
              : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <motion.button
            type="button"
            className="at-log-filter-bar__dork-chip-close"
            onClick={() => ctx.removeChip(chip)}
            aria-label={`Remove ${chip.token}`}
            title={`Remove ${chip.token}`}
            initial={ctx.reduceMotion ? undefined : { scale: 0.96, x: -2 }}
            animate={ctx.reduceMotion ? undefined : { scale: 1, x: 0 }}
            exit={ctx.reduceMotion ? undefined : { scale: 0.96, x: -2 }}
            transition={
              ctx.reduceMotion
                ? { duration: 0 }
                : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }
            }
          >
            ×
          </motion.button>
        </motion.span>
      )}
    </AnimatePresence>
  )
}

export const LogDorkChips = Object.assign(LogDorkChipsRoot, {
  Row: LogDorkChipRow,
  Chip: LogDorkChipItem,
  ChipType: LogDorkChipType,
  ChipToken: LogDorkChipToken,
  ChipRemove: LogDorkChipRemove,
})
