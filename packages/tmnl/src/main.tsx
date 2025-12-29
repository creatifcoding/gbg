import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import router from './router';
import { ScaleProvider } from './lib/scale';
import { OverlayRegistryProvider } from './lib/overlays/atoms';
import { VisualOverlayProvider, GlobalSlot } from './lib/overlays/visual';
import { AppShell, HeaderContent } from './components/shell';
import { Sidebar, type SidebarConfig } from './lib/sidebar';
import { Cursor } from './lib/cursor';
import './index.css';

// Variables v2: Register all variables at startup (side-effect import)
import '@/lib/variables/v2/config';

// React Grab: UI element selector + Claude Code integration (dev only)
if (import.meta.env.DEV) {
  import('./dev/browserLogForwarder').then(({ installBrowserLogForwarder }) => {
    installBrowserLogForwarder();
  });

  // 1. Core: enables hover-to-select UI elements
  import('react-grab');
  // 2. Agent: connects selected elements to Claude Code
  import('@react-grab/claude-code/client').then(({ attachAgent }) => {
    attachAgent();
  });
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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* OverlayRegistryProvider MUST be outermost to provide registry context
        to all overlay hooks including those in VisualOverlayProvider body */}
    <OverlayRegistryProvider>
      {/* ScaleProvider injects CSS custom properties for scalable UI
          Default scale: 1.0 — base sizes are now readable by default
          User can adjust via Ctrl/Cmd +/- or settings */}
      <ScaleProvider initialScale={1.0}>
        {/* VisualOverlayProvider manages all visual overlays
            GlobalSlot renders global overlays (modal, toast, command-palette)
            EPOCH-0004: Global Overlay System */}
        <VisualOverlayProvider>
          {/* AppShell: CSS Grid layout orchestrator
              Header (row 1, col 1-2) overlaps Sidebar (row 1-2, col 1) at top-left
              Content fills remaining space (row 2, col 2) */}
          <AppShell
            header={<HeaderContent />}
            sidebar={<Sidebar config={defaultSidebarConfig} />}
          >
            <RouterProvider router={router} />
          </AppShell>
          {/* GlobalSlot for modals, toasts, command-palette (above AppShell) */}
          <GlobalSlot />
          {/* AI Cursor - global Dynamic Island overlay */}
          <Cursor />
        </VisualOverlayProvider>
      </ScaleProvider>
    </OverlayRegistryProvider>
  </React.StrictMode>
);
