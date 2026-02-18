import type { CSSProperties } from 'react'

export const CHAT_SHELL_SCROLL_CONTRACT = {
  id: 'tmnl-chat-shell-scroll-v1',
  thread: {
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
  composer: {
    position: 'sticky',
    bottom: 0,
    zIndex: 2,
    overflow: 'visible',
  },
} as const

export function resolveChatShellThreadScrollStyle(style?: CSSProperties): CSSProperties {
  return {
    minHeight: CHAT_SHELL_SCROLL_CONTRACT.thread.minHeight,
    overflowY: CHAT_SHELL_SCROLL_CONTRACT.thread.overflowY,
    overscrollBehavior: CHAT_SHELL_SCROLL_CONTRACT.thread.overscrollBehavior,
    ...style,
  }
}

export function resolveChatShellComposerScrollStyle(style?: CSSProperties): CSSProperties {
  return {
    position: CHAT_SHELL_SCROLL_CONTRACT.composer.position,
    bottom: CHAT_SHELL_SCROLL_CONTRACT.composer.bottom,
    zIndex: CHAT_SHELL_SCROLL_CONTRACT.composer.zIndex,
    overflow: CHAT_SHELL_SCROLL_CONTRACT.composer.overflow,
    ...style,
  }
}
