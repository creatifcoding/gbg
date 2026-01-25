/**
 * run command - Execute a spike file
 *
 * @skill spikectl/core
 */

import { Args, Command, Options } from "@effect/cli"
import { Effect, Console } from "effect"

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
      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      yield* Console.log(`🧪 EXECUTING SPIKE: ${spikeFile}`)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

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
        yield* Console.log(output)
      }

      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      if (exitCode === 0) {
        yield* Console.log(`✅ SPIKE PASSED - All hypotheses validated`)
        yield* Console.log(``)
        yield* Console.log(`📝 NEXT STEPS:`)
        yield* Console.log(`   1. Extract successful patterns to production code`)
        yield* Console.log(`   2. Document learning in .edin/ if significant`)
        yield* Console.log(`   3. Delete spike file if no longer needed`)
      } else {
        yield* Console.log(`❌ SPIKE FAILED - One or more hypotheses invalidated`)
        yield* Console.log(``)
        yield* Console.log(`📝 NEXT STEPS:`)
        yield* Console.log(`   1. IDENTIFY - Find FIRST failing hypothesis (that's the bug layer)`)
        yield* Console.log(`   2. ANALYZE - Check actual values vs expected in output above`)
        yield* Console.log(`   3. ROOT CAUSE - The difference reveals the bug`)
        yield* Console.log(`   4. FIX - Apply fix to production code`)
        yield* Console.log(`   5. RE-RUN - spikectl run ${spikeFile} --verbose`)
      }
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    })
).pipe(Command.withDescription("Execute a spike file"))
