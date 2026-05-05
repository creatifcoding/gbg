#!/usr/bin/env bun
/**
 * `pact` CLI entry point.
 *
 * Wires the pact command tree to BunRuntime + BunServices for stdio,
 * filesystem, path, terminal, and child-process services.
 *
 * Invoke:
 *
 *   bun run packages/pct/bin/pact.ts <subcommand> [args]
 *   pact registry status --url http://localhost:8080
 *   pact publish ./specs/vitals.ts --url http://localhost:8080
 *
 * @module @tmnl/pct/bin/pact
 */

import { BunRuntime, BunServices } from "@effect/platform-bun"
import * as Effect from "effect-v4/Effect"
import { CliOutput, Command } from "effect-v4/unstable/cli"

import { pact } from "../src/cli/index.js"

const program = Command.run(pact, { version: "0.0.1" }).pipe(
  Effect.provide(CliOutput.layer(CliOutput.defaultFormatter({ colors: true }))),
  Effect.provide(BunServices.layer),
)

BunRuntime.runMain(program)
