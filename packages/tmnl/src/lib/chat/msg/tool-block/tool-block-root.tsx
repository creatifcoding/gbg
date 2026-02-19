/**
 * ChatToolBlock.Root — Compound root with collapsible details.
 *
 * Manages open/close state, provides context for sub-components.
 * Auto-collapses completed tools on mount, auto-expands running tools.
 *
 * @module chat/msg/tool-block
 */

import {
  forwardRef,
  memo,
  useCallback,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import type { ToolInvocationState } from '@/lib/morphchat/schemas/message-types'
import { ChatToolBlockContext, type ChatToolBlockContextValue } from './tool-block-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatToolBlockRootProps extends ComponentPropsWithoutRef<'div'> {
  /** Unique tool call ID */
  toolCallId: string
  /** Tool name */
  toolName: string
  /** Current lifecycle state */
  state: ToolInvocationState
  /** Input parameters (JSON) */
  input?: unknown
  /** Output result (JSON) */
  output?: unknown
  /** Error message */
  errorText?: string
  /** Controlled open state */
  open?: boolean
  /** Default open state. Defaults: expanded for running/error, collapsed for completed. */
  defaultOpen?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}

// =============================================================================
// Auto-open heuristic
// =============================================================================

function shouldAutoOpen(state: ToolInvocationState): boolean {
  return state === 'running' || state === 'error' || state === 'approval-required'
}

// =============================================================================
// Component
// =============================================================================

export const ChatToolBlockRoot = memo(forwardRef<HTMLDivElement, ChatToolBlockRootProps>(
  (
    {
      toolCallId,
      toolName,
      state,
      input,
      output,
      errorText,
      open: controlledOpen,
      defaultOpen,
      onOpenChange,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const resolvedDefault = defaultOpen ?? shouldAutoOpen(state)
    const [internalOpen, setInternalOpen] = useState(resolvedDefault)
    const isOpen = controlledOpen ?? internalOpen
    const setIsOpen = useCallback((next: boolean) => {
      setInternalOpen(next)
      onOpenChange?.(next)
    }, [onOpenChange])

    const hasDetails = input != null || output != null || errorText != null

    const ctx: ChatToolBlockContextValue = {
      toolCallId,
      toolName,
      state,
      input,
      output,
      errorText,
      isOpen,
      setIsOpen,
      hasDetails,
    }

    // State-dependent border color
    const borderColor =
      state === 'error' ? 'border-red-500/20' :
      state === 'running' ? 'border-cyan-500/20' :
      state === 'approval-required' ? 'border-amber-500/20' :
      state === 'completed' ? 'border-neutral-800' :
      'border-neutral-800'

    return (
      <ChatToolBlockContext.Provider value={ctx}>
        <div
          ref={ref}
          data-slot="tmnl-chat-tool-block"
          data-state={isOpen ? 'open' : 'closed'}
          data-tool-state={state}
          className={cn(
            'rounded border my-1.5 transition-colors duration-200',
            'bg-neutral-950/50',
            borderColor,
            'hover:bg-neutral-900/30',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </ChatToolBlockContext.Provider>
    )
  },
))

ChatToolBlockRoot.displayName = 'ChatToolBlock.Root'
