/**
 * Composer.SendButton
 *
 * Send action button — TMNL cyan accent when ready, neutral when idle.
 */

import { cn } from '@/lib/utils'
import { Send } from 'lucide-react'
import { CHAT_TOKENS, COMPOSER_SIZING } from '../tokens'
import { useComposer } from './composer-context'

export interface ComposerSendButtonProps {
  className?: string
}

export function ComposerSendButton({ className }: ComposerSendButtonProps) {
  const { value, isSubmitting, submit, widthTier } = useComposer()
  const hasInput = value.trim().length > 0
  const isReady = hasInput && !isSubmitting
  const sizing = COMPOSER_SIZING[widthTier]

  const t = CHAT_TOKENS.send

  return (
    <button
      onClick={submit}
      disabled={!isReady}
      data-slot="tmnl-composer-send"
      className={cn(
        'flex items-center justify-center',
        sizing.sendBtn,
        'border-none cursor-pointer transition-all duration-200',
        isReady ? t.ready : t.idle,
        className,
      )}
      title={isSubmitting ? 'Sending...' : 'Send'}
    >
      <Send size={sizing.sendIcon} />
    </button>
  )
}

ComposerSendButton.displayName = 'Composer.SendButton'
