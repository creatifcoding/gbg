import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { chrome } from '../src/lib/chrome.ts';
import { LabUiTestbed } from './LabUiTestbed.tsx';

const root = document.getElementById('root');
if (!root) {
  throw new Error('missing #root');
}

document.documentElement.style.background = chrome.color.void;
document.body.style.margin = '0';
document.body.style.background = chrome.color.void;

createRoot(root).render(
  <StrictMode>
    <LabUiTestbed />
  </StrictMode>,
);
