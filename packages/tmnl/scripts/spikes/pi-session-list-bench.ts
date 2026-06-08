#!/usr/bin/env bun
/**
 * Quick harness/pi session list benchmark.
 *
 * Compares TMNL's bounded fast-list path against pi SDK's CLI-compatible
 * SessionManager.list for the current cwd. Use this before/after list-path
 * changes to keep the session drawer smooth.
 */

import { rm } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { SessionManager } from '@mariozechner/pi-coding-agent'
import { PiSessionSourceTestApi } from '@/lib/harness/session/v2/pi-session-source'

interface Args {
  readonly cwd: string
  readonly sessionDir?: string
  readonly scope: 'current' | 'all' | 'current-plus-all'
  readonly limit: number
  readonly skipSdk: boolean
  readonly diagnostics: boolean
  readonly cachePath?: string
  readonly clearCache: boolean
}

const parseArgs = (argv: ReadonlyArray<string>): Args => {
  let cwd = process.cwd()
  let sessionDir: string | undefined
  let scope: Args['scope'] = 'current-plus-all'
  let limit = 500
  let skipSdk = false
  let diagnostics = false
  let cachePath: string | undefined
  let clearCache = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i]

    if (arg === '--cwd') {
      cwd = next() ?? cwd
    } else if (arg === '--session-dir') {
      sessionDir = next()
    } else if (arg === '--scope') {
      const value = next()
      if (value === 'current' || value === 'all' || value === 'current-plus-all') scope = value
    } else if (arg === '--limit') {
      const value = Number(next())
      if (Number.isFinite(value) && value > 0) limit = value
    } else if (arg === '--skip-sdk') {
      skipSdk = true
    } else if (arg === '--diagnostics') {
      diagnostics = true
    } else if (arg === '--cache-path') {
      cachePath = next()
    } else if (arg === '--clear-cache') {
      clearCache = true
    } else if (!arg.startsWith('--')) {
      cwd = arg
    }
  }

  return { cwd, sessionDir, scope, limit, skipSdk, diagnostics, cachePath, clearCache }
}

const args = parseArgs(process.argv.slice(2))

if (args.cachePath) {
  process.env.TMNL_PI_SESSION_CACHE_PATH = args.cachePath
}

if (args.clearCache && args.cachePath) {
  await rm(args.cachePath, { force: true })
}

async function time<A>(label: string, fn: () => Promise<A>) {
  const start = performance.now()
  const value = await fn()
  const elapsedMs = performance.now() - start
  const count = Array.isArray(value)
    ? value.length
    : typeof value === 'object' && value !== null && 'sessions' in value && Array.isArray((value as any).sessions)
      ? (value as any).sessions.length
      : undefined
  console.log(JSON.stringify({
    label,
    elapsedMs: Math.round(elapsedMs * 100) / 100,
    count,
    ...(args.diagnostics && typeof value === 'object' && value !== null && 'diagnostics' in value
      ? { diagnostics: (value as any).diagnostics }
      : {}),
  }))
  return value
}

await time(`tmnl.fast-list.${args.scope}`, () =>
  PiSessionSourceTestApi.listFast({
    cwd: args.cwd,
    scope: args.scope,
    limit: args.limit,
    ...(args.sessionDir ? { sessionDir: args.sessionDir } : {}),
  }),
)

if (!args.skipSdk) {
  await time('pi.sdk.list.current', () =>
    SessionManager.list(args.cwd),
  )
}

// Some pi SDK imports keep process handles alive in test runners. This is a
// benchmark CLI, Prime, not a daemon audition.
process.exit(0)
