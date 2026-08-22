import { assemblePlant, receiptFromJson } from '../../../simulator/src/assemble.ts';
import { injectFault, injectStale } from '../../../simulator/src/inject.ts';
import { CHANNEL, type Receipt } from '../../../simulator/src/types.ts';
import { view } from '../../../simulator/src/view.ts';
import { TerrariumCard } from './TerrariumCard.tsx';

import knownFresh from '../../../fixtures/telemetry/plants/known-fresh.json';
import simulatedModel from '../../../fixtures/telemetry/plants/simulated-model.json';
import unavailableChannels from '../../../fixtures/telemetry/plants/unavailable-channels.json';
import recDryKnown from '../../../fixtures/telemetry/receipts/rec.air.dry-bulb.known.json';
import recHumKnown from '../../../fixtures/telemetry/receipts/rec.air.relative-humidity.known.json';
import recHumUnavail from '../../../fixtures/telemetry/receipts/rec.air.relative-humidity.unavailable.json';
import recLuxModel from '../../../fixtures/telemetry/receipts/rec.enclosure.illuminance.model.json';
import recLuxUnavail from '../../../fixtures/telemetry/receipts/rec.enclosure.illuminance.unavailable.json';
import recVoltKnown from '../../../fixtures/telemetry/receipts/rec.rail.local-branch-voltage.known.json';

const receipts: Record<string, Receipt> = {
  [recDryKnown.id]: receiptFromJson(recDryKnown),
  [recHumKnown.id]: receiptFromJson(recHumKnown),
  [recHumUnavail.id]: receiptFromJson(recHumUnavail),
  [recLuxModel.id]: receiptFromJson(recLuxModel),
  [recLuxUnavail.id]: receiptFromJson(recLuxUnavail),
  [recVoltKnown.id]: receiptFromJson(recVoltKnown),
};

const known = view(assemblePlant(knownFresh, receipts));
const stale = view(injectStale(assemblePlant(knownFresh, receipts), CHANNEL.dryBulb));
const simulated = view(assemblePlant(simulatedModel, receipts));
const faulted = view(injectFault(assemblePlant(knownFresh, receipts), 'pinch'));
const unavailable = view(assemblePlant(unavailableChannels, receipts));

export function Gallery() {
  return (
    <main className="gallery">
      <header className="gallery-head">
        <p className="terra-kicker">A4a · service-sim · no live gateway</p>
        <h1>Simulated terrarium honesty gallery</h1>
        <p>
          Five plants from fixtures. Known, stale, simulated, faulted, and unavailable are painted
          as stamps. This is not a linked terrarium. stream=none on every card.
        </p>
      </header>
      <TerrariumCard view={known} />
      <TerrariumCard view={stale} />
      <TerrariumCard view={simulated} />
      <TerrariumCard view={faulted} />
      <TerrariumCard view={unavailable} />
    </main>
  );
}

export const galleryViews = { known, stale, simulated, faulted, unavailable };
