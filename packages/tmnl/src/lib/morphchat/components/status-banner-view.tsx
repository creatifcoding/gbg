/**
 * Status Banner View — Interruption Banners
 *
 * Reads adapter.statusRows$ and renders tone-driven banners
 * (info/warn/error) at the top of the thread area.
 *
 * Animations: opacity + translateY enter/exit, 200ms ease-out.
 * Reduced motion: opacity-only fallback.
 *
 * @module morphchat/components/status-banner-view
 */

import * as React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import type { MockChatAdapter, MockStatusRow } from '../adapters/mock-adapter'

// =============================================================================
// Tone Styling
// =============================================================================

const TONE_STYLES: Record<MockStatusRow['tone'], {
  container: string
  icon: string
  IconComponent: typeof Info
}> = {
  info: {
    container: 'border-neutral-800/50 text-neutral-400',
    icon: 'text-neutral-500',
    IconComponent: Info,
  },
  warn: {
    container: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
    icon: 'text-amber-500',
    IconComponent: AlertTriangle,
  },
  error: {
    container: 'border-red-500/20 bg-red-500/5 text-red-300',
    icon: 'text-red-500',
    IconComponent: XCircle,
  },
}

// =============================================================================
// Status Banner View
// =============================================================================

export function StatusBannerView() {
  const { adapter } = useMorphChatContext()

  // Duck-type check for statusRows$ (mock-specific)
  const mockAdapter = adapter as Partial<MockChatAdapter>
  if (!mockAdapter.statusRows$) return null

  return <StatusBannerList statusRows$={mockAdapter.statusRows$} />
}

StatusBannerView.displayName = 'MorphChat.StatusBannerView'

// =============================================================================
// Inner list (separate component so hook call is unconditional)
// =============================================================================

function StatusBannerList({
  statusRows$,
}: {
  statusRows$: NonNullable<MockChatAdapter['statusRows$']>
}) {
  const rows = useAtomValue(statusRows$)

  if (rows.length === 0) return null

  return (
    <div className="flex flex-col gap-0.5 px-4 py-1.5" data-slot="morphchat-status-banners">
      <AnimatePresence mode="popLayout">
        {rows.map((row) => {
          const tone = TONE_STYLES[row.tone] ?? TONE_STYLES.info
          const Icon = tone.IconComponent

          return (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded border font-mono',
                tone.container,
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <Icon size={13} strokeWidth={1.5} className={cn('shrink-0', tone.icon)} />
              <span className="truncate">{row.text}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
