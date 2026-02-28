/**
 * Match.exhaustive category dispatch.
 *
 * Routes a HarnessErrorCode to its CategoryMatch: visual config,
 * detail component, and recovery actions.
 *
 * Uses Schema.is category guards — NOT individual string literals.
 * Adding a code to a Schema.Literal category in error-codes.ts
 * automatically routes it here. Single-source contract.
 *
 * @module harness/error-detail/category-matcher
 */

import { Match, pipe } from 'effect'
import { Schema } from 'effect'

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

import { categoryOf } from './category-registry'
import type { CategoryMatch } from './types'

import { StreamErrorDetail, STREAM_ACTIONS } from './details/stream-error-detail'
import { NetworkErrorDetail, NETWORK_ACTIONS } from './details/network-error-detail'
import { SessionErrorDetail, SESSION_ACTIONS } from './details/session-error-detail'
import { ToolErrorDetail, TOOL_ACTIONS } from './details/tool-error-detail'
import { ModelErrorDetail, MODEL_ACTIONS } from './details/model-error-detail'
import { DefectDetail, DEFECT_ACTIONS } from './details/defect-detail'
import { InterruptionDetail, INTERRUPTION_ACTIONS } from './details/interruption-detail'
import { FallbackDetail, FALLBACK_ACTIONS, FALLBACK_ACTIONS_WITH_RETRY } from './details/fallback-detail'

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

// ─── Match.exhaustive dispatch ───────────────────────────────────────────────

export const matchCategory = (code: HarnessErrorCode): CategoryMatch =>
  pipe(
    Match.value(code),

    // ── Errors (expected, recoverable) ──────────────────────
    Match.when(isStream, (c) => ({
      config: categoryOf(c),
      DetailComponent: StreamErrorDetail,
      actions: STREAM_ACTIONS,
    })),
    Match.when(isNetwork, (c) => ({
      config: categoryOf(c),
      DetailComponent: NetworkErrorDetail,
      actions: NETWORK_ACTIONS,
    })),
    Match.when(isSession, (c) => ({
      config: categoryOf(c),
      DetailComponent: SessionErrorDetail,
      actions: SESSION_ACTIONS,
    })),
    Match.when(isCrud, (c) => ({
      config: categoryOf(c),
      DetailComponent: FallbackDetail,
      actions: FALLBACK_ACTIONS_WITH_RETRY,
    })),
    Match.when(isTool, (c) => ({
      config: categoryOf(c),
      DetailComponent: ToolErrorDetail,
      actions: TOOL_ACTIONS,
    })),
    Match.when(isModel, (c) => ({
      config: categoryOf(c),
      DetailComponent: ModelErrorDetail,
      actions: MODEL_ACTIONS,
    })),
    Match.when(isTimeout, (c) => ({
      config: categoryOf(c),
      DetailComponent: FallbackDetail,
      actions: FALLBACK_ACTIONS_WITH_RETRY,
    })),
    Match.when(isCompaction, (c) => ({
      config: categoryOf(c),
      DetailComponent: FallbackDetail,
      actions: FALLBACK_ACTIONS,
    })),

    // ── Defects (unexpected, bugs) ──────────────────────────
    Match.when(isDefect, (c) => ({
      config: categoryOf(c),
      DetailComponent: DefectDetail,
      actions: DEFECT_ACTIONS,
    })),
    Match.when(isAdapterDx, (c) => ({
      config: categoryOf(c),
      DetailComponent: FallbackDetail,
      actions: FALLBACK_ACTIONS,
    })),
    Match.when(isStoreDx, (c) => ({
      config: categoryOf(c),
      DetailComponent: FallbackDetail,
      actions: FALLBACK_ACTIONS,
    })),

    // ── Interruptions (user-initiated) ──────────────────────
    Match.when(isAbort, (c) => ({
      config: categoryOf(c),
      DetailComponent: InterruptionDetail,
      actions: INTERRUPTION_ACTIONS,
    })),

    Match.exhaustive,
  )
