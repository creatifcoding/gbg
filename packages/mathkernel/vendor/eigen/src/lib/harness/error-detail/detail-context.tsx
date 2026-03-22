/**
 * Error detail compound component context.
 *
 * Provider is the only place that knows how state is managed.
 * UI sub-components consume the context interface.
 *
 * @module harness/error-detail/detail-context
 */

import { createContext, use, type ReactNode } from 'react'
import type { ErrorDetailContextValue, ErrorDetailState, ErrorDetailActions, ErrorDetailMeta } from './types'

// ─── Context ─────────────────────────────────────────────────────────────────

export const ErrorDetailContext = createContext<ErrorDetailContextValue | null>(null)

export function useErrorDetail(): ErrorDetailContextValue {
  const ctx = use(ErrorDetailContext)
  if (!ctx) throw new Error('useErrorDetail must be used within ErrorDetail.Provider')
  return ctx
}

// ─── Provider ────────────────────────────────────────────────────────────────

export interface ErrorDetailProviderProps {
  readonly state: ErrorDetailState
  readonly actions: ErrorDetailActions
  readonly meta: ErrorDetailMeta
  readonly children: ReactNode
}

export function ErrorDetailProvider({ state, actions, meta, children }: ErrorDetailProviderProps) {
  return (
    <ErrorDetailContext value={{ state, actions, meta }}>
      {children}
    </ErrorDetailContext>
  )
}
