import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Gallery } from './gallery.tsx';
import './TerrariumCard.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('missing #root');
}

createRoot(root).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
