#!/usr/bin/env bun
/**
 * Streams Playground Runner
 *
 * Usage:
 *   bun run src/lib/streams/playground.ts [challenge]
 *
 * Examples:
 *   bun run src/lib/streams/playground.ts 1        # Run challenge 1
 *   bun run src/lib/streams/playground.ts          # Run all
 */

import { Effect, Console } from "effect"

const challenge = process.argv[2]

const divider = (title: string) =>
  Console.log(`\n${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}\n`)

const runChallenge1 = async () => {
  const { runHeartbeat } = await import("./01-heartbeat")
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* divider("Challenge 1: The Heartbeat")
      yield* runHeartbeat(5)
    })
  )
}

const runChallenge2 = async () => {
  const { runFeed } = await import("./02-cancellable-feed")
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* divider("Challenge 2: The Cancellable Feed")
      yield* runFeed(1000)
    })
  )
}

const runChallenge3 = async () => {
  const { runChallenge3: run } = await import("./03-feed-demo")
  await run()
}

const runChallenge4 = async () => {
  const { runChallenge4: run } = await import("./04-manager-demo")
  await run()
}

const runChallenge5 = async () => {
  const { runChallenge5: run } = await import("./05-primitives-demo")
  await run()
}

const runChallenge6 = async () => {
  const { runChallenge6: run } = await import("./06-multi-source-merge")
  await Effect.runPromise(run)
}

const runChallenge7 = async () => {
  const { run } = await import("./07-channel-demo")
  await run()
}

const challenges: Record<string, () => Promise<void>> = {
  "1": runChallenge1,
  "2": runChallenge2,
  "3": runChallenge3,
  "4": runChallenge4,
  "5": runChallenge5,
  "6": runChallenge6,
  "7": runChallenge7,
}

const runAll = async () => {
  for (const [num, run] of Object.entries(challenges)) {
    await run()
  }
}

const main = async () => {
  if (challenge && challenges[challenge]) {
    await challenges[challenge]()
  } else if (!challenge) {
    await runAll()
  } else {
    console.error(`Unknown challenge: ${challenge}`)
    console.error(`Available: ${Object.keys(challenges).join(", ")}`)
    process.exit(1)
  }
}

main().catch(console.error)
