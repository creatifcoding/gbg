import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LabUiTestbed } from '../src/components/testbed/LabUiTestbed.tsx';
import { chrome } from '../src/lib/chrome.ts';

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
