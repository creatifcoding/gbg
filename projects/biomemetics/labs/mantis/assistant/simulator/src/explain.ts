import type { PlantView } from './types.ts';

export type Explanation = {
  readonly sourceClass: 'simulated';
  readonly banner: 'SIMULATED PLANT';
  readonly sentences: readonly string[];
  readonly receipts: readonly { readonly id: string; readonly href: string }[];
};

const sampleSentence = (view: PlantView, channel: PlantView['channels'][number]): string => {
  const { sample, paint, receipt } = channel;
  const phase = view.phase;
  switch (sample.kind) {
    case 'unavailable':
      return `${sample.channel} is unavailable (${sample.reason}). paint=${paint}. receipt ${receipt.id} at ${receipt.href}. phase=${phase}.`;
    case 'faulted':
      return `${sample.channel} is faulted (${sample.fault}). unit=${sample.unit}. paint=${paint}. receipt ${receipt.id} at ${receipt.href}. phase=${phase}.`;
    case 'reading': {
      const uncertainty =
        sample.uncertainty.kind === 'symmetric'
          ? `uncertainty ±${sample.uncertainty.value} ${sample.uncertainty.unit}`
          : `uncertainty unverified (${sample.uncertainty.note})`;
      return `${sample.channel}=${sample.value} ${sample.unit} (${uncertainty}; calibration ${sample.calibrationRevision}; observedAt ${sample.observedAt}; sourceClass=${sample.sourceClass}; claim=${sample.claim}). paint=${paint}. receipt ${receipt.id} at ${receipt.href}.`;
    }
    default: {
      const _exhaustive: never = sample;
      return _exhaustive;
    }
  }
};

export const explain = (plantView: PlantView): Explanation => {
  const video =
    plantView.video.kind === 'available'
      ? `video available as metadata only; stream=none; ${plantView.video.note}`
      : `video unavailable (${plantView.video.reason}); stream=none`;
  const sentences = [
    `${plantView.banner}. sourceClass=${plantView.sourceClass}. fixture=${plantView.fixtureId}. phase=${plantView.phase}. S1=${plantView.interlocks.s1.kind} S2=${plantView.interlocks.s2.kind} Q1=${plantView.interlocks.q1.kind}. ${video}. clock=${plantView.clock}.`,
    ...plantView.channels.map((channel) => sampleSentence(plantView, channel)),
  ];
  return {
    sourceClass: 'simulated',
    banner: 'SIMULATED PLANT',
    sentences,
    receipts: plantView.receipts.map((receipt) => ({ id: receipt.id, href: receipt.href })),
  };
};
