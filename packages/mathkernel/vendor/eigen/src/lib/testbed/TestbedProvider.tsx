/**
 * TestbedProvider
 *
 * Context provider for the component testbed system.
 * Provides:
 * - Component registry (for tool targeting)
 * - Source registry access (from Vite plugin at virtual:component-sources)
 * - Design mode state (prop overrides, style overrides)
 * - Optional WebSocket connection to cursor server for real-time updates
 */

import * as React from 'react'
import type {
  TestbedContextValue,
  RegisteredComponent,
  DesignModeState,
} from './types'
import type { CSSProperties } from 'react'

// =============================================================================
// Context
// =============================================================================

const TestbedContext = React.createContext<TestbedContextValue | null>(null)

// =============================================================================
// Hook: useTestbed
// =============================================================================

/**
 * Access the testbed context
 * @throws if used outside of TestbedProvider
 */
export function useTestbed(): TestbedContextValue {
  const ctx = React.useContext(TestbedContext)
  if (ctx === null) {
    throw new Error('useTestbed must be used within a TestbedProvider')
  }
  return ctx
}

/**
 * Access the testbed context (nullable)
 * Returns null if not within a TestbedProvider
 */
export function useTestbedOptional(): TestbedContextValue | null {
  return React.useContext(TestbedContext)
}

// =============================================================================
// WebSocket Connection Types
// =============================================================================

interface WebSocketMessage {
  type: 'style_override' | 'prop_override' | 'clear_overrides' | 'select_component'
  componentId: string
  payload?: unknown
}

interface WebSocketConfig {
  url: string
  reconnectInterval?: number
  maxRetries?: number
}

// =============================================================================
// Provider Props
// =============================================================================

export interface TestbedProviderProps {
  children: React.ReactNode
  /**
   * WebSocket configuration for cursor server connection
   * If not provided, WebSocket connection is disabled
   */
  webSocket?: WebSocketConfig
  /**
   * Initial design mode state
   * @default false
   */
  initialDesignMode?: boolean
}

// =============================================================================
// TestbedProvider Component
// =============================================================================

export function TestbedProvider({
  children,
  webSocket,
  initialDesignMode = false,
}: TestbedProviderProps) {
  // ---------------------------------------------------------------------------
  // Component Registry State
  // ---------------------------------------------------------------------------
  const [components, setComponents] = React.useState<Map<string, RegisteredComponent>>(
    () => new Map()
  )

  // ---------------------------------------------------------------------------
  // Design Mode State
  // ---------------------------------------------------------------------------
  const [designMode, setDesignMode] = React.useState<DesignModeState>(() => ({
    active: initialDesignMode,
    styleOverrides: new Map(),
    propOverrides: new Map(),
    selectedComponentId: null,
  }))

  // ---------------------------------------------------------------------------
  // WebSocket Connection
  // ---------------------------------------------------------------------------
  const wsRef = React.useRef<WebSocket | null>(null)
  const retryCountRef = React.useRef(0)

  const connectWebSocket = React.useCallback(() => {
    if (!webSocket) return

    const { url, maxRetries = 5 } = webSocket

    if (retryCountRef.current >= maxRetries) {
      console.warn('[TestbedProvider] Max WebSocket retries reached')
      return
    }

    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        console.log('[TestbedProvider] WebSocket connected')
        retryCountRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (e) {
          console.warn('[TestbedProvider] Invalid WebSocket message:', e)
        }
      }

      ws.onclose = () => {
        console.log('[TestbedProvider] WebSocket disconnected')
        wsRef.current = null

        // Attempt reconnect
        const { reconnectInterval = 3000 } = webSocket
        retryCountRef.current++
        setTimeout(connectWebSocket, reconnectInterval)
      }

      ws.onerror = (error) => {
        console.error('[TestbedProvider] WebSocket error:', error)
      }

      wsRef.current = ws
    } catch (e) {
      console.error('[TestbedProvider] WebSocket connection failed:', e)
    }
  }, [webSocket])

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = React.useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'style_override':
        if (message.payload && typeof message.payload === 'object') {
          setDesignMode((prev) => {
            const newStyleOverrides = new Map(prev.styleOverrides)
            newStyleOverrides.set(message.componentId, message.payload as CSSProperties)
            return { ...prev, styleOverrides: newStyleOverrides }
          })
        }
        break

      case 'prop_override':
        if (message.payload && typeof message.payload === 'object') {
          const { propName, value } = message.payload as { propName: string; value: unknown }
          setDesignMode((prev) => {
            const newPropOverrides = new Map(prev.propOverrides)
            newPropOverrides.set(`${message.componentId}:${propName}`, value)
            return { ...prev, propOverrides: newPropOverrides }
          })
        }
        break

      case 'clear_overrides':
        setDesignMode((prev) => {
          const newStyleOverrides = new Map(prev.styleOverrides)
          const newPropOverrides = new Map(prev.propOverrides)

          newStyleOverrides.delete(message.componentId)

          // Clear all prop overrides for this component
          for (const key of newPropOverrides.keys()) {
            if (key.startsWith(`${message.componentId}:`)) {
              newPropOverrides.delete(key)
            }
          }

          return {
            ...prev,
            styleOverrides: newStyleOverrides,
            propOverrides: newPropOverrides,
          }
        })
        break

      case 'select_component':
        setDesignMode((prev) => ({
          ...prev,
          selectedComponentId: message.componentId || null,
        }))
        break
    }
  }, [])

  // Connect WebSocket on mount
  React.useEffect(() => {
    if (webSocket) {
      connectWebSocket()
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connectWebSocket, webSocket])

  // ---------------------------------------------------------------------------
  // Context Actions
  // ---------------------------------------------------------------------------

  const registerComponent = React.useCallback((component: RegisteredComponent) => {
    setComponents((prev) => {
      const next = new Map(prev)
      next.set(component.id, component)
      return next
    })
  }, [])

  const unregisterComponent = React.useCallback((id: string) => {
    setComponents((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const setDesignModeActive = React.useCallback((active: boolean) => {
    setDesignMode((prev) => ({ ...prev, active }))
  }, [])

  const applyStyleOverride = React.useCallback(
    (componentId: string, styles: CSSProperties) => {
      setDesignMode((prev) => {
        const newStyleOverrides = new Map(prev.styleOverrides)
        const existing = newStyleOverrides.get(componentId) ?? {}
        newStyleOverrides.set(componentId, { ...existing, ...styles })
        return { ...prev, styleOverrides: newStyleOverrides }
      })

      // Send to WebSocket if connected
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'style_override',
            componentId,
            payload: styles,
          })
        )
      }
    },
    []
  )

  const applyPropOverride = React.useCallback(
    (componentId: string, propName: string, value: unknown) => {
      setDesignMode((prev) => {
        const newPropOverrides = new Map(prev.propOverrides)
        newPropOverrides.set(`${componentId}:${propName}`, value)
        return { ...prev, propOverrides: newPropOverrides }
      })

      // Send to WebSocket if connected
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'prop_override',
            componentId,
            payload: { propName, value },
          })
        )
      }
    },
    []
  )

  const clearOverrides = React.useCallback((componentId: string) => {
    setDesignMode((prev) => {
      const newStyleOverrides = new Map(prev.styleOverrides)
      const newPropOverrides = new Map(prev.propOverrides)

      newStyleOverrides.delete(componentId)

      // Clear all prop overrides for this component
      for (const key of newPropOverrides.keys()) {
        if (key.startsWith(`${componentId}:`)) {
          newPropOverrides.delete(key)
        }
      }

      return {
        ...prev,
        styleOverrides: newStyleOverrides,
        propOverrides: newPropOverrides,
      }
    })

    // Send to WebSocket if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'clear_overrides',
          componentId,
        })
      )
    }
  }, [])

  const clearAllOverrides = React.useCallback(() => {
    setDesignMode((prev) => ({
      ...prev,
      styleOverrides: new Map(),
      propOverrides: new Map(),
    }))
  }, [])

  const selectComponent = React.useCallback((componentId: string | null) => {
    setDesignMode((prev) => ({ ...prev, selectedComponentId: componentId }))

    // Send to WebSocket if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'select_component',
          componentId: componentId ?? '',
        })
      )
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Context Value
  // ---------------------------------------------------------------------------

  const contextValue = React.useMemo<TestbedContextValue>(
    () => ({
      components,
      registerComponent,
      unregisterComponent,
      designMode,
      setDesignModeActive,
      applyStyleOverride,
      applyPropOverride,
      clearOverrides,
      clearAllOverrides,
      selectComponent,
    }),
    [
      components,
      registerComponent,
      unregisterComponent,
      designMode,
      setDesignModeActive,
      applyStyleOverride,
      applyPropOverride,
      clearOverrides,
      clearAllOverrides,
      selectComponent,
    ]
  )

  return (
    <TestbedContext.Provider value={contextValue}>
      {children}
    </TestbedContext.Provider>
  )
}

export default TestbedProvider
