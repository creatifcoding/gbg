/**
 * Compaction Boundary — Visual separator when context is compacted.
 * Shows summary of what was compacted: message count, token savings, timestamp.
 */
import * as React from 'react'
import { motion } from 'motion/react'

export interface CompactionBoundaryProps {
  readonly messagesSummarized: number
  readonly tokensBefore: number
  readonly tokensAfter: number
  readonly compactedAt: number
  readonly compactionIndex: number // which compaction (1st, 2nd, etc.)
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export const CompactionBoundary = React.memo(function CompactionBoundary({
  messagesSummarized,
  tokensBefore,
  tokensAfter,
  compactedAt,
  compactionIndex,
}: CompactionBoundaryProps) {
  const saved = tokensBefore - tokensAfter
  const savedPercent = tokensBefore > 0 ? ((saved / tokensBefore) * 100).toFixed(0) : '0'
  const time = new Date(compactedAt).toLocaleTimeString()

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.8 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 py-2 px-4 my-2"
      role="separator"
      aria-label={`Context compacted: ${messagesSummarized} messages summarized`}
    >
      {/* Left line */}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-900/40 to-amber-900/40" />

      {/* Center badge */}
      <span
        className="inline-flex items-center gap-2 px-3 py-1 rounded-md font-data border border-amber-900/30 bg-amber-950/20 text-amber-500/80"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <span className="uppercase tracking-wider">Compacted</span>
        <span className="text-amber-600/60">#{compactionIndex}</span>
        <span className="text-neutral-600">·</span>
        <span>{messagesSummarized} msgs</span>
        <span className="text-neutral-600">·</span>
        <span className="text-emerald-500/70">-{formatTokens(saved)} ({savedPercent}%)</span>
        <span className="text-neutral-600">·</span>
        <span className="text-neutral-600">{time}</span>
      </span>

      {/* Right line */}
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-900/40 to-amber-900/40" />
    </motion.div>
  )
})
