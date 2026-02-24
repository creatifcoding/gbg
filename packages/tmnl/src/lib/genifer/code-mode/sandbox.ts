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

import { Effect, Schema } from 'effect'
import type { GeniferCodeSDK, ExposeSpec } from './schemas'
import { CodeModeSandboxError, CodeModeTimeoutError } from './schemas'
import type { GeointHarnessServiceShape } from '@/lib/geoint/harness'
import { SearchResultItem } from '@/lib/geoint/schemas/search'
import type { SearchResultItem as SearchResultItemValue } from '@/lib/geoint/schemas/search'
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
import {
  surfaceGet,
  surfaceListElements,
  surfaceGetElement,
  surfaceUpdateElement,
  surfaceAddElement,
  surfaceRemoveElement,
  resetSurfaceBridge,
} from './surface-bridge'

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
// Shared Atom Store (effect-atom Registry-backed)
// =============================================================================

import {
  setCodeModeAtom,
  getCodeModeAtom,
  subscribeCodeModeAtom,
  resetSharedAtomStore,
} from './shared-atoms'

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

export interface CreateCodeSDKOptions {
  readonly geointService?: GeointHarnessServiceShape
}

const decodeSearchResult = Schema.decodeUnknownSync(SearchResultItem)
const decodeSearchResultArray = Schema.decodeUnknownSync(Schema.Array(SearchResultItem))

const inBounds = (
  item: { position: { longitude: number; latitude: number } },
  bounds: { west: number; east: number; south: number; north: number },
) =>
  item.position.longitude >= bounds.west &&
  item.position.longitude <= bounds.east &&
  item.position.latitude >= bounds.south &&
  item.position.latitude <= bounds.north

const normalizeSearchResult = (input: unknown): SearchResultItemValue => {
  try {
    return decodeSearchResult(input) as SearchResultItemValue
  } catch {
    return input as SearchResultItemValue
  }
}

const normalizeSearchResults = (input: ReadonlyArray<unknown>): ReadonlyArray<SearchResultItemValue> => {
  try {
    return decodeSearchResultArray(input) as ReadonlyArray<SearchResultItemValue>
  } catch {
    return input.map((item) => normalizeSearchResult(item))
  }
}

// =============================================================================
// SDK Factory
// =============================================================================

/**
 * Creates a GeniferCodeSDK instance for sandbox execution.
 * All operations are audited and sandboxed.
 */
export function createCodeSDK(options: CreateCodeSDKOptions = {}): GeniferCodeSDK {
  const geointService = options.geointService

  const withGeoint = async <A>(
    operation: string,
    f: (service: GeointHarnessServiceShape) => Promise<A>,
  ): Promise<A> => {
    if (!geointService) {
      throw new Error(`sdk.geoint.${operation} unavailable: GeointHarnessService was not provided`)
    }
    return f(geointService)
  }

  const sdk: GeniferCodeSDK = {
    // --- Atoms (backed by shared effect-atom Registry) ---
    atoms: {
      get: <T>(key: string): T | undefined => {
        audit('atoms.get', key)
        return getCodeModeAtom<T>(key)
      },
      set: <T>(key: string, value: T): void => {
        audit('atoms.set', `${key} = ${JSON.stringify(value)?.slice(0, 100)}`)
        setCodeModeAtom(key, value)
      },
      subscribe: <T>(key: string, fn: (value: T) => void): (() => void) => {
        audit('atoms.subscribe', key)
        return subscribeCodeModeAtom<T>(key, fn)
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

    // --- Surface Manipulation ---
    surface: {
      get: (surfaceId) => {
        audit('surface.get', surfaceId)
        return surfaceGet(surfaceId)
      },
      listElements: (surfaceId) => {
        audit('surface.listElements', surfaceId)
        return surfaceListElements(surfaceId)
      },
      getElement: (surfaceId, elementKey) => {
        audit('surface.getElement', `${surfaceId}/${elementKey}`)
        return surfaceGetElement(surfaceId, elementKey)
      },
      updateElement: (surfaceId, elementKey, props) => {
        audit('surface.updateElement', `${surfaceId}/${elementKey} ${JSON.stringify(props)?.slice(0, 100)}`)
        surfaceUpdateElement(surfaceId, elementKey, props)
      },
      addElement: (surfaceId, parentKey, element) => {
        audit('surface.addElement', `${surfaceId}/${parentKey} → ${element.key}`)
        surfaceAddElement(surfaceId, parentKey, element)
      },
      removeElement: (surfaceId, elementKey) => {
        audit('surface.removeElement', `${surfaceId}/${elementKey}`)
        surfaceRemoveElement(surfaceId, elementKey)
      },
    },

    // --- GEOINT ---
    geoint: {
      spawn: {
        one: async (result) => withGeoint('spawn.one', async (service) => {
          audit('geoint.spawn.one', 'spawn from SearchResultItem')
          const decoded = normalizeSearchResult(result)
          const stx = await Effect.runPromise(service.spawnFromSearchResult(decoded))
          return Effect.runPromise(service.getSummary(stx.data.entityId.get()))
        }),
        batch: async (results) => withGeoint('spawn.batch', async (service) => {
          audit('geoint.spawn.batch', `spawn batch size=${results.length}`)
          const decoded = normalizeSearchResults(results)
          const spawned = await Effect.runPromise(service.spawnBatchFromSearchResults(decoded))
          const summaries = await Promise.all(
            spawned.map((s) => Effect.runPromise(service.getSummary(s.data.entityId.get()))),
          )
          return summaries.filter(Boolean)
        }),
      },

      search: async (params) => withGeoint('search', async (service) => {
        const mode = params.mode ?? 'all'
        audit('geoint.search', mode)

        const all = (await Effect.runPromise(service.getAllSummaries())).filter(Boolean)
        let filtered = all

        if ((mode === 'type' || mode === 'type+bounds') && params.entityType) {
          filtered = filtered.filter((s) => s.entityType === params.entityType)
        }
        if ((mode === 'bounds' || mode === 'type+bounds') && params.bounds) {
          filtered = filtered.filter((s) => inBounds(s, params.bounds!))
        }

        const limit = params.limit ?? 200
        const items = filtered.slice(0, Math.max(1, Math.min(limit, 5000)))

        return {
          mode,
          count: items.length,
          entityIds: items.map((s) => s.entityId),
          items,
        }
      }),

      summary: async (params) => withGeoint('summary', async (service) => {
        const scope = params.scope ?? 'all'
        audit('geoint.summary', scope)

        let entities: ReadonlyArray<any>
        switch (scope) {
          case 'entity':
            entities = [await Effect.runPromise(service.getSummary(params.entityId ?? ''))]
            break
          case 'type': {
            const stx = await Effect.runPromise(service.getByType(params.entityType as any))
            entities = await Promise.all(stx.map((s) => Effect.runPromise(service.getSummary(s.data.entityId.get()))))
            break
          }
          case 'bounds': {
            const stx = await Effect.runPromise(service.getInBounds(params.bounds as any))
            entities = await Promise.all(stx.map((s) => Effect.runPromise(service.getSummary(s.data.entityId.get()))))
            break
          }
          case 'all':
          default:
            entities = await Effect.runPromise(service.getAllSummaries())
            break
        }

        const normalized = entities.filter(Boolean)
        const byType = normalized.reduce<Record<string, number>>((acc, item) => {
          acc[item.entityType] = (acc[item.entityType] ?? 0) + 1
          return acc
        }, {})

        const viewport = params.includeViewport
          ? await Effect.runPromise(service.getViewport())
          : undefined

        return {
          scope,
          total: normalized.length,
          byType,
          entities: normalized,
          ...(viewport ? { viewport } : {}),
        }
      }),

      select: async (entityId) => withGeoint('select', async (service) => {
        audit('geoint.select', entityId ?? 'null')
        await Effect.runPromise(service.select(entityId))
      }),

      focus: async (entityId, zoom) => withGeoint('focus', async (service) => {
        audit('geoint.focus', `${entityId} @ ${zoom ?? 'default'}`)
        return Effect.runPromise(service.focusEntity(entityId, zoom))
      }),

      clear: async () => withGeoint('clear', async (service) => {
        audit('geoint.clear', 'clear all entities')
        await Effect.runPromise(service.clear())
      }),

      viewport: {
        get: async () => withGeoint('viewport.get', async (service) => {
          audit('geoint.viewport.get', 'get')
          return Effect.runPromise(service.getViewport())
        }),
        set: async (viewport) => withGeoint('viewport.set', async (service) => {
          audit('geoint.viewport.set', JSON.stringify(viewport).slice(0, 120))
          return Effect.runPromise(service.setViewport(viewport as any))
        }),
        reset: async () => withGeoint('viewport.reset', async (service) => {
          audit('geoint.viewport.reset', 'reset')
          return Effect.runPromise(service.resetViewport())
        }),
      },
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
  resetSharedAtomStore()
  resetSurfaceBridge()
  dynamicTools.clear()
  dynamicComponents.clear()
  clearAuditLog()
}
