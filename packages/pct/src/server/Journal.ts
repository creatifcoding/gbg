/**
 * EventJournal backend selection for `pact serve`.
 *
 * Flow C needs a swappable journal substrate: tests/dev can remain in
 * memory, while runtimes with IndexedDB can opt into Effect-smol's
 * persistent journal implementation. This module keeps that choice out
 * of CLI assembly code.
 */

import * as Layer from "effect-v4/Layer"
import * as EventJournal from "effect-v4/unstable/eventlog/EventJournal"

import type { PactConfigValue } from "../config/PactConfig.js"

export const layerFromConfig = (
  config: PactConfigValue["journal"],
): Layer.Layer<EventJournal.EventJournal, EventJournal.EventJournalError> => {
  switch (config.backend) {
    case "indexeddb":
      return EventJournal.layerIndexedDb(
        config.database !== undefined ? { database: config.database } : undefined,
      )
    case "memory":
    default:
      return EventJournal.layerMemory
  }
}
