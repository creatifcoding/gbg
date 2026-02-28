/**
 * Category visual identity + action registry.
 *
 * Maps each of the 12 error-code categories to:
 *   - Icon, accent, derived tints (from tokens)
 *   - Recovery actions
 *   - Human-readable label + severity
 *
 * borderTint and bgTint are DERIVED from accent + tokens.
 * Actions live here — detail components consume, not own.
 *
 * @module harness/error-detail/category-registry
 */

import { Schema } from 'effect'
import type { LucideIcon } from 'lucide-react'
import {
  Zap, WifiOff, Database, FolderOpen, Wrench,
  Cpu, Clock, Archive, Bug, Activity, HardDrive, CircleStop,
} from 'lucide-react'

import {
  StreamError, NetworkError, SessionError, SessionCrudError,
  ToolError, ModelError, TimeoutError, CompactionError,
  CriticalDefect, AdapterDefect, StoreDefect, Interruption,
  type HarnessErrorCode,
} from '../error-codes'

import { ACCENT, SEMANTIC, borderTint, bgTint, type BgHue } from './tokens'
import type { ActionDef } from './types'

// ─── CategoryConfig ──────────────────────────────────────────────────────────

export interface CategoryConfig {
  /** Short key for data attributes / css selectors */
  readonly key: string
  /** Human-readable category label */
  readonly label: string
  /** Lucide icon component (render at size={11} strokeWidth={1.5}) */
  readonly Icon: LucideIcon
  /** Hex accent color for text, icon stroke, action borders */
  readonly accent: string
  /** Card border: derived from accent + ALPHA.border */
  readonly borderTint: string
  /** Card background: derived from bgHue + ALPHA.bgOpacity */
  readonly bgTint: string
  /** Severity label for the pill badge */
  readonly severityLabel: SeverityLabel
  /** Recovery actions available for this category */
  readonly actions: ReadonlyArray<ActionDef>
}

export type SeverityLabel = 'error' | 'warn' | 'defect' | 'info' | 'silent'

// ─── Builder (DRY config construction) ───────────────────────────────────────

interface CategoryInput {
  key: string
  label: string
  Icon: LucideIcon
  accent: string
  bgHue: BgHue
  severityLabel: SeverityLabel
  actions: ReadonlyArray<ActionDef>
  /** Override border alpha (e.g. 0.3 for defects) */
  borderAlpha?: number
}

function mkCategory(input: CategoryInput): CategoryConfig {
  return {
    key: input.key,
    label: input.label,
    Icon: input.Icon,
    accent: input.accent,
    borderTint: borderTint(input.accent, input.borderAlpha),
    bgTint: bgTint(input.bgHue),
    severityLabel: input.severityLabel,
    actions: input.actions,
  }
}

// ─── Shared action sets ──────────────────────────────────────────────────────

const DISMISS_ONLY: ReadonlyArray<ActionDef> = [
  { label: 'Dismiss', action: 'dismiss' },
] as const

const RETRY_DISMISS: ReadonlyArray<ActionDef> = [
  { label: 'Retry', action: 'reconnect', primary: true },
  { label: 'Dismiss', action: 'dismiss' },
] as const

// ─── Category configs ────────────────────────────────────────────────────────

const STREAM = mkCategory({
  key: 'stream',
  label: 'Stream Error',
  Icon: Zap,
  accent: ACCENT.stream,
  bgHue: 'red',
  severityLabel: 'error',
  actions: [
    { label: 'Retry Stream', action: 'reconnect', primary: true },
    { label: 'Dismiss', action: 'dismiss' },
  ],
})

const NETWORK = mkCategory({
  key: 'network',
  label: 'Network Unavailable',
  Icon: WifiOff,
  accent: ACCENT.network,
  bgHue: 'orange',
  severityLabel: 'error',
  actions: [
    { label: 'Check Connection', action: 'reconnect', primary: true },
    { label: 'Retry', action: 'reconnect' },
    { label: 'Dismiss', action: 'dismiss' },
  ],
})

const SESSION = mkCategory({
  key: 'session',
  label: 'Session Error',
  Icon: Database,
  accent: ACCENT.session,
  bgHue: 'amber',
  severityLabel: 'error',
  actions: [
    { label: 'Reload Session', action: 'reconnect', primary: true },
    { label: 'New Session', action: 'new-session', accent: SEMANTIC.positive },
    { label: 'Dismiss', action: 'dismiss' },
  ],
})

const SESSION_CRUD = mkCategory({
  key: 'session-crud',
  label: 'Session Operation',
  Icon: FolderOpen,
  accent: ACCENT.sessionCrud,
  bgHue: 'neutral',
  severityLabel: 'warn',
  actions: RETRY_DISMISS,
})

const TOOL = mkCategory({
  key: 'tool',
  label: 'Tool Error',
  Icon: Wrench,
  accent: ACCENT.tool,
  bgHue: 'indigo',
  severityLabel: 'warn',
  actions: [
    { label: 'Re-run Tool', action: 'reconnect', primary: true },
    { label: 'Skip', action: 'dismiss' },
    { label: 'Dismiss', action: 'dismiss' },
  ],
})

const MODEL = mkCategory({
  key: 'model',
  label: 'Model Error',
  Icon: Cpu,
  accent: ACCENT.model,
  bgHue: 'purple',
  severityLabel: 'warn',
  actions: [
    { label: 'Retry Catalog', action: 'retry-catalog', primary: true },
    { label: 'Switch Model', action: 'switch-model' },
    { label: 'Dismiss', action: 'dismiss' },
  ],
})

const TIMEOUT = mkCategory({
  key: 'timeout',
  label: 'Timeout',
  Icon: Clock,
  accent: ACCENT.timeout,
  bgHue: 'red',
  severityLabel: 'error',
  actions: RETRY_DISMISS,
})

const COMPACTION = mkCategory({
  key: 'compaction',
  label: 'Compaction',
  Icon: Archive,
  accent: ACCENT.compaction,
  bgHue: 'neutral',
  severityLabel: 'warn',
  actions: DISMISS_ONLY,
})

const CRITICAL_DEFECT = mkCategory({
  key: 'defect',
  label: 'Defect',
  Icon: Bug,
  accent: ACCENT.defect,
  bgHue: 'red',
  severityLabel: 'defect',
  borderAlpha: 0.3,
  actions: [
    { label: 'Copy Diagnostic', action: 'copy-diagnostic', primary: true },
    { label: 'Reconnect', action: 'reconnect' },
    { label: 'Dismiss', action: 'dismiss' },
  ],
})

const ADAPTER_DEFECT = mkCategory({
  key: 'adapter-defect',
  label: 'Adapter Diagnostic',
  Icon: Activity,
  accent: ACCENT.adapterDefect,
  bgHue: 'dark',
  severityLabel: 'silent',
  actions: DISMISS_ONLY,
})

const STORE_DEFECT = mkCategory({
  key: 'store-defect',
  label: 'Store Diagnostic',
  Icon: HardDrive,
  accent: ACCENT.storeDefect,
  bgHue: 'dark',
  severityLabel: 'silent',
  actions: DISMISS_ONLY,
})

const INTERRUPTION_CFG = mkCategory({
  key: 'interruption',
  label: 'Cancelled',
  Icon: CircleStop,
  accent: ACCENT.interruption,
  bgHue: 'slate',
  severityLabel: 'info',
  actions: [
    { label: 'Resume', action: 'resume', primary: true },
    { label: 'Dismiss', action: 'dismiss' },
  ],
})

// ─── Schema.is guards ────────────────────────────────────────────────────────

const isStream     = Schema.is(StreamError)
const isNetwork    = Schema.is(NetworkError)
const isSession    = Schema.is(SessionError)
const isCrud       = Schema.is(SessionCrudError)
const isTool       = Schema.is(ToolError)
const isModel      = Schema.is(ModelError)
const isTimeout    = Schema.is(TimeoutError)
const isCompaction = Schema.is(CompactionError)
const isDefect     = Schema.is(CriticalDefect)
const isAdapterDx  = Schema.is(AdapterDefect)
const isStoreDx    = Schema.is(StoreDefect)
const isAbort      = Schema.is(Interruption)

// ─── Classifier ──────────────────────────────────────────────────────────────

export function categoryOf(code: HarnessErrorCode): CategoryConfig
export function categoryOf(code: string): CategoryConfig
export function categoryOf(code: string): CategoryConfig {
  if (isStream(code))     return STREAM
  if (isNetwork(code))    return NETWORK
  if (isSession(code))    return SESSION
  if (isCrud(code))       return SESSION_CRUD
  if (isTool(code))       return TOOL
  if (isModel(code))      return MODEL
  if (isTimeout(code))    return TIMEOUT
  if (isCompaction(code)) return COMPACTION
  if (isDefect(code))     return CRITICAL_DEFECT
  if (isAdapterDx(code))  return ADAPTER_DEFECT
  if (isStoreDx(code))    return STORE_DEFECT
  if (isAbort(code))      return INTERRUPTION_CFG
  return CRITICAL_DEFECT
}

// ─── Severity weight (for badge worst-severity scan) ─────────────────────────

export const SEVERITY_WEIGHT: Record<SeverityLabel, number> = {
  silent: 0,
  info: 1,
  warn: 2,
  error: 3,
  defect: 4,
}
