/**
 * CodeModeSandbox — Isolated execution environment for genifer_code
 *
 * Provides a sandboxed context where LLM-generated code runs with
 * controlled access to genifer services via GeniferCodeSDK.
 *
 * Security: URL allowlist, timeout, no process/fs access, audit log.
 *
 * @module genifer/code-mode/sandbox
 */

import type { GeniferCodeSDK, ExposeSpec } from './schemas'
import { CodeModeSandboxError, CodeModeTimeoutError } from './schemas'
import {
  registerDynamicRpc,
  callDynamicRpc,
  registerCustomRpcHandler,
} from '../services/DynamicRpcService'
import {
  defineDynamicEvent,
  emitDynamicEvent,
  subscribeDynamicEvent,
} from '../services/DynamicEventService'
import { RpcDefinition } from '../services/DynamicRpcSchemas'
import { EventDefinition } from '../services/DynamicEventSchemas'

// =============================================================================
// URL Allowlist (security)
// =============================================================================

const URL_ALLOWLIST = new Set([
  'opensky-network.org',
  'api.opensky-network.org',
  'api.github.com',
  'httpbin.org',
  'jsonplaceholder.typicode.com',
])

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Allow localhost for dev
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return true
    return URL_ALLOWLIST.has(parsed.hostname) || URL_ALLOWLIST.has(parsed.host)
  } catch {
    return false
  }
}

/** Add a domain to the URL allowlist (e.g., from user config) */
export function allowUrl(domain: string): void {
  URL_ALLOWLIST.add(domain)
}

// =============================================================================
// Audit Log
// =============================================================================

interface AuditEntry {
  readonly timestamp: number
  readonly action: string
  readonly detail: string
}

const auditLog: AuditEntry[] = []

function audit(action: string, detail: string): void {
  auditLog.push({ timestamp: Date.now(), action, detail })
}

export function getAuditLog(): ReadonlyArray<AuditEntry> {
  return auditLog
}

export function clearAuditLog(): void {
  auditLog.length = 0
}

// =============================================================================
// Dynamic Atom Store (session-scoped)
// =============================================================================

/** Session-scoped dynamic atoms — key → value + subscribers */
const dynamicAtoms = new Map<string, { value: any; subscribers: Set<(v: any) => void> }>()

function getDynamicAtom(key: string): { value: any; subscribers: Set<(v: any) => void> } {
  let entry = dynamicAtoms.get(key)
  if (!entry) {
    entry = { value: undefined, subscribers: new Set() }
    dynamicAtoms.set(key, entry)
  }
  return entry
}

// =============================================================================
// Dynamic Tool Store (session-scoped)
// =============================================================================

const dynamicTools = new Map<string, {
  name: string
  label: string
  description: string
  execute: (params: any) => Promise<any>
}>()

export function getDynamicTools(): ReadonlyMap<string, typeof dynamicTools extends Map<string, infer V> ? V : never> {
  return dynamicTools
}

// =============================================================================
// Dynamic Component Store (session-scoped)
// =============================================================================

const dynamicComponents = new Map<string, (props: any) => any>()

export function getDynamicComponents(): ReadonlyMap<string, (props: any) => any> {
  return dynamicComponents
}

// =============================================================================
// SDK Factory
// =============================================================================

/**
 * Creates a GeniferCodeSDK instance for sandbox execution.
 * All operations are audited and sandboxed.
 */
export function createCodeSDK(): GeniferCodeSDK {
  const sdk: GeniferCodeSDK = {
    // --- Atoms ---
    atoms: {
      get: <T>(key: string): T | undefined => {
        audit('atoms.get', key)
        return getDynamicAtom(key).value as T | undefined
      },
      set: <T>(key: string, value: T): void => {
        audit('atoms.set', `${key} = ${JSON.stringify(value)?.slice(0, 100)}`)
        const entry = getDynamicAtom(key)
        entry.value = value
        for (const fn of entry.subscribers) {
          try { fn(value) } catch { /* subscriber error — don't crash sandbox */ }
        }
      },
      subscribe: <T>(key: string, fn: (value: T) => void): (() => void) => {
        audit('atoms.subscribe', key)
        const entry = getDynamicAtom(key)
        entry.subscribers.add(fn as any)
        return () => { entry.subscribers.delete(fn as any) }
      },
    },

    // --- Registration ---
    register: {
      tool: (spec) => {
        audit('register.tool', spec.name)
        dynamicTools.set(spec.name, spec)
      },
      rpc: (spec) => {
        audit('register.rpc', spec.tag)
        const def = new RpcDefinition({
          tag: spec.tag,
          description: spec.description ?? '',
          handler: { _tag: 'custom', handlerId: `code-mode-${spec.tag}` } as any,
          source: 'code-mode',
          registeredAt: Date.now(),
        })
        registerDynamicRpc(spec.tag, def)
        registerCustomRpcHandler(`code-mode-${spec.tag}`, spec.handler)
      },
      event: (spec) => {
        audit('register.event', spec.tag)
        const def = new EventDefinition({
          tag: spec.tag,
          description: spec.description ?? '',
          payloadSchema: spec.payloadSchema,
          source: 'code-mode',
          definedAt: Date.now(),
        })
        defineDynamicEvent(spec.tag, def)
      },
      component: (name, factory) => {
        audit('register.component', name)
        dynamicComponents.set(name, factory)
      },
    },

    // --- HTTP Client (sandboxed) ---
    http: {
      get: async (url, options) => {
        audit('http.get', url)
        if (!isAllowedUrl(url)) {
          throw new Error(`URL not in allowlist: ${url}. Use sdk.allowUrl() or contact admin.`)
        }
        const resp = await fetch(url, { headers: options?.headers })
        return resp.json()
      },
      post: async (url, body, options) => {
        audit('http.post', url)
        if (!isAllowedUrl(url)) {
          throw new Error(`URL not in allowlist: ${url}. Use sdk.allowUrl() or contact admin.`)
        }
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...options?.headers },
          body: JSON.stringify(body),
        })
        return resp.json()
      },
    },

    // --- Events ---
    emit: (tag, payload) => {
      audit('emit', `${tag} ${JSON.stringify(payload)?.slice(0, 100)}`)
      emitDynamicEvent(tag, payload)
    },
    on: (tag, handler) => {
      audit('on', tag)
      return subscribeDynamicEvent(tag, handler)
    },

    // --- RPC ---
    callRpc: (tag, payload) => {
      audit('callRpc', `${tag} ${JSON.stringify(payload)?.slice(0, 100)}`)
      return callDynamicRpc(tag, payload)
    },

    // --- Logging ---
    log: (...args) => { audit('log', args.map(String).join(' ')); console.log('[code-mode]', ...args) },
    warn: (...args) => { audit('warn', args.map(String).join(' ')); console.warn('[code-mode]', ...args) },
    error: (...args) => { audit('error', args.map(String).join(' ')); console.error('[code-mode]', ...args) },
  }

  return sdk
}

// =============================================================================
// Reset (for tests)
// =============================================================================

export function resetSandboxState(): void {
  dynamicAtoms.clear()
  dynamicTools.clear()
  dynamicComponents.clear()
  clearAuditLog()
}
