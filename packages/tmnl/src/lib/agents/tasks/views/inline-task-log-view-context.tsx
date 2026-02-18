import React, { createContext, useContext, type PropsWithChildren } from 'react'
import type { AgentTaskLogAtomSurfaceAtoms } from '../atoms'
import type { AssembledLogEntry } from '../services/CodecService'
import type { TailInterruptProps } from './use-inline-task-log-controller'

export interface InlineTaskLogViewContextValue {
  readonly taskId: string
  readonly compact: boolean
  readonly atoms?: AgentTaskLogAtomSurfaceAtoms
  readonly entries: ReadonlyArray<AssembledLogEntry>
  readonly tailMode: 'tail' | 'inspect'
  readonly unreadCount: number
  readonly scrollRef: React.RefObject<HTMLDivElement | null>
  readonly tailAnchorRef: React.RefObject<HTMLDivElement | null>
  readonly tailInterruptProps: TailInterruptProps
  readonly interruptTail: () => void
  readonly jumpToLatest: () => void
}

const InlineTaskLogViewContext = createContext<InlineTaskLogViewContextValue | null>(null)

export const useInlineTaskLogViewContext = (): InlineTaskLogViewContextValue => {
  const ctx = useContext(InlineTaskLogViewContext)
  if (ctx) return ctx
  throw new Error('InlineTaskLogView subcomponents must be used inside <InlineTaskLogView taskId={...}>')
}

export interface InlineTaskLogViewProviderProps extends PropsWithChildren {
  readonly value: InlineTaskLogViewContextValue
}

export const InlineTaskLogViewProvider = ({
  value,
  children,
}: InlineTaskLogViewProviderProps) => (
  <InlineTaskLogViewContext.Provider value={value}>
    {children}
  </InlineTaskLogViewContext.Provider>
)
