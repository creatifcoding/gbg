/**
 * Derived connection data — error message, label text, endpoint shortname.
 *
 * Extracts and formats display-ready values from raw ConnectionState.
 * Keeps the main component clean of parsing logic.
 *
 * @module connection-capsule/hooks/use-connection-data
 */

import * as React from 'react'
import type { ConnectionPhase } from '../../../schemas/message-types'
import { PHASE_LABEL } from '../phase-styles'

interface ConnectionDataInput {
  phase: ConnectionPhase
  error?: unknown
  reconnectAttempt?: number
  endpoint?: string
}

export interface ConnectionData {
  errorMessage: string | null
  labelText: string
  endpoint: string | null
}

export function useConnectionData(input: ConnectionDataInput): ConnectionData {
  const { phase, error, reconnectAttempt, endpoint: rawEndpoint } = input

  const errorMessage = React.useMemo(() => {
    if (phase !== 'error') return null
    if (typeof error === 'string') {
      const bracket = error.match(/^\s*\[([^\]]+)\]\s*(.*)$/)
      if (bracket) return `[${bracket[1]}]`
      return error.slice(0, 30)
    }
    if (error && typeof error === 'object' && typeof (error as any).code === 'string') {
      return `[${(error as any).code}]`
    }
    return '[error]'
  }, [phase, error])

  const labelText = React.useMemo(() => {
    if (phase === 'error' && errorMessage) return errorMessage
    if (phase === 'reconnecting' && reconnectAttempt) {
      return `reconnecting (${reconnectAttempt})…`
    }
    return PHASE_LABEL[phase]
  }, [phase, errorMessage, reconnectAttempt])

  const endpoint = React.useMemo(() => {
    if (!rawEndpoint) return null
    if (rawEndpoint.startsWith('harness:')) return 'harness'
    try { return new URL(rawEndpoint).hostname.replace('localhost', 'local') } catch { return rawEndpoint.slice(0, 12) }
  }, [rawEndpoint])

  return { errorMessage, labelText, endpoint }
}
