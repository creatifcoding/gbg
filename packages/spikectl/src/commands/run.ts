/**
 * run command - Execute a spike file
 *
 * @skill spikectl/core
 */

import { Args, Command, Options } from "@effect/cli"
import { Effect, Console } from "effect"
import { section, sectionEnd, spikeSuccess, subSection, printList, NextSteps } from "../output.js"

const spikeFile = Args.text({ name: "file" }).pipe(
  Args.withDescription("Path to spike file to execute")
)

const verbose = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDescription("Show verbose output from spike execution"),
  Options.withDefault(false)
)

export const runCommand = Command.make(
  "run",
  { spikeFile, verbose },
  ({ spikeFile, verbose }) =>
    Effect.gen(function* () {
      yield* section("EXECUTING SPIKE", spikeFile)

      // Execute via Bun.spawn
      const proc = Bun.spawn(["bun", "run", spikeFile], {
        stdout: verbose ? "inherit" : "pipe",
        stderr: "inherit",
        cwd: process.cwd(),
      })

      const exitCode = yield* Effect.promise(() => proc.exited)

      if (!verbose && proc.stdout) {
        const output = yield* Effect.promise(async () => {
          const reader = proc.stdout as ReadableStream<Uint8Array>
          const chunks: Uint8Array[] = []
          const readerInstance = reader.getReader()
          let done = false
          while (!done) {
            const result = await readerInstance.read()
            if (result.done) {
              done = true
            } else {
              chunks.push(result.value)
            }
          }
          return new TextDecoder().decode(
            Uint8Array.from(chunks.flatMap((chunk) => Array.from(chunk)))
          )
        })
        // Raw output from spike execution - intentional Console.log
        yield* Console.log(output)
      }

      if (exitCode === 0) {
        yield* spikeSuccess(
          "SPIKE PASSED - All hypotheses validated",
          { exitCode: "0" },
          NextSteps.afterSpikePass(spikeFile)
        )
      } else {
        yield* subSection("FAILED", "One or more hypotheses invalidated")
        yield* printList(NextSteps.afterSpikeFail(spikeFile))
      }
      yield* sectionEnd()
    })
).pipe(Command.withDescription("Execute a spike file"))
