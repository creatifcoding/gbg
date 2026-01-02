/**
 * PipelineADRTestbed - Granular Review Application for Sensor Pipeline ADRs
 *
 * Features:
 * - ADR list with filtering by tier (isolated/pairs/triplets)
 * - Granular unit-level review (Accept/Reject/Discuss per decision point)
 * - Collapsible sections with progress indicators
 * - Inline commenting via path-based annotation
 * - JSON export for digest generation
 *
 * Uses the ADRReview compound component system from @/lib/adr-review
 *
 * @route /testbed/pipeline-adr
 */

import { useState, useCallback, useMemo, memo, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  FileText,
  Download,
  Check,
  Clock,
  MessageSquare,
  Archive,
  Filter,
  Layers,
  GitBranch,
  Cpu,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADRReview, downloadDigest } from '@/lib/adr-review'
import type { ADRStatus, ADRTier } from '@/../assets/documents/pipeline-adr/schema'
import { PIPELINE_STAGES } from '@/../assets/documents/pipeline-adr/schema'

// =============================================================================
// ADR MANIFEST (Generated from Wave 1-4)
// =============================================================================

type ADRManifestEntry = {
  id: string
  title: string
  tier: ADRTier
  stages: string[]
  status: ADRStatus
  path: string
  wordCount: number
}

const ADR_MANIFEST: ADRManifestEntry[] = [
  // Wave 1: Isolated Stages
  { id: 'S1', title: 'Physical Stage — Sensor Firmware & SenML Encoding', tier: 'isolated', stages: ['S1'], status: 'draft', path: 'isolated/ADR-S1-physical.md', wordCount: 500 },
  { id: 'S2', title: 'Edge Stage — Gateway Aggregation & Buffering', tier: 'isolated', stages: ['S2'], status: 'draft', path: 'isolated/ADR-S2-edge.md', wordCount: 500 },
  { id: 'S3', title: 'Transport Stage — NATS JetStream Broker', tier: 'isolated', stages: ['S3'], status: 'draft', path: 'isolated/ADR-S3-transport.md', wordCount: 500 },
  { id: 'S4', title: 'Ingestion Stage — Effect.Service Validation', tier: 'isolated', stages: ['S4'], status: 'draft', path: 'isolated/ADR-S4-ingestion.md', wordCount: 500 },
  { id: 'S5', title: 'Storage Stage — Dual-Write (NATS KV + SQLite)', tier: 'isolated', stages: ['S5'], status: 'draft', path: 'isolated/ADR-S5-storage.md', wordCount: 500 },
  { id: 'S6', title: 'Client Transport Stage — WebSocket/SSE', tier: 'isolated', stages: ['S6'], status: 'draft', path: 'isolated/ADR-S6-client-transport.md', wordCount: 500 },
  { id: 'S7', title: 'Filtering Stage — Dead-Band Compression', tier: 'isolated', stages: ['S7'], status: 'draft', path: 'isolated/ADR-S7-filtering.md', wordCount: 500 },
  { id: 'S8', title: 'State Stage — Atom Architecture & Registry', tier: 'isolated', stages: ['S8'], status: 'draft', path: 'isolated/ADR-S8-state.md', wordCount: 500 },
  { id: 'S9', title: 'React Stage — Subscription & Rendering', tier: 'isolated', stages: ['S9'], status: 'draft', path: 'isolated/ADR-S9-react.md', wordCount: 500 },

  // Wave 2: Adjacent Pairs
  { id: 'S1-S2', title: 'Physical → Edge — Wire Protocol & Handshake', tier: 'pair-adjacent', stages: ['S1', 'S2'], status: 'draft', path: 'pairs/adjacent/ADR-S1-S2-physical-edge.md', wordCount: 1000 },
  { id: 'S2-S3', title: 'Edge → Transport — MQTT-NATS Bridge', tier: 'pair-adjacent', stages: ['S2', 'S3'], status: 'draft', path: 'pairs/adjacent/ADR-S2-S3-edge-transport.md', wordCount: 1000 },
  { id: 'S3-S4', title: 'Transport → Ingestion — Subject Subscription', tier: 'pair-adjacent', stages: ['S3', 'S4'], status: 'draft', path: 'pairs/adjacent/ADR-S3-S4-transport-ingestion.md', wordCount: 1000 },
  { id: 'S4-S5', title: 'Ingestion → Storage — Schema-to-Model', tier: 'pair-adjacent', stages: ['S4', 'S5'], status: 'draft', path: 'pairs/adjacent/ADR-S4-S5-ingestion-storage.md', wordCount: 1000 },
  { id: 'S5-S6', title: 'Storage → Client — Query API & Watch', tier: 'pair-adjacent', stages: ['S5', 'S6'], status: 'draft', path: 'pairs/adjacent/ADR-S5-S6-storage-client.md', wordCount: 1000 },
  { id: 'S6-S7', title: 'Client → Filtering — Server vs Client', tier: 'pair-adjacent', stages: ['S6', 'S7'], status: 'draft', path: 'pairs/adjacent/ADR-S6-S7-client-filtering.md', wordCount: 1000 },
  { id: 'S7-S8', title: 'Filtering → State — Delta-to-Atom Update', tier: 'pair-adjacent', stages: ['S7', 'S8'], status: 'draft', path: 'pairs/adjacent/ADR-S7-S8-filtering-state.md', wordCount: 1000 },
  { id: 'S8-S9', title: 'State → React — Subscription Granularity', tier: 'pair-adjacent', stages: ['S8', 'S9'], status: 'draft', path: 'pairs/adjacent/ADR-S8-S9-state-react.md', wordCount: 1000 },

  // Wave 3: Synergy Pairs
  { id: 'S1-S9', title: 'Physical ↔ React — E2E Latency Budget', tier: 'pair-synergy', stages: ['S1', 'S9'], status: 'draft', path: 'pairs/synergy/ADR-S1-S9-e2e-latency.md', wordCount: 1000 },
  { id: 'S2-S8', title: 'Edge ↔ State — Offline-First', tier: 'pair-synergy', stages: ['S2', 'S8'], status: 'draft', path: 'pairs/synergy/ADR-S2-S8-offline-first.md', wordCount: 1000 },
  { id: 'S3-S7', title: 'Transport ↔ Filtering — Filter Placement', tier: 'pair-synergy', stages: ['S3', 'S7'], status: 'draft', path: 'pairs/synergy/ADR-S3-S7-filter-placement.md', wordCount: 1000 },
  { id: 'S4-S6', title: 'Ingestion ↔ Client — Schema Contract', tier: 'pair-synergy', stages: ['S4', 'S6'], status: 'draft', path: 'pairs/synergy/ADR-S4-S6-schema-contract.md', wordCount: 1000 },

  // Wave 3: Sequential Triplets
  { id: 'S1-S2-S3', title: 'Sensor-to-Cloud Ingestion Pipeline', tier: 'triplet-sequential', stages: ['S1', 'S2', 'S3'], status: 'draft', path: 'triplets/sequential/ADR-S1-S2-S3-sensor-cloud.md', wordCount: 2000 },
  { id: 'S4-S5-S6', title: 'Backend Data Plane Architecture', tier: 'triplet-sequential', stages: ['S4', 'S5', 'S6'], status: 'draft', path: 'triplets/sequential/ADR-S4-S5-S6-backend-plane.md', wordCount: 2000 },
  { id: 'S7-S8-S9', title: 'Frontend Data Flow Pipeline', tier: 'triplet-sequential', stages: ['S7', 'S8', 'S9'], status: 'draft', path: 'triplets/sequential/ADR-S7-S8-S9-frontend-flow.md', wordCount: 2000 },

  // Wave 4: Cross-cutting Triplets
  { id: 'S1-S5-S9', title: 'E2E Observability & Tracing', tier: 'triplet-crosscut', stages: ['S1', 'S5', 'S9'], status: 'draft', path: 'triplets/crosscut/ADR-S1-S5-S9-observability.md', wordCount: 2000 },
  { id: 'S3-S6-S8', title: 'Error Propagation & Recovery', tier: 'triplet-crosscut', stages: ['S3', 'S6', 'S8'], status: 'draft', path: 'triplets/crosscut/ADR-S3-S6-S8-error-handling.md', wordCount: 2000 },
]

// =============================================================================
// STATUS HELPERS
// =============================================================================

const STATUS_CONFIG: Record<ADRStatus, { icon: typeof Check; color: string; bg: string; label: string }> = {
  draft: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Draft' },
  review: { icon: MessageSquare, color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'Review' },
  accepted: { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Accepted' },
  superseded: { icon: Archive, color: 'text-neutral-500', bg: 'bg-neutral-500/10', label: 'Superseded' },
}

const TIER_CONFIG: Record<ADRTier, { icon: typeof Cpu; color: string; label: string }> = {
  isolated: { icon: Cpu, color: 'text-blue-400', label: 'Isolated' },
  'pair-adjacent': { icon: GitBranch, color: 'text-purple-400', label: 'Adjacent' },
  'pair-synergy': { icon: Layers, color: 'text-pink-400', label: 'Synergy' },
  'triplet-sequential': { icon: GitBranch, color: 'text-orange-400', label: 'Sequential' },
  'triplet-crosscut': { icon: Layers, color: 'text-red-400', label: 'Cross-cut' },
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const StatusBadge = memo(function StatusBadge({ status }: { status: ADRStatus }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded', config.bg)}>
      <Icon size={12} className={config.color} />
      <span className={cn('font-mono text-xs', config.color)}>{config.label}</span>
    </div>
  )
})

const TierBadge = memo(function TierBadge({ tier }: { tier: ADRTier }) {
  const config = TIER_CONFIG[tier]
  const Icon = config.icon
  return (
    <div className="flex items-center gap-1">
      <Icon size={12} className={config.color} />
      <span className={cn('font-mono text-xs', config.color)}>{config.label}</span>
    </div>
  )
})

const StagePill = memo(function StagePill({ stageId }: { stageId: string }) {
  const stage = PIPELINE_STAGES[stageId as keyof typeof PIPELINE_STAGES]
  if (!stage) return null
  return (
    <div
      className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-xs"
      title={`${stage.name}: ${stage.description}`}
    >
      {stageId}
    </div>
  )
})

// =============================================================================
// LIST ITEM COMPONENT
// =============================================================================

interface ADRListItemProps {
  entry: ADRManifestEntry
  isSelected: boolean
  onSelect: () => void
}

const ADRListItem = memo(function ADRListItem({ entry, isSelected, onSelect }: ADRListItemProps) {
  return (
    <div
      className={cn(
        'p-3 border-b border-white/5 cursor-pointer transition-colors',
        isSelected ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500' : 'hover:bg-white/[0.02]'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-white">{entry.id}</span>
          <TierBadge tier={entry.tier} />
        </div>
        <StatusBadge status={entry.status} />
      </div>
      <div className="text-white/70 text-sm mb-2">{entry.title}</div>
      <div className="flex items-center gap-1">
        {entry.stages.map((s) => (
          <StagePill key={s} stageId={s} />
        ))}
        <span className="ml-auto font-mono text-white/30 text-xs">~{entry.wordCount}w</span>
      </div>
    </div>
  )
})

// =============================================================================
// FILTER PANEL
// =============================================================================

type TierFilter = ADRTier | 'all'

interface FilterPanelProps {
  tierFilter: TierFilter
  onTierChange: (tier: TierFilter) => void
}

const FilterPanel = memo(function FilterPanel({ tierFilter, onTierChange }: FilterPanelProps) {
  const tiers: TierFilter[] = ['all', 'isolated', 'pair-adjacent', 'pair-synergy', 'triplet-sequential', 'triplet-crosscut']

  return (
    <div className="p-3 border-b border-white/10 space-y-3">
      <div className="flex items-center gap-2">
        <Filter size={12} className="text-white/50" />
        <span className="font-mono text-white/50 text-xs">TIER FILTER</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {tiers.map((t) => (
          <button
            key={t}
            onClick={() => onTierChange(t)}
            className={cn(
              'px-2 py-0.5 rounded font-mono text-xs transition-colors',
              tierFilter === t
                ? 'bg-white/10 text-white'
                : 'bg-white/5 text-white/40 hover:text-white/70'
            )}
          >
            {t === 'all' ? 'All' : TIER_CONFIG[t].label}
          </button>
        ))}
      </div>
    </div>
  )
})

// =============================================================================
// STATS PANEL
// =============================================================================

const StatsPanel = memo(function StatsPanel({ entries }: { entries: ADRManifestEntry[] }) {
  const totalWords = entries.reduce((sum, e) => sum + e.wordCount, 0)
  const byTier = useMemo(() => {
    const counts: Record<string, number> = {}
    entries.forEach((e) => {
      counts[e.tier] = (counts[e.tier] || 0) + 1
    })
    return counts
  }, [entries])

  return (
    <div className="p-3 border-b border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-2xl text-white">{entries.length}</span>
        <span className="font-mono text-white/40 text-xs">~{(totalWords / 1000).toFixed(1)}k words</span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(byTier).map(([tier, count]) => (
          <span key={tier} className="font-mono text-white/50">
            {TIER_CONFIG[tier as ADRTier]?.label}: {count}
          </span>
        ))}
      </div>
    </div>
  )
})

// =============================================================================
// ADR DETAIL PANEL (Uses ADRReview compound component)
// =============================================================================

interface ADRDetailPanelProps {
  entry: ADRManifestEntry
  markdown: string | null
  isLoading: boolean
  onRefresh: () => void
}

function ADRDetailPanel({ entry, markdown, isLoading, onRefresh }: ADRDetailPanelProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={32} className="mx-auto mb-4 text-cyan-400 animate-spin" />
          <div className="font-mono text-white/40">Loading ADR content...</div>
        </div>
      </div>
    )
  }

  if (!markdown) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <FileText size={48} className="mx-auto mb-4 text-white/20" />
          <div className="font-mono text-white/40 mb-2">Unable to load ADR content</div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 mx-auto px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors font-mono text-sm"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <ADRReview.Provider adrId={entry.id} markdown={markdown}>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <ADRReview.Header />
        </div>

        {/* Filter bar */}
        <div className="px-4 py-2 border-b border-white/10 bg-neutral-900/50">
          <ADRReview.Filter />
        </div>

        {/* Document content */}
        <div className="flex-1 overflow-y-auto p-4">
          <ADRReview.Document />
        </div>
      </div>
    </ADRReview.Provider>
  )
}

// =============================================================================
// MAIN TESTBED
// =============================================================================

export function PipelineADRTestbed() {
  // State
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [markdownCache, setMarkdownCache] = useState<Map<string, string>>(new Map())
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Derived state
  const filteredEntries = useMemo(() => {
    return ADR_MANIFEST.filter((e) => {
      if (tierFilter !== 'all' && e.tier !== tierFilter) return false
      return true
    })
  }, [tierFilter])

  const selectedEntry = useMemo(
    () => ADR_MANIFEST.find((e) => e.id === selectedId),
    [selectedId]
  )

  // Load markdown content when selection changes
  const loadMarkdown = useCallback(async (entry: ADRManifestEntry) => {
    // Check cache first
    if (markdownCache.has(entry.id)) return

    setLoadingId(entry.id)
    try {
      // Fetch markdown file
      const response = await fetch(`/assets/documents/pipeline-adr/${entry.path}`)
      if (response.ok) {
        const content = await response.text()
        setMarkdownCache((prev) => new Map(prev).set(entry.id, content))
      }
    } catch (err) {
      console.error('Failed to load ADR:', err)
    } finally {
      setLoadingId(null)
    }
  }, [markdownCache])

  // Load markdown when selection changes
  useEffect(() => {
    if (selectedEntry) {
      loadMarkdown(selectedEntry)
    }
  }, [selectedEntry, loadMarkdown])

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const handleRefresh = useCallback(() => {
    if (selectedEntry) {
      setMarkdownCache((prev) => {
        const next = new Map(prev)
        next.delete(selectedEntry.id)
        return next
      })
      loadMarkdown(selectedEntry)
    }
  }, [selectedEntry, loadMarkdown])

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/50">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <FileText size={18} className="text-cyan-400" />
          <span className="font-mono font-medium">Pipeline ADR Review</span>
          <span className="text-white/30">|</span>
          <span className="font-mono text-white/50 text-xs">Commit: 6656064</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadDigest}
            className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors font-mono text-xs"
          >
            <Download size={12} />
            Export JSON
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar: ADR List */}
        <div className="w-80 border-r border-white/10 flex flex-col">
          <StatsPanel entries={ADR_MANIFEST} />
          <FilterPanel tierFilter={tierFilter} onTierChange={setTierFilter} />
          <div className="flex-1 overflow-y-auto">
            {filteredEntries.map((entry) => (
              <ADRListItem
                key={entry.id}
                entry={entry}
                isSelected={entry.id === selectedId}
                onSelect={() => handleSelect(entry.id)}
              />
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 flex flex-col">
          {selectedEntry ? (
            <ADRDetailPanel
              entry={selectedEntry}
              markdown={markdownCache.get(selectedEntry.id) || null}
              isLoading={loadingId === selectedEntry.id}
              onRefresh={handleRefresh}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Layers size={64} className="mx-auto mb-4 text-white/10" />
                <div className="font-mono text-white/40">Select an ADR to review</div>
                <div className="font-mono text-white/30 mt-1 text-xs">
                  {ADR_MANIFEST.length} documents across 5 tiers
                </div>
                <div className="mt-4 text-xs text-white/30 max-w-md mx-auto">
                  Each ADR is decomposed into reviewable units. Accept, reject, or discuss each
                  decision point individually.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
