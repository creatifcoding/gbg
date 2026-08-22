import {
  Kicker,
  VANTA_BORDERS,
  VANTA_COLORS,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
  chrome,
} from '@gbg/lab-ui';
import { Link, useRouterState } from '@tanstack/react-router';
import type { CSSProperties, ReactNode } from 'react';

const tools = [
  { to: '/register', label: 'register' },
  { to: '/buy', label: 'buy' },
  { to: '/receive', label: 'receive' },
  { to: '/need', label: 'need' },
  { to: '/vendors', label: 'vendors' },
] as const;

const mastStyle: CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'space-between',
  height: chrome.space.headerHeight,
  padding: `0 ${VANTA_SPACING['5']}`,
  background: VANTA_COLORS.surface.void,
  borderBottom: VANTA_BORDERS.style.default,
};

const railStyle: CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  alignItems: 'stretch',
  gap: 0,
  margin: 0,
  padding: `0 ${VANTA_SPACING['2']}`,
  listStyle: 'none',
  height: VANTA_SPACING['8'],
  background: VANTA_COLORS.surface.base,
  borderBottom: VANTA_BORDERS.style.default,
};

const tabStyle = (current: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  padding: `0 ${VANTA_SPACING['4']}`,
  color: current ? VANTA_COLORS.text.primary : VANTA_COLORS.text.muted,
  fontFamily: VANTA_TYPOGRAPHY.family.sans,
  fontSize: VANTA_TYPOGRAPHY.size.xs,
  fontWeight: VANTA_TYPOGRAPHY.weight.medium,
  letterSpacing: VANTA_TYPOGRAPHY.tracking.widest,
  textTransform: 'uppercase',
  boxShadow: current
    ? `inset 0 -1px 0 ${VANTA_COLORS.text.primary}`
    : 'none',
});

const gateStyle: CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'space-between',
  height: VANTA_SPACING['8'],
  padding: `0 ${VANTA_SPACING['4']}`,
  background: VANTA_COLORS.surface.void,
  borderTop: VANTA_BORDERS.style.default,
};

export function Shell({
  poCount,
  children,
}: {
  poCount: number;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: VANTA_COLORS.surface.void,
        color: VANTA_COLORS.text.primary,
        fontFamily: VANTA_TYPOGRAPHY.family.sans,
        fontSize: VANTA_TYPOGRAPHY.size.sm,
      }}
    >
      <header style={mastStyle}>
        <Kicker size={11} tone="muted">
          Mantis / Procurement
        </Kicker>
        <Kicker size={11} tone="dim">
          Register only
        </Kicker>
      </header>
      <nav aria-label="constellation">
        <ul style={railStyle} data-region="constellation-tab-rail">
          {tools.map((tool) => {
            const current = pathname === tool.to;
            return (
              <li key={tool.to}>
                <Link
                  to={tool.to}
                  aria-current={current ? 'page' : undefined}
                  style={tabStyle(current)}
                >
                  {tool.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <main
        className="outlet"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: VANTA_COLORS.surface.base,
        }}
      >
        {children}
      </main>
      <footer style={gateStyle} data-region="footer-gate">
        <Kicker tone="dim">
          {poCount === 0 ? 'gate closed, no PO.' : 'gate closed.'}
        </Kicker>
        <Kicker tone="dim">No purchase order has been issued.</Kicker>
      </footer>
    </div>
  );
}
