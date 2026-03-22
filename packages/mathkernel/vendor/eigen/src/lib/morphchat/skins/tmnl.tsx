/**
 * TMNL Default Skin
 *
 * Pure-black spectrum, hairline borders, neutral grays,
 * backdrop-blur, cyan accents. The canonical MorphChat appearance.
 *
 * @module morphchat/skins/tmnl
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import type {
  MorphChatSkin,
  ShellSlotProps,
  MessageSlotProps,
  ComposerSlotProps,
  HeaderSlotProps,
  BadgeSlotProps,
  ThreadSlotProps,
  EmptyStateSlotProps,
} from '../schemas/skin-types'

// =============================================================================
// Slot Implementations
// =============================================================================

function TmnlShell({ frameChrome, isFocused, label, children, className }: ShellSlotProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col bg-black text-neutral-200',
        frameChrome === 'full' && 'border border-neutral-800/50 rounded-lg',
        frameChrome === 'minimal' && 'border border-neutral-800/30 rounded',
        isFocused && 'ring-1 ring-cyan-900/30',
        className,
      )}
      data-skin="tmnl"
      data-label={label}
    >
      {children}
    </div>
  )
}

function TmnlMessageBubble({ role, status, isStreaming, isLatest, children, className }: MessageSlotProps) {
  return (
    <div
      className={cn(
        'px-4 py-2',
        role === 'operator' && 'bg-neutral-900/30',
        role === 'agent' && 'bg-transparent',
        role === 'system' && 'bg-amber-500/5 border-l-2 border-amber-500/20',
        role === 'tool' && 'bg-violet-500/5 border-l-2 border-violet-500/20',
        isStreaming && 'opacity-90',
        className,
      )}
    >
      {children}
    </div>
  )
}

function TmnlComposerFrame({ variant, isFocused, isStreaming, children, className }: ComposerSlotProps) {
  return (
    <div
      className={cn(
        'border-t border-neutral-800/50 bg-neutral-950/50',
        isFocused && 'border-t-cyan-900/30',
        isStreaming && 'opacity-80',
        className,
      )}
    >
      {children}
    </div>
  )
}

function TmnlHeaderBar({ label, connectionPhase, onMorphRequest, children, className }: HeaderSlotProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 border-b border-neutral-800/50',
        className,
      )}
    >
      <span
        className="text-neutral-500 font-mono tracking-wider uppercase"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {label}
      </span>
      <div className="flex-1" />
      {children}
    </div>
  )
}

function TmnlBadge({ variant, tone, animated, children, className }: BadgeSlotProps) {
  const toneColors: Record<string, string> = {
    neutral: 'text-neutral-500 bg-neutral-800/30',
    info: 'text-cyan-400 bg-cyan-500/10',
    success: 'text-emerald-400 bg-emerald-500/10',
    warning: 'text-amber-400 bg-amber-500/10',
    error: 'text-red-400 bg-red-500/10',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono',
        toneColors[tone] ?? toneColors.neutral,
        animated && 'animate-pulse',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {children}
    </span>
  )
}

function TmnlThreadContainer({ isAutoScrolling, isStreaming, children, className }: ThreadSlotProps) {
  return (
    <div className={cn('flex-1 min-h-0 overflow-y-auto', className)}>
      {children}
    </div>
  )
}

function TmnlEmptyState({ label, isConnected, className }: EmptyStateSlotProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full gap-3 text-neutral-600',
        className,
      )}
    >
      <div
        className="font-mono tracking-wider uppercase"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {label}
      </div>
      <div style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        {isConnected ? 'No messages yet' : 'Disconnected'}
      </div>
    </div>
  )
}

// =============================================================================
// Skin Export
// =============================================================================

export const tmnlChatSkin: MorphChatSkin = {
  Shell: TmnlShell,
  MessageBubble: TmnlMessageBubble,
  ComposerFrame: TmnlComposerFrame,
  HeaderBar: TmnlHeaderBar,
  Badge: TmnlBadge,
  ThreadContainer: TmnlThreadContainer,
  EmptyState: TmnlEmptyState,
}
