import { paintSample } from './honesty.ts';
import { assertLegal, deriveVideo, instantFromMs } from './rail.ts';
import type { PaintedChannel, Plant, PlantView, Receipt, Sample } from './types.ts';

export const view = (plant: Plant): PlantView => {
  assertLegal(plant);
  const now = instantFromMs(plant.clockMs);
  const channels: PaintedChannel[] = Object.values(plant.samples).map((sample: Sample) => {
    const receipt: Receipt | undefined = plant.receipts[sample.receiptId];
    if (!receipt) {
      throw new Error(`missing receipt ${sample.receiptId}`);
    }
    return {
      channel: sample.channel,
      paint: paintSample(sample, now, plant.freshWithinMs),
      sample,
      receipt,
    };
  });
  channels.sort((a, b) => a.channel.localeCompare(b.channel));
  return {
    fixtureId: plant.fixtureId,
    sourceClass: 'simulated',
    banner: 'SIMULATED PLANT',
    phase: plant.phase,
    interlocks: plant.interlocks,
    video: deriveVideo(plant),
    channels,
    clock: now,
    receipts: Object.values(plant.receipts).sort((a, b) => a.id.localeCompare(b.id)),
  };
};
