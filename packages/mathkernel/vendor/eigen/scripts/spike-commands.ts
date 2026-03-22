#!/usr/bin/env bun
/**
 * Spike: Verify command registration and execution
 *
 * Run: bun scripts/spike-commands.ts
 */

import { Effect, Logger, LogLevel } from 'effect'

// Import defaults to trigger registration side-effects
import { allCommands } from '../src/lib/commands/defaults'
import { getRegisteredCommands, getDefaultBindings } from '../src/lib/commands/decorators'
import { CommandService } from '../src/lib/commands/service'

console.log('\n=== TMNL Command Spike ===\n')

// 1. Check registration
const commands = getRegisteredCommands()
const bindings = getDefaultBindings()

console.log(`[1] Registered commands: ${commands.size}`)
console.log(`[2] Default bindings: ${bindings.length}`)

// 2. List all commands
console.log('\n--- Commands ---')
for (const [id, cmd] of commands) {
  console.log(`  ${cmd.name} (${id}) [${cmd.scope}]`)
}

// 3. Execute a command directly via Effect
console.log('\n--- Executing file.save ---')

const program = Effect.gen(function* () {
  const svc = yield* CommandService
  yield* svc.execute('file.save')
  console.log('[OK] Command executed successfully')
}).pipe(
  Effect.provide(CommandService.Default),
  Effect.catchAll((err) => Effect.sync(() => {
    console.error('[ERR] Command failed:', err)
  })),
  // Show Effect.log output
  Logger.withMinimumLogLevel(LogLevel.All)
)

await Effect.runPromise(program)

console.log('\n=== Spike Complete ===\n')
