const TELEMETRY_FIELDS = ['temperature', 'humidity', 'camera', 'rail'] as const;

export function TerrariumSurface() {
  return (
    <section aria-labelledby="terra-heading">
      <p className="kicker">Terrarium · terrarium-read</p>
      <h1 id="terra-heading">Terrarium</h1>
      <article className="well" aria-label="Terrarium telemetry">
        <p className="well-kicker">Telemetry</p>
        <dl className="telemetry">
          {TELEMETRY_FIELDS.map((field) => (
            <div key={field}>
              <dt>{field}</dt>
              <dd data-field={field}></dd>
            </div>
          ))}
        </dl>
        <p className="muted">
          A1 has no terrarium telemetry, camera, or rail read. Unavailable is not a husbandry
          status.
        </p>
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
