import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import router from './router';
import { ScaleProvider } from './lib/scale';
import { OverlayRegistryProvider } from './lib/overlays/atoms';
import { VisualOverlayProvider, GlobalSlot, PersistentOverlays } from './lib/overlays/visual';
import './index.css';

// React Grab: UI element selector + Claude Code integration (dev only)
if (import.meta.env.DEV) {
  // 1. Core: enables hover-to-select UI elements
  import('react-grab');
  // 2. Agent: connects selected elements to Claude Code
  import('@react-grab/claude-code/client').then(({ attachAgent }) => {
    attachAgent();
  });
}

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
            GlobalSlot renders global overlays (modal, toast, command-palette, top-bar)
            EPOCH-0004: Global Overlay System */}
        <VisualOverlayProvider>
          <PersistentOverlays showHeader={true} />
          <GlobalSlot />
          <RouterProvider router={router} />
        </VisualOverlayProvider>
      </ScaleProvider>
    </OverlayRegistryProvider>
  </React.StrictMode>
);
