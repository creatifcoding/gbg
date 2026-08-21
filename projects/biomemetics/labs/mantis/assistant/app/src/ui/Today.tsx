import { useKeeper } from '../state/keeper';

export function EpistemicLegend() {
  return (
    <div className="chips" aria-label="Epistemic kinds">
      <span className="chip observed">observed</span>
      <span className="chip interpreted">interpreted</span>
      <span className="chip recommended">recommended</span>
      <span className="chip confirmed">confirmed</span>
      <span className="chip unknown">unknown</span>
    </div>
  );
}

export function TodaySurface() {
  const k = useKeeper();
  const subject = k.model.subjects[0];
  const nextReminder = k.model.reminders.find((r) => !r.cancelled);
  const lastAct = k.model.careEvents.at(-1);

  return (
    <section aria-labelledby="today-heading">
      <p className="kicker">Today · care mode</p>
      <h1 id="today-heading">Keeper notebook</h1>
      <EpistemicLegend />
      <article className="card">
        <p className="kicker">Care subject</p>
        {subject ? (
          <>
            <p>
              Local identity <code>{subject.careSubjectId}</code>
            </p>
            <p className="muted">
              Catalog Specimen: never. Taxon: {subject.taxon.status}. Locality: none.
              Housing: {subject.housing}.
            </p>
          </>
        ) : (
          <p className="muted">No CareSubject yet. Photograph or log from Observe.</p>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={() => void k.ensureSubject()}>
            Open local CareSubject
          </button>
        </div>
      </article>
      <article className="card">
        <p className="kicker">Confirmed timeline</p>
        {lastAct ? (
          <p>
            Last confirmed act: <strong>{lastAct.act}</strong> at {lastAct.occurredAt}
          </p>
        ) : (
          <p className="muted">No confirmed care events. A recommendation is not a feeding.</p>
        )}
        {nextReminder ? (
          <p>Reminder: {nextReminder.text} · {nextReminder.dueAt}</p>
        ) : (
          <p className="muted">No local reminders.</p>
        )}
      </article>
      <article className="card">
        <p className="kicker">Network</p>
        <p>{k.online ? 'Device reports online. Current lookups still require assayed adapters.' : 'Offline. Capture and logging remain available. Current inventory/transit is unavailable.'}</p>
      </article>
    </section>
  );
}
