/**
 * Composer.ThinkingLevel
 *
 * Cycler button with motion animations, radial pulse, drop-shadow layers.
 * Forked from ChatInput.ThinkingLevel — intact animation system, TMNL tokens.
 */

import { useState } from 'react'
import { Brain } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useScrambleText } from '@/lib/animation/text-effects'
import { CHAT_TOKENS } from '../tokens'
import { useComposer } from './composer-context'
import type { ShadowLayer } from './types'

// =============================================================================
// Helpers
// =============================================================================

function buildDropShadowFilter(layers: ShadowLayer[]): string {
  if (layers.length === 0) return 'none'
  return layers
    .map((l) => {
      const x = l.offsetX ?? 0
      const y = l.offsetY ?? 0
      return `drop-shadow(${x}px ${y}px ${l.blur}px rgba(${l.color}, ${l.opacity}))`
    })
    .join(' ')
}

// =============================================================================
// Component
// =============================================================================

export interface ComposerThinkingLevelProps {
  className?: string
}

export function ComposerThinkingLevel({
  className,
}: ComposerThinkingLevelProps) {
  const { mode, thinkingLevel, setThinkingLevel, thinkingLevels } =
    useComposer()
  const [showPicker, setShowPicker] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const [showPulse, setShowPulse] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const currentOption =
    thinkingLevels.find((l) => l.id === thinkingLevel) ?? thinkingLevels[0]
  const nextOption = (() => {
    const idx = thinkingLevels.findIndex((l) => l.id === thinkingLevel)
    return thinkingLevels[(idx + 1) % thinkingLevels.length]
  })()

  const isActive = thinkingLevel !== 'none'
  const t = CHAT_TOKENS.thinking

  // Model doesn't support reasoning — hide entirely
  // (thinkingLevels will be empty or contain only 'none' when model has reasoning=false)
  if (thinkingLevels.length <= 1) return null

  const { ref: scrambleRef } = useScrambleText({
    text: isActive ? currentOption.name : '',
    preset: 'cyber',
    playOnMount: false,
  })

  if (mode !== 'ai') return null

  const handleClick = () => {
    if (prefersReducedMotion) {
      setThinkingLevel(nextOption.id)
      return
    }

    if (thinkingLevel !== 'none') {
      setIsPressed(true)
      if (nextOption.animation.pulse) {
        setShowPulse(true)
      }
    }

    setThinkingLevel(nextOption.id)
  }

  const handleAnimationComplete = () => {
    if (isPressed) setIsPressed(false)
  }

  const handlePulseComplete = () => {
    setShowPulse(false)
  }

  const currentAnim = currentOption.animation
  const nextAnim = nextOption.animation

  const effectiveDuration = prefersReducedMotion
    ? { press: 0, release: 0 }
    : { press: nextAnim.duration.press, release: nextAnim.duration.release }

  const currentShadowFilter = isActive
    ? buildDropShadowFilter(currentAnim.shadow.layers)
    : 'none'
  const iconShadowFilter = isPressed
    ? buildDropShadowFilter(nextAnim.shadow.layers)
    : currentShadowFilter

  const pulseColor = nextAnim.pulse?.color ?? '255, 255, 255'
  const pulseOpacity = nextAnim.pulse?.opacity ?? 0.4

  const scaleValue = (() => {
    if (isPressed) return nextAnim.scale.pressed
    if (nextAnim.scale.overshoot) {
      return [nextAnim.scale.overshoot, nextAnim.scale.final]
    }
    return nextAnim.scale.final
  })()

  return (
    <div className={cn('relative flex items-center', className)}>
      <span id="thinking-level-description" className="sr-only">
        {`Current thinking level: ${currentOption.name}. Token usage: ${currentOption.tokens}`}
      </span>

      {/* Radial pulse */}
      <AnimatePresence>
        {showPulse && nextAnim.pulse && (
          <motion.div
            initial={{ scale: 0.8, opacity: pulseOpacity }}
            animate={{ scale: nextAnim.pulse.scale, opacity: 0 }}
            exit={{ opacity: 0 }}
            onAnimationComplete={handlePulseComplete}
            transition={{
              duration: (nextAnim.pulse.duration ?? 300) / 1000,
              ease: 'easeOut',
            }}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, rgba(${pulseColor}, ${pulseOpacity}) 0%, transparent 70%)`,
              transformOrigin: 'center',
            }}
          />
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        role="button"
        aria-label={`Thinking level: ${currentOption.name}`}
        aria-pressed={isActive}
        aria-describedby="thinking-level-description"
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault()
          setShowPicker((v) => !v)
        }}
        animate={{ scale: scaleValue }}
        onAnimationComplete={handleAnimationComplete}
        transition={{
          scale: {
            duration: isPressed
              ? effectiveDuration.press / 1000
              : effectiveDuration.release / 1000,
            ease: isPressed ? 'easeIn' : nextAnim.easing,
          },
        }}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md',
          'border-none cursor-pointer transition-colors duration-150',
          isActive ? t.active : t.idle,
        )}
        title={`Thinking: ${currentOption.name} (click to cycle, right-click for picker)`}
      >
        <motion.span
          animate={{ filter: iconShadowFilter }}
          transition={{
            filter: {
              duration: isPressed
                ? effectiveDuration.press / 1000
                : effectiveDuration.release / 1000,
              ease: isPressed ? 'easeIn' : 'easeOut',
            },
          }}
          className="flex items-center justify-center"
        >
          <Brain size={14} />
        </motion.span>
        {isActive && (
          <motion.span
            ref={scrambleRef}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            className="font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          />
        )}
      </motion.button>

      {/* Picker dropdown */}
      <AnimatePresence>
        {showPicker && (
          <>
            <div
              className="fixed inset-0 z-[999998]"
              onClick={() => setShowPicker(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={cn(
                'absolute bottom-full left-0 mb-2 z-[999999] w-56 p-1.5 rounded-lg',
                'bg-black/90 backdrop-blur-xl',
                'border border-neutral-700 shadow-xl',
              )}
            >
              <div
                className="px-2 py-1.5 text-neutral-500 font-mono uppercase tracking-wider"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Extended Thinking
              </div>
              {thinkingLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => {
                    setThinkingLevel(level.id)
                    setShowPicker(false)
                  }}
                  className={cn(
                    'w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-left',
                    'border-none cursor-pointer transition-all duration-150',
                    thinkingLevel === level.id
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'bg-transparent text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200',
                  )}
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{level.name}</span>
                      <span className="text-neutral-600 font-mono flex-shrink-0 ml-2">
                        {level.tokens}
                      </span>
                    </div>
                    {level.description && (
                      <div
                        className="text-neutral-500 mt-0.5 leading-tight"
                        style={{ fontSize: '10px' }}
                      >
                        {level.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

ComposerThinkingLevel.displayName = 'Composer.ThinkingLevel'
