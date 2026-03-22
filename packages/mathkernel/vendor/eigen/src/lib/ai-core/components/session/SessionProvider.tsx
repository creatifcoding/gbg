/**
 * SessionProvider Component
 *
 * Context provider for session management. Combines AICoreRegistryProvider
 * with session initialization logic.
 *
 * @example
 * ```tsx
 * <SessionProvider>
 *   <SessionSwitcher />
 *   <ChatArea />
 * </SessionProvider>
 * ```
 */

import { type ReactNode, useEffect, createContext, useContext, useMemo } from 'react'
import { AICoreRegistryProvider } from '../../atoms'
import { useAiCoreChatSession, type UseAiCoreChatSessionResult } from '../../hooks/useAiCoreChatSession'
import { useAiCoreChatSessions, type UseAiCoreChatSessionsResult } from '../../hooks/useAiCoreChatSessions'

// =============================================================================
// Context Types
// =============================================================================

export interface SessionContextValue {
  /** Single session operations */
  session: UseAiCoreChatSessionResult
  /** Session list operations */
  sessions: UseAiCoreChatSessionsResult
}

// =============================================================================
// Context
// =============================================================================

const SessionContext = createContext<SessionContextValue | null>(null)

// =============================================================================
// Hook
// =============================================================================

/**
 * Access session context
 * @throws If used outside SessionProvider
 */
export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSessionContext must be used within a SessionProvider')
  }
  return ctx
}

// =============================================================================
// Props
// =============================================================================

export interface SessionProviderProps {
  /** Child components */
  children: ReactNode
  /** Auto-create session if none exists */
  autoCreateSession?: boolean
  /** Default system prompt for new sessions */
  defaultSystemPrompt?: string
  /** Default model for new sessions */
  defaultModel?: string
}

// =============================================================================
// Component
// =============================================================================

/**
 * Internal provider that uses hooks (must be inside AICoreRegistryProvider)
 */
function SessionProviderInner({
  children,
  autoCreateSession = true,
  defaultSystemPrompt,
  defaultModel,
}: SessionProviderProps) {
  const session = useAiCoreChatSession()
  const sessions = useAiCoreChatSessions()

  // Auto-create session if none exists and autoCreate is enabled
  useEffect(() => {
    if (autoCreateSession && sessions.sessions.length === 0 && !session.session) {
      // Small delay to ensure storage has loaded
      const timer = setTimeout(() => {
        if (!session.session) {
          sessions.createNew({
            systemPrompt: defaultSystemPrompt,
            model: defaultModel,
          })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoCreateSession, sessions.sessions.length, session.session, defaultSystemPrompt, defaultModel, sessions])

  const value = useMemo(
    () => ({ session, sessions }),
    [session, sessions]
  )

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

/**
 * Session management provider
 *
 * Wraps children with:
 * - AICoreRegistryProvider for atom state
 * - SessionContext for session operations
 *
 * Features:
 * - Auto-loads sessions from storage on mount
 * - Auto-creates initial session if none exists
 * - Provides session hooks via context
 */
export function SessionProvider(props: SessionProviderProps) {
  return (
    <AICoreRegistryProvider>
      <SessionProviderInner {...props} />
    </AICoreRegistryProvider>
  )
}

// =============================================================================
// Compound Export
// =============================================================================

SessionProvider.displayName = 'SessionProvider'
