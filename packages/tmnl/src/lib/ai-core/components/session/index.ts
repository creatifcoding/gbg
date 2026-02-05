/**
 * Session Components
 *
 * UI components for chat session management.
 * Implements Variant C (Collapsible Hybrid) from the plan.
 */

export {
  SessionProvider,
  useSessionContext,
  type SessionProviderProps,
  type SessionContextValue,
} from './SessionProvider'

export {
  SessionSidebar,
  type SessionSidebarProps,
} from './SessionSidebar'

export {
  SessionHeader,
  type SessionHeaderProps,
} from './SessionHeader'

export {
  SessionSwitcher,
  type SessionSwitcherProps,
  type SessionSwitcherRootProps,
  type SessionSwitcherContentProps,
  type SessionSwitcherMainProps,
} from './SessionSwitcher'

export {
  SessionAwareChat,
  type SessionAwareChatProps,
  type SessionChatRenderProps,
} from './SessionAwareChat'
