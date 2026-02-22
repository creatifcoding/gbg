/**
 * DynamicRpcService — Runtime RPC registration and dispatch.
 *
 * Implements the DynamicRpcGroup handlers using @effect/rpc.
 *
 * Architecture:
 *   - Management API (register/call/list/get/unregister) → @effect/rpc handlers
 *   - State → Atom<Map<string, RpcDefinition>> (Atom-as-State pattern)
 *   - Handler dispatch → internal routing by handler._tag (http/custom/service/llm/script)
 *   - Custom handlers → registered imperatively at bootstrap
 *
 * @module genifer/services/DynamicRpcService
 */

import { Effect, Layer } from 'effect'
import * as Atom from '@effect-atom/atom/Atom'
import { Registry } from '@effect-atom/atom'
import {
  DynamicRpcGroup,
  DynamicRpcNotFound,
  DynamicRpcHandlerError,
  type RpcDefinition,
  type RpcHandler,
} from './DynamicRpcSchemas'

// =============================================================================
// State Atoms (Atom-as-State — React subscribes directly)
// =============================================================================

/** All registered RPC definitions, keyed by tag */
export const rpcRegistryAtom = Atom.make<ReadonlyMap<string, RpcDefinition>>(new Map())

// =============================================================================
// Custom Handler Registry
// =============================================================================

const _customHandlers = new Map<string, (payload: unknown) => Promise<unknown>>()

export function registerCustomRpcHandler(
  handlerId: string,
  fn: (payload: unknown) => Promise<unknown>,
): void {
  _customHandlers.set(handlerId, fn)
}

export function unregisterCustomRpcHandler(handlerId: string): void {
  _customHandlers.delete(handlerId)
}

// =============================================================================
// Registry Bridge (for Atom mutations — same pattern as bootstrap.ts)
// =============================================================================

let _registry: Registry.Registry | null = null

export function setDynamicRpcRegistry(r: Registry.Registry): void {
  _registry = r
}

function reg(): Registry.Registry {
  if (!_registry) throw new Error('DynamicRpcService registry not set — call setDynamicRpcRegistry()')
  return _registry
}

/** Register an RPC definition via the service's own registry — avoids module duplication */
export function registerDynamicRpc(tag: string, def: RpcDefinition): void {
  const r = reg()
  const current = new Map(r.get(rpcRegistryAtom))
  current.set(tag, def)
  r.set(rpcRegistryAtom, current)
}

/** Register multiple RPC definitions at once */
export function registerDynamicRpcs(defs: ReadonlyMap<string, RpcDefinition>): void {
  const r = reg()
  const current = new Map(r.get(rpcRegistryAtom))
  for (const [tag, def] of defs) {
    current.set(tag, def)
  }
  r.set(rpcRegistryAtom, current)
}

/** Get all registered RPCs */
export function getDynamicRpcs(): ReadonlyMap<string, RpcDefinition> {
  return reg().get(rpcRegistryAtom)
}

// =============================================================================
// Handler Dispatch
// =============================================================================

function dispatchHandler(
  tag: string,
  handler: RpcHandler,
  payload: unknown,
): Effect.Effect<unknown, DynamicRpcHandlerError> {
  switch (handler._tag) {
    case 'custom': {
      const fn = _customHandlers.get(handler.handlerId)
      if (!fn) {
        return Effect.fail(new DynamicRpcHandlerError({
          tag,
          message: `Custom handler '${handler.handlerId}' not registered`,
        }))
      }
      // Invoke handler — supports both sync and async return values
      return Effect.suspend(() => {
        try {
          const result = fn(payload)
          // If handler returns a thenable, wrap as async Effect
          if (result && typeof (result as any).then === 'function') {
            return Effect.tryPromise({
              try: () => result as Promise<unknown>,
              catch: (err) => new DynamicRpcHandlerError({
                tag,
                message: `Handler error: ${err instanceof Error ? err.message : String(err)}`,
                cause: err,
              }),
            })
          }
          // Sync result — return immediately
          return Effect.succeed(result)
        } catch (err) {
          return Effect.fail(new DynamicRpcHandlerError({
            tag,
            message: `Handler error: ${err instanceof Error ? err.message : String(err)}`,
            cause: err,
          }))
        }
      })
    }

    case 'http': {
      const method = handler.method ?? 'GET'
      const url = new URL(handler.url)

      if (method === 'GET' && payload && typeof payload === 'object') {
        for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
          if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
        }
      }

      const headers: Record<string, string> = { ...handler.headers }
      let body: string | undefined

      if (method !== 'GET' && payload !== undefined) {
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
        body = handler.bodyTemplate
          ? handler.bodyTemplate.replace('{{payload}}', JSON.stringify(payload))
          : JSON.stringify(payload)
      }

      return Effect.tryPromise({
        try: async () => {
          const res = await fetch(url.toString(), { method, headers, body })
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          const ct = res.headers.get('content-type') ?? ''
          return ct.includes('json') ? res.json() : res.text()
        },
        catch: (err) => new DynamicRpcHandlerError({
          tag,
          message: `HTTP handler error: ${err instanceof Error ? err.message : String(err)}`,
          cause: err,
        }),
      })
    }

    case 'service':
      return Effect.fail(new DynamicRpcHandlerError({
        tag,
        message: `Service handler dispatch not yet implemented (serviceTag: ${handler.serviceTag})`,
      }))

    case 'llm':
      return Effect.fail(new DynamicRpcHandlerError({
        tag,
        message: 'LLM handler dispatch not yet implemented',
      }))

    case 'script':
      return Effect.fail(new DynamicRpcHandlerError({
        tag,
        message: 'Script handler dispatch reserved for Code Mode SDK (Tier 3)',
      }))
  }
}

// =============================================================================
// RPC Handlers Layer — @effect/rpc toLayer implementation
// =============================================================================

export const DynamicRpcHandlersLive = DynamicRpcGroup.toLayer({
  RegisterDynamicRpc: ({ definition }) =>
    Effect.withSpan(
      Effect.sync(() => {
        const r = reg()
        const current = r.get(rpcRegistryAtom)
        const next = new Map(current)
        next.set(definition.tag, {
          ...definition,
          registeredAt: definition.registeredAt ?? Date.now(),
        } as RpcDefinition)
        r.set(rpcRegistryAtom, next)
      }),
      'DynamicRpc.Register',
    ),

  UnregisterDynamicRpc: ({ tag }) =>
    Effect.withSpan(
      Effect.gen(function* () {
        const r = reg()
        const current = r.get(rpcRegistryAtom)
        if (!current.has(tag)) {
          return yield* new DynamicRpcNotFound({
            tag,
            message: `RPC '${tag}' not registered`,
          })
        }
        const next = new Map(current)
        next.delete(tag)
        r.set(rpcRegistryAtom, next)
      }),
      'DynamicRpc.Unregister',
    ),

  CallDynamicRpc: ({ tag, data }) =>
    Effect.withSpan(
      Effect.gen(function* () {
        const r = reg()
        const current = r.get(rpcRegistryAtom)
        const def = current.get(tag)
        if (!def) {
          return yield* new DynamicRpcNotFound({
            tag,
            message: `RPC '${tag}' not registered`,
          })
        }
        return yield* dispatchHandler(tag, def.handler, data)
      }),
      'DynamicRpc.Call',
    ),

  ListDynamicRpcs: () =>
    Effect.sync(() => Array.from(reg().get(rpcRegistryAtom).values())),

  GetDynamicRpc: ({ tag }) =>
    Effect.gen(function* () {
      const def = reg().get(rpcRegistryAtom).get(tag)
      if (!def) {
        return yield* new DynamicRpcNotFound({
          tag,
          message: `RPC '${tag}' not registered`,
        })
      }
      return def
    }),
})

// =============================================================================
// Convenience: call() for in-process use (interpreter bridge)
// =============================================================================

/**
 * Direct in-process call — bypasses RPC transport.
 * Used by the interpreter's callRpc action handler.
 *
 * Uses Effect.suspend for the sync lookup, then chains async dispatch.
 */
export function callDynamicRpc(
  tag: string,
  payload: unknown,
): Effect.Effect<unknown, DynamicRpcNotFound | DynamicRpcHandlerError> {
  return Effect.suspend(() => {
    const r = reg()
    const current = r.get(rpcRegistryAtom)
    const def = current.get(tag)
    if (!def) {
      return Effect.fail(new DynamicRpcNotFound({
        tag,
        message: `RPC '${tag}' not registered`,
      }))
    }
    return dispatchHandler(tag, def.handler, payload)
  })
}
