import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router'; // Import RouterProvider
import router from './router'; // Import the router instance
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} /> {/* Render our router */}
  </React.StrictMode>
);
