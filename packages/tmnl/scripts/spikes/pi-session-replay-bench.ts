#!/usr/bin/env bun
/**
 * Pi session replay benchmark.
 *
 * Measures the new bounded preview path separately from the legacy full
 * SessionManager.open/getBranch snapshot path. The drawer target is
 * time-to-preview <500ms; full hydration can be slower because it now runs in
 * the background.
 */

import { stat } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { PiSessionSourceTestApi } from '@/lib/harness/session/v2/pi-session-source'

interface Args {
  readonly cwd: string
  readonly sessionDir?: string
  readonly scope: 'current' | 'all' | 'current-plus-all'
  readonly limit: number
  readonly path?: string
  readonly previewMaxEntries: number
  readonly previewTailBytes: number
  readonly skipFull: boolean
}

const parseArgs = (argv: ReadonlyArray<string>): Args => {
  let cwd = process.cwd()
  let sessionDir: string | undefined
  let scope: Args['scope'] = 'current-plus-all'
  let limit = 500
  let path: string | undefined
  let previewMaxEntries = 80
  let previewTailBytes = 512 * 1024
  let skipFull = false

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
    } else if (arg === '--path') {
      path = next()
    } else if (arg === '--preview-max-entries') {
      const value = Number(next())
      if (Number.isFinite(value) && value > 0) previewMaxEntries = value
    } else if (arg === '--preview-tail-bytes') {
      const value = Number(next())
      if (Number.isFinite(value) && value > 0) previewTailBytes = value
    } else if (arg === '--skip-full') {
      skipFull = true
    } else if (!arg.startsWith('--')) {
      path = arg
    }
  }

  return { cwd, sessionDir, scope, limit, path, previewMaxEntries, previewTailBytes, skipFull }
}

const roundMs = (value: number) => Math.round(value * 100) / 100

async function time<A>(label: string, fn: () => Promise<A>) {
  const startedAt = performance.now()
  const value = await fn()
  return {
    label,
    elapsedMs: roundMs(performance.now() - startedAt),
    value,
  }
}

const args = parseArgs(process.argv.slice(2))

async function resolveTargetPath(): Promise<{ path: string; source: string; size: number }> {
  if (args.path) {
    const stats = await stat(args.path)
    return { path: args.path, source: 'explicit', size: stats.size }
  }

  const list = await PiSessionSourceTestApi.listFast({
    cwd: args.cwd,
    scope: args.scope,
    limit: args.limit,
    ...(args.sessionDir ? { sessionDir: args.sessionDir } : {}),
  })

  const sized = await Promise.all(
    list.sessions.map(async (session) => ({
      path: session.ref.path,
      source: session.localProject ? 'local-list-largest' : 'global-list-largest',
      size: (await stat(session.ref.path)).size,
    })),
  )

  const largest = sized.sort((a, b) => b.size - a.size)[0]
  if (!largest) throw new Error('No pi sessions found to benchmark')
  return largest
}

const target = await resolveTargetPath()

const preview = await time('tmnl.pi-replay.preview', async () =>
  PiSessionSourceTestApi.loadPreviewSnapshotFromPiFile({
    path: target.path,
    maxEntries: args.previewMaxEntries,
    tailBytes: args.previewTailBytes,
  }),
)

const full = args.skipFull
  ? null
  : await time('tmnl.pi-replay.full-snapshot', async () =>
      PiSessionSourceTestApi.loadSnapshotFromPiFile(target.path),
    )

const previewSnapshot = preview.value
const fullSnapshot = full?.value ?? null

console.log(JSON.stringify({
  target,
  preview: {
    label: preview.label,
    elapsedMs: preview.elapsedMs,
    sessionId: previewSnapshot.sessionId,
    events: previewSnapshot.events.length,
    headSeq: previewSnapshot.headSeq,
    within500ms: preview.elapsedMs < 500,
  },
  full: full && fullSnapshot ? {
    label: full.label,
    elapsedMs: full.elapsedMs,
    sessionId: fullSnapshot.sessionId,
    events: fullSnapshot.events.length,
    headSeq: fullSnapshot.headSeq,
  } : null,
  config: {
    previewMaxEntries: args.previewMaxEntries,
    previewTailBytes: args.previewTailBytes,
    scope: args.scope,
    limit: args.limit,
  },
}))

// pi SDK imports can keep handles alive. Benchmark, not a sleepover.
process.exit(0)
