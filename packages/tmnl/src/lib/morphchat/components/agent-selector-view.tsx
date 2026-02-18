/**
 * Agent Selector View — Compound Component
 *
 * Maps spec.agentSelector axis → dropdown, tabs, or hidden.
 * Reads agent roster from adapter.agents$ and active agent from adapter.
 *
 * Dropdown mode: compound Root → Trigger → Menu → Option
 * Tabs mode: horizontal tab bar
 *
 * Animations (Emil Kowalski):
 * - Menu: opacity + translateY(4px), 200ms ease-out enter, 150ms exit
 * - Options: scale(0.97) on press
 * - Reduced motion: opacity-only fallback
 *
 * @module morphchat/components/agent-selector-view
 */

import * as React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import type { MockChatAdapter } from '../adapters/mock-adapter'
import type { AgentInfo } from '../schemas/message-types'

// =============================================================================
// Agent Selector View (topology resolver)
// =============================================================================

export function AgentSelectorView() {
  const { spec, adapter } = useMorphChatContext()
  const agents = useAtomValue(adapter.agents$)

  // Read active agent from mock adapter (duck-typed)
  const mockAdapter = adapter as Partial<MockChatAdapter>
  const activeAgentId = mockAdapter.activeAgentId$
    ? useAtomValue(mockAdapter.activeAgentId$)
    : agents[0]?.id

  const setActiveAgent = React.useCallback(
    (id: string) => {
      mockAdapter.setActiveAgent?.(id)
    },
    [mockAdapter],
  )

  if (spec.agentSelector === 'hidden' || agents.length === 0) return null

  if (spec.agentSelector === 'tabs') {
    return (
      <AgentTabs
        agents={agents}
        activeId={activeAgentId}
        onSelect={setActiveAgent}
      />
    )
  }

  // dropdown (default)
  return (
    <AgentDropdown
      agents={agents}
      activeId={activeAgentId}
      onSelect={setActiveAgent}
    />
  )
}

AgentSelectorView.displayName = 'MorphChat.AgentSelectorView'

// =============================================================================
// Tabs Mode
// =============================================================================

function AgentTabs({
  agents,
  activeId,
  onSelect,
}: {
  agents: ReadonlyArray<AgentInfo>
  activeId?: string
  onSelect: (id: string) => void
}) {
  return (
    <div
      data-slot="morphchat-agent-tabs"
      className="flex items-center gap-0.5"
      role="tablist"
      aria-label="Agent selector"
    >
      {agents.map((agent) => {
        const isActive = activeId === agent.id
        return (
          <button
            key={agent.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(agent.id)}
            className={cn(
              'relative px-2.5 py-1 rounded font-mono transition-colors duration-200',
              'active:scale-[0.97]',
              isActive
                ? 'text-cyan-400'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50',
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {isActive && (
              <motion.span
                layoutId="agent-tab-indicator"
                className="absolute inset-0 rounded bg-cyan-500/10 border border-cyan-800/50"
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              />
            )}
            <span className="relative z-10">{agent.name}</span>
          </button>
        )
      })}
    </div>
  )
}

// =============================================================================
// Dropdown Mode — Compound Component
// =============================================================================

function AgentDropdown({
  agents,
  activeId,
  onSelect,
}: {
  agents: ReadonlyArray<AgentInfo>
  activeId?: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const activeAgent = agents.find((a) => a.id === activeId) ?? agents[0]

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.stopPropagation()
        setOpen(false)
      }
    },
    [open],
  )

  return (
    <div
      ref={containerRef}
      data-slot="morphchat-agent-dropdown"
      className="relative"
      onKeyDown={handleKeyDown}
    >
      {/* ── Trigger ──────────────────────────────────── */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded',
          'font-mono border transition-all duration-200',
          'active:scale-[0.97]',
          open
            ? 'border-cyan-800 text-cyan-400 bg-cyan-500/5'
            : 'border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <Bot size={12} strokeWidth={1.5} className="shrink-0" />
        <span className="truncate max-w-[120px]">{activeAgent?.name ?? 'Select'}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="shrink-0 text-neutral-600"
        >
          <ChevronDown size={12} strokeWidth={1.5} />
        </motion.span>
      </button>

      {/* ── Menu ─────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            role="listbox"
            aria-label="Available agents"
            className={cn(
              'absolute top-full left-0 mt-1 z-50 min-w-[180px]',
              'rounded border border-neutral-800 bg-neutral-950',
              'shadow-lg shadow-black/40',
              'py-1 overflow-hidden',
            )}
          >
            {agents.map((agent) => {
              const isSelected = agent.id === activeId
              return (
                <button
                  key={agent.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(agent.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-1.5 text-left',
                    'font-mono transition-colors duration-150',
                    'active:scale-[0.97]',
                    isSelected
                      ? 'text-cyan-400 bg-cyan-500/5'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50',
                  )}
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      agent.status === 'online' ? 'bg-emerald-400' : 'bg-neutral-600',
                    )}
                  />
                  <span className="truncate flex-1">{agent.name}</span>
                  {agent.role && (
                    <span className="text-neutral-700 shrink-0">{agent.role}</span>
                  )}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
