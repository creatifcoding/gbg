export const CHAT_SHELL_GEOMETRY_CONTRACT = {
  id: 'tmnl-chat-shell-geometry-v1',
  transitionMs: 220,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  levels: {
    l2: {
      threadMinHeight: 'clamp(140px, 24vh, 220px)',
      panelMinHeight: 'clamp(280px, 48vh, 480px)',
    },
    l3: {
      threadMinHeight: 'clamp(180px, 32vh, 340px)',
      panelMinHeight: 'clamp(360px, 64vh, 760px)',
    },
  },
} as const

export type ChatShellExpansionLevel = keyof typeof CHAT_SHELL_GEOMETRY_CONTRACT.levels

export interface ResolveChatShellGeometryOptions {
  expansionLevel: ChatShellExpansionLevel
  animated?: boolean
  prefersReducedMotion?: boolean
}

export interface ChatShellGeometryStyle {
  gridTemplateRows: string
  minHeight: string
  transition: string
}

export function resolveChatShellGeometry({
  expansionLevel,
  animated = true,
  prefersReducedMotion = false,
}: ResolveChatShellGeometryOptions): ChatShellGeometryStyle {
  const level = CHAT_SHELL_GEOMETRY_CONTRACT.levels[expansionLevel]
  const duration = animated && !prefersReducedMotion
    ? CHAT_SHELL_GEOMETRY_CONTRACT.transitionMs
    : 0

  return {
    gridTemplateRows: `auto auto minmax(${level.threadMinHeight}, 1fr) auto`,
    minHeight: level.panelMinHeight,
    transition: [
      `grid-template-rows ${duration}ms ${CHAT_SHELL_GEOMETRY_CONTRACT.easing}`,
      `min-height ${duration}ms ${CHAT_SHELL_GEOMETRY_CONTRACT.easing}`,
    ].join(', '),
  }
}
