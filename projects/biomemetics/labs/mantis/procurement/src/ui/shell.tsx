import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

const tools = [
  { to: '/register', label: 'register' },
  { to: '/buy', label: 'buy' },
  { to: '/receive', label: 'receive' },
  { to: '/need', label: 'need' },
  { to: '/vendors', label: 'vendors' },
] as const;

export function Shell({
  current,
  children,
}: {
  current: (typeof tools)[number]['to'] | '/';
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <header className="mast">
        <h1>Mantis procurement</h1>
        <p className="honesty">Register only. No purchase order has been issued.</p>
      </header>
      <nav aria-label="constellation">
        <ul className="rail">
          {tools.map((tool) => (
            <li key={tool.to}>
              <Link
                to={tool.to}
                aria-current={current === tool.to ? 'page' : undefined}
              >
                {tool.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}

export function ClassStamp({ value }: { value: string | null }) {
  if (value === null) {
    return (
      <span className="stamp stamp-null" title="No class token">
        no class
      </span>
    );
  }
  const tone =
    value === 'UNVERIFIED' || value === 'DRAFT'
      ? 'stamp-unverified'
      : value === 'LOCK'
        ? 'stamp-lock'
        : value === 'orderable'
          ? 'stamp-orderable'
          : 'stamp-ref';
  return <span className={`stamp ${tone}`}>{value}</span>;
}

export function EmptyWell({ label, value }: { label: string; value?: string | null }) {
  const empty = value === undefined || value === null || value === '';
  return (
    <div className="well" data-empty={empty ? 'true' : 'false'}>
      <span className="well-label">{label}</span>
      {empty ? null : value}
    </div>
  );
}
