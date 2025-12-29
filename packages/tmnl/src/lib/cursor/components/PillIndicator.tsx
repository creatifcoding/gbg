/**
 * PillIndicator Component
 *
 * Collapsed cursor state - minimal pill showing status.
 */

import { motion } from 'framer-motion'

interface PillIndicatorProps {
  status: 'awaiting_message' | 'streaming' | 'in_progress' | 'submitted' | 'ready' | 'error'
  messageCount: number
  onClick: () => void
}

export function PillIndicator({ status, messageCount, onClick }: PillIndicatorProps) {
  const isActive = status === 'streaming' || status === 'in_progress' || status === 'submitted'

  return (
    <motion.button
      className="w-full h-full flex items-center justify-center gap-2 pointer-events-auto cursor-pointer"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      style={{
        background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(30, 30, 30, 0.9))',
        borderRadius: 20,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Status indicator */}
      <motion.div
        className="w-2 h-2 rounded-full"
        style={{
          background: isActive
            ? 'linear-gradient(135deg, #60f0a0, #30d080)'
            : 'rgba(100, 100, 100, 0.5)',
          boxShadow: isActive ? '0 0 8px rgba(96, 240, 160, 0.5)' : 'none',
        }}
        animate={
          isActive
            ? {
                scale: [1, 1.2, 1],
                opacity: [1, 0.7, 1],
              }
            : {}
        }
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Label */}
      <span
        className="font-mono text-xs"
        style={{
          color: 'rgba(255, 255, 255, 0.7)',
          letterSpacing: '0.05em',
        }}
      >
        {isActive ? 'thinking...' : messageCount > 0 ? `${messageCount} msgs` : 'AI'}
      </span>
    </motion.button>
  )
}

export default PillIndicator
