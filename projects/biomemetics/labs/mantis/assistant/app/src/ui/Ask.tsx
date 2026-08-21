import { useState } from 'react';
import { useKeeper } from '../state/keeper';
import { MastraWell } from './CopilotHost';

export function AskSurface() {
  const k = useKeeper();
  const [place, setPlace] = useState('');
  const [due, setDue] = useState('');
  const advice = k.lastAdvice ?? k.model.advice.at(-1) ?? null;

  return (
    <section aria-labelledby="ask-heading">
      <p className="kicker">Ask · advice is not a care event</p>
      <h1 id="ask-heading">What do I do now?</h1>
      <MastraWell />
      <div className="row">
        <button type="button" className="btn" onClick={() => void k.askNow()}>
          Source local guidance
        </button>
      </div>
      {advice ? (
        <article className="care-card" aria-label="Care advice card">
          <p className="kicker">Care card · {advice.confidence} confidence</p>
          <p className="chip recommended">recommended</p>
          <h2>Do now</h2>
          <ul>
            {advice.doNow.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h2>Numerical claims</h2>
          <ul>
            {advice.numericalClaims.map((c) => (
              <li key={c.text}>
                {c.text}: <strong>{c.status}</strong>
                {c.reason ? ` — ${c.reason}` : ''}
              </li>
            ))}
          </ul>
          <h2>Warnings</h2>
          <ul>
            {advice.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="muted">
            Sources:{' '}
            {advice.sources.map((s) => `${s.title} (${s.citation})`).join(' · ') || 'none'}
          </p>
          <p className="muted">This card does not mark the animal as fed.</p>
          <label htmlFor="due">Reminder</label>
          <input id="due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          <div className="row">
            <button
              type="button"
              className="btn secondary"
              onClick={() => due && void k.remind('Check prey removal', new Date(due).toISOString())}
            >
              Set local reminder
            </button>
          </div>
        </article>
      ) : null}

      <article className="card">
        <p className="kicker">Supply / transit · purpose-bound</p>
        <p className="muted">{k.supplyStatus}</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => void k.requestLocation()}>
            Grant coarse location once
          </button>
          <button type="button" className="btn secondary" onClick={() => k.declineLocation()}>
            Decline location
          </button>
        </div>
        <label htmlFor="place">Manual place (not animal locality)</label>
        <input
          id="place"
          type="text"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="City or neighborhood"
        />
        <div className="row">
          <button type="button" className="btn secondary" onClick={() => void k.setManualPlace(place)}>
            Use manual place
          </button>
          <button type="button" className="btn" onClick={() => void k.lookupSupplies()}>
            Look up fixture inventory
          </button>
        </div>
        <ul className="list">
          {k.supplyHits.map((h) => (
            <li key={h.name}>
              {h.name} · {h.availability}
            </li>
          ))}
        </ul>
        <p className="muted">
          No purchase, login, checkout, phone call, message, or navigation launches from this card.
        </p>
      </article>
    </section>
  );
}
