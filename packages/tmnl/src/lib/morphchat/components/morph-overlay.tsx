/**
 * Morph Transition Overlay
 *
 * Rendered during spec morphing. Uses MorphCard's transition grammar
 * to animate between specs. The machine's morphTransition field
 * determines which verb/modifier/direction to use.
 *
 * @module morphchat/components/morph-overlay
 */

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useMorphChatContext } from './surface-context'
import {
  grammarToVariants,
  DEFAULT_TRANSITION,
} from '../../morph-card/schemas/transition-grammar'

export function MorphOverlay() {
  const { isMorphing, actor, previousSpec, spec } = useMorphChatContext()

  // Get transition grammar from machine context
  const grammar = React.useMemo(() => {
    const snapshot = actor.getSnapshot()
    return snapshot.context.morphTransition ?? DEFAULT_TRANSITION
  }, [actor, isMorphing])

  // Convert grammar to Framer Motion variants
  const variants = React.useMemo(() => grammarToVariants(grammar), [grammar])

  return (
    <AnimatePresence>
      {isMorphing && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
        >
          <div className="text-center space-y-2">
            <div
              className="font-mono text-neutral-500 tracking-wider uppercase"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              morphing
            </div>
            {previousSpec && (
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-neutral-600"
                  style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                >
                  {previousSpec._tag}
                </span>
                <span className="text-neutral-700">→</span>
                <span
                  className="font-mono text-cyan-500"
                  style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                >
                  {spec._tag}
                </span>
              </div>
            )}
            <div
              className="font-mono text-neutral-700"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {grammar.verb}
              {grammar.modifier ? `:${grammar.modifier}` : ''}
              {grammar.direction ? `:${grammar.direction}` : ''}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

MorphOverlay.displayName = 'MorphChat.MorphOverlay'
