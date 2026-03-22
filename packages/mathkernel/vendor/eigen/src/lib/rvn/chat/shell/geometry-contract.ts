export const RVN_CHAT_SHELL_GEOMETRY_CONTRACT = {
  id: 'rvn-chat-shell-geometry-v1',
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

export type RvnChatShellExpansionLevel = keyof typeof RVN_CHAT_SHELL_GEOMETRY_CONTRACT.levels

export interface ResolveRvnChatShellGeometryOptions {
  expansionLevel: RvnChatShellExpansionLevel
  animated?: boolean
  prefersReducedMotion?: boolean
}

export interface RvnChatShellGeometryStyle {
  gridTemplateRows: string
  minHeight: string
  transition: string
}

export function resolveRvnChatShellGeometry({
  expansionLevel,
  animated = true,
  prefersReducedMotion = false,
}: ResolveRvnChatShellGeometryOptions): RvnChatShellGeometryStyle {
  const level = RVN_CHAT_SHELL_GEOMETRY_CONTRACT.levels[expansionLevel]
  const duration = animated && !prefersReducedMotion
    ? RVN_CHAT_SHELL_GEOMETRY_CONTRACT.transitionMs
    : 0

  return {
    gridTemplateRows: `auto auto minmax(${level.threadMinHeight}, 1fr) auto`,
    minHeight: level.panelMinHeight,
    transition: [
      `grid-template-rows ${duration}ms ${RVN_CHAT_SHELL_GEOMETRY_CONTRACT.easing}`,
      `min-height ${duration}ms ${RVN_CHAT_SHELL_GEOMETRY_CONTRACT.easing}`,
    ].join(', '),
  }
}
