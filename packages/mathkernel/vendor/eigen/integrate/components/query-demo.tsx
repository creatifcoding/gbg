"use client"

import { useState, useCallback } from "react"
import * as DorkQuery from "./dork-query"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Zap,
  Command,
  ArrowUpDown,
  Sparkles,
  ListFilter,
  MessageSquare,
  Send,
  TextCursorInput,
  Hash,
} from "lucide-react"

interface SearchEvent {
  query: string
  filters: DorkQuery.ActiveFilter[]
  timestamp: Date
  source: string
}

export function QueryDemo() {
  const [searchEvents, setSearchEvents] = useState<SearchEvent[]>([])

  const createHandler = useCallback(
    (source: string) =>
      (query: string, filters: DorkQuery.ActiveFilter[]) => {
        setSearchEvents((prev) => [
          { query, filters, timestamp: new Date(), source },
          ...prev.slice(0, 9),
        ])
      },
    []
  )

  return (
    <div className="flex min-h-screen flex-col items-center bg-background">
      {/* Hero */}
      <div className="flex w-full max-w-3xl flex-col items-center gap-8 px-4 pt-20 pb-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Search className="size-5 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground md:text-4xl">
            {"Dork Query System"}
          </h1>
          <p className="max-w-lg text-sm text-muted-foreground leading-relaxed text-pretty">
            {"Compound component API with dedicated bar and inline popover modes. Configurable triggers, fuzzy search, full keyboard navigation."}
          </p>
        </div>
      </div>

      <div className="flex w-full max-w-3xl flex-col gap-10 px-4 pb-24">
        {/* ─── DEFAULT BAR ─── */}
        <section className="flex flex-col gap-3">
          <SectionLabel
            icon={Search}
            label="Bar Mode"
            badge="/"
            description="Full-featured search bar with category groups and rich operator cards"
          />
          <DorkQuery.Root onSearch={createHandler("bar")} className="relative w-full">
            <DorkQuery.Bar>
              <DorkQuery.ChipList />
              <DorkQuery.PendingBadge />
              <DorkQuery.Input placeholder="Search... press / for operators, or type site: directly" />
              <DorkQuery.SlashHint />
              <DorkQuery.FilterCount />
            </DorkQuery.Bar>
            <DorkQuery.OperatorRolodex />
            <DorkQuery.ValueRolodex />
          </DorkQuery.Root>
          <DorkQuery.KeyboardHints trigger="/" />
        </section>

        {/* ─── COMPACT BAR IN CHAT ─── */}
        <section className="flex flex-col gap-3">
          <SectionLabel
            icon={MessageSquare}
            label="Bar / Compact"
            badge="/"
            description="Compact bar variant for chat inputs and toolbars"
          />
          <div className="rounded-xl border border-border bg-card p-1 flex items-end gap-1">
            <DorkQuery.Root onSearch={createHandler("chat")} variant="compact" className="relative flex-1">
              <DorkQuery.Bar>
                <DorkQuery.ChipList />
                <DorkQuery.PendingBadge />
                <DorkQuery.Input placeholder="Message with filters..." />
                <DorkQuery.FilterCount />
              </DorkQuery.Bar>
              <DorkQuery.OperatorRolodex />
              <DorkQuery.ValueRolodex />
            </DorkQuery.Root>
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer mb-0.5"
              aria-label="Send message"
            >
              <Send className="size-3.5" />
            </button>
          </div>
        </section>

        {/* ─── INLINE MODE: / trigger ─── */}
        <section className="flex flex-col gap-3">
          <SectionLabel
            icon={TextCursorInput}
            label="Inline / Slash"
            badge="/"
            description="Type prose, press / mid-sentence -- popover appears at cursor with operator picker"
          />
          <DorkQuery.Root
            onSearch={createHandler("inline-slash")}
            variant="compact"
            trigger="/"
            className="relative w-full"
          >
            <DorkQuery.Inline
              placeholder="Write a sentence, then press / to insert filters inline..."
              onSubmit={(text, filters) => createHandler("inline-slash")(text, filters)}
            />
          </DorkQuery.Root>
        </section>

        {/* ─── INLINE MODE: @ trigger ─── */}
        <section className="flex flex-col gap-3">
          <SectionLabel
            icon={TextCursorInput}
            label="Inline / @-mention"
            badge="@"
            description="Uses @ as trigger -- familiar mention-style activation like Cursor or v0"
          />
          <DorkQuery.Root
            onSearch={createHandler("inline-at")}
            variant="compact"
            trigger="@"
            className="relative w-full"
          >
            <DorkQuery.Inline
              placeholder="Type your query, use @ to mention operators..."
              onSubmit={(text, filters) => createHandler("inline-at")(text, filters)}
            />
          </DorkQuery.Root>
        </section>

        {/* ─── INLINE MODE: # trigger ─── */}
        <section className="flex flex-col gap-3">
          <SectionLabel
            icon={Hash}
            label="Inline / Hashtag"
            badge="#"
            description="Uses # as trigger -- natural for tagging and categorization"
          />
          <DorkQuery.Root
            onSearch={createHandler("inline-hash")}
            variant="compact"
            trigger="#"
            className="relative w-full"
          >
            <DorkQuery.Inline
              placeholder="Type text, use # to tag with operators..."
              onSubmit={(text, filters) => createHandler("inline-hash")(text, filters)}
            />
          </DorkQuery.Root>
        </section>

        {/* ─── INLINE IN A CHAT BUBBLE ─── */}
        <section className="flex flex-col gap-3">
          <SectionLabel
            icon={MessageSquare}
            label="Inline / Chat Input"
            badge="/"
            description="Inline mode embedded in a chat-style input with send button"
          />
          <div className="rounded-xl border border-border bg-card flex items-end gap-1 p-1">
            <DorkQuery.Root
              onSearch={createHandler("inline-chat")}
              variant="compact"
              trigger="/"
              className="relative flex-1"
            >
              <DorkQuery.Inline
                placeholder="Ask anything... use / to add context filters"
                onSubmit={(text, filters) => createHandler("inline-chat")(text, filters)}
              />
            </DorkQuery.Root>
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer mb-0.5"
              aria-label="Send message"
            >
              <Send className="size-3.5" />
            </button>
          </div>
        </section>

        {/* ─── EVENT LOG ─── */}
        {searchEvents.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 px-1">
              {"Search Activity"}
            </h2>
            <div className="flex flex-col gap-2">
              {searchEvents.map((event, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card/50 p-3 animate-in fade-in-0 slide-in-from-top-2 duration-200"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[9px] font-mono px-1.5 py-0 h-4 bg-transparent text-muted-foreground/60 border-border/40"
                      >
                        {event.source}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground/40">
                        {event.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-mono px-1.5 py-0 h-4 bg-transparent text-muted-foreground/50 border-border/40"
                    >
                      {event.filters.length}{" "}
                      {event.filters.length === 1 ? "filter" : "filters"}
                    </Badge>
                  </div>
                  {event.query && (
                    <p className="text-sm text-foreground">{event.query}</p>
                  )}
                  {event.filters.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {event.filters.map((f, j) => {
                        const Icon = f.operator.icon
                        return (
                          <span
                            key={j}
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-mono ${f.operator.colorClass}`}
                          >
                            <Icon className="size-2.5 opacity-70" />
                            <span className="font-semibold opacity-80">{f.operator.key}</span>
                            <span>{f.value}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── FEATURES GRID ─── */}
        {searchEvents.length === 0 && (
          <section className="flex flex-col items-center gap-6 py-8">
            <div className="grid grid-cols-2 gap-3 w-full max-w-md md:grid-cols-3">
              {[
                {
                  icon: Zap,
                  title: "Fuzzy Completion",
                  desc: "Partial names for instant fuzzy-ranked matching",
                },
                {
                  icon: ArrowUpDown,
                  title: "Rolodex Nav",
                  desc: "j/k, arrows, Tab/Ctrl+Tab with wrap-around cycling",
                },
                {
                  icon: Command,
                  title: "Vim-style Keys",
                  desc: "h/j/k/l navigation for chips and rolodex items",
                },
                {
                  icon: Sparkles,
                  title: "Auto-detect",
                  desc: 'Type "site:" directly to activate without trigger key',
                },
                {
                  icon: ListFilter,
                  title: "Value Search",
                  desc: "Fuzzy-searchable known values per operator",
                },
                {
                  icon: TextCursorInput,
                  title: "Inline Popover",
                  desc: "Cursor-anchored popover for inline-in-text chip insertion",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="flex flex-col gap-2 rounded-lg border border-border/40 bg-card/30 p-3"
                >
                  <feature.icon className="size-4 text-primary/70" />
                  <h3 className="text-xs font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-[11px] leading-relaxed text-muted-foreground/60">{feature.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────
// Section label
// ────────────────────────────────────────────────

function SectionLabel({
  icon: Icon,
  label,
  badge,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  badge: string
  description: string
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="size-3.5 text-muted-foreground/50" />
      <span className="text-xs font-semibold text-foreground/80">{label}</span>
      <span className="rounded bg-muted/60 px-1.5 py-px text-[10px] font-mono text-muted-foreground/60">{badge}</span>
      <span className="text-[11px] text-muted-foreground/40">{description}</span>
    </div>
  )
}
