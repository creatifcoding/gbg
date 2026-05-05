#!/usr/bin/env bun
/**
 * `pact` CLI entry point.
 *
 * Wires the pact command tree to an in-package CLI runtime
 * (Stdio/FileSystem/Path/Terminal/ChildProcessSpawner) backed by
 * Node primitives. See `src/cli/runtime.ts` for why we don't use
 * `@effect/platform-bun` here.
 *
 * Invoke:
 *
 *   bun run packages/pct/bin/pact.ts <subcommand> [args]
 *   pact registry status [--config path] [--url override]
 *   pact publish ./specs/vitals.ts [--config path] [--url override]
 *
 * @module @tmnl/pct/bin/pact
 */

import * as Effect from "effect-v4/Effect"
import { CliOutput, Command } from "effect-v4/unstable/cli"

import { pact } from "../src/cli/index.js"
import { cliRuntimeLayer } from "../src/cli/runtime.js"

const program = Command.run(pact, { version: "0.0.1" }).pipe(
  Effect.provide(
    CliOutput.layer(CliOutput.defaultFormatter({ colors: true })),
  ),
  Effect.provide(cliRuntimeLayer),
)

const exit = await Effect.runPromise(
  program.pipe(
    Effect.match({
      onFailure: () => 1,
      onSuccess: () => 0,
    }),
  ),
)
process.exit(exit)
