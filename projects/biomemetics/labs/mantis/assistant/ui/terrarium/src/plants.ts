import { assemblePlant, fixtureFileFromJson, receiptFromJson } from '../../../simulator/src/assemble.ts';
import { injectFault, injectStale } from '../../../simulator/src/inject.ts';
import { CHANNEL, type Receipt } from '../../../simulator/src/types.ts';
import { view } from '../../../simulator/src/view.ts';

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

const knownPlant = assemblePlant(fixtureFileFromJson(knownFresh), receipts);

export const galleryViews = {
  known: view(knownPlant),
  stale: view(injectStale(knownPlant, CHANNEL.dryBulb)),
  simulated: view(assemblePlant(fixtureFileFromJson(simulatedModel), receipts)),
  faulted: view(injectFault(knownPlant, 'pinch')),
  unavailable: view(assemblePlant(fixtureFileFromJson(unavailableChannels), receipts)),
};
