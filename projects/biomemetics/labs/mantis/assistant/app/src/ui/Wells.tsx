export function TerrariumSurface() {
  return (
    <section aria-labelledby="terra-heading">
      <p className="kicker">Terrarium · terrarium-read</p>
      <h1 id="terra-heading">Telemetry well</h1>
      <article className="well" aria-label="Terrarium empty well">
        <p className="well-kicker">No live gateway</p>
        <h2>This well is empty</h2>
        <p>
          A1 has no terrarium telemetry, camera, or rail read. Unavailable is not a husbandry
          status. This surface will never render a false all-clear.
        </p>
        <p className="muted">Gateway: unbound. Freshness: none. Simulator: A4. Telemetry well: empty.</p>
        <p role="status">Status: unavailable</p>
      </article>
    </section>
  );
}

export function LabSurface({
  drafts,
}: {
  drafts: readonly { id: string; kind: string; summary: string }[];
}) {
  return (
    <section aria-labelledby="lab-heading">
      <p className="kicker">Lab · reviewable drafts only</p>
      <h1 id="lab-heading">Draft queue</h1>
      <article className="card">
        <p>
          Observation and advice receipts can be reviewed here. SpecimenDB attachment, evidence
          admission, EVA, and shop-release are out of scope. Nothing here mints a Specimen.
        </p>
        {drafts.length === 0 ? (
          <p className="muted">No drafts yet.</p>
        ) : (
          <ul className="list">
            {drafts.map((d) => (
              <li key={d.id}>
                <strong>{d.kind}</strong> · {d.summary}
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}

export function ServiceSurface() {
  return (
    <section aria-labelledby="svc-heading">
      <p className="kicker">Service · simulator only</p>
      <h1 id="svc-heading">Simulator label</h1>
      <article className="well">
        <p className="well-kicker">No actuation</p>
        <h2>device-command is not on this surface</h2>
        <p>
          Hidden unless the simulator query is present. This is a rehearsal label, not a rail,
          binder, or load path.
        </p>
      </article>
    </section>
  );
}
