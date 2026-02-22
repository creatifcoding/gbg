/**
 * ChatToolBlock.Header — Clickable trigger with inline tool metadata.
 *
 * When collapsed: shows tool name + state badge + contextual metadata
 * from the renderer's registered HeaderMeta component.
 *
 * When expanded: metadata slides out (the renderer shows the full version).
 *
 * Header metas are registered per-tool via registerToolHeaderMeta().
 * Each tool decides what to surface — file path, command, pattern, etc.
 *
 * @module chat/msg/tool-block
 */

import { forwardRef, memo, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import {
  WrenchIcon,
  CheckCircleIcon,
  CircleIcon,
  XCircleIcon,
  ShieldAlertIcon,
  ChevronDownIcon,
} from 'lucide-react'
import type { ToolInvocationState } from '@/lib/morphchat/schemas/message-types'
import { useChatToolBlock } from './tool-block-context'
import { useToolRenderer } from './renderers/registry'

// =============================================================================
// State config
// =============================================================================

const STATE_CONFIG: Record<ToolInvocationState, {
  icon: typeof WrenchIcon | null
  label: string
  color: string
}> = {
  pending:              { icon: CircleIcon,       label: 'Pending',    color: 'text-neutral-500' },
  running:              { icon: null,             label: 'Running',    color: 'text-cyan-400' },
  'approval-required':  { icon: ShieldAlertIcon,  label: 'Approval',   color: 'text-amber-400' },
  approved:             { icon: CheckCircleIcon,  label: 'Approved',   color: 'text-blue-400' },
  completed:            { icon: CheckCircleIcon,  label: 'Done',       color: 'text-emerald-400' },
  error:                { icon: XCircleIcon,      label: 'Error',      color: 'text-red-400' },
  denied:               { icon: XCircleIcon,      label: 'Denied',     color: 'text-orange-400' },
}

/** Live pulsing dot for running state */
function LiveDot() {
  return (
    <span className="relative flex size-2.5 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
      <span className="relative inline-flex size-2.5 rounded-full bg-cyan-400" />
    </span>
  )
}

// ── Motion ────────────────────────────────────────────────

const META_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]

// =============================================================================
// Props
// =============================================================================

export interface ChatToolBlockHeaderProps extends ComponentPropsWithoutRef<'button'> {
  /** Override tool name display */
  title?: string
  /** Custom status badge renderer */
  renderBadge?: (state: ToolInvocationState) => ReactNode
}

// =============================================================================
// Component
// =============================================================================

export const ChatToolBlockHeader = memo(forwardRef<HTMLButtonElement, ChatToolBlockHeaderProps>(
  ({ title, renderBadge, className, children, ...props }, ref) => {
    const { toolCallId, toolName, state, input, output, errorText, isOpen, setIsOpen, hasDetails } = useChatToolBlock()
    const config = STATE_CONFIG[state]
    const StateIcon = config.icon

    // Reactive lookup — re-renders when extensions register new renderers
    const entry = useToolRenderer(toolName)
    const HeaderMeta = entry?.headerMeta ?? null

    return (
      <button
        ref={ref}
        type="button"
        data-slot="tmnl-chat-tool-header"
        onClick={() => hasDetails && setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-1.5',
          'text-left font-mono transition-colors duration-150',
          hasDetails && 'cursor-pointer hover:bg-neutral-900/50',
          !hasDetails && 'cursor-default',
          className,
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        aria-expanded={hasDetails ? isOpen : undefined}
        disabled={!hasDetails}
        {...props}
      >
        {children ?? (
          <>
            {/* ── Left: icon · name · state ── */}
            <div className="flex items-center gap-2 shrink-0">
              <WrenchIcon className="size-3.5 text-neutral-600 shrink-0" />
              <span className="text-neutral-400">
                {title ?? toolName}
              </span>
              {renderBadge ? renderBadge(state) : (
                <span className={cn('flex items-center gap-1.5 shrink-0', config.color)}>
                  {state === 'running' ? (
                    <LiveDot />
                  ) : StateIcon ? (
                    <StateIcon className="size-3" />
                  ) : null}
                  <span className={config.color}>{config.label}</span>
                </span>
              )}
            </div>

            {/* ── Center: contextual metadata from renderer — visible when collapsed ── */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <AnimatePresence initial={false}>
                {!isOpen && HeaderMeta && (
                  <motion.div
                    key="header-meta"
                    initial={{ opacity: 0, x: -6, filter: 'blur(4px)' }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      filter: 'blur(0px)',
                      transition: { duration: 0.2, ease: META_EASE, delay: 0.06 },
                    }}
                    exit={{
                      opacity: 0,
                      x: 6,
                      filter: 'blur(4px)',
                      transition: { duration: 0.12, ease: 'easeIn' },
                    }}
                    className="truncate"
                  >
                    <HeaderMeta
                      input={input}
                      output={output}
                      errorText={errorText}
                      state={state}
                      toolCallId={toolCallId}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Right: chevron ── */}
            {hasDetails && (
              <ChevronDownIcon
                className={cn(
                  'size-3 text-neutral-600 shrink-0 transition-transform duration-200',
                  isOpen && 'rotate-180',
                )}
              />
            )}
          </>
        )}
      </button>
    )
  },
))

ChatToolBlockHeader.displayName = 'ChatToolBlock.Header'
