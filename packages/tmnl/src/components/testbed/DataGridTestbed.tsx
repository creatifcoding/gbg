/**
 * DataGrid Testbed
 *
 * Regression test + FUI modal demo for the modular DataGrid component.
 * Route: /testbed/data-grid
 */

import { useState, useReducer, memo } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Maximize2, X } from 'lucide-react'
import { DataGrid, useTypewriterReveal, useDataGrid, TMNL_TOKENS } from '../data-grid'
import type { DataGridRow } from '../data-grid'
import { FuiModal } from '@/lib/fui'
import { SectionLabel, TestCard } from '@/components/testbed/shared'

// =============================================================================
// RENDER-TRACKED COMPONENTS (for isolation proof)
// =============================================================================

// Module-level counters survive re-renders, reset on page reload
const renderCounts = {
  title: 0,
  status: 0,
}

/**
 * TrackedTitle — memo'd, receives `title` as prop, consumes `scaledPx` from context.
 * Re-renders when: title prop changes OR context changes.
 */
const TrackedTitle = memo(function TrackedTitle({ title }: { title: string }) {
  renderCounts.title++
  const { scaledPx } = useDataGrid()

  return (
    <span
      className="font-mono uppercase tracking-widest text-neutral-500 group-hover:text-white transition-colors"
      style={{ fontSize: scaledPx(TMNL_TOKENS.typography.fontSizeSm) }}
    >
      {title}{' '}
      <span className="text-cyan-500 ml-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>r:{renderCounts.title}</span>
    </span>
  )
})

/**
 * TrackedStatusIndicator — memo'd, no props, consumes `rowData` + `scaledPx` from context.
 * Re-renders when: context changes (specifically rowData).
 */
const TrackedStatusIndicator = memo(function TrackedStatusIndicator() {
  renderCounts.status++
  const { rowData, scaledPx } = useDataGrid()

  return (
    <div className="ml-auto flex items-center gap-2">
      <span
        className="font-mono text-neutral-600 uppercase"
        style={{ fontSize: scaledPx(7) }}
      >
        {rowData.length} rows{' '}
        <span className="text-cyan-500">r:{renderCounts.status}</span>
      </span>
      <div
        className="w-1.5 h-1.5 bg-white/50"
        style={{ boxShadow: '0 0 4px rgba(255, 255, 255, 0.3)' }}
      />
    </div>
  )
})

// =============================================================================
// TEST DATA SETS
// =============================================================================

const EMITTER_DATA: DataGridRow[] = [
  { id: 1, name: 'RADAR-ALPHA', value: 92, status: 'active' },
  { id: 2, name: 'COMMS-DELTA', value: 67, status: 'active' },
  { id: 3, name: 'JAMMER-SIGMA', value: 45, status: 'pending' },
  { id: 4, name: 'BEACON-OMEGA', value: 88, status: 'active' },
  { id: 5, name: 'SAT-UPLINK', value: 23, status: 'inactive' },
  { id: 6, name: 'RELAY-THETA', value: 71, status: 'active' },
  { id: 7, name: 'PULSE-KAPPA', value: 34, status: 'pending' },
  { id: 8, name: 'SWEEP-ZETA', value: 95, status: 'active' },
]

const ACTOR_DATA: DataGridRow[] = [
  { id: 101, name: 'UNIT-BRAVO', value: 100, status: 'active' },
  { id: 102, name: 'ASSET-CHARLIE', value: 75, status: 'pending' },
  { id: 103, name: 'NODE-FOXTROT', value: 50, status: 'active' },
]

const MINIMAL_DATA: DataGridRow[] = [
  { id: 1, name: 'SINGLE-ROW', value: 50, status: 'active' },
]

const LARGE_DATA: DataGridRow[] = Array.from({ length: 100_000 }, (_, i) => ({
  id: i + 1,
  name: `ITEM-${String(i + 1).padStart(6, '0')}`,
  value: Math.floor(Math.random() * 100),
  status: ['active', 'pending', 'inactive'][i % 3] as DataGridRow['status'],
}))

// =============================================================================
// RENDER ISOLATION PROOF
// =============================================================================

const TITLE_CYCLE = ['ISOLATED', 'MODIFIED', 'UPDATED', 'CHANGED'] as const

function RenderIsolationProof() {
  const [titleIndex, setTitleIndex] = useState(0)
  const [isolationData, setIsolationData] = useState<DataGridRow[]>(
    EMITTER_DATA.slice(0, 3)
  )
  const [, forceParent] = useReducer((x) => x + 1, 0)

  const cycleTitle = () => {
    setTitleIndex((i) => (i + 1) % TITLE_CYCLE.length)
  }

  const addRow = () => {
    setIsolationData((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        name: `ROW-${prev.length + 1}`,
        value: Math.floor(Math.random() * 100),
        status: 'pending' as const,
      },
    ])
  }

  const title = TITLE_CYCLE[titleIndex]

  return (
    <section className="mb-12">
      <SectionLabel variant="gradient">Render Isolation Proof</SectionLabel>

      <div className="grid grid-cols-[1fr,340px] gap-6">
        {/* DataGrid with tracked components */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-mono uppercase tracking-widest text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Tracked Components
            </div>
            <div className="flex gap-1">
              <button
                onClick={cycleTitle}
                className="px-2 py-1 font-mono border border-neutral-700 hover:border-cyan-500 hover:text-cyan-500 transition-colors"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                CYCLE TITLE
              </button>
              <button
                onClick={addRow}
                className="px-2 py-1 font-mono border border-neutral-700 hover:border-amber-500 hover:text-amber-500 transition-colors"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                ADD ROW
              </button>
              <button
                onClick={forceParent}
                className="px-2 py-1 font-mono border border-neutral-700 hover:border-neutral-500 hover:text-neutral-400 transition-colors"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                FORCE PARENT
              </button>
            </div>
          </div>

          <DataGrid id="isolation-proof" rowData={isolationData} height={180}>
            <DataGrid.CornerDecorations />
            <DataGrid.Header>
              <TrackedTitle title={title} />
              <TrackedStatusIndicator />
            </DataGrid.Header>
            <DataGrid.Body />
          </DataGrid>

          <div className="font-mono text-neutral-600 mt-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Cyan <span className="text-cyan-500">r:N</span> = render count.
            Watch counts change with each button.
          </div>
        </div>

        {/* Explanation panel */}
        <div className="border border-dashed border-neutral-800 bg-neutral-900/20 p-4">
          <div className="font-mono uppercase tracking-widest text-neutral-500 mb-3" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Why Isolation Works
          </div>
          <div className="space-y-3 font-mono text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            <div>
              <div className="text-neutral-400 mb-1">CYCLE TITLE →</div>
              <div>
                Title: <span className="text-cyan-500">+1</span> (prop changed)
                <br />
                Status: <span className="text-neutral-500">+0</span> (memo blocks, props unchanged)
              </div>
            </div>
            <div>
              <div className="text-neutral-400 mb-1">ADD ROW →</div>
              <div>
                Title: <span className="text-cyan-500">+1</span> (context changed)
                <br />
                Status: <span className="text-cyan-500">+1</span> (context changed)
              </div>
              <div className="text-neutral-700 mt-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                * Both consume useDataGrid() — context change triggers both
              </div>
            </div>
            <div>
              <div className="text-neutral-400 mb-1">FORCE PARENT →</div>
              <div>
                Title: <span className="text-neutral-500">+0</span> (memo blocks)
                <br />
                Status: <span className="text-neutral-500">+0</span> (memo blocks)
              </div>
              <div className="text-neutral-700 mt-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                * Context unchanged, useMemo returns same ref
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-800/50">
            <div className="font-mono text-neutral-700" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Key insight: Title prop decoupled from context means title changes
              don't cascade to StatusIndicator.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DataGridTestbed() {
  const [dynamicData, setDynamicData] = useState<DataGridRow[]>(EMITTER_DATA.slice(0, 5))
  const [modalOpen, setModalOpen] = useState(false)
  const [checks, setChecks] = useState<Record<string, boolean>>({})

  // Typewriter reveal for modal elevation
  const { containerRef, triggerReveal } = useTypewriterReveal()

  const addRow = () => {
    const newId = Math.max(...dynamicData.map((r) => r.id), 0) + 1
    setDynamicData((prev) => [
      ...prev,
      {
        id: newId,
        name: `NEW-ITEM-${newId}`,
        value: Math.floor(Math.random() * 100),
        status: 'pending' as const,
      },
    ])
  }

  const removeRow = () => {
    setDynamicData((prev) => prev.slice(0, -1))
  }

  const toggleCheck = (key: string) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const checkItems = [
    { key: 'resize', label: 'Columns resize on drag' },
    { key: 'sort', label: 'Columns sort on header click' },
    { key: 'reorder', label: 'Rows reorder via drag handle' },
    { key: 'highlight', label: 'Row highlight on drag enter' },
    { key: 'glow', label: 'Container glow on drag enter' },
    { key: 'dynamic', label: 'Dynamic add/remove updates grid' },
    { key: 'scroll', label: 'Large dataset scrolls smoothly' },
    { key: 'status', label: 'Status indicators render correctly' },
    { key: 'modal', label: 'FUI modal typewriter reveal works' },
  ]

  return (
    <div className="min-h-screen w-screen bg-neutral-950">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-neutral-600 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="font-mono text-sm uppercase tracking-widest text-neutral-300">
                DataGrid Testbed
              </h1>
              <p className="font-mono text-neutral-600 mt-0.5" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Regression tests + FUI modal elevation demo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-neutral-500 uppercase" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {Object.values(checks).filter(Boolean).length}/{checkItems.length} checks
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ================================================================= */}
        {/* FUI MODAL DEMO */}
        {/* ================================================================= */}
        <section className="mb-12">
          <SectionLabel variant="gradient">FUI Modal Elevation</SectionLabel>

          <div className="grid grid-cols-[1fr,300px] gap-6">
            {/* Demo trigger area */}
            <div className="relative border border-neutral-800 bg-neutral-900/30 p-6 flex flex-col items-center justify-center min-h-[280px]">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neutral-700" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neutral-700" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neutral-700" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neutral-700" />

              <button
                onClick={() => setModalOpen(true)}
                className="group relative px-8 py-4 border border-neutral-700 hover:border-white/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
              >
                <div className="flex items-center gap-3">
                  <Maximize2
                    size={18}
                    className="text-neutral-500 group-hover:text-white transition-colors"
                  />
                  <span className="font-mono text-sm uppercase tracking-widest text-neutral-400 group-hover:text-white transition-colors">
                    Elevate DataGrid
                  </span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <p className="mt-4 font-mono text-neutral-600 text-center max-w-xs" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Opens DataGrid in vantablack modal with typewriter row reveal
              </p>
            </div>

            {/* Info panel */}
            <div className="border border-dashed border-neutral-800 bg-neutral-900/20 p-4">
              <div className="font-mono uppercase tracking-widest text-neutral-500 mb-3" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Animation Sequence
              </div>
              <ol className="font-mono text-neutral-600 space-y-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                <li className="flex items-start gap-2">
                  <span className="text-neutral-500">1.</span>
                  <span>Backdrop fades with blur</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neutral-500">2.</span>
                  <span>Vantablack container scales in</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neutral-500">3.</span>
                  <span>Rows typewriter reveal L→R (anime.js)</span>
                </li>
              </ol>
              <div className="mt-3 pt-3 border-t border-neutral-800/50">
                <div className="font-mono text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  clipPath: inset(0 100% 0 0) → inset(0 0 0 0)
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* RENDER ISOLATION PROOF */}
        {/* ================================================================= */}
        <RenderIsolationProof />

        {/* ================================================================= */}
        {/* REGRESSION TESTS */}
        {/* ================================================================= */}
        <section className="mb-12">
          <SectionLabel variant="gradient">Regression Tests</SectionLabel>

          <div className="grid grid-cols-3 gap-6">
            {/* Standard config */}
            <TestCard variant="compact" label="Standard (drag + sort + resize)">
              <DataGrid id="standard" rowData={EMITTER_DATA} height={200}>
                <DataGrid.CornerDecorations />
                <DataGrid.Header>
                  <DataGrid.Title title="EMITTERS" />
                  <DataGrid.StatusIndicator />
                </DataGrid.Header>
                <DataGrid.Body />
              </DataGrid>
            </TestCard>

            {/* No drag */}
            <TestCard variant="compact" label="No Drag Handle">
              <DataGrid id="no-drag" rowData={ACTOR_DATA} height={200} behavior={{ enableDrag: false }}>
                <DataGrid.CornerDecorations />
                <DataGrid.Header>
                  <DataGrid.Title title="ACTORS" />
                  <DataGrid.StatusIndicator />
                </DataGrid.Header>
                <DataGrid.Body />
              </DataGrid>
            </TestCard>

            {/* Minimal data */}
            <TestCard variant="compact" label="Single Row">
              <DataGrid id="minimal" rowData={MINIMAL_DATA} height={120}>
                <DataGrid.CornerDecorations />
                <DataGrid.Header>
                  <DataGrid.Title title="MINIMAL" />
                  <DataGrid.StatusIndicator />
                </DataGrid.Header>
                <DataGrid.Body />
              </DataGrid>
            </TestCard>

            {/* Large dataset */}
            <TestCard variant="compact" label="Large Dataset (100k rows)">
              <DataGrid id="large" rowData={LARGE_DATA} height={200}>
                <DataGrid.CornerDecorations />
                <DataGrid.Header>
                  <DataGrid.Title title="VIRTUALIZED" />
                  <DataGrid.StatusIndicator />
                </DataGrid.Header>
                <DataGrid.Body />
              </DataGrid>
            </TestCard>

            {/* Dynamic data */}
            <TestCard
              variant="compact"
              label="Dynamic Data"
              actions={
                <div className="flex gap-1">
                  <button
                    onClick={addRow}
                    className="px-1.5 py-0.5 font-mono border border-neutral-700 hover:border-cyan-500 hover:text-cyan-500 transition-colors"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    + ADD
                  </button>
                  <button
                    onClick={removeRow}
                    className="px-1.5 py-0.5 font-mono border border-neutral-700 hover:border-red-500 hover:text-red-500 transition-colors"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    − REMOVE
                  </button>
                </div>
              }
            >
              <DataGrid id="dynamic" rowData={dynamicData} height={200}>
                <DataGrid.CornerDecorations />
                <DataGrid.Header>
                  <DataGrid.Title title="DYNAMIC" />
                  <DataGrid.StatusIndicator />
                </DataGrid.Header>
                <DataGrid.Body />
              </DataGrid>
            </TestCard>

            {/* Fixed dimensions */}
            <TestCard variant="compact" label="Fixed 280×180">
              <DataGrid id="fixed" rowData={ACTOR_DATA} width={280} height={180}>
                <DataGrid.CornerDecorations />
                <DataGrid.Header>
                  <DataGrid.Title title="FIXED SIZE" />
                  <DataGrid.StatusIndicator />
                </DataGrid.Header>
                <DataGrid.Body />
              </DataGrid>
            </TestCard>
          </div>
        </section>

        {/* ================================================================= */}
        {/* CHECKLIST */}
        {/* ================================================================= */}
        <section>
          <SectionLabel variant="gradient">Manual Verification</SectionLabel>

          <div className="grid grid-cols-3 gap-4">
            {checkItems.map((item) => (
              <button
                key={item.key}
                onClick={() => toggleCheck(item.key)}
                className={`
                  flex items-center gap-3 p-3 border transition-all text-left
                  ${
                    checks[item.key]
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }
                `}
              >
                <div
                  className={`
                    w-4 h-4 border flex items-center justify-center
                    ${
                      checks[item.key]
                        ? 'border-emerald-500 text-emerald-500'
                        : 'border-neutral-700 text-transparent'
                    }
                  `}
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  ✓
                </div>
                <span
                  className={`
                    font-mono
                    ${checks[item.key] ? 'text-neutral-300' : 'text-neutral-500'}
                  `}
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* ================================================================= */}
      {/* FUI MODAL */}
      {/* ================================================================= */}
      <FuiModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onOpenComplete={triggerReveal}
        fullScreen
      >
        <div className="flex flex-col h-full">
          {/* Modal header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50 shrink-0">
            <div className="font-mono uppercase tracking-widest text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Elevated DataGrid
            </div>
            <button
              onClick={() => setModalOpen(false)}
              className="text-neutral-600 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Grid container - fills remaining space */}
          <div ref={containerRef} className="flex-1 min-h-0">
            <DataGrid id="modal-elevated" rowData={EMITTER_DATA} height="100%">
              <DataGrid.CornerDecorations />
              <DataGrid.Header>
                <DataGrid.Title title="EMITTER ARRAY" />
                <DataGrid.StatusIndicator />
              </DataGrid.Header>
              <DataGrid.Body />
            </DataGrid>
          </div>
        </div>
      </FuiModal>
    </div>
  )
}
