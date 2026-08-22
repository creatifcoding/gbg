import type { Honesty, PlantView } from '../../../simulator/src/types.ts';

const honestyLabel: Record<Honesty, string> = {
  known: 'known',
  stale: 'stale',
  simulated: 'simulated',
  faulted: 'faulted',
  unavailable: 'unavailable',
};

const mateText = (kind: string): string => kind;
const q1Text = (kind: string): string => kind;

export function TerrariumCard({ view }: { readonly view: PlantView }) {
  const videoText =
    view.video.kind === 'available'
      ? 'Camera metadata available. No live stream.'
      : `Camera unavailable (${view.video.reason}). No live stream.`;
  return (
    <article
      className="terra-card"
      data-source-class={view.sourceClass}
      data-phase={view.phase}
      data-video={view.video.kind}
      aria-label={`Simulated terrarium ${view.fixtureId}`}
    >
      <p className="terra-stamp" role="status">
        {view.banner}
      </p>
      <p className="terra-kicker">
        fixture {view.fixtureId} · phase {view.phase} · sourceClass {view.sourceClass}
      </p>
      <div className="terra-rail" data-phase={view.phase} aria-hidden="true">
        <span className="terra-rail-track" />
        <span className={`terra-carriage terra-carriage--${view.phase}`} />
      </div>
      <dl className="terra-locks">
        <div>
          <dt>S1</dt>
          <dd>{mateText(view.interlocks.s1.kind)}</dd>
        </div>
        <div>
          <dt>S2</dt>
          <dd>{mateText(view.interlocks.s2.kind)}</dd>
        </div>
        <div>
          <dt>Q1</dt>
          <dd>{q1Text(view.interlocks.q1.kind)}</dd>
        </div>
      </dl>
      <section className="terra-camera" data-video={view.video.kind}>
        <h2>Camera</h2>
        <p>{videoText}</p>
        <p className="terra-stream">stream=none</p>
      </section>
      <ul className="terra-channels">
        {view.channels.map((channel) => (
          <li
            key={channel.channel}
            className={`terra-channel terra-channel--${channel.paint}`}
            data-honesty={channel.paint}
            data-channel={channel.channel}
          >
            <span className="terra-honesty" aria-label={`honesty ${channel.paint}`}>
              {honestyLabel[channel.paint]}
            </span>
            <span className="terra-channel-id">{channel.channel}</span>
            <ChannelValue view={view} channel={channel} />
            <a className="terra-receipt" href={channel.receipt.href}>
              {channel.receipt.id}
            </a>
          </li>
        ))}
      </ul>
      <p className="terra-clock">clock {view.clock}</p>
    </article>
  );
}

function ChannelValue({
  channel,
}: {
  readonly view: PlantView;
  readonly channel: PlantView['channels'][number];
}) {
  const { sample } = channel;
  if (sample.kind === 'unavailable') {
    return <span className="terra-value">{sample.reason}</span>;
  }
  if (sample.kind === 'faulted') {
    return (
      <span className="terra-value">
        fault {sample.fault} · {sample.unit}
      </span>
    );
  }
  const uncertainty =
    sample.uncertainty.kind === 'symmetric'
      ? `±${sample.uncertainty.value} ${sample.uncertainty.unit}`
      : sample.uncertainty.note;
  return (
    <span className="terra-value">
      {sample.value} {sample.unit} {uncertainty} cal {sample.calibrationRevision}
    </span>
  );
}
