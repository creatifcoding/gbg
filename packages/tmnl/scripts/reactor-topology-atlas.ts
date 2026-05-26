#!/usr/bin/env bun
/** Generate the IIoT Reactor topology atlas markdown + visual artifact. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import {
  getReactorLiveGraphOverlay,
  getReactorTopologyAtlas,
} from '../src/lib/iiot/services/reactor/topology-atlas'
import { GraphClientLive } from '../src/lib/iiot/services/l1/GraphClient'

const repoMarkdownPath = 'src/lib/iiot/docs/REACTOR-TOPOLOGY-ATLAS.md'
const diagramsDir = join(process.env.HOME ?? '/tmp', '.agent/diagrams')
const defaultDiagramPath = join(diagramsDir, 'reactor-topology-atlas.html')
const liveMarkdownPath = join(diagramsDir, 'reactor-topology-atlas-live.md')
const liveDiagramPath = join(diagramsDir, 'reactor-topology-atlas-live.html')
const liveMarkdownDisplayPath = '~/.agent/diagrams/reactor-topology-atlas-live.md'
const liveDiagramDisplayPath = '~/.agent/diagrams/reactor-topology-atlas-live.html'
const deterministicGeneratedAt = '1970-01-01T00:00:00.000Z'
const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')
const liveGraph = args.has('--live-graph')
const generatedAtIso = process.env.REACTOR_TOPOLOGY_ATLAS_GENERATED_AT ?? deterministicGeneratedAt

if (checkOnly && liveGraph) {
  console.error('--check cannot be combined with --live-graph; live graph output is intentionally not committed')
  process.exit(1)
}

const atlas = getReactorTopologyAtlas(generatedAtIso)
const liveGraphOverlay = liveGraph
  ? await Effect.runPromise(getReactorLiveGraphOverlay(generatedAtIso).pipe(Effect.provide(GraphClientLive)))
  : undefined
const markdownPath = liveGraph ? liveMarkdownPath : repoMarkdownPath
const diagramPath = liveGraph ? liveDiagramPath : defaultDiagramPath

const escapeHtml = (value: unknown): string => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const mdCell = (value: unknown): string => String(value)
  .replace(/\|/g, '\\|')
  .replace(/\n/g, '<br>')

const joinList = (items: readonly string[]): string => items.length > 0 ? items.join(', ') : '—'

const eventRows = atlas.eventCoverage
  .map((entry) => `| ${mdCell(entry.group)} | ${mdCell(entry.tag)} | ${entry.status} | ${mdCell(joinList(entry.signals))} | ${mdCell(joinList(entry.productionObservationIds))} | ${mdCell(joinList(entry.productionPolicyIds))} | ${mdCell(entry.rationale)} |`)
  .join('\n')

const routingContractRows = atlas.eventRoutingContracts
  .map((contract) => `| ${mdCell(contract.id)} | ${contract.routingKind} | ${mdCell(contract.subject.entityType ?? '—')} | ${mdCell(joinList(contract.relationshipPaths.flatMap((path) => path.edgeTypes)))} | ${mdCell(contract.targetOwner ?? '—')} | ${mdCell(joinList(contract.targetCapabilities))} | ${mdCell(joinList(contract.proofRequirements))} |`)
  .join('\n')

const relationshipRows = atlas.relationshipCoverage
  .map((entry) => `| ${entry.edgeType} | ${entry.status} | ${entry.directionality} | ${mdCell(joinList(entry.allowedSourceTypes))} | ${mdCell(joinList(entry.allowedTargetTypes))} | ${entry.allowedPairCount} | ${mdCell(joinList(entry.productionPolicyIds))} | ${mdCell(joinList(entry.livePolicyIds))} | ${mdCell(joinList(entry.candidateSignals))} | ${mdCell(entry.rationale)} |`)
  .join('\n')

const productionLanes = atlas.laneReadiness.filter((lane) => lane.readiness === 'production')
const candidateLanes = atlas.laneReadiness.filter((lane) => lane.readiness === 'candidate')
const parkedLanes = atlas.laneReadiness.filter((lane) => lane.readiness === 'parked')

const readinessRows = atlas.laneReadiness
  .map((lane) => `| ${mdCell(lane.id)} | ${lane.readiness} | ${mdCell(joinList(lane.activationGroups))} | ${lane.routingKind} | ${mdCell(lane.subjectType ?? '—')} | ${mdCell(joinList(lane.relationshipEdgeTypes))} | ${mdCell(lane.targetOwner ?? '—')} | ${mdCell(joinList(lane.declaredObservationIds))} | ${mdCell(joinList(lane.declaredPolicyIds))} | ${mdCell(joinList(lane.livePolicyIds))} | ${mdCell(joinList(lane.requiredProofs))} | ${mdCell(lane.readinessNotes ?? '—')} |`)
  .join('\n')

const liveGraphMarkdown = liveGraphOverlay
  ? `\n## Live graph overlay\n\nGenerated from the configured Apache AGE graph. This section is intentionally written to \`${mdCell(liveMarkdownDisplayPath)}\`, not the committed atlas.\n\n| Metric | Count |\n| --- | ---: |\n| Live graph nodes | ${liveGraphOverlay.totalNodes} |\n| Live graph edges | ${liveGraphOverlay.totalEdges} |\n\n### Live node counts\n\n| Node type | Count |\n| --- | ---: |\n${liveGraphOverlay.nodeCounts.map((entry) => `| ${entry.nodeType} | ${entry.count} |`).join('\n')}\n\n### Live relationship edge counts\n\n| Edge | Live count | Allowed registry pairs | Registered policies | Live policies |\n| --- | ---: | ---: | --- | --- |\n${liveGraphOverlay.edgeCounts.map((entry) => `| ${entry.edgeType} | ${entry.count} | ${entry.allowedPairCount} | ${mdCell(joinList(entry.registeredPolicyIds))} | ${mdCell(joinList(entry.livePolicyIds))} |`).join('\n')}\n`
  : `\n## Optional live graph overlay\n\nRun \`bun run reactor:atlas:live\` to generate a non-committed DB-backed overlay at \`${mdCell(liveMarkdownDisplayPath)}\` and \`${mdCell(liveDiagramDisplayPath)}\`. The committed atlas stays code-only and deterministic; the live overlay compares Apache AGE node/edge counts against the relationship registry.\n`

const markdown = `# Reactor Topology Atlas

Status: **generated rolling artifact**
Generated: ${atlas.generatedAtIso}

This atlas is generated from code-adjacent Reactor audit data. It is the working map for durable event coverage, relationship multiplicity, and production/candidate consistency lanes.

Events remain the primitive source of truth. Relationship and Reactor declarations are routing/consistency projections over durable facts.

## Summary

| Metric | Count |
| --- | ---: |
| Event groups | ${atlas.stats.eventGroupCount} |
| Event tags | ${atlas.stats.eventTagCount} |
| Reactive events | ${atlas.stats.reactiveEventCount} |
| Candidate events | ${atlas.stats.candidateEventCount} |
| Non-reactive events | ${atlas.stats.nonReactiveEventCount} |
| Relationship edge types | ${atlas.stats.relationshipEdgeCount} |
| Allowed source/target pairs | ${atlas.stats.relationshipAllowedPairCount} |
| Registered propagation policies | ${atlas.stats.registeredPolicyCount} |
| Live production policies | ${atlas.stats.productionPolicyCount} |
| Production lanes | ${atlas.stats.productionLaneCount} |
| Candidate lanes | ${atlas.stats.candidateLaneCount} |
| Parked lanes | ${atlas.stats.parkedLaneCount} |
${liveGraphMarkdown}
## Production lanes

| Lane | Signals | Live policies | Target capability |
| --- | --- | --- | --- |
${productionLanes.map((lane) => `| ${lane.id} | ${mdCell(joinList(lane.signals))} | ${mdCell(joinList(lane.livePolicyIds))} | ${mdCell(joinList(lane.targetCapabilities))} |`).join('\n')}

## Lane readiness

| Lane | Readiness | Activation groups | Routing kind | Subject | Relationship paths | Target owner | Declared observations | Declared policies | Live policies | Required proofs | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${readinessRows}

## Relationship multiplicity

| Edge | Status | Direction | Allowed sources | Allowed targets | Pair count | Registered policies | Live policies | Candidate signals | Rationale |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
${relationshipRows}

## Event Routing Contracts

| Contract | Routing kind | Subject | Relationship paths | Target owner | Capabilities | Proof requirements |
| --- | --- | --- | --- | --- | --- | --- |
${routingContractRows}

## Event coverage

| Group | Tag | Status | Signals | Observation specs | Production policies | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
${eventRows}
`

const statusLabel = (status: string) => `<span class="status status-${escapeHtml(status)}">${escapeHtml(status)}</span>`

const chipList = (items: readonly string[], className = 'chip') => items.length > 0
  ? items.map((item) => `<span class="${className}">${escapeHtml(item)}</span>`).join('')
  : '<span class="muted">—</span>'

const groupedEvents = atlas.eventCoverage.reduce<Record<string, typeof atlas.eventCoverage>>((groups, entry) => {
  groups[entry.group] = groups[entry.group] ?? []
  groups[entry.group].push(entry)
  return groups
}, {})

const groupedContracts = atlas.eventRoutingContracts.reduce<Record<string, typeof atlas.eventRoutingContracts>>((groups, contract) => {
  groups[contract.group] = groups[contract.group] ?? []
  groups[contract.group].push(contract)
  return groups
}, {})

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IIoT Reactor Topology Atlas</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #101412;
      --panel: #151c19;
      --panel-2: #1b2521;
      --text: #e8f4ed;
      --muted: #9db3a8;
      --line: #31453b;
      --cyan: #64d9ff;
      --green: #8dffb8;
      --amber: #ffd36e;
      --red: #ff8f8f;
      --violet: #c7a4ff;
      --font: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font);
      font-size: 14px;
      line-height: 1.55;
      color: var(--text);
      background:
        radial-gradient(circle at 20% 0%, rgba(100, 217, 255, 0.11), transparent 34rem),
        radial-gradient(circle at 80% 10%, rgba(141, 255, 184, 0.08), transparent 34rem),
        var(--bg);
    }
    header { padding: 32px; border-bottom: 1px solid var(--line); }
    h1 { margin: 0 0 8px; font-size: 32px; letter-spacing: -0.04em; }
    h2 { margin: 40px 0 16px; font-size: 20px; color: var(--cyan); }
    h3 { margin: 0 0 12px; font-size: 16px; color: var(--green); }
    p { color: var(--muted); max-width: 980px; }
    main { padding: 0 32px 48px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 24px 0; }
    .card { background: linear-gradient(180deg, var(--panel), var(--panel-2)); border: 1px solid var(--line); border-radius: 16px; padding: 16px; box-shadow: 0 16px 40px rgba(0,0,0,0.25); }
    .metric { font-size: 28px; color: var(--green); font-weight: 700; }
    .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .relationship { min-height: 260px; }
    .edge-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .route { margin: 12px 0; padding: 12px; background: rgba(100, 217, 255, 0.06); border: 1px dashed rgba(100, 217, 255, 0.35); border-radius: 12px; }
    .arrow { color: var(--cyan); padding: 0 8px; }
    .chip, .policy, .status { display: inline-flex; align-items: center; min-height: 24px; padding: 2px 8px; margin: 3px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,0.04); font-size: 12px; }
    .policy { border-color: rgba(141,255,184,0.45); color: var(--green); }
    .status-reactive, .status-production { border-color: rgba(141,255,184,0.6); color: var(--green); }
    .status-candidate { border-color: rgba(255,211,110,0.7); color: var(--amber); }
    .status-parked, .status-non_reactive, .status-reference { border-color: rgba(157,179,168,0.35); color: var(--muted); }
    .status-topology { border-color: rgba(199,164,255,0.7); color: var(--violet); }
    table { width: 100%; border-collapse: collapse; background: rgba(21,28,25,0.72); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid rgba(49,69,59,0.72); vertical-align: top; text-align: left; font-size: 12px; }
    th { color: var(--cyan); background: rgba(100,217,255,0.08); position: sticky; top: 0; }
    details { background: rgba(21,28,25,0.72); border: 1px solid var(--line); border-radius: 16px; margin-bottom: 12px; overflow: hidden; }
    summary { cursor: pointer; padding: 14px 16px; color: var(--green); font-weight: 700; }
    .details-body { padding: 0 16px 16px; }
    .muted { color: var(--muted); }
    .lane { display: grid; grid-template-columns: minmax(180px, 1fr) auto minmax(220px, 1fr) auto minmax(180px, 1fr); align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: rgba(141,255,184,0.05); margin-bottom: 10px; }
    @media (max-width: 760px) {
      header, main { padding-left: 16px; padding-right: 16px; }
      .lane { grid-template-columns: 1fr; }
      .arrow { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <h1>IIoT Reactor Topology Atlas</h1>
    <p>Generated ${escapeHtml(atlas.generatedAtIso)}. A rolling artifact for reasoning about durable events, relationship multiplicity, and Reactor propagation lanes. Events stay canonical; Reactor declarations explain what consistency pressure may flow where.</p>
  </header>
  <main>
    <section class="cards">
      <div class="card"><div class="metric">${atlas.stats.eventTagCount}</div><div class="label">Event tags audited</div></div>
      <div class="card"><div class="metric">${atlas.stats.reactiveEventCount}</div><div class="label">Reactive events</div></div>
      <div class="card"><div class="metric">${atlas.stats.candidateEventCount}</div><div class="label">Candidate events</div></div>
      <div class="card"><div class="metric">${atlas.stats.relationshipEdgeCount}</div><div class="label">Relationship edge types</div></div>
      <div class="card"><div class="metric">${atlas.stats.relationshipAllowedPairCount}</div><div class="label">Allowed endpoint pairs</div></div>
      <div class="card"><div class="metric">${atlas.stats.registeredPolicyCount}</div><div class="label">Registered policies</div></div>
      <div class="card"><div class="metric">${atlas.stats.productionPolicyCount}</div><div class="label">Live policies</div></div>
      <div class="card"><div class="metric">${atlas.stats.productionLaneCount}/${atlas.stats.candidateLaneCount}/${atlas.stats.parkedLaneCount}</div><div class="label">Production / candidate / parked lanes</div></div>
    </section>

    ${liveGraphOverlay ? `
      <h2>Live graph overlay</h2>
      <section class="grid">
        <article class="card">
          <h3>Node counts · ${liveGraphOverlay.totalNodes}</h3>
          ${liveGraphOverlay.nodeCounts.map((entry) => `
            <div class="route"><strong>${escapeHtml(entry.nodeType)}</strong> <span class="metric">${entry.count}</span></div>
          `).join('')}
        </article>
        <article class="card">
          <h3>Relationship edge counts · ${liveGraphOverlay.totalEdges}</h3>
          ${liveGraphOverlay.edgeCounts.map((entry) => `
            <div class="route">
              <div><strong>${escapeHtml(entry.edgeType)}</strong> <span class="metric">${entry.count}</span></div>
              <div><span class="muted">Allowed pairs:</span> ${entry.allowedPairCount}</div>
              <div><span class="muted">Registered:</span> ${chipList(entry.registeredPolicyIds, 'policy')}</div>
              <div><span class="muted">Live:</span> ${chipList(entry.livePolicyIds, 'policy')}</div>
            </div>
          `).join('')}
        </article>
      </section>
    ` : `
      <h2>Optional live graph overlay</h2>
      <article class="card">
        <p>Run <strong>bun run reactor:atlas:live</strong> to generate a non-committed DB-backed overlay at ${escapeHtml(liveMarkdownDisplayPath)} and ${escapeHtml(liveDiagramDisplayPath)}. Prime, the committed atlas remains deterministic; the live report is where the database is allowed to be gloriously messy.</p>
      </article>
    `}

    <h2>Production Reactor lanes</h2>
    ${productionLanes.map((lane) => `
      <div class="lane">
        <div><strong>${escapeHtml(lane.id)}</strong><br>${chipList(lane.signals)}</div>
        <div class="arrow">→</div>
        <div>${statusLabel('production')} ${chipList(lane.livePolicyIds, 'policy')}</div>
        <div class="arrow">→</div>
        <div>${chipList(lane.targetCapabilities)}</div>
      </div>
    `).join('')}

    <h2>Lane readiness</h2>
    <section class="grid">
      ${[
        { label: 'Production', lanes: productionLanes },
        { label: 'Candidate', lanes: candidateLanes },
        { label: 'Parked', lanes: parkedLanes },
      ].map((group) => `
        <article class="card">
          <h3>${escapeHtml(group.label)} lanes · ${group.lanes.length}</h3>
          ${group.lanes.slice(0, 18).map((lane) => `
            <div class="route">
              <div><strong>${escapeHtml(lane.id)}</strong> ${statusLabel(lane.readiness)}</div>
              <div><span class="muted">Activation:</span> ${chipList(lane.activationGroups)}</div>
              <div><span class="muted">Proofs:</span> ${chipList(lane.requiredProofs)}</div>
              <div><span class="muted">Declared:</span> ${chipList(lane.declaredPolicyIds, 'policy')}</div>
              <div><span class="muted">Live:</span> ${chipList(lane.livePolicyIds, 'policy')}</div>
            </div>
          `).join('')}
          ${group.lanes.length > 18 ? `<p class="muted">${group.lanes.length - 18} more lanes in markdown table.</p>` : ''}
        </article>
      `).join('')}
    </section>

    <h2>Relationship multiplicity</h2>
    <section class="grid">
      ${atlas.relationshipCoverage.map((entry) => `
        <article class="card relationship">
          <div class="edge-title"><h3>${escapeHtml(entry.edgeType)}</h3>${statusLabel(entry.status)}</div>
          <div class="route">
            ${chipList(entry.allowedSourceTypes)}<span class="arrow">→</span>${chipList(entry.allowedTargetTypes)}
          </div>
          <p><strong>${entry.allowedPairCount}</strong> allowed source/target combinations · ${escapeHtml(entry.directionality)}</p>
          <p>${escapeHtml(entry.rationale)}</p>
          <div><span class="muted">Registered policies:</span> ${chipList(entry.productionPolicyIds, 'policy')}</div>
          <div><span class="muted">Live policies:</span> ${chipList(entry.livePolicyIds, 'policy')}</div>
          <div><span class="muted">Candidate signals:</span> ${chipList(entry.candidateSignals)}</div>
          <div><span class="muted">Target capabilities:</span> ${chipList(entry.targetCapabilities)}</div>
        </article>
      `).join('')}
    </section>

    <h2>Event Routing Contracts</h2>
    ${Object.entries(groupedContracts).map(([group, contracts]) => `
      <details ${group === 'EquipmentStateEvents' ? 'open' : ''}>
        <summary>${escapeHtml(group)} · ${contracts.length} routing contracts</summary>
        <div class="details-body">
          <table>
            <thead><tr><th>Event</th><th>Kind</th><th>Subject</th><th>Paths</th><th>Owner</th><th>Proofs</th></tr></thead>
            <tbody>
              ${contracts.map((contract) => `
                <tr>
                  <td><strong>${escapeHtml(contract.eventTag)}</strong></td>
                  <td>${statusLabel(contract.routingKind)}</td>
                  <td>${escapeHtml(contract.subject.entityType ?? '—')}<br><span class="muted">${escapeHtml(contract.subject.source)}</span></td>
                  <td>${chipList(contract.relationshipPaths.flatMap((path) => path.edgeTypes))}</td>
                  <td>${escapeHtml(contract.targetOwner ?? '—')}</td>
                  <td>${chipList(contract.proofRequirements)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>
    `).join('')}

    <h2>Event coverage by group</h2>
    ${Object.entries(groupedEvents).map(([group, entries]) => `
      <details ${group === 'EquipmentStateEvents' ? 'open' : ''}>
        <summary>${escapeHtml(group)} · ${entries.length} events</summary>
        <div class="details-body">
          <table>
            <thead><tr><th>Tag</th><th>Status</th><th>Signals</th><th>Policies</th><th>Rationale</th></tr></thead>
            <tbody>
              ${entries.map((entry) => `
                <tr>
                  <td><strong>${escapeHtml(entry.tag)}</strong></td>
                  <td>${statusLabel(entry.status)}</td>
                  <td>${chipList(entry.signals)}</td>
                  <td>${chipList(entry.productionPolicyIds, 'policy')}</td>
                  <td>${escapeHtml(entry.rationale)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>
    `).join('')}
  </main>
</body>
</html>
`

if (checkOnly) {
  if (!existsSync(repoMarkdownPath)) {
    console.error(`missing generated atlas: ${repoMarkdownPath}`)
    process.exit(1)
  }

  const current = readFileSync(repoMarkdownPath, 'utf8')
  if (current !== markdown) {
    console.error(`stale generated atlas: ${repoMarkdownPath}`)
    console.error('run: bun run reactor:atlas')
    process.exit(1)
  }

  console.log(`checked ${repoMarkdownPath}`)
} else {
  mkdirSync(dirname(markdownPath), { recursive: true })
  writeFileSync(markdownPath, markdown)

  mkdirSync(dirname(diagramPath), { recursive: true })
  writeFileSync(diagramPath, html)

  console.log(`wrote ${markdownPath}`)
  console.log(`wrote ${diagramPath}`)
}
