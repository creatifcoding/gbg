/**
 * Floating Panel Icons
 *
 * 14×14 stroke-based SVG icons for panel chrome.
 * All memoized. All named.
 *
 * @module
 */

import { memo } from 'react'

export const MinimizeIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="3" y1="7" x2="11" y2="7" />
  </svg>
))
MinimizeIcon.displayName = 'MinimizeIcon'

export const CollapseIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="11,6 8,6 8,3" />
    <line x1="8" y1="6" x2="11.5" y2="2.5" />
    <polyline points="3,8 6,8 6,11" />
    <line x1="6" y1="8" x2="2.5" y2="11.5" />
  </svg>
))
CollapseIcon.displayName = 'CollapseIcon'

export const ExpandIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="8,3 11,3 11,6" />
    <line x1="11" y1="3" x2="7.5" y2="6.5" />
    <polyline points="6,11 3,11 3,8" />
    <line x1="3" y1="11" x2="6.5" y2="7.5" />
  </svg>
))
ExpandIcon.displayName = 'ExpandIcon'

export const MaximizeIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="2.5" width="9" height="9" rx="1.5" />
  </svg>
))
MaximizeIcon.displayName = 'MaximizeIcon'

export const RestoreIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="7" height="7" rx="1" />
    <path d="M5 4V3.5A1.5 1.5 0 016.5 2H10.5A1.5 1.5 0 0112 3.5V7.5A1.5 1.5 0 0110.5 9H10" />
  </svg>
))
RestoreIcon.displayName = 'RestoreIcon'

// ─── SM Migration: mode transition icons ─────────────────────────────

/** "Float as window" icon (SM §3.2: lucide-maximize2 variant) */
export const FloatIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
))
FloatIcon.displayName = 'FloatIcon'

/** "Dock to side" icon (SM §3.4: lucide-panel-right-close variant) */
export const DockIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <polyline points="10 15 7 12 10 9" />
  </svg>
))
DockIcon.displayName = 'DockIcon'
