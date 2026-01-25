/**
 * init command - Generate spike config JSON template
 *
 * @skill spikectl/core
 */

import { Args, Command } from "@effect/cli"
import { Effect } from "effect"
import { generateConfigTemplate } from "../services/generators.js"
import { section, sectionEnd, spikeWarning, spikeSuccess, NextSteps } from "../output.js"

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
      yield* spikeWarning(
        `File already exists: ${filename}`,
        "Use a different name or delete the existing file."
      )
      return
    }

    const config = generateConfigTemplate(initName)
    yield* Effect.promise(() => Bun.write(filename, config))

    yield* section("SPIKE CONFIG CREATED", filename)
    yield* spikeSuccess(
      "Config created",
      { file: filename },
      NextSteps.afterConfigCreate(filename)
    )
    yield* sectionEnd()
  })
).pipe(Command.withDescription("Generate a spike config JSON template"))
