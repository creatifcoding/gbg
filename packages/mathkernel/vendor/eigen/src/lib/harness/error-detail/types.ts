/**
 * Shared types for the error-detail compound component system.
 *
 * @module harness/error-detail/types
 */

import type { ReactNode } from 'react'
import type { HarnessErrorCode } from '../error-codes'
import type { CategoryConfig } from './category-registry'

// ─── Detail context value (dependency-injected by provider) ──────────────────

export interface ErrorDetailState {
  readonly code: HarnessErrorCode
  readonly message: string
  readonly at: number
  readonly details: unknown
}

export interface ErrorDetailActions {
  readonly onDismiss: () => void
  readonly onReconnect?: () => void
  readonly onNewSession?: () => void
  readonly onCopyDiagnostic?: () => void
}

export interface ErrorDetailMeta {
  readonly config: CategoryConfig
  readonly sessionId?: string | null
}

export interface ErrorDetailContextValue {
  readonly state: ErrorDetailState
  readonly actions: ErrorDetailActions
  readonly meta: ErrorDetailMeta
}

// ─── Action definition (for match results) ───────────────────────────────────

export interface ActionDef {
  readonly label: string
  /** Action key for dispatch */
  readonly action: 'dismiss' | 'reconnect' | 'new-session' | 'copy-diagnostic' | 'retry-catalog' | 'switch-model' | 'resume'
  /** Accent override (defaults to category accent) */
  readonly accent?: string
  /** Is this the primary (leftmost) action? */
  readonly primary?: boolean
}

// ─── Category match result ───────────────────────────────────────────────────

export interface CategoryMatch {
  readonly config: CategoryConfig
  readonly DetailComponent: React.ComponentType<{ children?: ReactNode }>
  readonly actions: ReadonlyArray<ActionDef>
}
