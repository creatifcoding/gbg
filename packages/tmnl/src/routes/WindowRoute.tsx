/**
 * WindowRoute — Child Window Entry Point
 *
 * Renders a testbed in a child Tauri window.
 * Reads ?testbed=<id> from query params, looks up the component,
 * and renders it inside WindowLayout (derived from AppShell).
 *
 * @module
 */

import { useSearch } from '@tanstack/react-router'
import { Suspense, lazy, useMemo, useEffect, useState, useRef } from 'react'
import { Effect } from 'effect'
import { getTestbedById, getWindowLabel } from '@/lib/testbed/registry'
import { WindowLayout, WindowHeaderContent } from '@/lib/shell'
import { getCurrentWindowLabel } from '@/lib/tauri-windows'

// ─────────────────────────────────────────────────────────────────────────────
// Performance Measurement
// ─────────────────────────────────────────────────────────────────────────────

const PERF_ENABLED = true // Set to false in production

interface PerfMetrics {
  navigationStart: number
  routeMount: number
  testbedResolved: number
  suspenseStart: number
  testbedMounted: number
}

function logPerf(label: string, startTime: number) {
  if (!PERF_ENABLED) return
  const elapsed = performance.now() - startTime
  console.log(`[WindowRoute:Perf] ${label}: ${elapsed.toFixed(1)}ms`)
}

/**
 * Hook to track when a component actually mounts (not just renders)
 */
function useOnMount(callback: () => void) {
  const hasRun = useRef(false)
  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true
      callback()
    }
  }, [callback])
}

/**
 * Wrapper to track testbed mount time
 */
function TestbedPerfWrapper({
  children,
  testbedId,
  onMount
}: {
  children: React.ReactNode
  testbedId: string
  onMount: () => void
}) {
  useOnMount(onMount)
  return <>{children}</>
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy Component Map
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map testbed IDs to lazy-loaded components.
 * This allows dynamic loading based on URL params.
 */
const TESTBED_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  // Data
  'data-manager': lazy(() => import('@/components/testbed/DataManagerTestbed').then(m => ({ default: m.DataManagerTestbed }))),
  'search': lazy(() => import('@/components/testbed/SearchTestbed').then(m => ({ default: m.SearchTestbed }))),
  'data-grid': lazy(() => import('@/components/testbed/DataGridTestbedSwitch').then(m => ({ default: m.DataGridTestbedSwitch }))),
  'data-grid-variants': lazy(() => import('@/components/testbed/DataGridVariantTestbedSwitch').then(m => ({ default: m.DataGridVariantTestbedSwitch }))),
  'search-service': lazy(() => import('@/components/testbed/SearchServiceTestbed').then(m => ({ default: m.SearchServiceTestbed }))),
  'search-to-kori': lazy(() => import('@/components/testbed/SearchToKoriTestbed').then(m => ({ default: m.SearchToKoriTestbed }))),
  'streaming-search': lazy(() => import('@/components/testbed/StreamingSearchTestbed').then(m => ({ default: m.StreamingSearchTestbed }))),
  'timeline-search': lazy(() => import('@/components/testbed/TimelineSearchTestbed').then(m => ({ default: m.TimelineSearchTestbed }))),
  'integrated-geoint': lazy(() => import('@/components/testbed/IntegratedGeointTestbed').then(m => ({ default: m.IntegratedGeointTestbed }))),
  // Animation
  'animation': lazy(() => import('@/components/testbed/AnimationTestbed').then(m => ({ default: m.AnimationTestbed }))),
  // UI
  'slider': lazy(() => import('@/components/testbed/SliderTestbed').then(m => ({ default: m.SliderTestbed }))),
  'base-modal': lazy(() => import('@/components/testbed/BaseModalTestbed').then(m => ({ default: m.BaseModalTestbed }))),
  'vanta': lazy(() => import('@/components/testbed/VantaCardTestbed').then(m => ({ default: m.VantaCardTestbed }))),
  'rvn': lazy(() => import('@/components/testbed/RvnTestbed').then(m => ({ default: m.RvnTestbed }))),
  'morph-card': lazy(() => import('@/components/testbed/MorphCardTestbed').then(m => ({ default: m.MorphCardTestbed }))),
  'drawer': lazy(() => import('@/components/testbed/DrawerTestbed').then(m => ({ default: m.DrawerTestbed }))),
  'floating': lazy(() => import('@/components/testbed/FloatingPanelTestbed').then(m => ({ default: m.FloatingPanelTestbed }))),
  'overlays': lazy(() => import('@/components/testbed/OverlayTestbed').then(m => ({ default: m.OverlayTestbed }))),
  'screensaver': lazy(() => import('@/components/testbed/ScreensaverTestbed').then(m => ({ default: m.ScreensaverTestbed }))),
  'selection': lazy(() => import('@/components/testbed/SelectionTestbed').then(m => ({ default: m.SelectionTestbed }))),
  'block-terminal': lazy(() => import('@/components/testbed/BlockTerminalTestbed').then(m => ({ default: m.BlockTerminalTestbed }))),
  // State
  'effect-atom': lazy(() => import('@/components/testbed/EffectAtomTestbed').then(m => ({ default: m.EffectAtomTestbed }))),
  'traits': lazy(() => import('@/components/testbed/TraitTestbed').then(m => ({ default: m.TraitTestbed }))),
  'capabilities': lazy(() => import('@/components/testbed/CapabilityTestbed').then(m => ({ default: m.CapabilityTestbed }))),
  'variables': lazy(() => import('@/components/testbed/VariablesTestbed').then(m => ({ default: m.VariablesTestbed }))),
  'axiom': lazy(() => import('@/components/testbed/AxiomTestbed').then(m => ({ default: m.AxiomTestbed }))),
  'kori': lazy(() => import('@/components/testbed/kori').then(m => ({ default: m.KoriTestbed }))),
  'kori-atoms': lazy(() => import('@/components/testbed/KoriAtomsTestbed').then(m => ({ default: m.KoriAtomsTestbed }))),
  'entity-ui-atoms': lazy(() => import('@/components/testbed/EntityUIAtomsTestbed').then(m => ({ default: m.EntityUIAtomsTestbed }))),
  'atom-rpc': lazy(() => import('@/components/testbed/AtomRpcTestbed').then(m => ({ default: m.AtomRpcTestbed }))),
  // Input
  'hotkeys': lazy(() => import('@/components/testbed/HotkeyTestbed').then(m => ({ default: m.HotkeyTestbed }))),
  'keybindings': lazy(() => import('@/components/testbed/KeybindingTestbed').then(m => ({ default: m.KeybindingTestbed }))),
  // Charting
  'charting': lazy(() => import('@/components/testbed/ChartingTestbed').then(m => ({ default: m.ChartingTestbed }))),
  'indices': lazy(() => import('@/components/testbed/IndicesTestbed').then(m => ({ default: m.IndicesTestbed }))),
  // Advanced
  'ava': lazy(() => import('@/components/testbed/AvaTestbed').then(m => ({ default: m.AvaTestbed }))),
  'fermion': lazy(() => import('@/components/testbed/FermionTestbed').then(m => ({ default: m.FermionTestbed }))),
  'terminal': lazy(() => import('@/components/testbed/TerminalTestbed').then(m => ({ default: m.TerminalTestbed }))),
  'geoint': lazy(() => import('@/components/testbed/GeointDashboardTestbed').then(m => ({ default: m.GeointDashboardTestbed }))),
  'collaboration': lazy(() => import('@/components/testbed/CollaborationTestbed').then(m => ({ default: m.CollaborationTestbed }))),
  'json-render': lazy(() => import('@/components/testbed/JSONRenderTestbed').then(m => ({ default: m.JSONRenderTestbed }))),
  // Infrastructure
  'dataplane': lazy(() => import('@/components/testbed/DataplaneTestbed').then(m => ({ default: m.DataplaneTestbed }))),
  'durable-streams': lazy(() => import('@/components/testbed/DurableStreamsTestbed').then(m => ({ default: m.DurableStreamsTestbed }))),
  'holonet-durable-streams': lazy(() => import('@/components/testbed/HolonetDurableStreamsTestbed').then(m => ({ default: m.HolonetDurableStreamsTestbed }))),
  'ecs-vertical-slice': lazy(() => import('@/components/testbed/ECSVerticalSliceTestbed').then(m => ({ default: m.ECSVerticalSliceTestbed }))),
  'electric-sync': lazy(() => import('@/components/testbed/ElectricSyncTestbed').then(m => ({ default: m.ElectricSyncTestbed }))),
  'ingestion': lazy(() => import('@/components/testbed/IngestionTestbed').then(m => ({ default: m.IngestionTestbed }))),
  'ingestion-orchestrator': lazy(() => import('@/components/testbed/IngestionOrchestratorTestbed').then(m => ({ default: m.IngestionOrchestratorTestbed }))),
  'materializer-flow': lazy(() => import('@/components/testbed/MaterializerFlowTestbed').then(m => ({ default: m.MaterializerFlowTestbed }))),
  'pipeline-adr': lazy(() => import('@/components/testbed/PipelineADRTestbed').then(m => ({ default: m.PipelineADRTestbed }))),
  'schema-transform': lazy(() => import('@/components/testbed/SchemaTransformTestbed').then(m => ({ default: m.SchemaTransformTestbed }))),
  'tauri-fs': lazy(() => import('@/components/testbed/TauriFilesystemTestbed').then(m => ({ default: m.TauriFilesystemTestbed }))),
  'theia': lazy(() => import('@/components/testbed/TheiaTestbed').then(m => ({ default: m.TheiaTestbed }))),
  'windows': lazy(() => import('@/components/testbed/WindowsTestbed').then(m => ({ default: m.WindowsTestbed }))),
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface WindowSearchParams {
  testbed?: string
}

/**
 * Loading fallback for lazy testbed components
 */
function TestbedLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950">
      <div className="text-sm text-zinc-500">Loading testbed...</div>
    </div>
  )
}

/**
 * Error state when testbed not found
 */
function TestbedNotFound({ testbedId }: { testbedId: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-950">
      <div className="text-lg font-medium text-zinc-300">Testbed Not Found</div>
      <div className="text-sm text-zinc-500">
        No testbed with ID "{testbedId}" exists in the registry.
      </div>
      <div className="text-xs text-zinc-600">
        Available testbeds are defined in src/lib/testbed/registry.ts
      </div>
    </div>
  )
}

/**
 * WindowRoute renders a testbed inside WindowLayout.
 *
 * Features:
 * - Reads ?testbed=<id> from URL search params
 * - Looks up testbed in registry for metadata
 * - Lazy-loads the testbed component
 * - Wraps in WindowLayout with WindowHeaderContent
 * - Performance tracking (when PERF_ENABLED=true)
 *
 * Used by child Tauri windows opened via:
 * - Cmd+Shift+N quick-switcher
 * - WindowManagerService.createTestbedWindow()
 */
export function WindowRoute() {
  // Performance tracking - capture navigation timestamp
  const navStartRef = useRef(performance.now())
  const perfMetricsRef = useRef<Partial<PerfMetrics>>({
    navigationStart: navStartRef.current
  })

  const search = useSearch({ from: '/window' }) as WindowSearchParams
  const testbedId = search.testbed

  // Track route mount
  useEffect(() => {
    if (PERF_ENABLED) {
      perfMetricsRef.current.routeMount = performance.now()
      logPerf('Route mounted', navStartRef.current)
    }
  }, [])

  // Get window label for display (optional, doesn't affect functionality)
  const [windowLabel, setWindowLabel] = useState<string | undefined>(undefined)
  useEffect(() => {
    Effect.runPromise(getCurrentWindowLabel()).then((label) => {
      if (label) setWindowLabel(label)
    })
  }, [])

  // Derive expected window label from testbed ID
  const expectedLabel = testbedId ? getWindowLabel(testbedId) : undefined

  // IMPORTANT: All hooks must be called before any conditional returns
  const TestbedComponent = useMemo(() => {
    if (!testbedId) return null

    // Check if testbed exists in registry
    const entry = getTestbedById(testbedId)
    if (!entry) return null

    // Track testbed resolution
    if (PERF_ENABLED) {
      perfMetricsRef.current.testbedResolved = performance.now()
      logPerf(`Testbed "${testbedId}" resolved`, navStartRef.current)
    }

    // Get lazy component
    return TESTBED_COMPONENTS[testbedId] ?? null
  }, [testbedId])

  // Callback when testbed actually mounts
  const handleTestbedMount = useMemo(() => () => {
    if (PERF_ENABLED && testbedId) {
      perfMetricsRef.current.testbedMounted = performance.now()
      const total = performance.now() - navStartRef.current
      console.log(`[WindowRoute:Perf] ✅ Testbed "${testbedId}" READY in ${total.toFixed(0)}ms`)
      console.log(`[WindowRoute:Perf] Breakdown:`, {
        routeMount: `${(perfMetricsRef.current.routeMount! - navStartRef.current).toFixed(0)}ms`,
        testbedResolved: `${(perfMetricsRef.current.testbedResolved! - navStartRef.current).toFixed(0)}ms`,
        testbedMounted: `${total.toFixed(0)}ms (total)`
      })
    }
  }, [testbedId])

  // No testbed specified - show empty state in WindowLayout
  if (!testbedId) {
    return (
      <WindowLayout
        header={
          <WindowHeaderContent
            testbedId=""
            windowLabel={windowLabel}
            title="No Testbed"
          />
        }
      >
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-sm text-zinc-500">
            No testbed specified. Add ?testbed=&lt;id&gt; to the URL.
          </div>
        </div>
      </WindowLayout>
    )
  }

  // Testbed not found
  if (!TestbedComponent) {
    return (
      <WindowLayout
        header={
          <WindowHeaderContent
            testbedId={testbedId}
            windowLabel={windowLabel ?? expectedLabel}
            title="Not Found"
          />
        }
      >
        <TestbedNotFound testbedId={testbedId} />
      </WindowLayout>
    )
  }

  // Render testbed inside WindowLayout
  return (
    <WindowLayout
      header={
        <WindowHeaderContent
          testbedId={testbedId}
          windowLabel={windowLabel ?? expectedLabel}
        />
      }
    >
      <Suspense fallback={<TestbedLoading />}>
        <TestbedPerfWrapper testbedId={testbedId} onMount={handleTestbedMount}>
          <TestbedComponent />
        </TestbedPerfWrapper>
      </Suspense>
    </WindowLayout>
  )
}

export default WindowRoute
