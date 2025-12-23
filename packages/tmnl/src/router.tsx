/**
 * TMNL Router Configuration
 *
 * CHECKLIST FOR NEW ROUTES:
 * 1. Import the component at top of file
 * 2. Create route constant (e.g., `const fooRoute = createRoute({ ... })`)
 * 3. Add route to `routeTree.addChildren([...])` array
 * 4. Add Link in App.tsx homepage navigation
 * 5. Verify route works in browser
 *
 * DON'T FORGET STEP 4. THE LINK. IN APP.TSX. SERIOUSLY.
 */

import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
} from '@tanstack/react-router';
import App from './App';
import { LockScreenController } from './components/splash';
import { TmnlLayout } from './components/tmnl-layout';
import { AnimationTestbed } from './components/testbed/AnimationTestbed';
import { AnimationV2Testbed } from './lib/animation/v2/__tests__/basic';
import { BaseModalTestbed } from './components/testbed/BaseModalTestbed';
import { TraitTestbed } from './components/testbed/TraitTestbed';
import { CapabilityTestbed } from './components/testbed/CapabilityTestbed';
import { DataGridTestbedSwitch } from './components/testbed/DataGridTestbedSwitch';
import { EffectAtomTestbed } from './components/testbed/EffectAtomTestbed';
import { HotkeyTestbed } from './components/testbed/HotkeyTestbed';
import { KeybindingTestbed } from './components/testbed/KeybindingTestbed';
import { SliderTestbed } from './components/testbed/SliderTestbed';
import { SliderV2Testbed } from './components/testbed/SliderV2Testbed';
import { SearchTestbed } from './components/testbed/SearchTestbed';
import { DataManagerTestbed } from './components/testbed/DataManagerTestbed';
import { DataManagerV1Testbed } from './components/testbed/data-manager/v1';
import { DataManagerV2Testbed } from './components/testbed/data-manager/v2';
import { VantaCardTestbed } from './components/testbed/VantaCardTestbed';
import { ChartingTestbed } from './components/testbed/ChartingTestbed';
import { OverlayTestbed } from './components/testbed/OverlayTestbed';
import { ScadaOverlayTestbed } from './components/testbed/ScadaOverlayTestbed';
import { ScadaCanvas } from './components/scada';
import { IndicesTestbed } from './components/testbed/IndicesTestbed';
import { DataGridVariantTestbedSwitch } from './components/testbed/DataGridVariantTestbedSwitch';
import Dispositions from './pages/Dispositions';
import { StreamsPlayground } from './components/playground/streams';
import { AvaTestbed } from './components/testbed/AvaTestbed';
import { FloatingPanelTestbed } from './components/testbed/FloatingPanelTestbed';
import { SelectionTestbed } from './components/testbed/SelectionTestbed';
import { DrawerTestbed } from './components/testbed/DrawerTestbed';
import { VariablesTestbed } from './components/testbed/VariablesTestbed';
import { ScreensaverTestbed } from './components/testbed/ScreensaverTestbed';
import { TerminalTestbed } from './components/testbed/TerminalTestbed';
import { KoriTestbed } from './components/testbed/kori';
import { EditorTestbed } from './components/testbed/EditorTestbed';
import { DiagramsPage } from './components/docs';
import { OverhaulDocsPage } from './components/docs/overhaul';
import { DocsLanding } from './components/docs-3d';

// Create a root route
// LockScreenController wraps all routes to enable lock screen functionality
// Triggered by idle detection or system.lockScreen command (Ctrl+Alt+L / M-x)
const rootRoute = createRootRoute({
  component: () => (
    <LockScreenController enabled>
      <Outlet />
    </LockScreenController>
  ),
});

// Create an index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
});

// Create a route for the TmnlLayout
const tmnlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tmnl',
  component: TmnlLayout,
});

// Create testbed route for animation development
const testbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed',
  component: AnimationTestbed,
});

// Create v2 testbed route
const testbedV2Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/v2',
  component: AnimationV2Testbed,
});

// Create dispositions route
const dispositionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dispositions',
  component: Dispositions,
});

// Create data-grid testbed route (with V1/V2 switch)
const dataGridTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/data-grid',
  component: DataGridTestbedSwitch,
});

// Create effect-atom testbed route
const effectAtomTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/effect-atom',
  component: EffectAtomTestbed,
});

// Create hotkey testbed route
const hotkeyTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/hotkeys',
  component: HotkeyTestbed,
});

// Create base-modal testbed route
const baseModalTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/base-modal',
  component: BaseModalTestbed,
});

// Create trait testbed route
const traitTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/traits',
  component: TraitTestbed,
});

// Create capability testbed route
const capabilityTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/capabilities',
  component: CapabilityTestbed,
});

// Create keybinding testbed route
const keybindingTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/keybindings',
  component: KeybindingTestbed,
});

// Create slider testbed route (v1)
const sliderTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/slider',
  component: SliderTestbed,
});

// Create slider v2 testbed route
const sliderV2TestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/slider-v2',
  component: SliderV2Testbed,
});

// Create search testbed route
const searchTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/search',
  component: SearchTestbed,
});

// Create data-manager testbed route
const dataManagerTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/data-manager',
  component: DataManagerTestbed,
});

// Create vanta-card testbed route
const vantaCardTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/vanta',
  component: VantaCardTestbed,
});

// Create charting testbed route
const chartingTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/charting',
  component: ChartingTestbed,
});

// Create data-manager v1 testbed route
const dataManagerV1TestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/data-manager/v1',
  component: DataManagerV1Testbed,
});

// Create data-manager v2 testbed route
const dataManagerV2TestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/data-manager/v2',
  component: DataManagerV2Testbed,
});

// Create overlay testbed route
const overlayTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/overlays',
  component: OverlayTestbed,
});

// Create SCADA overlay testbed route
const scadaOverlayTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/scada',
  component: ScadaOverlayTestbed,
});

// Create indices testbed route
const indicesTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/indices',
  component: IndicesTestbed,
});

// Create data-grid variants testbed route (with V1/V2 switch)
const dataGridVariantTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/data-grid-variants',
  component: DataGridVariantTestbedSwitch,
});

// Create SCADA canvas route (unified multi-overlay demo)
const scadaCanvasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scada',
  component: ScadaCanvas,
});

// Create streams playground route
const streamsPlaygroundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/playground/streams',
  component: StreamsPlayground,
});

// Create AVA testbed route
const avaTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/ava',
  component: AvaTestbed,
});

// Create floating panel testbed route
const floatingPanelTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/floating',
  component: FloatingPanelTestbed,
});

// Create selection testbed route
const selectionTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/selection',
  component: SelectionTestbed,
});

// Create drawer testbed route
const drawerTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/drawer',
  component: DrawerTestbed,
});

// Create variables testbed route
const variablesTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/variables',
  component: VariablesTestbed,
});

// Create screensaver testbed route
const screensaverTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/screensaver',
  component: ScreensaverTestbed,
});

// Create terminal testbed route
const terminalTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/terminal',
  component: TerminalTestbed,
});

// Create docs landing route (3D bento grid)
const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: DocsLanding,
});

const diagramsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs/diagrams',
  component: DiagramsPage,
});

// Create overhaul documentation route (AFFiNE integration docs)
const overhaulDocsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs/overhaul',
  component: OverhaulDocsPage,
});

// Create KORI ECS testbed route
const koriTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/kori',
  component: KoriTestbed,
});

// Create block editor testbed route
const editorTestbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed/editor',
  component: EditorTestbed,
});

// Create the router
const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    tmnlRoute,
    testbedRoute,
    testbedV2Route,
    dispositionsRoute,
    dataGridTestbedRoute,
    effectAtomTestbedRoute,
    hotkeyTestbedRoute,
    keybindingTestbedRoute,
    baseModalTestbedRoute,
    traitTestbedRoute,
    capabilityTestbedRoute,
    sliderTestbedRoute,
    sliderV2TestbedRoute,
    searchTestbedRoute,
    dataManagerTestbedRoute,
    dataManagerV1TestbedRoute,
    dataManagerV2TestbedRoute,
    vantaCardTestbedRoute,
    chartingTestbedRoute,
    overlayTestbedRoute,
    scadaOverlayTestbedRoute,
    indicesTestbedRoute,
    dataGridVariantTestbedRoute,
    scadaCanvasRoute,
    streamsPlaygroundRoute,
    avaTestbedRoute,
    floatingPanelTestbedRoute,
    selectionTestbedRoute,
    drawerTestbedRoute,
    variablesTestbedRoute,
    screensaverTestbedRoute,
    terminalTestbedRoute,
    docsRoute,
    diagramsRoute,
    overhaulDocsRoute,
    koriTestbedRoute,
    editorTestbedRoute,
  ]),
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default router;