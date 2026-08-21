import { useState } from 'react';
import scenario from '../../../fixtures/golden-care/scenario.json' with { type: 'json' };
import { useKeeper } from '../state/keeper';

export function ObserveSurface() {
  const k = useKeeper();
  const [note, setNote] = useState(scenario.photo.visibleFacts[0] ?? '');
  const [hyp, setHyp] = useState('Order-level guess only — raptorial forelegs visible.');
  const latestObs = k.model.observations.at(-1);
  const latestMedia = k.model.mediaDigests.at(-1);

  return (
    <section aria-labelledby="observe-heading">
      <p className="kicker">Observe · draft only</p>
      <h1 id="observe-heading">Visible facts</h1>
      <div className="photo-frame" aria-hidden="true">
        cup · not a taxon · GPS stripped
      </div>
      <label className="sr-only" htmlFor="photo">Import photograph</label>
      <input
        id="photo"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void k.capturePhoto(file);
        }}
      />
      <p className="muted">
        Photo does not establish taxon, locality, health, or length. EXIF location is stripped
        before the blob is stored.
      </p>
      <article className="card">
        <label htmlFor="obs-note">Observation (observed)</label>
        <textarea id="obs-note" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => void k.addObservation(note, latestMedia)}
          >
            Log observation
          </button>
        </div>
      </article>
      <div className="feed-grid" aria-label="Feeding events">
        <button type="button" className="feed" onClick={() => void k.logAct('offered')}>
          Offered
        </button>
        <button type="button" className="feed eaten" onClick={() => void k.logAct('eaten')}>
          Eaten
        </button>
        <button type="button" className="feed refused" onClick={() => void k.logAct('refused')}>
          Refused
        </button>
        <button type="button" className="feed removed" onClick={() => void k.logAct('removed')}>
          Removed
        </button>
      </div>
      <article className="card">
        <label htmlFor="hyp">Hypothesis (interpreted, not confirmed)</label>
        <textarea id="hyp" value={hyp} onChange={(e) => setHyp(e.target.value)} />
        <div className="row">
          <button
            type="button"
            className="btn secondary"
            disabled={!latestObs}
            onClick={() => latestObs && void k.addHypothesis(latestObs.observationId, hyp)}
          >
            File hypothesis
          </button>
        </div>
      </article>
      <ul className="list">
        {k.model.observations.map((o) => (
          <li key={o.observationId}>
            <span className="chip observed">observed</span> {o.statements.map((s) => s.text).join(' ')}
            <div className="muted">taxon {o.taxon.status} · locality none</div>
          </li>
        ))}
        {k.model.interpretations.map((i) => (
          <li key={i.interpretationId}>
            <span className="chip interpreted">interpreted</span>{' '}
            {i.statements.map((s) => s.text).join(' ')}
            {i.taxonHypothesis ? (
              <div className="muted">
                cited-guess {i.taxonHypothesis.name} · confirmed {String(i.taxonHypothesis.confirmed)}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
