import {
  Kicker,
  VANTA_BORDERS,
  VANTA_COLORS,
  VANTA_SPACING,
  chrome,
} from '@gbg/lab-ui';
import type { CSSProperties, ReactNode } from 'react';

export const gridFill: CSSProperties = {
  height: '100%',
  minHeight: chrome.space.gridHeight,
  border: 'none',
  borderRadius: chrome.radius.frame,
};

export function Board({ children }: { readonly children: ReactNode }) {
  return (
    <div
      data-board=""
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: '960px',
        background: VANTA_COLORS.surface.base,
      }}
    >
      {children}
    </div>
  );
}

export function BoardKicker({ children }: { readonly children: string }) {
  return (
    <div
      style={{
        padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['4']}`,
        borderBottom: VANTA_BORDERS.style.default,
      }}
    >
      <Kicker>{children}</Kicker>
    </div>
  );
}

export function Inspector({ children }: { readonly children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: chrome.space.gap,
        padding: VANTA_SPACING['4'],
        borderBottom: VANTA_BORDERS.style.default,
      }}
    >
      {children}
    </div>
  );
}
