/**
 * Match.exhaustive category dispatch.
 *
 * Routes a HarnessErrorCode to its CategoryMatch: visual config,
 * detail component, and recovery actions (all from registry).
 *
 * Uses Schema.is category guards — NOT individual string literals.
 * Adding a code to a Schema.Literal category in error-codes.ts
 * automatically routes it. Single-source contract.
 *
 * @module harness/error-detail/category-matcher
 */

import { Match, pipe } from 'effect'
import { Schema } from 'effect'

import {
  StreamError, NetworkError, SessionError, SessionCrudError,
  ToolError, ModelError, TimeoutError, CompactionError,
  CriticalDefect, AdapterDefect, StoreDefect, Interruption,
  type HarnessErrorCode,
} from '../error-codes'

import { categoryOf } from './category-registry'
import type { CategoryMatch } from './types'

import { StreamErrorDetail } from './details/stream-error-detail'
import { NetworkErrorDetail } from './details/network-error-detail'
import { SessionErrorDetail } from './details/session-error-detail'
import { ToolErrorDetail } from './details/tool-error-detail'
import { ModelErrorDetail } from './details/model-error-detail'
import { DefectDetail } from './details/defect-detail'
import { InterruptionDetail } from './details/interruption-detail'
import { FallbackDetail } from './details/fallback-detail'

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

// ─── Builder (config + component → CategoryMatch) ────────────────────────────

function mkMatch(code: HarnessErrorCode, DetailComponent: CategoryMatch['DetailComponent']): CategoryMatch {
  const config = categoryOf(code)
  return { config, DetailComponent, actions: config.actions }
}

// ─── Match.exhaustive dispatch ───────────────────────────────────────────────

export const matchCategory = (code: HarnessErrorCode): CategoryMatch =>
  pipe(
    Match.value(code),

    // ── Errors (expected, recoverable) ──────────────────────
    Match.when(isStream,     (c) => mkMatch(c, StreamErrorDetail)),
    Match.when(isNetwork,    (c) => mkMatch(c, NetworkErrorDetail)),
    Match.when(isSession,    (c) => mkMatch(c, SessionErrorDetail)),
    Match.when(isCrud,       (c) => mkMatch(c, FallbackDetail)),
    Match.when(isTool,       (c) => mkMatch(c, ToolErrorDetail)),
    Match.when(isModel,      (c) => mkMatch(c, ModelErrorDetail)),
    Match.when(isTimeout,    (c) => mkMatch(c, FallbackDetail)),
    Match.when(isCompaction, (c) => mkMatch(c, FallbackDetail)),

    // ── Defects (unexpected, bugs) ──────────────────────────
    Match.when(isDefect,     (c) => mkMatch(c, DefectDetail)),
    Match.when(isAdapterDx,  (c) => mkMatch(c, FallbackDetail)),
    Match.when(isStoreDx,    (c) => mkMatch(c, FallbackDetail)),

    // ── Interruptions (user-initiated) ──────────────────────
    Match.when(isAbort,      (c) => mkMatch(c, InterruptionDetail)),

    Match.exhaustive,
  )
