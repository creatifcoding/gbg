#!/usr/bin/env bun
/**
 * Agent-browser smoke for the session drawer temporal loading envelope.
 *
 * Assumes TMNL dev is already running (usually via interactive_shell):
 *   TMNL_VITE_FORCE=1 bun run dev
 */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const session = process.env.TMNL_SESSION_DRAWER_SMOKE_SESSION ?? 'tmnl-session-drawer-smoke'
const baseUrl = process.env.TMNL_SESSION_DRAWER_SMOKE_URL ?? 'http://127.0.0.1:1420/session-drawer-smoke.html'
const outputDir = process.env.TMNL_SESSION_DRAWER_SMOKE_OUT ?? '/tmp/tmnl'
const socketDir = process.env.AGENT_BROWSER_SOCKET_DIR ?? '/tmp/tmnl/agent-browser-session-smoke'

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

const evidenceEval = `(() => ({
  url: location.href,
  title: document.title,
  drawer: !!document.querySelector('[data-tmnl-session-drawer]'),
  skeleton: !!document.querySelector('[data-tmnl-session-skeleton]'),
  skeletonMode: document.querySelector('[data-tmnl-session-skeleton]')?.getAttribute('data-tmnl-session-skeleton-mode') ?? null,
  list: !!document.querySelector('[data-tmnl-session-list]'),
  sessionCards: document.querySelectorAll('[data-tmnl-session-list] [role=button]').length,
  textFloorViolations: [...document.querySelectorAll('*')].filter((el) => {
    const fontSize = parseFloat(getComputedStyle(el).fontSize)
    return fontSize > 0 && fontSize < 12
  }).slice(0, 10).map((el) => ({
    tag: el.tagName,
    text: el.textContent?.trim().slice(0, 40),
    fontSize: getComputedStyle(el).fontSize,
  })),
}))()`

async function waitForReady() {
  for (let i = 0; i < 18; i++) {
    const result = await agent(['eval', `(() => ({ ready: document.readyState, rootChildren: document.getElementById('root')?.children.length ?? 0 }))()`, '--json'], 1)
    if (result.exitCode === 0 && result.stdout.includes('"rootChildren":1')) return
    await sleep(2_000)
  }
}

async function capture(label: 'skeleton' | 'settled', url: string) {
  const opened = await agent(['open', url, '--json'])
  if (opened.exitCode !== 0) {
    // agent-browser can occasionally report EAGAIN while navigation still succeeds.
    await sleep(2_000)
  }

  await waitForReady()
  await agent(['wait', label === 'skeleton' ? '2500' : '1500', '--json'], 1)

  const evidence = parseJson<{ result: unknown }>(await agent(['eval', evidenceEval, '--json']))
  const screenshotPath = join(outputDir, `session-drawer-${label}-smoke.png`)
  await agent(['screenshot', screenshotPath, '--json'])

  const snapshot = await agent(['snapshot', '-i', '-c'], 2)
  const snapshotPath = join(outputDir, `session-drawer-${label}.snapshot.txt`)
  await Bun.write(snapshotPath, snapshot.stdout)

  return {
    label,
    url,
    screenshotPath,
    snapshotPath,
    evidence: evidence.result,
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  await mkdir(socketDir, { recursive: true })

  const skeleton = await capture('skeleton', `${baseUrl}?tmnl-session-skeleton`)
  const settled = await capture('settled', `${baseUrl}?tmnl-session-settled`)

  const report = {
    generatedAt: new Date().toISOString(),
    session,
    baseUrl,
    socketDir,
    skeleton,
    settled,
  }

  const reportPath = join(outputDir, 'session-drawer-smoke-report.json')
  await Bun.write(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ reportPath, ...report }, null, 2))
}

await main()
