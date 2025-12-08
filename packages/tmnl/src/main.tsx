import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router'; // Import RouterProvider
import router from './router'; // Import the router instance
import { ScaleProvider } from './lib/layers/static-ui/ScaleProvider';
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
    {/* ScaleProvider injects CSS custom properties for scalable UI
        Default scale: 1.0 — base sizes are now readable by default
        User can adjust via Ctrl/Cmd +/- or settings */}
    <ScaleProvider initialScale={1.0}>
      <RouterProvider router={router} />
    </ScaleProvider>
  </React.StrictMode>
);
