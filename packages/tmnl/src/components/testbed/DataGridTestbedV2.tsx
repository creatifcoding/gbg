/**
 * DataGrid Testbed V2
 *
 * Tests the NEW unified Tmnl.DataGrid from lib/data-grid.
 * Mirror of DataGridTestbed but using the consolidated implementation.
 *
 * Route: /testbed/data-grid (via wrapper toggle)
 */

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { SectionLabel, TestCard } from '@/components/testbed/shared'

// NEW: Unified DataGrid from lib/data-grid
import {
  Tmnl,
  tmnlDenseDark,
  tmnlDenseDarkMuted,
  tmnlUltraOps,
  tmnlAnalystLight,
  type GridVariantType,
} from '@/lib/data-grid'

// =============================================================================
// TEST DATA
// =============================================================================

interface TestRow {
  id: string
  name: string
  value: number
  status: 'active' | 'pending' | 'inactive'
}

const EMITTER_DATA: TestRow[] = [
  { id: 'E001', name: 'RADAR-ALPHA', value: 92, status: 'active' },
  { id: 'E002', name: 'COMMS-DELTA', value: 67, status: 'active' },
  { id: 'E003', name: 'JAMMER-SIGMA', value: 45, status: 'pending' },
  { id: 'E004', name: 'BEACON-OMEGA', value: 88, status: 'active' },
  { id: 'E005', name: 'SAT-UPLINK', value: 23, status: 'inactive' },
  { id: 'E006', name: 'RELAY-THETA', value: 71, status: 'active' },
  { id: 'E007', name: 'PULSE-KAPPA', value: 34, status: 'pending' },
  { id: 'E008', name: 'SWEEP-ZETA', value: 95, status: 'active' },
]

const ACTOR_DATA: TestRow[] = [
  { id: 'A101', name: 'UNIT-BRAVO', value: 100, status: 'active' },
  { id: 'A102', name: 'ASSET-CHARLIE', value: 75, status: 'pending' },
  { id: 'A103', name: 'NODE-FOXTROT', value: 50, status: 'active' },
]

const LARGE_DATA: TestRow[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: `L${String(i + 1).padStart(5, '0')}`,
  name: `ITEM-${String(i + 1).padStart(6, '0')}`,
  value: Math.floor(Math.random() * 100),
  status: (['active', 'pending', 'inactive'] as const)[i % 3],
}))

// =============================================================================
// VARIANT SELECTOR
// =============================================================================

const VARIANTS: { id: string; label: string; variant: GridVariantType }[] = [
  { id: 'dense-dark', label: 'Dense Dark', variant: tmnlDenseDark },
  { id: 'dense-muted', label: 'Dense Muted', variant: tmnlDenseDarkMuted },
  { id: 'ultra-ops', label: 'Ultra Ops', variant: tmnlUltraOps },
  { id: 'analyst-light', label: 'Analyst Light', variant: tmnlAnalystLight },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DataGridTestbedV2() {
  const [selectedVariant, setSelectedVariant] = useState(VARIANTS[0])
  const [dynamicData, setDynamicData] = useState<TestRow[]>(EMITTER_DATA.slice(0, 5))
  const [checks, setChecks] = useState<Record<string, boolean>>({})

  const addRow = () => {
    const newId = `D${String(dynamicData.length + 1).padStart(3, '0')}`
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
    { key: 'renders', label: 'Grid renders without errors' },
    { key: 'variant', label: 'Variant switching works' },
    { key: 'resize', label: 'Columns resize on drag' },
    { key: 'sort', label: 'Columns sort on header click' },
    { key: 'dynamic', label: 'Dynamic add/remove updates grid' },
    { key: 'scroll', label: 'Large dataset scrolls smoothly' },
    { key: 'context', label: 'Context provides variant to subcomponents' },
    { key: 'compound', label: 'Compound pattern (Header/Body) works' },
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
                DataGrid Testbed{' '}
                <span className="text-cyan-500">V2 (Tmnl.DataGrid)</span>
              </h1>
              <p
                className="font-mono text-neutral-600 mt-0.5"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Testing unified lib/data-grid implementation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Variant selector */}
            <select
              value={selectedVariant.id}
              onChange={(e) => {
                const v = VARIANTS.find((v) => v.id === e.target.value)
                if (v) setSelectedVariant(v)
              }}
              className="bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono px-2 py-1"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {VARIANTS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span
                className="font-mono text-neutral-500 uppercase"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {Object.values(checks).filter(Boolean).length}/{checkItems.length} checks
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ================================================================= */}
        {/* BASIC GRIDS */}
        {/* ================================================================= */}
        <section className="mb-12">
          <SectionLabel variant="gradient">Basic Grids (Tmnl.DataGrid)</SectionLabel>

          <div className="grid grid-cols-2 gap-6">
            {/* Standard with compound pattern */}
            <TestCard variant="compact" label="Compound Pattern">
              <div style={{ height: 240 }}>
                <Tmnl.DataGrid
                  id="compound-test"
                  variant={selectedVariant.variant}
                  rowData={EMITTER_DATA}
                  columnDefs={[
                    { field: 'id', headerName: 'ID', width: 80 },
                    { field: 'name', headerName: 'NAME', flex: 1 },
                    { field: 'value', headerName: 'VALUE', width: 100 },
                    { field: 'status', headerName: 'STATUS', width: 100 },
                  ]}
                >
                  <Tmnl.DataGrid.Header>
                    <Tmnl.DataGrid.Title title="EMITTERS" badge={EMITTER_DATA.length} />
                    <Tmnl.DataGrid.SettingsButton />
                  </Tmnl.DataGrid.Header>
                  <Tmnl.DataGrid.Body />
                  <Tmnl.DataGrid.StatusBar>
                    <span>Ready</span>
                    <span>{EMITTER_DATA.length} rows</span>
                  </Tmnl.DataGrid.StatusBar>
                  <Tmnl.DataGrid.CornerDecorations />
                </Tmnl.DataGrid>
              </div>
            </TestCard>

            {/* Minimal - no children (default body) */}
            <TestCard variant="compact" label="Minimal (Default Body)">
              <div style={{ height: 240 }}>
                <Tmnl.DataGrid
                  id="minimal-test"
                  variant={selectedVariant.variant}
                  rowData={ACTOR_DATA}
                  columnDefs={[
                    { field: 'id', headerName: 'ID', width: 80 },
                    { field: 'name', headerName: 'NAME', flex: 1 },
                    { field: 'value', headerName: 'VALUE', width: 100 },
                    { field: 'status', headerName: 'STATUS', width: 100 },
                  ]}
                />
              </div>
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
              <div style={{ height: 240 }}>
                <Tmnl.DataGrid
                  id="dynamic-test"
                  variant={selectedVariant.variant}
                  rowData={dynamicData}
                  columnDefs={[
                    { field: 'id', headerName: 'ID', width: 80 },
                    { field: 'name', headerName: 'NAME', flex: 1 },
                    { field: 'value', headerName: 'VALUE', width: 100 },
                    { field: 'status', headerName: 'STATUS', width: 100 },
                  ]}
                >
                  <Tmnl.DataGrid.Header>
                    <Tmnl.DataGrid.Title title="DYNAMIC" badge={dynamicData.length} />
                  </Tmnl.DataGrid.Header>
                  <Tmnl.DataGrid.Body />
                </Tmnl.DataGrid>
              </div>
            </TestCard>

            {/* Large dataset */}
            <TestCard variant="compact" label="Large Dataset (10k rows)">
              <div style={{ height: 240 }}>
                <Tmnl.DataGrid
                  id="large-test"
                  variant={selectedVariant.variant}
                  rowData={LARGE_DATA}
                  columnDefs={[
                    { field: 'id', headerName: 'ID', width: 100 },
                    { field: 'name', headerName: 'NAME', flex: 1 },
                    { field: 'value', headerName: 'VALUE', width: 100 },
                    { field: 'status', headerName: 'STATUS', width: 100 },
                  ]}
                >
                  <Tmnl.DataGrid.Header>
                    <Tmnl.DataGrid.Title title="VIRTUALIZED" badge="10k" />
                  </Tmnl.DataGrid.Header>
                  <Tmnl.DataGrid.Body />
                </Tmnl.DataGrid>
              </div>
            </TestCard>
          </div>
        </section>

        {/* ================================================================= */}
        {/* CHECKLIST */}
        {/* ================================================================= */}
        <section>
          <SectionLabel variant="gradient">Manual Verification</SectionLabel>

          <div className="grid grid-cols-4 gap-4">
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
    </div>
  )
}
