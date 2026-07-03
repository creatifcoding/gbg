#!/usr/bin/env bun
/**
 * Emit a JSON diagnostics rollup.
 *
 * Defaults to an in-memory PCT semantic report so the wrapper is safe in normal
 * development shells. Pass one or more `--report <file>` arguments to roll up
 * precomputed MSH/LNK/PCT DiagnosticReport JSON files without rerunning checks.
 */

import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { DiagnosticReport } from "@tmnl/msh/diagnostics"

import {
  collectPctDiagnosticsRollup,
  pctDiagnosticsServiceLayer,
  rollupDiagnosticsReports,
} from "../src/diagnostics/index.js"
import { layerMemory as RegistryMemory } from "../src/registry/Memory.js"

interface Args {
  readonly reportFiles: ReadonlyArray<string>
  readonly pretty: boolean
}

const parseArgs = (argv: ReadonlyArray<string>): Effect.Effect<Args, Error> =>
  Effect.sync(() => {
    const reportFiles: string[] = []
    let pretty = true
    for (let index = 0; index < argv.length; index += 1) {
      const arg = argv[index]
      if (arg === "--compact") {
        pretty = false
        continue
      }
      if (arg === "--pretty") {
        pretty = true
        continue
      }
      if (arg === "--report") {
        const file = argv[index + 1]
        if (file === undefined) throw new Error("--report requires a file path")
        reportFiles.push(file)
        index += 1
        continue
      }
      throw new Error(`unknown diagnostics-rollup argument: ${arg}`)
    }
    return { reportFiles, pretty }
  }).pipe(Effect.catchCause((cause) => Effect.fail(new Error(Cause.pretty(cause)))))

const loadReport = (path: string): Effect.Effect<typeof DiagnosticReport.Type, unknown> =>
  Effect.gen(function* () {
    const raw = yield* Effect.tryPromise({
      try: () => Bun.file(path).json(),
      catch: (cause) => cause,
    })
    return yield* Schema.decodeUnknownEffect(DiagnosticReport)(raw)
  })

const makePctOnlyRollup = () => {
  const deps = RegistryMemory
  const layer = Layer.mergeAll(deps, pctDiagnosticsServiceLayer.pipe(Layer.provide(deps)))
  return collectPctDiagnosticsRollup().pipe(Effect.provide(layer))
}

const program = Effect.gen(function* () {
  const args = yield* parseArgs(Bun.argv.slice(2))
  const rollup = args.reportFiles.length > 0
    ? rollupDiagnosticsReports(yield* Effect.all(args.reportFiles.map(loadReport)))
    : yield* makePctOnlyRollup()

  console.log(JSON.stringify(rollup, null, args.pretty ? 2 : 0))
})

const exit = await Effect.runPromiseExit(program)
if (exit._tag === "Failure") {
  console.error(Cause.pretty(exit.cause))
  process.exit(1)
}
