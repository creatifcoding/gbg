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
