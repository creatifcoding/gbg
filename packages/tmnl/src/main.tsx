import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
// Effect imported for potential future use in window pool status checking
// import { Effect } from 'effect';
import router from './router';
import { ScaleProvider } from './lib/scale';
import { OverlayRegistryProvider } from './lib/overlays/atoms';
import { DataplaneRegistryProvider } from './lib/dataplane';
import { VisualOverlayProvider, GlobalSlot } from './lib/overlays/visual';
import { CodeEditorWorkspaceOverlay, toggleCodeEditor } from './lib/code-editor/overlay';
import { BufferProvider } from './lib/buffer';
import { WindowProvider } from './lib/windows';
import { AppShell, HeaderContent } from '@/lib/shell';
import { Sidebar, type SidebarConfig } from './lib/sidebar';
import { Cursor } from './lib/cursor';
import { PanelWorkspaceOverlay } from './lib/floating/overlay';
import { PanelWorkspace } from './lib/floating/overlay/PanelWorkspace';
import './index.css';

// Agentation: dev-only lazy import (307KB saved in production)
const LazyAgentation = import.meta.env.DEV
  ? React.lazy(() => import('agentation').then(m => ({ default: m.Agentation })))
  : null;

// Variables v2: Register all variables at startup (side-effect import)
import '@/lib/variables/v2/config';

// Floating panels: register panel types at startup (side-effect import)
import '@/lib/egui/panels';
// Code editor floating panel registration (side-effect)
import '@/lib/code-editor/panels/CodeEditorPanel';

// Dev diagnostics (browser log forwarding + atom tracing)
if (import.meta.env.DEV) {
  import('./dev/browserLogForwarder').then(({ installBrowserLogForwarder }) => {
    installBrowserLogForwarder();
  });

  // Atom DevTools: enable observability hook for atom tracing
  import('@/lib/primitives/atoms/observability').then(
    ({ initAtomDevTools }) => {
      initAtomDevTools();
      console.log('[TMNL] Atom DevTools initialized');
    }
  );
}

// ─────────────────────────────────────────────────────────────
// Default Sidebar Configuration
// ─────────────────────────────────────────────────────────────

const defaultSidebarConfig: SidebarConfig = {
  coreItems: [
    {
      id: 'home' as any,
      label: 'Home',
      icon: { type: 'lucide', value: 'Home' },
      group: 'core',
      action: { _tag: 'RouteAction', path: '/' },
      order: 0,
    },
    {
      id: 'playground' as any,
      label: 'Playground',
      icon: { type: 'lucide', value: 'FlaskConical' },
      group: 'core',
      action: { _tag: 'RouteAction', path: '/playground' },
      order: 10,
    },
    {
      id: 'testbed' as any,
      label: 'Testbed',
      icon: { type: 'lucide', value: 'TestTube2' },
      group: 'core',
      action: { _tag: 'RouteAction', path: '/testbed' },
      order: 20,
    },
    {
      id: 'docs' as any,
      label: 'Documentation',
      icon: { type: 'lucide', value: 'BookOpen' },
      group: 'core',
      action: { _tag: 'RouteAction', path: '/docs' },
      order: 30,
    },
    {
      id: 'panels' as any,
      label: 'Panels',
      icon: { type: 'lucide', value: 'PanelLeftClose' },
      group: 'core',
      action: { _tag: 'CommandAction', commandId: 'toggle-panel-overlay' },
      order: 40,
    },
    {
      id: 'settings' as any,
      label: 'Settings',
      icon: { type: 'lucide', value: 'Settings' },
      group: 'core',
      action: {
        _tag: 'DrawerAction',
        drawerId: 'settings',
        side: 'right',
        width: 320,
      },
      order: 100,
    },
  ],
  width: 48,
  storageKey: 'tmnl:sidebar',
};

// ─────────────────────────────────────────────────────────────
// Window Type Detection
// ─────────────────────────────────────────────────────────────

/**
 * Check if this is a child window (testbed window).
 * Child windows load /window?testbed=<id> and should NOT have AppShell.
 */
const isChildWindow = window.location.pathname === '/window';

// ─────────────────────────────────────────────────────────────
// Window Pool Initialization
// ─────────────────────────────────────────────────────────────
// Pool is initialized from Rust setup() in lib.rs - NOT from TypeScript.
// This avoids double-initialization which creates duplicate WebView2 instances.
// The Rust side creates pool windows at startup with proper thread handling
// to avoid WebView2 deadlock on Windows.
//
// To check pool status from TypeScript:
//   const svc = yield* WindowManagerService
//   const status = yield* svc.getPoolStatus()
//   console.log(`Pool: ${status.available}/${status.target_size}`)

// ─────────────────────────────────────────────────────────────
// Render Tree
// ─────────────────────────────────────────────────────────────

// Cache root for HMR - prevents recreating on hot update
const rootElement = document.getElementById('root') as HTMLElement;
const root =
  (globalThis as any).__TMNL_ROOT__ ?? ReactDOM.createRoot(rootElement);
(globalThis as any).__TMNL_ROOT__ = root;

root.render(
  <React.StrictMode>
    <OverlayRegistryProvider>
      <DataplaneRegistryProvider>
        <ScaleProvider initialScale={1.0}>
          <VisualOverlayProvider>
            <BufferProvider>
              {isChildWindow ? (
                // Child window: minimal tree, WindowRoute has its own layout
                <RouterProvider router={router} />
              ) : (
                // Main window: full AppShell with sidebar
                <>
                  <AppShell>
                    <AppShell.Header>
                      <HeaderContent />
                    </AppShell.Header>
                    <AppShell.Sidebar>
                      <Sidebar config={defaultSidebarConfig} />
                    </AppShell.Sidebar>
                    <AppShell.Workspace>
                      <WindowProvider enabled={true}>
                        <RouterProvider router={router} />
                      </WindowProvider>
                      <CodeEditorWorkspaceOverlay />
                    </AppShell.Workspace>
                    <PanelWorkspaceOverlay>
                      <PanelWorkspace />
                    </PanelWorkspaceOverlay>
                  </AppShell>
                  <GlobalSlot />
                  <Cursor />
                  {import.meta.env.DEV && LazyAgentation && (
                    <React.Suspense fallback={null}>
                      <LazyAgentation />
                    </React.Suspense>
                  )}
                </>
              )}
            </BufferProvider>
          </VisualOverlayProvider>
        </ScaleProvider>
      </DataplaneRegistryProvider>
    </OverlayRegistryProvider>
  </React.StrictMode>
);
