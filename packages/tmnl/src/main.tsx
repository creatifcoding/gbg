import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router'; // Import RouterProvider
import router from './router'; // Import the router instance
import { ScaleProvider } from './lib/layers/static-ui/ScaleProvider';
import './index.css';

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
