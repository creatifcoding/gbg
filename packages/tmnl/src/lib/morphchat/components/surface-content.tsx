/**
 * MorphChat Surface Content — Topology Resolver
 *
 * Reads the active spec and renders the appropriate component tree.
 * This is NOT prop drilling — it's spec-driven composition.
 *
 * The topology resolver selects from src/lib/chat/ building blocks
 * based on each feature axis value. MorphChat orchestrates; chat/ implements.
 *
 * Transfer wiring:
 *   - Drag: InlineTasksFull passes enableTransfer to InlineTaskShellRoot
 *     which internally calls useInlineTaskTransfer (v2).
 *   - Drop: ComposerView uses useTransferDroppable (v2) directly on
 *     the composer container when spec.enableTransferDrop is true.
 *   No wrapping scope needed — each component manages its own side.
 *
 * @module morphchat/components/surface-content
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { ComposerView } from './composer-view'
import { ThreadView } from './thread-view'
import { InlineTasksView } from './inline-tasks-view'
import { FrameChromeView } from './frame-chrome-view'
import { ConnectionView } from './connection-view'
import { AgentSelectorView } from './agent-selector-view'
import { StatusBannerView } from './status-banner-view'
import { CommandBandView } from './command-band-view'

// =============================================================================
// Surface Content
// =============================================================================

export interface SurfaceContentProps {
  children?: React.ReactNode
  className?: string
}

/**
 * Topology resolver — maps spec axes to rendered component tree.
 *
 * Layout bands (top → bottom):
 * 1. Frame chrome (full/minimal/none)
 * 2. Header: connection badge + agent selector
 * 3. Thread: message list (with integrated tail controls)
 * 4. Inline tasks (between thread + composer)
 * 5. Composer: input area (with transfer drop zone)
 */
export function SurfaceContent({ children, className }: SurfaceContentProps) {
  const { spec, adapter } = useMorphChatContext()

  // Keyboard shortcuts scoped by spec.keyboardShortcuts axis
  const onKeyDown = useKeyboardShortcuts({
    scope: spec.keyboardShortcuts,
    adapter,
  })

  // Layout constraints from spec
  const constraintStyle = React.useMemo(() => ({
    maxHeight: spec.maxHeight ? `${spec.maxHeight}px` : undefined,
    maxWidth: spec.maxWidth ? `${spec.maxWidth}px` : undefined,
    minHeight: spec.minHeight ? `${spec.minHeight}px` : undefined,
  }), [spec.maxHeight, spec.maxWidth, spec.minHeight])

  return (
    <div
      className={cn(
        'morphchat-surface relative flex flex-col',
        'bg-black text-neutral-200',
        'overflow-hidden',
        className,
      )}
      style={constraintStyle}
      data-morphchat-spec={spec._tag}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      {/* ── Frame Chrome ──────────────────────────────── */}
      {spec.frameChrome !== 'none' && (
        <FrameChromeView />
      )}

      {/* ── Header Band (connection + agent selector) ── */}
      {(spec.connectionStatus !== 'hidden' || spec.agentSelector !== 'hidden') && (
        <div className="morphchat-header flex items-center gap-2 px-3 py-1.5 border-b border-neutral-800/50">
          {spec.connectionStatus !== 'hidden' && <ConnectionView />}
          <div className="flex-1" />
          {spec.agentSelector !== 'hidden' && <AgentSelectorView />}
        </div>
      )}

      {/* ── Status Banners (interruption banners above thread) ───── */}
      <StatusBannerView />

      {/* ── Thread Band (includes tail controls via renderAfterScroll) ── */}
      {spec.thread !== 'none' && (
        <div className="morphchat-thread flex-1 min-h-0 flex flex-col overflow-hidden">
          <ThreadView />
        </div>
      )}

      {/* ── Inline Tasks (between thread + composer) ──── */}
      {spec.inlineTasks !== 'hidden' && (
        <InlineTasksView />
      )}

      {/* ── Command Band (slash command chips) ─────────── */}
      <CommandBandView />

      {/* ── Composer Band (with transfer drop zone) ───── */}
      {spec.composer !== 'none' && (
        <div className="morphchat-composer border-t border-neutral-800/50">
          <ComposerView />
        </div>
      )}

      {/* ── Slot overrides from consumer ──────────────── */}
      {children}
    </div>
  )
}

SurfaceContent.displayName = 'MorphChat.SurfaceContent'
