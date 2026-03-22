/**
 * useHarnessAdapter — React hook for per-instance harness sessions.
 *
 * Each instanceId gets fully isolated state (messages, connection, session)
 * while sharing one WebSocket transport (RuntimeAtom singleton).
 *
 * Depends on: atoms.ts, helpers.ts, operations.ts, persistence.ts
 *
 * @module morphchat/hooks/harness-adapter/hook
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAtom, useAtomValue } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { morphChatRegistry } from '../../atoms/registry'
import type { ChatMessage, ConnectionState } from '../../schemas/message-types'
import type { SendParams } from '../../schemas/message-types'
import type { MorphChatAdapter } from '../../schemas/adapter-types'

import {
  messages$, messageIds$, connection$, streaming$, agents$,
  metrics$, provider$, statusRows$, availableModels$, selectedModel$,
  modelOverride$, contextUsage$, lastError$, cancelledAt$,
  modelsLoading$, modelsError$, sessionId$,
  getMessageAtom, messageAtomMaps, setInstanceConfig,
} from './atoms'
import { hasMessageTopologyChanged } from './helpers'
import {
  connectOp$, sendOp$, cancelOp$, clearOp$, disposeOp$,
  fetchModelsOp$, newSessionOp$, resumeSessionOp$, hardReconnect,
} from './operations'
import { schedulePersist, hydrateContent } from './persistence'
import { pendingDisposeTimers } from './panel-replay'
import type {
  UseHarnessAdapterConfig,
  UseHarnessAdapterResult,
  HarnessAdapterStatus,
} from './types'

export function useHarnessAdapter(config: UseHarnessAdapterConfig): UseHarnessAdapterResult {
  const { instanceId, nodeId, role, agentName = 'Agent', autoConnect = true } = config

  // Bind per-instance fn-atom ops
  const [, doConnect] = useAtom(connectOp$(instanceId))
  const [, doSend] = useAtom(sendOp$(instanceId))
  const [, doCancel] = useAtom(cancelOp$(instanceId))
  const [, doClear] = useAtom(clearOp$(instanceId))
  const [, doDispose] = useAtom(disposeOp$(instanceId))
  const [, doFetchModels] = useAtom(fetchModelsOp$(instanceId))
  const [, doNewSession] = useAtom(newSessionOp$(instanceId))
  const [, doResumeSession] = useAtom(resumeSessionOp$(instanceId))

  // Pin session atom subscription so session identity remains stable across
  // transient registry/GC cycles while panel stays mounted.
  useAtomValue(sessionId$(instanceId))

  // Per-message atom sync: update topology atom only on add/remove/reorder,
  // while streaming content updates touch only the specific message atom.
  const previousMessageIdsRef = useRef<ReadonlyArray<string>>([])
  const previousMessagesByIdRef = useRef<Map<string, ChatMessage>>(new Map())
  useEffect(() => {
    const syncMessageAtoms = () => {
      const messages = morphChatRegistry.get(messages$(instanceId))
      const nextIds = messages.map((message) => message.id)

      if (hasMessageTopologyChanged(previousMessageIdsRef.current, nextIds)) {
        morphChatRegistry.set(messageIds$(instanceId), nextIds)

        const nextIdSet = new Set(nextIds)
        const atomMap = messageAtomMaps.get(instanceId)
        if (atomMap) {
          for (const [messageId, atom] of atomMap.entries()) {
            if (!nextIdSet.has(messageId)) {
              morphChatRegistry.set(atom, null)
              atomMap.delete(messageId)
            }
          }
        }

        previousMessageIdsRef.current = nextIds
      }

      const previousById = previousMessagesByIdRef.current
      const nextById = new Map<string, ChatMessage>()

      for (const message of messages) {
        nextById.set(message.id, message)
        if (previousById.get(message.id) !== message) {
          morphChatRegistry.set(getMessageAtom(instanceId, message.id), message)
        }
      }

      previousMessagesByIdRef.current = nextById
    }

    syncMessageAtoms()
    return morphChatRegistry.subscribe(messages$(instanceId), syncMessageAtoms)
  }, [instanceId])

  // ── Content persistence: debounced write-through on message changes ──
  useEffect(() => {
    hydrateContent(instanceId)

    return morphChatRegistry.subscribe(messages$(instanceId), () => {
      schedulePersist(instanceId)
    })
  }, [instanceId])

  // Connection status from per-instance atom
  const [status, setStatus] = useState<HarnessAdapterStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const check = () => {
      const conn = morphChatRegistry.get(connection$(instanceId))
      const phase = conn.phase ?? 'idle'
      setStatus(
        phase === 'connected' ? 'connected' :
        phase === 'connecting' || phase === 'reconnecting' ? 'connecting' :
        phase === 'error' ? 'error' : 'idle',
      )
      setError(conn?.error ?? null)
    }
    check()
    return morphChatRegistry.subscribe(connection$(instanceId), check)
  }, [instanceId])

  useEffect(() => {
    setInstanceConfig(instanceId, { nodeId, role, agentName })
  }, [instanceId, nodeId, role, agentName])

  // Auto-connect with backoff
  const reconnectAttempts = useRef(0)
  useEffect(() => {
    if (!autoConnect) return
    if (status === 'connected' || status === 'connecting') return

    if (status === 'error') {
      const delay = Math.min(1500 * Math.pow(2, reconnectAttempts.current), 15000)
      reconnectAttempts.current++
      const timer = setTimeout(() => hardReconnect(instanceId, nodeId, role, agentName, doConnect), delay)
      return () => clearTimeout(timer)
    }

    reconnectAttempts.current = 0
    doConnect({ nodeId, role, agentName })
  }, [autoConnect, status, nodeId, role, agentName, instanceId, doConnect])

  useEffect(() => { if (status === 'connected') reconnectAttempts.current = 0 }, [status])

  // Fetch models once connected
  const hasFetchedModels = useRef(false)
  useEffect(() => {
    if (status === 'connected' && !hasFetchedModels.current) {
      hasFetchedModels.current = true
      doFetchModels(undefined as void)
    }
  }, [status, doFetchModels])

  // Dispose on unmount (debounced)
  useEffect(() => {
    const pending = pendingDisposeTimers.get(instanceId)
    if (pending) {
      clearTimeout(pending)
      pendingDisposeTimers.delete(instanceId)
    }

    return () => {
      const timer = setTimeout(() => {
        pendingDisposeTimers.delete(instanceId)
        doDispose(undefined as void)
      }, 1500)
      pendingDisposeTimers.set(instanceId, timer)
    }
  }, [instanceId, doDispose])

  // Stable refs for adapter
  const sendRef = useRef(doSend); sendRef.current = doSend
  const cancelRef = useRef(doCancel); cancelRef.current = doCancel
  const connectRef = useRef(doConnect); connectRef.current = doConnect
  const clearRef = useRef(doClear); clearRef.current = doClear
  const newSessionRef = useRef(doNewSession); newSessionRef.current = doNewSession
  const resumeSessionRef = useRef(doResumeSession); resumeSessionRef.current = doResumeSession

  // Build adapter — per-instance atoms
  const adapter = useMemo<MorphChatAdapter>(() => ({
    adapterId: `harness-${instanceId}`,
    label: `Harness (${instanceId})`,
    messages$: messages$(instanceId),
    messageIds$: messageIds$(instanceId),
    messageAtom: (messageId: string) => getMessageAtom(instanceId, messageId),
    getMessageAtom: (messageId: string) => getMessageAtom(instanceId, messageId),
    connection$: connection$(instanceId),
    streaming$: streaming$(instanceId),
    agents$: agents$(instanceId),
    metrics$: metrics$(instanceId),
    provider$: provider$(instanceId),
    statusRows$: statusRows$(instanceId),
    availableModels$: availableModels$(instanceId),
    selectedModel$: selectedModel$(instanceId),
    selectModel: (modelId: string) => {
      const models = morphChatRegistry.get(availableModels$(instanceId))
      const target = models.find((m) => m.id === modelId)
      if (!target) return
      const rawModelId = target.modelId ?? (target.id.includes(':') ? target.id.slice(target.id.indexOf(':') + 1) : target.id)
      morphChatRegistry.set(selectedModel$(instanceId), modelId)
      morphChatRegistry.set(modelOverride$(instanceId), { provider: target.provider, modelId: rawModelId })
    },
    contextUsage$: contextUsage$(instanceId),
    lastError$: lastError$(instanceId),
    cancelledAt$: cancelledAt$(instanceId),
    modelsLoading$: modelsLoading$(instanceId),
    modelsError$: modelsError$(instanceId),
    sessionId$: sessionId$(instanceId),
    send: (params: SendParams) => { sendRef.current({ content: params.content, thinkingLevel: params.thinkingLevel }); return Effect.void },
    cancel: () => { cancelRef.current(undefined as void); return Effect.void },
    reconnect: () => { hardReconnect(instanceId, nodeId, role, agentName, connectRef.current); return Effect.void },
    clear: () => { clearRef.current(undefined as void); return Effect.void },
    dispose: () => { /* handled by unmount effect */ return Effect.void },
  }), [instanceId, nodeId, role, agentName])

  return {
    adapter,
    status,
    error,
    connect: doConnect,
    newSession: () => newSessionRef.current({ nodeId, role, agentName }),
    resumeSession: (sessionId: string) => resumeSessionRef.current({ sessionId }),
    hardReconnect: () => hardReconnect(instanceId, nodeId, role, agentName, connectRef.current),
  }
}
