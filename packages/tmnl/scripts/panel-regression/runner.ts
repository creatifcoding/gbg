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

/**
 * agent-browser commands.
 *
 * Uses the DEFAULT session (no --session flag) because:
 * - Named sessions launch headless Chromium that can't init the full app
 *   (niri fiber crash, router initial-load bug)
 * - The default session is the already-connected browser with AppShell mounted
 * - Tests run SEQUENTIALLY on the default session, resetting state between each
 */

async function ab(...args: string[]): Promise<string> {
  const result = await $`agent-browser ${args.map(a => $.escape(a))}`.quiet().nothrow()
  return result.stdout.toString().trim()
}

async function abPress(key: string): Promise<void> {
  await $`agent-browser press ${key}`.quiet().nothrow()
}

async function abScreenshot(path: string): Promise<string> {
  await $`agent-browser screenshot ${path}`.quiet().nothrow()
  return path
}

async function abEval(js: string): Promise<string> {
  const result = await $`agent-browser eval ${js}`.quiet().nothrow()
  return result.stdout.toString().trim()
}

async function abErrors(): Promise<string> {
  const result = await $`agent-browser errors --clear`.quiet().nothrow()
  return result.stdout.toString().trim()
}

async function abClickRef(ref: string): Promise<void> {
  await $`agent-browser click @${ref}`.quiet().nothrow()
}

async function abClickModeToggle(): Promise<void> {
  const snapshot = await $`agent-browser snapshot -i`.quiet().nothrow()
  const text = snapshot.stdout.toString()
  const match = text.match(/button "◇ (?:Strip|Tree)" \[ref=(e\d+)\]/)
  if (match) {
    await abClickRef(match[1])
  }
}

/**
 * Reset panel state between scenarios.
 *
 * Calls __PANEL_TEST__.reset() which wipes stx state (panels, tree, strip,
 * zOrder) and closes the overlay. NO page reload — avoids the router bug.
 */
async function resetPanelState(): Promise<void> {
  const hasApi = await abEval('typeof window.__PANEL_TEST__?.reset')
  if (hasApi === '"function"') {
    await abEval('window.__PANEL_TEST__.reset()')
    await sleep(300)
  }

  // Clear browser errors from previous run
  await abErrors()
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
      await abPress(key)
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

  await abScreenshot(path)
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
  opts: { outputDir: string },
): Promise<ScenarioResult> {
  const startedAt = new Date().toISOString()
  const start = performance.now()

  const scenarioDir = join(opts.outputDir, scenario.id)
  await mkdir(scenarioDir, { recursive: true })

  const ctx: RunContext = {
    runId: scenario.id,
    scenarioId: scenario.id,
    screenshotDir: scenarioDir,
    baseUrl: '',
    session: 'default',
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
      // Reset panel state between runs (clean slate)
      await resetPanelState()

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
        await abClickModeToggle()
        await sleep(500)
        const shot = await executeCheckpoint(
          { _type: 'checkpoint', name: 'mode-switch-to-tree', description: 'After switching to tree' },
          ctx, scenario.steps.length,
        )
        screenshots.push(shot)
      }

      // Collect browser errors (filter known noise)
      const KNOWN_NOISE = [
        'transformCallback',         // dnd-kit internal
        'ResizeObserver loop',       // browser layout noise
        'Vite HMR',                  // dev only
        'favicon.ico',               // 404 on fresh load
        'net::ERR_',                 // network transients
        'niri',                      // niri WM integration (not available in test)
      ]
      const browserErrors = await abErrors()
      if (browserErrors && !browserErrors.includes('No errors')) {
        const relevantErrors = browserErrors
          .split('\n')
          .filter(l => l.includes('✗'))
          .map(l => l.replace(/\[31m✗\[0m /g, '').trim())
          .filter(Boolean)
          .filter(e => !KNOWN_NOISE.some(noise => e.includes(noise)))

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
    outputDir: string
  },
): Promise<RunReport> {
  const startedAt = new Date().toISOString()
  const results: ScenarioResult[] = []

  // Verify the default browser session is alive and has the app mounted
  const hasAppShell = await abEval('!!document.querySelector("[data-app-shell]")')
  if (hasAppShell !== 'true') {
    console.error('❌ Default browser session does not have the app mounted.')
    console.error('   Open the app in agent-browser first: agent-browser open http://localhost:1420')
    process.exit(1)
  }

  // Ensure __PANEL_TEST__ API is available
  const hasTestApi = await abEval('typeof window.__PANEL_TEST__?.toggle')
  if (hasTestApi !== '"function"') {
    console.error('⚠️  __PANEL_TEST__ API not found — overlay may not have loaded yet.')
    console.error('   Toggle the panel overlay once (Alt+P) to initialize it.')
  }

  console.log(`\n🔬 Panel Regression Suite`)
  console.log(`   ${scenarios.length} scenarios (sequential on default session)`)
  console.log(`   Output: ${opts.outputDir}\n`)

  // Sequential execution — all scenarios share the default session
  for (const scenario of scenarios) {
    const result = await executeScenario(scenario, {
      outputDir: opts.outputDir,
    })
    results.push(result)
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
