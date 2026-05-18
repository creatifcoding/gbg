/**
 * EventJournal backend selection for `pact serve`.
 *
 * Flow C needs a swappable journal substrate: tests/dev can remain in
 * memory, browser-ish runtimes can opt into IndexedDB, and production
 * servers can use Effect-smol's SQL EventJournal over a provided SQL
 * client (Postgres first). This module keeps that choice out of CLI
 * assembly code.
 */

import * as Layer from "effect-v4/Layer"
import * as EventJournal from "effect-v4/unstable/eventlog/EventJournal"
import * as SqlEventJournal from "effect-v4/unstable/eventlog/SqlEventJournal"
import * as SqlClient from "effect-v4/unstable/sql/SqlClient"
import * as SqlError from "effect-v4/unstable/sql/SqlError"

import type { PactConfigValue } from "../config/PactConfig.js"

export type JournalLayerError =
  | EventJournal.EventJournalError
  | SqlError.SqlError

export type JournalLayerRequirements = SqlClient.SqlClient

export const layerFromConfig = (
  config: PactConfigValue["journal"],
): Layer.Layer<
  EventJournal.EventJournal,
  JournalLayerError,
  JournalLayerRequirements
> => {
  switch (config.backend) {
    case "indexeddb":
      return EventJournal.layerIndexedDb(
        config.database !== undefined ? { database: config.database } : undefined,
      )

    case "postgres":
      return SqlEventJournal.layer({
        ...(config.entryTable !== undefined
          ? { entryTable: config.entryTable }
          : {}),
        ...(config.remotesTable !== undefined
          ? { remotesTable: config.remotesTable }
          : {}),
      })

    case "memory":
    default:
      return EventJournal.layerMemory
  }
}
