import { Link, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';

const tools = [
  { to: '/register', label: 'register' },
  { to: '/buy', label: 'buy' },
  { to: '/receive', label: 'receive' },
  { to: '/need', label: 'need' },
  { to: '/vendors', label: 'vendors' },
] as const;

export function Shell({
  poCount,
  children,
}: {
  poCount: number;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="shell">
      <header className="mast">
        <span className="mast-brand">Mantis / Procurement</span>
        <span className="mast-sys">Register only</span>
      </header>
      <nav aria-label="constellation">
        <ul className="rail" data-region="constellation-tab-rail">
          {tools.map((tool) => (
            <li key={tool.to}>
              <Link
                to={tool.to}
                aria-current={pathname === tool.to ? 'page' : undefined}
              >
                {tool.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="outlet">{children}</main>
      <footer className="gate" data-region="footer-gate">
        <span className="gate-copy">
          {poCount === 0 ? 'gate closed, no PO.' : 'gate closed.'}
        </span>
        <span className="gate-copy">No purchase order has been issued.</span>
      </footer>
    </div>
  );
}
