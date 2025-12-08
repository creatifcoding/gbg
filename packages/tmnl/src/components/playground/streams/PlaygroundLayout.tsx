/**
 * Streams Playground Layout
 *
 * Two-column layout with collapsible right panels (docs + event log).
 *
 * ```
 * ┌────────────────────────────────────┬──────────────────────┐
 * │                                    │  [Docs ▼]            │
 * │   LEFT PANEL                       │  [Event Log ▼]       │
 * │   (Visualization + Tabs)           │                      │
 * │                                    │                      │
 * └────────────────────────────────────┴──────────────────────┘
 * ```
 *
 * @module
 */

import { useState, type ReactNode } from 'react'

// =============================================================================
// TYPES
// =============================================================================

export interface PlaygroundLayoutProps {
  /** Header content (title, scenario selector, controls) */
  header: ReactNode
  /** Main visualization panel content */
  main: ReactNode
  /** Docs panel content */
  docs: ReactNode
  /** Event log panel content */
  eventLog: ReactNode
  /** Optional metrics panel */
  metrics?: ReactNode
  /** Optional hypothesis tracking panel */
  hypotheses?: ReactNode
}

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  badge?: ReactNode
}

// =============================================================================
// COLLAPSIBLE SECTION
// =============================================================================

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-neutral-800 bg-neutral-900/30 rounded overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span
            className="font-mono uppercase tracking-wider text-neutral-400"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {title}
          </span>
          {badge}
        </div>
        <span
          className="text-neutral-500 font-mono"
          style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
        >
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-neutral-800">{children}</div>
      )}
    </div>
  )
}

// =============================================================================
// LAYOUT
// =============================================================================

/**
 * Two-column layout for the Streams Playground.
 *
 * - Left: Main visualization area with tab navigation
 * - Right: Stacked collapsible panels (docs, event log)
 */
export function PlaygroundLayout({
  header,
  main,
  docs,
  eventLog,
  metrics,
  hypotheses,
}: PlaygroundLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="flex-none border-b border-neutral-800 bg-neutral-900/50">
        {header}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Visualization */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Optional metrics strip */}
          {metrics && (
            <div className="flex-none border-b border-neutral-800 bg-neutral-900/30">
              {metrics}
            </div>
          )}

          {/* Main visualization */}
          <div className="flex-1 overflow-auto p-4">
            {main}
          </div>
        </main>

        {/* Right Panel - Collapsible Sections */}
        <aside className="w-80 flex-none border-l border-neutral-800 bg-neutral-900/20 overflow-y-auto">
          <div className="p-3 space-y-3">
            {/* Docs Panel */}
            <CollapsibleSection title="Documentation" defaultOpen={false}>
              {docs}
            </CollapsibleSection>

            {/* Event Log Panel */}
            <CollapsibleSection
              title="Event Log"
              defaultOpen={true}
              badge={
                <span
                  className="px-1.5 py-0.5 bg-cyan-900/50 text-cyan-400 rounded font-mono"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  LIVE
                </span>
              }
            >
              {eventLog}
            </CollapsibleSection>

            {/* Hypotheses Panel */}
            {hypotheses && (
              <CollapsibleSection
                title="Hypotheses"
                defaultOpen={false}
                badge={
                  <span
                    className="px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 rounded font-mono"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    EDIN
                  </span>
                }
              >
                {hypotheses}
              </CollapsibleSection>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default PlaygroundLayout
