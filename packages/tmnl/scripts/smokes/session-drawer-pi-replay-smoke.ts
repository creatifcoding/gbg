#!/usr/bin/env bun
/**
 * Deterministic agent-browser smoke for pi-cli session row routing.
 *
 * Uses the isolated session drawer smoke page with a single tiny pi fixture row.
 * Verifies row selection calls SessionDrawer.onResumePiSession(path, id).
 */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const session = process.env.TMNL_SESSION_DRAWER_PI_SMOKE_SESSION ?? 'tmnl-session-drawer-pi-replay-smoke'
const baseUrl = process.env.TMNL_SESSION_DRAWER_SMOKE_URL ?? 'http://127.0.0.1:1420/session-drawer-smoke.html'
const outputDir = process.env.TMNL_SESSION_DRAWER_SMOKE_OUT ?? '/tmp/tmnl'
const socketDir = process.env.AGENT_BROWSER_SOCKET_DIR ?? '/tmp/tmnl/agent-browser-session-pi-smoke'

const encoder = new TextDecoder()

interface CommandResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function run(command: string, args: ReadonlyArray<string>, retries = 4): Promise<CommandResult> {
  let last: CommandResult | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    const proc = Bun.spawnSync([command, ...args], {
      env: {
        ...process.env,
        AGENT_BROWSER_SOCKET_DIR: socketDir,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const result: CommandResult = {
      stdout: encoder.decode(proc.stdout),
      stderr: encoder.decode(proc.stderr),
      exitCode: proc.exitCode,
    }

    last = result
    const transient = result.stdout.includes('Resource temporarily unavailable')
      || result.stderr.includes('Resource temporarily unavailable')
      || result.stderr.includes('Execution context was destroyed')
      || result.stdout.includes('Execution context was destroyed')

    if (result.exitCode === 0 && !transient) return result
    await sleep(1_500 * attempt)
  }

  return last ?? { stdout: '', stderr: 'command did not run', exitCode: 1 }
}

async function agent(args: ReadonlyArray<string>, retries?: number): Promise<CommandResult> {
  return run('agent-browser', [...args, '--session', session], retries)
}

function parseJson<T>(result: CommandResult): T {
  if (result.exitCode !== 0) {
    throw new Error(`agent-browser failed: ${result.stderr || result.stdout}`)
  }

  const parsed = JSON.parse(result.stdout) as { success: boolean; data?: T; error?: string }
  if (!parsed.success) {
    throw new Error(parsed.error ?? 'agent-browser command failed')
  }
  return parsed.data as T
}

async function waitForPiRow() {
  for (let i = 0; i < 20; i++) {
    const result = await agent(['eval', `(() => ({
      ready: document.readyState,
      piRows: document.querySelectorAll('[data-tmnl-session-source="pi-cli"]').length,
      drawer: !!document.querySelector('[data-tmnl-session-drawer]')
    }))()`, '--json'], 1)
    if (result.exitCode === 0 && result.stdout.includes('"piRows":1')) return
    await sleep(750)
  }
  throw new Error('Timed out waiting for tiny pi replay row')
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  await mkdir(socketDir, { recursive: true })

  const url = `${baseUrl}?tmnl-session-pi-replay`
  const opened = await agent(['open', url, '--json'])
  if (opened.exitCode !== 0) await sleep(1_500)

  await waitForPiRow()

  const before = parseJson<{ result: unknown }>(await agent(['eval', `(() => {
    const root = document.querySelector('[data-tmnl-session-smoke-root]')
    return {
      piRows: document.querySelectorAll('[data-tmnl-session-source="pi-cli"]').length,
      selectedPiPath: root?.getAttribute('data-tmnl-selected-pi-path') ?? '',
      selectedPiId: root?.getAttribute('data-tmnl-selected-pi-id') ?? '',
      textFloorViolations: [...document.querySelectorAll('*')].filter((el) => {
        const fontSize = parseFloat(getComputedStyle(el).fontSize)
        return fontSize > 0 && fontSize < 12
      }).length,
    }
  })()`, '--json']))

  await agent(['eval', `(() => {
    const row = document.querySelector('[data-tmnl-session-source="pi-cli"]')
    if (!(row instanceof HTMLElement)) throw new Error('missing pi-cli row')
    row.click()
    return true
  })()`, '--json'])

  await agent(['wait', '500', '--json'], 1)

  const after = parseJson<{ result: {
    readonly selectedSessionId: string
    readonly selectedPiPath: string
    readonly selectedPiId: string
    readonly piRows: number
    readonly textFloorViolations: number
  } }>(await agent(['eval', `(() => {
    const root = document.querySelector('[data-tmnl-session-smoke-root]')
    return {
      selectedSessionId: root?.getAttribute('data-tmnl-selected-session-id') ?? '',
      selectedPiPath: root?.getAttribute('data-tmnl-selected-pi-path') ?? '',
      selectedPiId: root?.getAttribute('data-tmnl-selected-pi-id') ?? '',
      piRows: document.querySelectorAll('[data-tmnl-session-source="pi-cli"]').length,
      textFloorViolations: [...document.querySelectorAll('*')].filter((el) => {
        const fontSize = parseFloat(getComputedStyle(el).fontSize)
        return fontSize > 0 && fontSize < 12
      }).length,
    }
  })()`, '--json']))

  if (after.result.selectedPiPath !== '/tmp/tmnl/tiny-pi-session-smoke.jsonl') {
    throw new Error(`Expected pi path to be selected, got ${after.result.selectedPiPath}`)
  }
  if (after.result.selectedPiId !== 'tiny-pi-smoke') {
    throw new Error(`Expected pi id tiny-pi-smoke, got ${after.result.selectedPiId}`)
  }
  if (after.result.textFloorViolations !== 0) {
    throw new Error(`Typography floor violations: ${after.result.textFloorViolations}`)
  }

  const screenshotPath = join(outputDir, 'session-drawer-pi-replay-smoke.png')
  await agent(['screenshot', screenshotPath, '--json'])

  const report = {
    generatedAt: new Date().toISOString(),
    session,
    url,
    socketDir,
    screenshotPath,
    before: before.result,
    after: after.result,
  }
  const reportPath = join(outputDir, 'session-drawer-pi-replay-smoke-report.json')
  await Bun.write(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ reportPath, ...report }, null, 2))
}

await main()
