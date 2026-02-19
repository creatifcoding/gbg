// ── Context ─────────────────────────────────────────────────
export {
  MorphChatContext,
  useMorphChatContext,
  type MorphChatContextValue,
} from './surface-context'

// ── Root Surface ────────────────────────────────────────────
export {
  MorphChatSurface,
  type MorphChatSurfaceProps,
} from './surface-root'

// ── Topology Resolver ───────────────────────────────────────
export { SurfaceContent } from './surface-content'

// ── View Resolvers ──────────────────────────────────────────
export { ComposerView } from './composer-view'
export { ThreadView } from './thread-view'
export { ThreadTailControls } from './thread-tail-controls'
export { InlineTasksView } from './inline-tasks-view'
export { FrameChromeView } from './frame-chrome-view'
export { ConnectionView } from './connection-view'
export { AgentSelectorView } from './agent-selector-view'
export { ModelSelectorView } from './model-selector-view'
export { StatusBannerView } from './status-banner-view'
export { CommandBandView } from './command-band-view'
export { AnalysisCard, RemediationCard } from './artifact-cards'
export type { AnalysisCardProps, RemediationCardProps } from './artifact-cards'
// MorphOverlay archived — layout morphing (#F368) will replace it
