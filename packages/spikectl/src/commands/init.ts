/**
 * init command - Generate spike config JSON template
 *
 * @skill spikectl/core
 */

import { Args, Command } from "@effect/cli"
import { Effect, Console } from "effect"
import { generateConfigTemplate } from "../services/generators.js"

const initName = Args.text({ name: "name" }).pipe(
  Args.withDescription("Name for the spike config")
)

export const initCommand = Command.make("init", { initName }, ({ initName }) =>
  Effect.gen(function* () {
    const filename = `spike-${initName}.config.json`

    // Check if file exists
    const exists = yield* Effect.sync(() => Bun.file(filename).size > 0).pipe(
      Effect.catchAll(() => Effect.succeed(false))
    )

    if (exists) {
      yield* Console.log(`⚠️  File already exists: ${filename}`)
      yield* Console.log(`   Use a different name or delete the existing file.`)
      return
    }

    const config = generateConfigTemplate(initName)
    yield* Effect.promise(() => Bun.write(filename, config))

    yield* Console.log(``)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    yield* Console.log(`✨ SPIKE CONFIG CREATED: ${filename}`)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    yield* Console.log(``)
    yield* Console.log(`📝 NEXT STEPS:`)
    yield* Console.log(``)
    yield* Console.log(`   1. EDIT CONFIG - Customize hypotheses for your issue:`)
    yield* Console.log(`      - Update metadata.topic with specific issue description`)
    yield* Console.log(`      - Update metadata.issueRef if you have a beads issue`)
    yield* Console.log(`      - Update metadata.relatedFiles with files to investigate`)
    yield* Console.log(`      - Rewrite hypotheses[].claim with falsifiable statements`)
    yield* Console.log(`      - Add specific acceptanceCriteria for each hypothesis`)
    yield* Console.log(``)
    yield* Console.log(`   2. GENERATE SPIKE:`)
    yield* Console.log(`      spikectl new --config ${filename}`)
    yield* Console.log(``)
    yield* Console.log(`   3. Config will be auto-cleaned after spike generation.`)
    yield* Console.log(``)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  })
).pipe(Command.withDescription("Generate a spike config JSON template"))
