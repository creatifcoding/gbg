#!/usr/bin/env bun
/**
 * Real live UI smoke for pi-cli session replay.
 *
 * Drives the actual TMNL app, not the isolated fixture page:
 *   root app → Panels → + Live → SESSIONS → first pi-cli row.
 *
 * Validates the bug class we hit in the wild:
 *   - harness remote WS is reachable
 *   - live MorphChat panel connects
 *   - real session drawer lists pi-cli rows
 *   - clicking a pi row closes the drawer and paints a pi preview status
 */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const session = process.env.TMNL_LIVE_PI_REPLAY_SMOKE_SESSION ?? 'tmnl-live-pi-replay-smoke'
const baseUrl = process.env.TMNL_LIVE_PI_REPLAY_SMOKE_URL ?? 'http://127.0.0.1:1420/'
const outputDir = process.env.TMNL_SESSION_DRAWER_SMOKE_OUT ?? '/tmp/tmnl'
const socketDir = process.env.AGENT_BROWSER_SOCKET_DIR ?? '/tmp/tmnl/agent-browser-live-pi-replay-smoke'
const healthUrl = process.env.TMNL_HARNESS_WS_HEALTH_URL ?? 'http://127.0.0.1:8787/health'
const allowFallback = process.env.TMNL_LIVE_PI_REPLAY_ALLOW_FALLBACK === '1'

const decoder = new TextDecoder()

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
      stdout: decoder.decode(proc.stdout),
      stderr: decoder.decode(proc.stderr),
      exitCode: proc.exitCode,
    }

    last = result
    const transient = result.stdout.includes('Resource temporarily unavailable')
      || result.stderr.includes('Resource temporarily unavailable')
      || result.stderr.includes('Execution context was destroyed')
      || result.stdout.includes('Execution context was destroyed')
      || result.stderr.includes('Target closed')
      || result.stdout.includes('Target closed')

    if (result.exitCode === 0 && !transient) return result
    await sleep(1_000 * attempt)
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

async function checkHarnessHealth() {
  const response = await fetch(healthUrl)
  if (!response.ok) throw new Error(`Harness remote WS health failed: ${response.status}`)
  const payload = await response.json() as { status?: string; service?: string }
  if (payload.status !== 'ok' || payload.service !== 'harness-remote-ws') {
    throw new Error(`Unexpected harness health payload: ${JSON.stringify(payload)}`)
  }
  return payload
}

async function evalJson<T>(source: string, retries?: number): Promise<T> {
  const result = await agent(['eval', source, '--json'], retries)
  return parseJson<{ result: T }>(result).result
}

async function clickPanelsIfNeeded() {
  const state = await evalJson<{ hasLiveButton: boolean; hasSessions: boolean }>(`(() => ({
    hasLiveButton: [...document.querySelectorAll('button')].some((button) => button.innerText.trim() === '+ Live'),
    hasSessions: [...document.querySelectorAll('button')].some((button) => button.innerText.trim() === 'SESSIONS'),
  }))()`)

  if (state.hasLiveButton || state.hasSessions) return

  await evalJson(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find((candidate) => candidate.title === 'Panels' || candidate.getAttribute('aria-label') === 'Panels')
    if (!(button instanceof HTMLElement)) throw new Error('Panels button not found')
    button.click()
    return true
  })()`)
}

async function ensureLivePanel() {
  for (let attempt = 0; attempt < 3; attempt++) {
    await clickPanelsIfNeeded()
    const state = await evalJson<{ hasSessions: boolean; hasLiveButton: boolean }>(`(() => ({
      hasSessions: [...document.querySelectorAll('button')].some((button) => button.innerText.trim() === 'SESSIONS'),
      hasLiveButton: [...document.querySelectorAll('button')].some((button) => button.innerText.trim() === '+ Live'),
    }))()`)

    if (state.hasSessions) return
    if (state.hasLiveButton) {
      await evalJson(`(() => {
        const button = [...document.querySelectorAll('button')]
          .find((candidate) => candidate.innerText.trim() === '+ Live')
        if (!(button instanceof HTMLElement)) throw new Error('+ Live button not found')
        button.click()
        return true
      })()`)
      return
    }

    await sleep(750)
  }

  throw new Error('Could not expose or spawn live MorphChat panel')
}

async function waitForConnectedSessionsButton() {
  for (let i = 0; i < 40; i++) {
    const state = await evalJson<{
      readonly connected: boolean
      readonly hasSessions: boolean
      readonly errorText: string | null
      readonly tail: string
    }>(`(() => {
      const text = document.body.innerText
      const errorText = text
        .split(String.fromCharCode(10))
        .find((line) => line.startsWith('ERROR:')) ?? null
      return {
        connected: text.includes('CONNECTED'),
        hasSessions: [...document.querySelectorAll('button')].some((button) => button.innerText.trim() === 'SESSIONS'),
        errorText,
        tail: text.slice(-1200),
      }
    })()`)

    if (state.errorText) throw new Error(`Live harness panel errored: ${state.errorText}\n${state.tail}`)
    if (state.connected && state.hasSessions) return state
    await sleep(750)
  }

  throw new Error('Timed out waiting for CONNECTED live panel with SESSIONS button')
}

async function openSessionsDrawer() {
  await evalJson(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find((candidate) => candidate.innerText.trim() === 'SESSIONS')
    if (!(button instanceof HTMLElement)) throw new Error('SESSIONS button not found')
    button.click()
    return true
  })()`)

  for (let i = 0; i < 30; i++) {
    const state = await evalJson<{ readonly drawer: boolean; readonly piRows: number; readonly harnessRows: number }>(`(() => ({
      drawer: !!document.querySelector('[data-tmnl-session-drawer="root"]'),
      piRows: document.querySelectorAll('[data-tmnl-session-source="pi-cli"]').length,
      harnessRows: document.querySelectorAll('[data-tmnl-session-source="harness"]').length,
    }))()`)
    if (state.drawer && state.piRows > 0) return state
    await sleep(750)
  }

  throw new Error('Timed out waiting for session drawer pi rows')
}

async function clickFirstPiRow() {
  return await evalJson<{
    readonly clicked: boolean
    readonly title: string
    readonly preview: string
    readonly piRows: number
  }>(`(() => {
    const row = document.querySelector('[data-tmnl-session-source="pi-cli"]')
    if (!(row instanceof HTMLElement)) throw new Error('missing pi-cli row')
    row.scrollIntoView({ block: 'center' })
    const text = row.textContent ?? ''
    const rect = row.getBoundingClientRect()
    row.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }))
    return {
      clicked: true,
      title: text.slice(0, 120),
      preview: text.slice(0, 400),
      piRows: document.querySelectorAll('[data-tmnl-session-source="pi-cli"]').length,
    }
  })()`)
}

async function waitForPiPreview() {
  for (let i = 0; i < 32; i++) {
    const state = await evalJson<{
      readonly drawer: boolean
      readonly statusText: string
      readonly bodyTail: string
      readonly connected: boolean
      readonly hasPreview: boolean
      readonly hasLegacyFallback: boolean
      readonly hasDeferredHydration: boolean
      readonly hasError: boolean
    }>(`(() => {
      const toast = document.querySelector('[data-slot="morphchat-status-toasts"]')
      const statusText = toast?.textContent ?? ''
      const bodyText = document.body.innerText
      return {
        drawer: !!document.querySelector('[data-tmnl-session-drawer="root"]'),
        statusText,
        bodyTail: bodyText.slice(-1500),
        connected: bodyText.includes('CONNECTED'),
        hasPreview: statusText.includes('[pi.preview]') && statusText.includes('preview painted'),
        hasLegacyFallback: statusText.includes('legacy full replay loaded'),
        hasDeferredHydration: statusText.includes('[pi.hydrate] deferred'),
        hasError: statusText.includes('[resume-pi-session]') || statusText.includes('ERROR:'),
      }
    })()`)

    if (state.hasError) throw new Error(`Pi replay surfaced error status: ${state.statusText}\n${state.bodyTail}`)
    if (!state.drawer && (state.hasPreview || state.hasLegacyFallback)) return state
    await sleep(500)
  }

  throw new Error('Timed out waiting for pi preview/fallback status after row click')
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  await mkdir(socketDir, { recursive: true })

  const health = await checkHarnessHealth()

  const opened = await agent(['open', baseUrl, '--wait', '1200', '--json'])
  if (opened.exitCode !== 0) await sleep(1_500)

  await ensureLivePanel()
  const connected = await waitForConnectedSessionsButton()
  const drawer = await openSessionsDrawer()
  const clicked = await clickFirstPiRow()
  const replay = await waitForPiPreview()
  if (replay.hasLegacyFallback && !allowFallback) {
    throw new Error(`Pi replay used legacy fallback instead of fast preview: ${replay.statusText}`)
  }
  if (!replay.hasDeferredHydration) {
    throw new Error(`Pi replay did not advertise deferred chunked hydration: ${replay.statusText}`)
  }

  await sleep(2_500)
  const postHydrationResponsiveness = await evalJson<{
    readonly evalRoundTripAt: number
    readonly connected: boolean
    readonly hasDeferredHydration: boolean
    readonly hasFullHydrationStatus: boolean
    readonly toolBlocks: number
    readonly flatToolResults: number
    readonly bodyTail: string
  }>(`(() => {
    const bodyText = document.body.innerText
    const statusText = document.querySelector('[data-slot="morphchat-status-toasts"]')?.textContent ?? ''
    return {
      evalRoundTripAt: Date.now(),
      connected: bodyText.includes('CONNECTED'),
      hasDeferredHydration: statusText.includes('[pi.hydrate] deferred'),
      hasFullHydrationStatus: statusText.includes('legacy full replay loaded') || statusText.includes('[pi.hydrate] hydrated'),
      toolBlocks: document.querySelectorAll('[data-slot="tmnl-chat-tool-block"]').length,
      flatToolResults: (bodyText.match(/\\[toolResult\\]/g) ?? []).length,
      bodyTail: bodyText.slice(-1500),
    }
  })()`, 2)

  if (!postHydrationResponsiveness.connected) {
    throw new Error(`Live panel lost connection after pi preview: ${postHydrationResponsiveness.bodyTail}`)
  }
  if (!postHydrationResponsiveness.hasDeferredHydration || postHydrationResponsiveness.hasFullHydrationStatus) {
    throw new Error(`Full hydration was not safely deferred after preview: ${JSON.stringify(postHydrationResponsiveness)}`)
  }
  if (postHydrationResponsiveness.flatToolResults > 0) {
    throw new Error(`Pi tool results are still rendered as flat prose: ${postHydrationResponsiveness.bodyTail}`)
  }

  const screenshotPath = join(outputDir, 'session-drawer-live-pi-replay-smoke.png')
  await agent(['screenshot', screenshotPath, '--json'])

  const report = {
    generatedAt: new Date().toISOString(),
    session,
    baseUrl,
    socketDir,
    health,
    connected,
    drawer,
    clicked,
    replay,
    postHydrationResponsiveness,
    allowFallback,
    screenshotPath,
  }
  const reportPath = join(outputDir, 'session-drawer-live-pi-replay-smoke-report.json')
  await Bun.write(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ reportPath, ...report }, null, 2))
}

await main()
