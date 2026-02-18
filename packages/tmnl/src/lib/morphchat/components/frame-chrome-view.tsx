/**
 * Frame Chrome Renderer
 *
 * Maps spec.frameChrome axis → actual frame from src/lib/chat/frame/
 *
 * - full: Frame corners, title bar, resize hints
 * - minimal: Hairline border only
 * - none: (not rendered — handled by topology resolver)
 *
 * @module morphchat/components/frame-chrome-view
 */

import * as React from 'react'
import { useMorphChatContext } from './surface-context'
import { ChatFrameCorners } from '@/lib/chat/frame'

export function FrameChromeView() {
  const { spec } = useMorphChatContext()

  switch (spec.frameChrome) {
    case 'full':
      return (
        <>
          <ChatFrameCorners />
          <div className="morphchat-titlebar flex items-center justify-between px-3 py-1.5 border-b border-neutral-800/50">
            <span
              className="text-neutral-500 font-mono tracking-wider uppercase"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {spec.label}
            </span>
            <span
              className="text-neutral-700 font-mono"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {spec._tag}
            </span>
          </div>
        </>
      )

    case 'minimal':
      return (
        <div className="absolute inset-0 pointer-events-none border border-neutral-800/30 rounded" />
      )

    case 'none':
    default:
      return null
  }
}

FrameChromeView.displayName = 'MorphChat.FrameChromeView'
