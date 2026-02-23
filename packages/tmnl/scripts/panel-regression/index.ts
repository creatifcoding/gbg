#!/usr/bin/env bun
/**
 * Panel regression test harness — CLI entry point.
 *
 * Usage:
 *   bun run panel:regression                           # all predefined
 *   bun run panel:regression -- --tags collapse         # filter by tag
 *   bun run panel:regression -- --fuzz 4 15             # 15 fuzz scenarios, depth 4
 *   bun run panel:regression -- --parallel 3            # 3 concurrent sessions
 *   bun run panel:regression -- --scenario amber-arch   # specific scenario by petname
 *   bun run panel:regression -- --list                  # list scenarios without running
 *
 * @module panel-regression
 */

import { mkdir } from 'fs/promises'
import { join } from 'path'
import { PREDEFINED, generateFuzzScenarios } from './scenarios'
import { runScenarios } from './runner'
import { runId } from './petnames'
import type { Scenario } from './types'

// ─── CLI Args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

function getFlag(name: string): boolean {
  return args.includes(`--${name}`)
}

function getFlagValue(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 ? args[idx + 1] : undefined
}

function getFlagValues(name: string, count: number): string[] {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 ? args.slice(idx + 1, idx + 1 + count) : []
}

// ─── Build Scenario List ────────────────────────────────────────────────────

let scenarios: Scenario[] = [...PREDEFINED]

// --fuzz <depth> <count> — always parallel, skips predefined unless --all
const fuzzArgs = getFlagValues('fuzz', 2)
let isFuzzRun = false
if (fuzzArgs.length === 2) {
  const depth = parseInt(fuzzArgs[0], 10) || 4
  const count = parseInt(fuzzArgs[1], 10) || 10
  const fuzzed = generateFuzzScenarios(depth, count)
  isFuzzRun = true
  if (getFlag('all')) {
    scenarios = [...scenarios, ...fuzzed]
  } else {
    scenarios = fuzzed // fuzz-only by default
  }
  console.log(`🎲 Generated ${fuzzed.length} fuzz scenarios (depth=${depth})`)
}

// --tags <tag1,tag2>
const tagsFilter = getFlagValue('tags')
if (tagsFilter) {
  const tags = tagsFilter.split(',')
  scenarios = scenarios.filter(s => tags.some(t => s.tags.includes(t)))
  console.log(`🏷️  Filtered to ${scenarios.length} scenarios matching tags: ${tags.join(', ')}`)
}

// --scenario <id>
const scenarioFilter = getFlagValue('scenario')
if (scenarioFilter) {
  scenarios = scenarios.filter(s => s.id === scenarioFilter || s.title.includes(scenarioFilter))
  if (scenarios.length === 0) {
    console.error(`❌ No scenario matching "${scenarioFilter}"`)
    process.exit(1)
  }
}

// --list
if (getFlag('list')) {
  console.log(`\n📋 Available scenarios (${scenarios.length}):\n`)
  for (const s of scenarios) {
    const modeStr = s.modes.join('+')
    const tagStr = s.tags.length ? ` [${s.tags.join(', ')}]` : ''
    console.log(`  ${s.id.padEnd(20)} ${modeStr.padEnd(12)} ${s.title}${tagStr}`)
  }
  console.log()
  process.exit(0)
}

// ─── Output Directory ───────────────────────────────────────────────────────

const rid = runId()
const outputDir = join('scripts', 'panel-regression', 'runs', rid)
await mkdir(outputDir, { recursive: true })

// ─── Run ────────────────────────────────────────────────────────────────────

const report = await runScenarios(scenarios, {
  outputDir,
})

process.exit(report.failed > 0 ? 1 : 0)
