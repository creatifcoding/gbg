import { useMemo, useState } from 'react';
import type { ProductSurface } from '../contracts/types';
import { useKeeper } from '../state/keeper';
import { AskSurface } from './Ask';
import { ObserveSurface } from './Observe';
import { TodaySurface } from './Today';
import { LabSurface, ServiceSurface, TerrariumSurface } from './Wells';

const NAV: { id: ProductSurface; label: string }[] = [
  { id: 'Today', label: 'Today' },
  { id: 'Observe', label: 'Observe' },
  { id: 'Ask', label: 'Ask' },
  { id: 'Terrarium', label: 'Terrarium' },
  { id: 'Lab', label: 'Lab' },
];

const simulatorOn = (): boolean => {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  return q.get('simulator') === '1' || q.get('mode') === 'service-sim';
};

export function Shell() {
  const k = useKeeper();
  const [surface, setSurface] = useState<ProductSurface>('Today');
  const showService = simulatorOn();
  const drafts = useMemo(
    () => [
      ...k.model.observations.map((o) => ({
        id: o.observationId,
        kind: 'Observation draft',
        summary: o.statements.map((s) => s.text).join(' '),
      })),
      ...k.model.advice.map((a) => ({
        id: a.adviceId,
        kind: 'CareAdvice receipt',
        summary: a.applicability,
      })),
    ],
    [k.model.advice, k.model.observations],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Keeper</div>
        <div className="status-pill">{k.online ? 'online-device' : 'offline'} · not a Specimen</div>
      </header>
      <main className="surface" id="main">
        {surface === 'Today' ? <TodaySurface /> : null}
        {surface === 'Observe' ? <ObserveSurface /> : null}
        {surface === 'Ask' ? <AskSurface /> : null}
        {surface === 'Terrarium' ? <TerrariumSurface /> : null}
        {surface === 'Lab' ? <LabSurface drafts={drafts} /> : null}
        {surface === 'Service' && showService ? <ServiceSurface /> : null}
      </main>
      <nav className="nav" aria-label="Keeper surfaces">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={surface === item.id ? 'page' : undefined}
            onClick={() => setSurface(item.id)}
          >
            {item.label}
          </button>
        ))}
        {showService ? (
          <button
            type="button"
            aria-current={surface === 'Service' ? 'page' : undefined}
            onClick={() => setSurface('Service')}
          >
            Service
          </button>
        ) : null}
      </nav>
    </div>
  );
}
