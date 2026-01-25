/**
 * list command - List spike files
 *
 * @skill spikectl/core
 */

import { Command, Options } from "@effect/cli"
import { Effect } from "effect"
import { subSection, patternTable, printKv, type ColumnDef } from "../output.js"

const pattern = Options.text("pattern").pipe(
  Options.withAlias("p"),
  Options.withDefault("scripts/spike-*.ts"),
  Options.withDescription("Glob pattern to match spike files")
)

type SpikeFile = {
  file: string
  [key: string]: unknown
}

const columns: ColumnDef<SpikeFile>[] = [{ key: "file", header: "Spike File" }]

export const listCommand = Command.make("list", { pattern }, ({ pattern }) =>
  Effect.gen(function* () {
    const glob = new Bun.Glob(pattern)
    const files = yield* Effect.sync(() => [...glob.scanSync(".")])

    yield* subSection("SPIKES", `matching "${pattern}"`)

    if (files.length === 0) {
      yield* printKv("Status", "(no spikes found)")
    } else {
      const items: SpikeFile[] = files.sort().map((f) => ({ file: f }))
      yield* patternTable(items, columns)
    }

    yield* printKv("Total", `${files.length} spikes`)
  })
).pipe(Command.withDescription("List spike files matching pattern"))
