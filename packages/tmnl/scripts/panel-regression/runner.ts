/**
 * Panel regression test runner — executes scenarios via agent-browser.
 *
 * Usage:
 *   bun run scripts/panel-regression/index.ts                    # all predefined
 *   bun run scripts/panel-regression/index.ts --tags collapse    # filter by tag
 *   bun run scripts/panel-regression/index.ts --fuzz 5 10        # 10 fuzz scenarios, depth 5
 *   bun run scripts/panel-regression/index.ts --parallel 3       # 3 concurrent sessions
 *   bun run scripts/panel-regression/index.ts --scenario S4      # specific scenario
 *
 * @module panel-regression/runner
 */

import { $ } from 'bun'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import type {
  Scenario, Step, Op, Checkpoint, RunContext,
  Screenshot, StepLog, ScenarioResult, RunReport,
} from './types'

// ─── Agent Browser Shell ────────────────────────────────────────────────────

async function ab(session: string, ...args: string[]): Promise<string> {
  const result = await $`agent-browser --session ${session} ${args.map(a => $.escape(a))}`.quiet().nothrow()
  return result.stdout.toString().trim()
}

async function abPress(session: string, key: string): Promise<void> {
  await $`agent-browser --session ${session} press ${key}`.quiet().nothrow()
}

async function abScreenshot(session: string, path: string): Promise<string> {
  await $`agent-browser --session ${session} screenshot ${path}`.quiet().nothrow()
  return path
}

async function abOpen(session: string, url: string): Promise<void> {
  await $`agent-browser --session ${session} open ${url}`.quiet().nothrow()
}

async function abEval(session: string, js: string): Promise<string> {
  const result = await $`agent-browser --session ${session} eval ${js}`.quiet().nothrow()
  return result.stdout.toString().trim()
}

async function abErrors(session: string): Promise<string> {
  const result = await $`agent-browser --session ${session} errors`.quiet().nothrow()
  return result.stdout.toString().trim()
}

async function abConsole(session: string): Promise<string> {
  const result = await $`agent-browser --session ${session} console`.quiet().nothrow()
  return result.stdout.toString().trim()
}

async function abClose(session: string): Promise<void> {
  await $`agent-browser --session ${session} close`.quiet().nothrow()
}

async function abClickModeToggle(session: string): Promise<void> {
  // Find and click the strip/tree toggle button
  const snapshot = await $`agent-browser --session ${session} snapshot -i`.quiet().nothrow()
  const text = snapshot.stdout.toString()
  const match = text.match(/button "◇ (?:Strip|Tree)" \[ref=(e\d+)\]/)
  if (match) {
    await $`agent-browser --session ${session} click @${match[1]}`.quiet().nothrow()
  }
}

// ─── Timing ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Step Execution ─────────────────────────────────────────────────────────

function isCheckpoint(step: Step): step is Checkpoint {
  return '_type' in step && step._type === 'checkpoint'
}

async function executeOp(op: Op, ctx: RunContext): Promise<StepLog> {
  const start = performance.now()
  const errors: string[] = []

  for (const key of op.keys) {
    try {
      await abPress(ctx.session, key)
      await sleep(80) // inter-key gap
    } catch (e: any) {
      errors.push(`Key ${key}: ${e.message}`)
    }
  }

  await sleep(op.wait ?? 150)

  return {
    index: ctx.screenshotIndex,
    tag: op.tag,
    label: op.label,
    timestamp: Date.now(),
    durationMs: performance.now() - start,
    error: errors.length ? errors.join('; ') : undefined,
  }
}

async function executeCheckpoint(
  cp: Checkpoint,
  ctx: RunContext,
  stepIdx: number,
): Promise<Screenshot> {
  await sleep(200) // settle time

  const name = `${String(stepIdx).padStart(3, '0')}-${cp.name}`
  const path = join(ctx.screenshotDir, `${name}.png`)

  await abScreenshot(ctx.session, path)
  ctx.screenshotIndex++

  return {
    name: cp.name,
    path,
    step: stepIdx,
    timestamp: Date.now(),
  }
}

// ─── Scenario Execution ─────────────────────────────────────────────────────

export async function executeScenario(
  scenario: Scenario,
  opts: { baseUrl: string; outputDir: string; session: string },
): Promise<ScenarioResult> {
  const startedAt = new Date().toISOString()
  const start = performance.now()

  const scenarioDir = join(opts.outputDir, scenario.id)
  await mkdir(scenarioDir, { recursive: true })

  const ctx: RunContext = {
    runId: scenario.id,
    scenarioId: scenario.id,
    screenshotDir: scenarioDir,
    baseUrl: opts.baseUrl,
    session: opts.session,
    screenshotIndex: 0,
  }

  const screenshots: Screenshot[] = []
  const stepLogs: StepLog[] = []
  const errors: string[] = []

  // Determine modes to run
  const modes = scenario.modes.includes('both')
    ? ['strip', 'tree'] as const
    : scenario.modes

  for (const mode of modes) {
    const modeDir = join(scenarioDir, mode)
    await mkdir(modeDir, { recursive: true })
    ctx.screenshotDir = modeDir
    ctx.screenshotIndex = 0

    try {
      // Fresh page
      await abOpen(ctx.session, opts.baseUrl)
      await sleep(1500)

      console.log(`  ⏳ ${scenario.id} [${mode}] — ${scenario.title}`)

      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i]

        if (isCheckpoint(step)) {
          const shot = await executeCheckpoint(step, ctx, i)
          screenshots.push(shot)
          console.log(`    📸 ${step.name}${step.description ? ` — ${step.description}` : ''}`)

          // Verify if needed
          if (step.verifyFn) {
            const result = await step.verifyFn(ctx)
            if (!result.passed) {
              errors.push(`[${mode}] ${step.name}: ${result.message}`)
              console.log(`    ❌ ${result.message}`)
            }
          }
        } else {
          const log = await executeOp(step, ctx)
          stepLogs.push(log)
          if (log.error) {
            errors.push(`[${mode}] Step ${i} (${step.tag}): ${log.error}`)
          }
        }
      }

      // If running both modes, switch for second pass
      if (modes.length > 1 && mode === 'strip') {
        await sleep(300)
        await abClickModeToggle(ctx.session)
        await sleep(500)
        const shot = await executeCheckpoint(
          { _type: 'checkpoint', name: 'mode-switch-to-tree', description: 'After switching to tree' },
          ctx, scenario.steps.length,
        )
        screenshots.push(shot)
      }

      // Collect browser errors
      const browserErrors = await abErrors(ctx.session)
      if (browserErrors && !browserErrors.includes('No errors')) {
        const relevantErrors = browserErrors
          .split('\n')
          .filter(l => l.includes('✗'))
          .map(l => l.replace(/^\[31m✗\[0m /, '').trim())
          .filter(Boolean)

        if (relevantErrors.length > 0) {
          errors.push(...relevantErrors.map(e => `[${mode}] Browser: ${e}`))
        }
      }

    } catch (e: any) {
      errors.push(`[${mode}] Fatal: ${e.message}`)
      console.log(`    💥 Fatal: ${e.message}`)
    }
  }

  const passed = errors.length === 0
  const icon = passed ? '✅' : '❌'
  console.log(`  ${icon} ${scenario.id} — ${passed ? 'PASSED' : `FAILED (${errors.length} errors)`}`)

  return {
    scenarioId: scenario.id,
    title: scenario.title,
    runId: ctx.runId,
    mode: modes.join('+'),
    passed,
    screenshots,
    steps: stepLogs,
    errors,
    durationMs: performance.now() - start,
    startedAt,
  }
}

// ─── Parallel Runner ────────────────────────────────────────────────────────

export async function runScenarios(
  scenarios: Scenario[],
  opts: {
    baseUrl?: string
    outputDir: string
    concurrency?: number
  },
): Promise<RunReport> {
  const startedAt = new Date().toISOString()
  const baseUrl = opts.baseUrl ?? 'http://localhost:1420'
  const concurrency = opts.concurrency ?? 1
  const results: ScenarioResult[] = []

  console.log(`\n🔬 Panel Regression Suite`)
  console.log(`   ${scenarios.length} scenarios, concurrency=${concurrency}`)
  console.log(`   Output: ${opts.outputDir}\n`)

  // Session naming: run-scoped prefix + scenario id → guaranteed unique per run.
  // agent-browser --session creates isolated browser contexts (separate cookies,
  // storage, viewport) so parallel sessions never collide.
  const sessionPrefix = `pr-${Date.now().toString(36)}`
  let sessionCounter = 0
  const makeSession = (scenario: Scenario) =>
    `${sessionPrefix}-${(sessionCounter++).toString(36)}-${scenario.id}`

  if (concurrency === 1) {
    // Sequential — one session at a time
    for (const scenario of scenarios) {
      const session = makeSession(scenario)
      try {
        const result = await executeScenario(scenario, {
          baseUrl,
          outputDir: opts.outputDir,
          session,
        })
        results.push(result)
      } finally {
        await abClose(session)
      }
    }
  } else {
    // Parallel batches — each slot gets its own isolated session
    const batches: Scenario[][] = []
    for (let i = 0; i < scenarios.length; i += concurrency) {
      batches.push(scenarios.slice(i, i + concurrency))
    }

    for (const [batchIdx, batch] of batches.entries()) {
      console.log(`  📦 Batch ${batchIdx + 1}/${batches.length} (${batch.length} scenarios)`)

      const batchResults = await Promise.allSettled(
        batch.map(async (scenario) => {
          const session = makeSession(scenario)
          try {
            return await executeScenario(scenario, {
              baseUrl,
              outputDir: opts.outputDir,
              session,
            })
          } finally {
            await abClose(session)
          }
        }),
      )

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          results.push(r.value)
        } else {
          // Scenario crashed hard — still record it
          results.push({
            scenarioId: 'unknown',
            title: 'CRASHED',
            runId: sessionPrefix,
            mode: 'unknown',
            passed: false,
            screenshots: [],
            steps: [],
            errors: [`Fatal crash: ${r.reason}`],
            durationMs: 0,
            startedAt: new Date().toISOString(),
          })
        }
      }
    }
  }

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  const report: RunReport = {
    runId: opts.outputDir.split('/').pop() ?? 'unknown',
    startedAt,
    completedAt: new Date().toISOString(),
    totalScenarios: scenarios.length,
    passed,
    failed,
    scenarios: results,
  }

  // Write report
  const reportPath = join(opts.outputDir, 'report.json')
  await Bun.write(reportPath, JSON.stringify(report, null, 2))

  // Summary
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`📊 Results: ${passed} passed, ${failed} failed / ${scenarios.length} total`)
  if (failed > 0) {
    console.log(`\n❌ Failures:`)
    for (const r of results.filter(r => !r.passed)) {
      console.log(`   ${r.scenarioId}: ${r.title}`)
      for (const err of r.errors) {
        console.log(`     → ${err}`)
      }
    }
  }
  console.log(`\n📁 Report: ${reportPath}`)
  console.log(`📸 Screenshots: ${opts.outputDir}/`)

  return report
}
