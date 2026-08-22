import type { Honesty, PlantView } from './types.ts';

export const formatPaint = (plantView: PlantView): string => {
  const lines = [
    plantView.banner,
    `sourceClass=${plantView.sourceClass} fixture=${plantView.fixtureId} phase=${plantView.phase}`,
    `S1=${plantView.interlocks.s1.kind} S2=${plantView.interlocks.s2.kind} Q1=${plantView.interlocks.q1.kind}`,
    plantView.video.kind === 'available'
      ? `video=available stream=none`
      : `video=unavailable reason=${plantView.video.reason} stream=none`,
    `clock=${plantView.clock}`,
  ];
  for (const channel of plantView.channels) {
    lines.push(`paint:${channel.paint} ${channel.channel}`);
  }
  return lines.join('\n');
};

export const paints = (plantView: PlantView): Record<string, Honesty> =>
  Object.fromEntries(plantView.channels.map((channel) => [channel.channel, channel.paint]));
