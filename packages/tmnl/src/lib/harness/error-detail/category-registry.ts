/**
 * Category visual identity registry.
 *
 * Maps each of the 12 error-code categories to icon, accent color,
 * tints, and human-readable label. Single source consumed by both
 * collapsed toast cards and expanded detail views.
 *
 * @module harness/error-detail/category-registry
 */

import { Schema } from 'effect'
import type { LucideIcon } from 'lucide-react'
import {
  Zap,
  WifiOff,
  Database,
  FolderOpen,
  Wrench,
  Cpu,
  Clock,
  Archive,
  Bug,
  Activity,
  HardDrive,
  CircleStop,
} from 'lucide-react'

import {
  StreamError,
  NetworkError,
  SessionError,
  SessionCrudError,
  ToolError,
  ModelError,
  TimeoutError,
  CompactionError,
  CriticalDefect,
  AdapterDefect,
  StoreDefect,
  Interruption,
  type HarnessErrorCode,
} from '../error-codes'

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
  /** Card border: accent at 0.2 alpha */
  readonly borderTint: string
  /** Card background: dark warm-shifted at 0.97 alpha */
  readonly bgTint: string
  /** Severity label for the pill badge */
  readonly severityLabel: 'error' | 'warn' | 'defect' | 'info' | 'silent'
}

// ─── Static configs ──────────────────────────────────────────────────────────

const STREAM: CategoryConfig = {
  key: 'stream',
  label: 'Stream Error',
  Icon: Zap,
  accent: '#f87171',
  borderTint: 'rgba(239,68,68,0.2)',
  bgTint: 'rgba(10,3,3,0.97)',
  severityLabel: 'error',
}

const NETWORK: CategoryConfig = {
  key: 'network',
  label: 'Network Unavailable',
  Icon: WifiOff,
  accent: '#fb923c',
  borderTint: 'rgba(251,146,60,0.2)',
  bgTint: 'rgba(10,7,3,0.97)',
  severityLabel: 'error',
}

const SESSION: CategoryConfig = {
  key: 'session',
  label: 'Session Error',
  Icon: Database,
  accent: '#f59e0b',
  borderTint: 'rgba(245,158,11,0.2)',
  bgTint: 'rgba(10,7,3,0.97)',
  severityLabel: 'error',
}

const SESSION_CRUD: CategoryConfig = {
  key: 'session-crud',
  label: 'Session Operation',
  Icon: FolderOpen,
  accent: '#a3a3a3',
  borderTint: 'rgba(163,163,163,0.2)',
  bgTint: 'rgba(8,8,8,0.97)',
  severityLabel: 'warn',
}

const TOOL: CategoryConfig = {
  key: 'tool',
  label: 'Tool Error',
  Icon: Wrench,
  accent: '#818cf8',
  borderTint: 'rgba(129,140,248,0.2)',
  bgTint: 'rgba(5,3,10,0.97)',
  severityLabel: 'warn',
}

const MODEL: CategoryConfig = {
  key: 'model',
  label: 'Model Error',
  Icon: Cpu,
  accent: '#c084fc',
  borderTint: 'rgba(192,132,252,0.2)',
  bgTint: 'rgba(8,3,10,0.97)',
  severityLabel: 'warn',
}

const TIMEOUT: CategoryConfig = {
  key: 'timeout',
  label: 'Timeout',
  Icon: Clock,
  accent: '#f87171',
  borderTint: 'rgba(239,68,68,0.2)',
  bgTint: 'rgba(10,3,3,0.97)',
  severityLabel: 'error',
}

const COMPACTION: CategoryConfig = {
  key: 'compaction',
  label: 'Compaction',
  Icon: Archive,
  accent: '#737373',
  borderTint: 'rgba(115,115,115,0.2)',
  bgTint: 'rgba(8,8,8,0.97)',
  severityLabel: 'warn',
}

const CRITICAL_DEFECT: CategoryConfig = {
  key: 'defect',
  label: 'Defect',
  Icon: Bug,
  accent: '#ef4444',
  borderTint: 'rgba(239,68,68,0.3)',
  bgTint: 'rgba(10,2,2,0.97)',
  severityLabel: 'defect',
}

const ADAPTER_DEFECT: CategoryConfig = {
  key: 'adapter-defect',
  label: 'Adapter Diagnostic',
  Icon: Activity,
  accent: '#404040',
  borderTint: 'rgba(64,64,64,0.2)',
  bgTint: 'rgba(6,6,6,0.97)',
  severityLabel: 'silent',
}

const STORE_DEFECT: CategoryConfig = {
  key: 'store-defect',
  label: 'Store Diagnostic',
  Icon: HardDrive,
  accent: '#404040',
  borderTint: 'rgba(64,64,64,0.2)',
  bgTint: 'rgba(6,6,6,0.97)',
  severityLabel: 'silent',
}

const INTERRUPTION: CategoryConfig = {
  key: 'interruption',
  label: 'Cancelled',
  Icon: CircleStop,
  accent: '#64748b',
  borderTint: 'rgba(100,116,139,0.2)',
  bgTint: 'rgba(8,8,10,0.97)',
  severityLabel: 'info',
}

// ─── Schema.is guards ────────────────────────────────────────────────────────

const isStream    = Schema.is(StreamError)
const isNetwork   = Schema.is(NetworkError)
const isSession   = Schema.is(SessionError)
const isCrud      = Schema.is(SessionCrudError)
const isTool      = Schema.is(ToolError)
const isModel     = Schema.is(ModelError)
const isTimeout   = Schema.is(TimeoutError)
const isCompaction = Schema.is(CompactionError)
const isDefect    = Schema.is(CriticalDefect)
const isAdapterDx = Schema.is(AdapterDefect)
const isStoreDx   = Schema.is(StoreDefect)
const isAbort     = Schema.is(Interruption)

// ─── Classifier ──────────────────────────────────────────────────────────────

/**
 * Classify a harness error code into its category visual config.
 *
 * Uses Schema.is guards — adding a code to a Schema.Literal category
 * in error-codes.ts automatically classifies it here.
 */
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
  if (isAbort(code))      return INTERRUPTION
  // Fallback for truly unknown codes (shouldn't happen with typed input)
  return CRITICAL_DEFECT
}

// ─── All configs (for badge worst-severity scan) ─────────────────────────────

/** Severity weight for worst-severity comparison. Higher = worse. */
export const SEVERITY_WEIGHT: Record<CategoryConfig['severityLabel'], number> = {
  silent: 0,
  info: 1,
  warn: 2,
  error: 3,
  defect: 4,
}
