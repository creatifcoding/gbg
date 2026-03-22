/**
 * useMorphTransition — Animation Hook
 *
 * Provides transition grammar + Framer Motion variants
 * for the current morph animation. Used by MorphOverlay
 * and custom transition components.
 *
 * @module morphchat/hooks/useMorphTransition
 */

import { useMemo } from 'react'
import { useMorphChatContext } from '../components/surface-context'
import {
  grammarToVariants,
  DEFAULT_TRANSITION,
  type TransitionGrammar,
} from '../../morph-card/schemas/transition-grammar'

/**
 * Get morph transition state and animation variants.
 *
 * ```tsx
 * const { grammar, variants, isMorphing } = useMorphTransition()
 * ```
 */
export function useMorphTransition() {
  const { isMorphing, actor, previousSpec, spec } = useMorphChatContext()

  const grammar: TransitionGrammar = useMemo(() => {
    if (!isMorphing) return DEFAULT_TRANSITION
    const snapshot = actor.getSnapshot()
    return snapshot.context.morphTransition ?? DEFAULT_TRANSITION
  }, [isMorphing, actor])

  const variants = useMemo(() => grammarToVariants(grammar), [grammar])

  const grammarString = useMemo(() => {
    return [
      grammar.verb,
      grammar.modifier,
      grammar.direction,
    ].filter(Boolean).join(':')
  }, [grammar])

  return {
    isMorphing,
    grammar,
    grammarString,
    variants,
    previousSpec,
    currentSpec: spec,
    fromTag: previousSpec?._tag ?? null,
    toTag: spec._tag,
  }
}
