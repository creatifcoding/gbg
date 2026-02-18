/**
 * Chat Composer Testbed
 *
 * Visual verification surface for the TMNL Chat Composer compound component.
 * Demonstrates all sub-components: TextArea, Toolbar, ModeToggle,
 * ThinkingLevel, SendButton, ContextChips, ActionButton.
 *
 * Route: /testbed/chat-composer
 */

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Paperclip, Slash, AtSign, Terminal } from 'lucide-react'
import { Composer, useComposer, type ComposerSubmitParams } from '@/lib/chat'

export function ChatComposerTestbed() {
  const [log, setLog] = useState<string[]>([])

  const handleSubmit = (params: ComposerSubmitParams) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${params.mode.toUpperCase()} | thinking:${params.thinkingLevel} | chips:${params.contextChips.length} | "${params.value}"`
    setLog((prev) => [entry, ...prev].slice(0, 50))
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-neutral-500 hover:text-white transition-colors font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            ← PORTAL
          </Link>
          <h1
            className="font-mono uppercase tracking-widest text-neutral-300"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            Chat Composer Testbed
          </h1>
        </div>
        <span
          className="font-mono text-neutral-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          src/lib/chat/composer
        </span>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        {/* Section 1: Full Composer */}
        <section className="space-y-4">
          <SectionLabel>Full Composer</SectionLabel>
          <Composer onSubmit={handleSubmit}>
            <Composer.ContextChips />
            <Composer.TextArea placeholder="Ask anything..." />
            <Composer.Toolbar>
              <Composer.ToolbarGroup>
                <Composer.ModeToggle />
                <Composer.Divider />
                <Composer.ThinkingLevel />
              </Composer.ToolbarGroup>
              <Composer.ToolbarGroup>
                <Composer.ActionButton
                  icon={<Slash size={14} />}
                  title="Commands"
                />
                <Composer.ActionButton
                  icon={<AtSign size={14} />}
                  title="Mentions"
                />
                <Composer.ActionButton
                  icon={<Paperclip size={14} />}
                  title="Attach file"
                />
                <Composer.Divider />
                <Composer.SendButton />
              </Composer.ToolbarGroup>
            </Composer.Toolbar>
          </Composer>
        </section>

        {/* Section 2: Minimal Composer */}
        <section className="space-y-4">
          <SectionLabel>Minimal (no toolbar)</SectionLabel>
          <Composer onSubmit={handleSubmit}>
            <Composer.TextArea
              placeholder="Quick message..."
              minHeight={36}
              maxHeight={100}
            />
          </Composer>
        </section>

        {/* Section 3: Terminal Mode Default */}
        <section className="space-y-4">
          <SectionLabel>Terminal Mode Default</SectionLabel>
          <Composer onSubmit={handleSubmit} defaultMode="terminal">
            <Composer.TextArea placeholder="$ run command..." />
            <Composer.Toolbar>
              <Composer.ToolbarGroup>
                <Composer.ModeToggle />
                <Composer.Divider />
                <Composer.ActionButton
                  icon={<Terminal size={14} />}
                  title="Terminal"
                  active
                />
              </Composer.ToolbarGroup>
              <Composer.ToolbarGroup>
                <Composer.SendButton />
              </Composer.ToolbarGroup>
            </Composer.Toolbar>
          </Composer>
        </section>

        {/* Section 4: With Pre-loaded Chips */}
        <section className="space-y-4">
          <SectionLabel>With Context Chips (add via hook)</SectionLabel>
          <ComposerWithChips onSubmit={handleSubmit} />
        </section>

        {/* Event Log */}
        <section className="space-y-4">
          <SectionLabel>Event Log</SectionLabel>
          <div className="border border-neutral-800 rounded-lg bg-neutral-950 p-4 max-h-64 overflow-y-auto">
            {log.length === 0 ? (
              <p
                className="text-neutral-600 font-mono"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Submit a message to see events here.
              </p>
            ) : (
              <div className="space-y-1">
                {log.map((entry, i) => (
                  <div
                    key={i}
                    className="font-mono text-neutral-400"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    {entry}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// =============================================================================
// Helper: Composer with pre-loaded chips
// =============================================================================

function ComposerWithChips({
  onSubmit,
}: {
  onSubmit: (params: ComposerSubmitParams) => void
}) {
  return (
    <Composer onSubmit={onSubmit}>
      <ChipInjector />
      <Composer.ContextChips />
      <Composer.TextArea placeholder="Message with context..." />
      <Composer.Toolbar>
        <Composer.ToolbarGroup>
          <Composer.ModeToggle />
          <Composer.Divider />
          <Composer.ThinkingLevel />
        </Composer.ToolbarGroup>
        <Composer.ToolbarGroup>
          <Composer.SendButton />
        </Composer.ToolbarGroup>
      </Composer.Toolbar>
    </Composer>
  )
}

/** Injects demo chips on mount via the composer context */
function ChipInjector() {
  const { addContextChip, contextChips } = useComposer()

  // Only inject once
  if (contextChips.length === 0) {
    setTimeout(() => {
      addContextChip({ label: 'conductor', type: 'hashtag' })
      addContextChip({ label: 'src/lib/chat', type: 'context' })
      addContextChip({ label: 'uploading...', type: 'pending' })
    }, 0)
  }

  return null
}

// =============================================================================
// UI Atoms
// =============================================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-mono uppercase tracking-widest text-neutral-500"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {children}
    </h2>
  )
}
