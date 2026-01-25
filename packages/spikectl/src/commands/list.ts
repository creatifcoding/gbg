/**
 * list command - List spike files
 *
 * @skill spikectl/core
 */

import { Command, Options } from "@effect/cli"
import { Effect, Console } from "effect"

const pattern = Options.text("pattern").pipe(
  Options.withAlias("p"),
  Options.withDefault("scripts/spike-*.ts"),
  Options.withDescription("Glob pattern to match spike files")
)

export const listCommand = Command.make("list", { pattern }, ({ pattern }) =>
  Effect.gen(function* () {
    const glob = new Bun.Glob(pattern)
    const files = yield* Effect.sync(() => [...glob.scanSync(".")])

    yield* Console.log(`📋 Spikes matching "${pattern}":`)
    if (files.length === 0) {
      yield* Console.log("  (no spikes found)")
    } else {
      for (const file of files.sort()) {
        yield* Console.log(`  - ${file}`)
      }
    }
    yield* Console.log(`\nTotal: ${files.length} spikes`)
  })
).pipe(Command.withDescription("List spike files matching pattern"))
