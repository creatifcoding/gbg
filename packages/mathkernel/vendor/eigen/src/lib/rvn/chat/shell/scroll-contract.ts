import type { CSSProperties } from 'react'

export const RVN_CHAT_SHELL_SCROLL_CONTRACT = {
  id: 'rvn-chat-shell-scroll-v1',
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

export function resolveRvnChatShellThreadScrollStyle(style?: CSSProperties): CSSProperties {
  return {
    minHeight: RVN_CHAT_SHELL_SCROLL_CONTRACT.thread.minHeight,
    overflowY: RVN_CHAT_SHELL_SCROLL_CONTRACT.thread.overflowY,
    overscrollBehavior: RVN_CHAT_SHELL_SCROLL_CONTRACT.thread.overscrollBehavior,
    ...style,
  }
}

export function resolveRvnChatShellComposerScrollStyle(style?: CSSProperties): CSSProperties {
  return {
    position: RVN_CHAT_SHELL_SCROLL_CONTRACT.composer.position,
    bottom: RVN_CHAT_SHELL_SCROLL_CONTRACT.composer.bottom,
    zIndex: RVN_CHAT_SHELL_SCROLL_CONTRACT.composer.zIndex,
    overflow: RVN_CHAT_SHELL_SCROLL_CONTRACT.composer.overflow,
    ...style,
  }
}
