/**
 * TMNL Router Configuration
 *
 * ARCHITECTURE: Route-level code splitting via lazyRouteComponent().
 * Only 5 routes are eagerly loaded (the app shell). Everything else
 * is deferred until navigation — saving ~17MB of decoded JS on startup.
 *
 * CHECKLIST FOR NEW ROUTES:
 * 1. Create route constant with lazyRouteComponent() (NOT eager import)
 * 2. Add route to `routeTree.addChildren([...])` array
 * 3. Add Link in App.tsx homepage navigation
 * 4. Verify route works in browser
 *
 * PATTERN (named export):
 *   component: lazyRouteComponent(() => import('./path'), 'ExportName')
 *
 * PATTERN (default export):
 *   component: lazyRouteComponent(() => import('./path'))
 *
 * EAGER ROUTES (app shell — always loaded):
 *   - / (App)
 *   - /tmnl (TmnlLayout)
 *   - rootRoute (LockScreenController wrapper)
 *   - /window (WindowRoute — child window host)
 *   - /pool-placeholder (PoolPlaceholder — pre-created pool windows)
 */

import {
  createRouter,
  createRoute,
  createRootRoute,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';

// ─────────────────────────────────────────────────────────────
// Eager imports: App shell only (5 components)
// ─────────────────────────────────────────────────────────────
import App from './App';
import { LockScreenController } from './components/splash';
import { TmnlLayout } from './components/tmnl-layout';
import { WindowRoute } from './routes/WindowRoute';
import { PoolPlaceholder } from './routes/PoolPlaceholder';

// ─────────────────────────────────────────────────────────────
// Root Route
// ─────────────────────────────────────────────────────────────

// LockScreenController wraps all routes to enable lock screen functionality
// Triggered by idle detection or system.lockScreen command (Ctrl+Alt+L / M-x)
const rootRoute = createRootRoute({
  component: () => (
    <LockScreenController enabled>
      <Outlet />
    </LockScreenController>
  ),
});

// ─────────────────────────────────────────────────────────────
// Eager Routes (app shell)
// ─────────────────────────────────────────────────────────────

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
});

const tmnlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tmnl',
  component: TmnlLayout,
});

// Window route for child Tauri windows (testbed in separate window)
// URL: /window?testbed=<testbed-id>
const windowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/window',
  component: WindowRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    testbed:
      typeof search['testbed'] === 'string' ? search['testbed'] : undefined,
  }),
});

// Pool placeholder route - minimal memory footprint for pre-created pool windows
// Pool windows start here and navigate to /window?testbed=<id> when claimed
const poolPlaceholderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pool-placeholder',
  component: PoolPlaceholder,
});

// ─────────────────────────────────────────────────────────────
// Lazy Routes: Testbeds
// ─────────────────────────────────────────────────────────────

const testbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed',
  component: lazyRouteComponent(() => import('./components/testbed/AnimationTestbed'), 'AnimationTestbed'),
});

const testbedV2Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/v2',
  component: lazyRouteComponent(() => import('./lib/animation/v2/__tests__/basic'), 'AnimationV2Testbed'),
});

const dataGridTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/data-grid',
  component: lazyRouteComponent(() => import('./components/testbed/DataGridTestbedSwitch'), 'DataGridTestbedSwitch'),
});

const effectAtomTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/effect-atom',
  component: lazyRouteComponent(() => import('./components/testbed/EffectAtomTestbed'), 'EffectAtomTestbed'),
});

const hotkeyTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/hotkeys',
  component: lazyRouteComponent(() => import('./components/testbed/HotkeyTestbed'), 'HotkeyTestbed'),
});

const baseModalTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/base-modal',
  component: lazyRouteComponent(() => import('./components/testbed/BaseModalTestbed'), 'BaseModalTestbed'),
});

const traitTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/traits',
  component: lazyRouteComponent(() => import('./components/testbed/TraitTestbed'), 'TraitTestbed'),
});

const capabilityTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/capabilities',
  component: lazyRouteComponent(() => import('./components/testbed/CapabilityTestbed'), 'CapabilityTestbed'),
});

const keybindingTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/keybindings',
  component: lazyRouteComponent(() => import('./components/testbed/KeybindingTestbed'), 'KeybindingTestbed'),
});

const sliderTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/slider',
  component: lazyRouteComponent(() => import('./components/testbed/SliderTestbed'), 'SliderTestbed'),
});

const sliderV2TestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/slider-v2',
  component: lazyRouteComponent(() => import('./components/testbed/SliderV2Testbed'), 'SliderV2Testbed'),
});

const searchTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/search',
  component: lazyRouteComponent(() => import('./components/testbed/SearchTestbed'), 'SearchTestbed'),
});

const dataManagerTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/data-manager',
  component: lazyRouteComponent(() => import('./components/testbed/DataManagerTestbed'), 'DataManagerTestbed'),
});

const dataManagerV1TestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/data-manager/v1',
  component: lazyRouteComponent(() => import('./components/testbed/data-manager/v1'), 'DataManagerV1Testbed'),
});

const dataManagerV2TestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/data-manager/v2',
  component: lazyRouteComponent(() => import('./components/testbed/data-manager/v2'), 'DataManagerV2Testbed'),
});

const vantaCardTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/vanta',
  component: lazyRouteComponent(() => import('./components/testbed/VantaCardTestbed'), 'VantaCardTestbed'),
});

const chartingTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/charting',
  component: lazyRouteComponent(() => import('./components/testbed/ChartingTestbed'), 'ChartingTestbed'),
});

const overlayTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/overlays',
  component: lazyRouteComponent(() => import('./components/testbed/OverlayTestbed'), 'OverlayTestbed'),
});

const indicesTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/indices',
  component: lazyRouteComponent(() => import('./components/testbed/IndicesTestbed'), 'IndicesTestbed'),
});

const dataGridVariantTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/data-grid-variants',
  component: lazyRouteComponent(() => import('./components/testbed/DataGridVariantTestbedSwitch'), 'DataGridVariantTestbedSwitch'),
});

const avaTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/ava',
  component: lazyRouteComponent(() => import('./components/testbed/AvaTestbed'), 'AvaTestbed'),
});

const avaV2TestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/ava-v2',
  component: lazyRouteComponent(() => import('./components/testbed/AvaV2Testbed'), 'AvaV2Testbed'),
});

const floatingPanelTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/floating',
  component: lazyRouteComponent(() => import('./components/testbed/FloatingPanelTestbed'), 'FloatingPanelTestbed'),
});

const selectionTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/selection',
  component: lazyRouteComponent(() => import('./components/testbed/SelectionTestbed'), 'SelectionTestbed'),
});

const drawerTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/drawer',
  component: lazyRouteComponent(() => import('./components/testbed/DrawerTestbed'), 'DrawerTestbed'),
});

const variablesTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/variables',
  component: lazyRouteComponent(() => import('./components/testbed/VariablesTestbed'), 'VariablesTestbed'),
});

const screensaverTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/screensaver',
  component: lazyRouteComponent(() => import('./components/testbed/ScreensaverTestbed'), 'ScreensaverTestbed'),
});

const terminalTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/terminal',
  component: lazyRouteComponent(() => import('./components/testbed/TerminalTestbed'), 'TerminalTestbed'),
});

const blockTerminalTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/block-terminal',
  component: lazyRouteComponent(() => import('./components/testbed/BlockTerminalTestbed'), 'BlockTerminalTestbed'),
});

const blockTerminalV3TestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/block-terminal-v3',
  component: lazyRouteComponent(() => import('./components/testbed/BlockTerminalTestbedV3'), 'BlockTerminalTestbedV3'),
});

const koriTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/kori',
  component: lazyRouteComponent(() => import('./components/testbed/kori'), 'KoriTestbed'),
});

const koriAtomsTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/kori-atoms',
  component: lazyRouteComponent(() => import('./components/testbed/KoriAtomsTestbed'), 'KoriAtomsTestbed'),
});

const collaborationTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/collaboration',
  component: lazyRouteComponent(() => import('./components/testbed/CollaborationTestbed'), 'CollaborationTestbed'),
});

const collaborationV2TestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/collaboration-v2',
  component: lazyRouteComponent(() => import('./components/testbed/CollaborationTestbedV2'), 'CollaborationTestbedV2'),
});

const tauriFilesystemTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/tauri-fs',
  component: lazyRouteComponent(() => import('./components/testbed/TauriFilesystemTestbed'), 'TauriFilesystemTestbed'),
});

const theiaTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/theia',
  component: lazyRouteComponent(() => import('./components/testbed/TheiaTestbed'), 'TheiaTestbed'),
});

const dataplaneTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/dataplane',
  component: lazyRouteComponent(() => import('./components/testbed/DataplaneTestbed'), 'DataplaneTestbed'),
});

const fermionTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/fermion',
  component: lazyRouteComponent(() => import('./components/testbed/FermionTestbed'), 'FermionTestbed'),
});

const axiomTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/axiom',
  component: lazyRouteComponent(() => import('./components/testbed/AxiomTestbed'), 'AxiomTestbed'),
});

const pipelineADRTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/pipeline-adr',
  component: lazyRouteComponent(() => import('./components/testbed/PipelineADRTestbed'), 'PipelineADRTestbed'),
});

const windowsTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/windows',
  component: lazyRouteComponent(() => import('./components/testbed/WindowsTestbed'), 'WindowsTestbed'),
});

const geointTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/geoint',
  component: lazyRouteComponent(() => import('./components/testbed/GeointDashboardTestbed'), 'GeointDashboardTestbed'),
});

const ecsVerticalSliceTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/ecs-vertical-slice',
  component: lazyRouteComponent(() => import('./components/testbed/ECSVerticalSliceTestbed'), 'ECSVerticalSliceTestbed'),
});

const searchToKoriTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/search-to-kori',
  component: lazyRouteComponent(() => import('./components/testbed/SearchToKoriTestbed'), 'SearchToKoriTestbed'),
});

const timelineSearchTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/timeline-search',
  component: lazyRouteComponent(() => import('./components/testbed/TimelineSearchTestbed'), 'TimelineSearchTestbed'),
});

const atomRpcTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/atom-rpc',
  component: lazyRouteComponent(() => import('./components/testbed/AtomRpcTestbed'), 'AtomRpcTestbed'),
});

const materializerFlowTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/materializer-flow',
  component: lazyRouteComponent(() => import('./components/testbed/MaterializerFlowTestbed'), 'MaterializerFlowTestbed'),
});

const ingestionOrchestratorTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/ingestion-orchestrator',
  component: lazyRouteComponent(() => import('./components/testbed/IngestionOrchestratorTestbed'), 'IngestionOrchestratorTestbed'),
});

const ingestionTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/ingestion',
  component: lazyRouteComponent(() => import('./components/testbed/IngestionTestbed'), 'IngestionTestbed'),
});

const entityUIAtomsTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/entity-ui-atoms',
  component: lazyRouteComponent(() => import('./components/testbed/EntityUIAtomsTestbed'), 'EntityUIAtomsTestbed'),
});

const integratedGeointTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/integrated-geoint',
  component: lazyRouteComponent(() => import('./components/testbed/IntegratedGeointTestbed'), 'IntegratedGeointTestbed'),
});

const electricSyncTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/electric-sync',
  component: lazyRouteComponent(() => import('./components/testbed/ElectricSyncTestbed'), 'ElectricSyncTestbed'),
});

const searchServiceTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/search-service',
  component: lazyRouteComponent(() => import('./components/testbed/SearchServiceTestbed'), 'SearchServiceTestbed'),
});

const schemaTransformTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/schema-transform',
  component: lazyRouteComponent(() => import('./components/testbed/SchemaTransformTestbed'), 'SchemaTransformTestbed'),
});

const streamingSearchTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/streaming-search',
  component: lazyRouteComponent(() => import('./components/testbed/StreamingSearchTestbed'), 'StreamingSearchTestbed'),
});

const durableStreamsTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/durable-streams',
  component: lazyRouteComponent(() => import('./components/testbed/DurableStreamsTestbed'), 'DurableStreamsTestbed'),
});

const holonetDurableStreamsTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/holonet-durable-streams',
  component: lazyRouteComponent(() => import('./components/testbed/HolonetDurableStreamsTestbed'), 'HolonetDurableStreamsTestbed'),
});

const geniferTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/genifer',
  component: lazyRouteComponent(() => import('./components/testbed/GeniferTestbed'), 'GeniferTestbed'),
});

const morphCardTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/morph-card',
  component: lazyRouteComponent(() => import('./components/testbed/MorphCardTestbed'), 'MorphCardTestbed'),
});

const eguiMorphCardTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/egui-morph',
  component: lazyRouteComponent(() => import('./components/testbed/EguiMorphCardTestbed'), 'EguiMorphCardTestbed'),
});

const rvnChatIsolatedTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/rvn-chat-isolated',
  component: lazyRouteComponent(() => import('./components/testbed/RvnChatIsolatedTestbed'), 'RvnChatIsolatedTestbed'),
});

const morphChatTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/morphchat',
  component: lazyRouteComponent(() => import('./components/testbed/MorphChatTestbed'), 'MorphChatTestbed'),
});

const conductorTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/conductor',
  component: lazyRouteComponent(() => import('./components/testbed/ConductorTestbed'), 'ConductorTestbed'),
});

// ─────────────────────────────────────────────────────────────
// Lazy Routes: Pages & Playground
// ─────────────────────────────────────────────────────────────

const dispositionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dispositions',
  component: lazyRouteComponent(() => import('./pages/Dispositions')),
});

const streamsPlaygroundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/playground/streams',
  component: lazyRouteComponent(() => import('./components/playground/streams'), 'StreamsPlayground'),
});

// ─────────────────────────────────────────────────────────────
// Lazy Routes: Documentation
// ─────────────────────────────────────────────────────────────

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: lazyRouteComponent(() => import('./components/docs-3d'), 'DocsLanding'),
});

const diagramsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs/diagrams',
  component: lazyRouteComponent(() => import('./components/docs'), 'DiagramsPage'),
});

const overhaulDocsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs/overhaul',
  component: lazyRouteComponent(() => import('./components/docs/overhaul'), 'OverhaulDocsPage'),
});

const geniferResearchDocsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs/genifer-research',
  component: lazyRouteComponent(() => import('./components/docs/genifer-research'), 'GeniferResearchPage'),
});

// ─────────────────────────────────────────────────────────────
// Lazy Routes: Conductor
// ─────────────────────────────────────────────────────────────

const conductorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conductor',
  component: lazyRouteComponent(() => import('./components/testbed/ConductorTestbed'), 'ConductorTestbed'),
});

const conductorLegacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conductor/legacy',
  component: lazyRouteComponent(() => import('./routes/ConductorLegacy'), 'ConductorLegacy'),
});

// ─────────────────────────────────────────────────────────────
// Route Tree
// ─────────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  // Eager (app shell)
  indexRoute,
  tmnlRoute,
  windowRoute,
  poolPlaceholderRoute,
  // Lazy (testbeds)
  testbedRoute,
  testbedV2Route,
  dataGridTestbedRoute,
  effectAtomTestbedRoute,
  hotkeyTestbedRoute,
  baseModalTestbedRoute,
  traitTestbedRoute,
  capabilityTestbedRoute,
  keybindingTestbedRoute,
  sliderTestbedRoute,
  sliderV2TestbedRoute,
  searchTestbedRoute,
  dataManagerTestbedRoute,
  dataManagerV1TestbedRoute,
  dataManagerV2TestbedRoute,
  vantaCardTestbedRoute,
  chartingTestbedRoute,
  overlayTestbedRoute,
  indicesTestbedRoute,
  dataGridVariantTestbedRoute,
  avaTestbedRoute,
  avaV2TestbedRoute,
  floatingPanelTestbedRoute,
  selectionTestbedRoute,
  drawerTestbedRoute,
  variablesTestbedRoute,
  screensaverTestbedRoute,
  terminalTestbedRoute,
  blockTerminalTestbedRoute,
  blockTerminalV3TestbedRoute,
  koriTestbedRoute,
  koriAtomsTestbedRoute,
  collaborationTestbedRoute,
  collaborationV2TestbedRoute,
  tauriFilesystemTestbedRoute,
  theiaTestbedRoute,
  dataplaneTestbedRoute,
  fermionTestbedRoute,
  axiomTestbedRoute,
  pipelineADRTestbedRoute,
  windowsTestbedRoute,
  geointTestbedRoute,
  ecsVerticalSliceTestbedRoute,
  searchToKoriTestbedRoute,
  timelineSearchTestbedRoute,
  atomRpcTestbedRoute,
  materializerFlowTestbedRoute,
  ingestionOrchestratorTestbedRoute,
  ingestionTestbedRoute,
  entityUIAtomsTestbedRoute,
  integratedGeointTestbedRoute,
  electricSyncTestbedRoute,
  searchServiceTestbedRoute,
  schemaTransformTestbedRoute,
  streamingSearchTestbedRoute,
  durableStreamsTestbedRoute,
  holonetDurableStreamsTestbedRoute,
  geniferTestbedRoute,
  morphCardTestbedRoute,
  eguiMorphCardTestbedRoute,
  rvnChatIsolatedTestbedRoute,
  morphChatTestbedRoute,
  conductorTestbedRoute,
  // Lazy (pages & playground)
  dispositionsRoute,
  streamsPlaygroundRoute,
  // Lazy (docs)
  docsRoute,
  diagramsRoute,
  overhaulDocsRoute,
  geniferResearchDocsRoute,
  // Lazy (conductor)
  conductorRoute,
  conductorLegacyRoute,
]);

// ─────────────────────────────────────────────────────────────
// Router Instance (HMR-safe singleton)
// ─────────────────────────────────────────────────────────────

let router: ReturnType<typeof createRouter<typeof routeTree>>;

function getRouter() {
  if (!router) {
    router = createRouter({ routeTree });
  }
  return router;
}

// HMR: Invalidate router on hot update so it picks up new routes
// but preserve current location
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // Router will be recreated on next getRouter() call
    // but location is preserved by the browser
  });
}

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default getRouter();
