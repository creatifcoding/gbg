#!/usr/bin/env bun
/**
 * Generate the Industrial Agentic Platform RFC guided reader.
 *
 * Output intentionally lives under ~/.agent/diagrams, matching the FRKNK reader
 * convention used for rich review artifacts.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const docsRoot = 'src/lib/iiot/docs/industrial-platform'
const outPath = join(homedir(), '.agent/diagrams/industrial-agentic-platform-rfc-reader.html')

const docs = [
  ['index', 'RFC Pack Index', 'README.md', 'Start here: thesis, doc map, non-negotiables, implementation order.', 'cyan'],
  ['charter', 'RFC-0000 Charter', 'RFC-0000-CHARTER.md', 'Product and architecture charter for the agentic industrial digital twin/control plane.', 'amber'],
  ['ports', 'RFC-0001 Integration Ports', 'RFC-0001-INTEGRATION-PORTS.md', 'Dependency-injected integration ports and ManagedRuntime edge pattern.', 'green'],
  ['dmn', 'RFC-0002 DMN', 'RFC-0002-DMN-DATA-MESSAGE-NETWORK.md', 'Telemetry/event/command fabric across OPC UA, Sparkplug B, PCT/LNK/MSH, historian, graph, and Reactor.', 'blue'],
  ['governance', 'RFC-0003 Command Governance', 'RFC-0003-COMMAND-GOVERNANCE.md', 'Agent autonomy, approvals, interlocks, IEC 62443 boundaries, and command audit.', 'red'],
  ['deployment', 'RFC-0004 Virtual Plant + Deployment', 'RFC-0004-VIRTUAL-PLANT-DEPLOYMENT.md', 'Virtual plant scenarios, Kubernetes/Pepr deployment matrix, and CI/CD profiles.', 'purple'],
  ['market', 'RFC-0005 Market Wedges', 'RFC-0005-MARKET-WEDGES.md', 'Market-informed feature wedges and first demo acceptance rubric.', 'olive'],
  ['sources', 'Source Ledger', 'SOURCE-LEDGER.md', 'Internal and external source anchors for the RFC pack.', 'slate'],
] as const

type Doc = {
  readonly key: string
  readonly title: string
  readonly path: string
  readonly summary: string
  readonly accent: string
  readonly html: string
  readonly headings: ReadonlyArray<readonly [number, string]>
  readonly words: number
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const inline = (value: string): string =>
  escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')

const parseTable = (lines: ReadonlyArray<string>): string => {
  const rows = lines.map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => inline(cell.trim())))
  const [head, separator, ...rest] = rows
  const body = separator?.every((cell) => /^:?-+:?$/.test(cell.replace(/<[^>]+>/g, ''))) ? rest : rows.slice(1)
  return `<div class="table-wrap"><table><thead><tr>${head.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
}

const slugify = (value: string): string =>
  value.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const markdownToHtml = (markdown: string): string => {
  const output: string[] = []
  const lines = markdown.split(/\r?\n/)
  const listStack: Array<'ul' | 'ol'> = []
  let inCode = false
  let code: string[] = []

  const closeLists = () => {
    while (listStack.length > 0) output.push(`</${listStack.pop()}>`)
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!

    if (line.startsWith('```')) {
      if (!inCode) {
        closeLists()
        inCode = true
        code = []
      } else {
        output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
        inCode = false
      }
      continue
    }

    if (inCode) {
      code.push(line)
      continue
    }

    if (line.trim() === '') {
      closeLists()
      continue
    }

    if (line.trim().startsWith('|') && line.trim().slice(1).includes('|')) {
      closeLists()
      const tableLines: string[] = []
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        tableLines.push(lines[i]!)
        i += 1
      }
      i -= 1
      output.push(parseTable(tableLines))
      continue
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line)
    if (heading) {
      closeLists()
      const level = heading[1]!.length
      const text = inline(heading[2]!)
      output.push(`<h${level} id="${slugify(text)}">${text}</h${level}>`)
      continue
    }

    const bullet = /^\s*-\s+(.+)$/.exec(line)
    if (bullet) {
      if (listStack.at(-1) !== 'ul') {
        closeLists()
        output.push('<ul>')
        listStack.push('ul')
      }
      output.push(`<li>${inline(bullet[1]!)}</li>`)
      continue
    }

    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line)
    if (ordered) {
      if (listStack.at(-1) !== 'ol') {
        closeLists()
        output.push('<ol>')
        listStack.push('ol')
      }
      output.push(`<li>${inline(ordered[1]!)}</li>`)
      continue
    }

    closeLists()
    output.push(`<p>${inline(line)}</p>`)
  }

  closeLists()
  return output.join('\n')
}

const readDocs = (): ReadonlyArray<Doc> =>
  docs.map(([key, title, filename, summary, accent]) => {
    const path = `${docsRoot}/${filename}`
    const markdown = readFileSync(path, 'utf8')
    const headings = [...markdown.matchAll(/^(#{1,3})\s+(.+)$/gm)].slice(0, 14).map((match) => [match[1]!.length, match[2]!] as const)
    return {
      key,
      title,
      path,
      summary,
      accent,
      html: markdownToHtml(markdown),
      headings,
      words: markdown.match(/\w+/g)?.length ?? 0,
    }
  })

const render = (items: ReadonlyArray<Doc>): string => {
  const nav = items.map((doc, index) => `<a href="#${doc.key}" data-doc="${doc.key}"><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(doc.title)}</a>`).join('\n')
  const cards = items.map((doc, index) => `<article class="card accent-${doc.accent}" onclick="document.getElementById('${doc.key}').scrollIntoView({behavior:'smooth'})"><div class="card-top"><span>${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(doc.title)}</b></div><p>${escapeHtml(doc.summary)}</p><small>${doc.words} words · ${escapeHtml(doc.path)}</small></article>`).join('\n')
  const sections = items.map((doc) => {
    const headingList = doc.headings.map(([level, heading]) => `<li><span>${'#'.repeat(level)}</span>${inline(heading)}</li>`).join('')
    return `<section class="doc accent-${doc.accent}" id="${doc.key}" data-doc-section="${doc.key}"><header class="doc-head"><div><p class="eyebrow">${escapeHtml(doc.path)}</p><h2>${escapeHtml(doc.title)}</h2><p>${escapeHtml(doc.summary)}</p></div><div class="wordmark">${doc.words}<span>words</span></div></header><div class="doc-grid"><aside class="headings"><h3>Section map</h3><ul>${headingList}</ul></aside><article class="markdown">${doc.html}</article></div></section>`
  }).join('\n')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Industrial Agentic Platform RFC Guided Reader · TMNL</title><style>${css}</style></head><body><div class="shell"><nav class="toc"><div class="brand"><div class="mark">λ</div><div><strong>TMNL Reader</strong><small>Industrial RFC Pack</small></div></div>${nav}</nav><main><section class="hero"><p class="eyebrow">Guided RFC dossier</p><h1>Industrial Agentic Platform</h1><p>A reader for the post-Reactor IIoT platform: digital twin, DMN, dependency-injected industrial integrations, command governance, virtual plant CI, deployment policy, and market wedge strategy.</p><div class="metrics"><div class="metric"><b>${items.length}</b><span>documents</span></div><div class="metric"><b>L3+</b><span>ISA-95 center</span></div><div class="metric"><b>0</b><span>unguarded OT writes</span></div><div class="metric"><b>DI</b><span>all integrations</span></div></div></section><section class="route"><div class="panel"><h2>Recommended reading route</h2><div class="sequence"><div class="step"><b>1</b><div><strong>Approve the thesis.</strong><br/>Index → Charter → Source Ledger. This nails what we are building and what we refuse to become.</div></div><div class="step"><b>2</b><div><strong>Approve the substrate.</strong><br/>Integration Ports → DMN. This defines OPC UA, Sparkplug, historian, CMMS/MES/ERP, and PCT/LNK/MSH boundaries.</div></div><div class="step"><b>3</b><div><strong>Approve safe action.</strong><br/>Command Governance → Virtual Plant/Deployment → Market Wedges. This turns agent ambition into governed, testable product slices.</div></div></div></div><div class="panel"><h2>Review gate</h2><p><strong>Decision needed:</strong> Is this the right RFC spine for the industrial agentic platform foundation?</p><p><strong>Watch for:</strong> vendor lock-in, unsafe command ambiguity, fake-vs-real adapter drift, and anything that tries to sneak around Reactor's source-of-truth discipline.</p></div></section><section class="cards">${cards}</section>${sections}<div class="footer">Generated from <code>${docsRoot}</code>. Reader artifact lives at <code>${outPath}</code>.</div></main></div><script>const links=[...document.querySelectorAll('.toc a')];const sections=[...document.querySelectorAll('[data-doc-section]')];const obs=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){links.forEach(l=>l.classList.toggle('active',l.dataset.doc===e.target.dataset.docSection));}}},{rootMargin:'-25% 0px -65% 0px'});sections.forEach(s=>obs.observe(s));</script></body></html>`
}

const css = `:root{--bg:#f5f1e8;--paper:#fffaf0;--ink:#18201c;--muted:#667067;--line:rgba(24,32,28,.16);--line2:rgba(24,32,28,.26);--cyan:#087f8c;--amber:#b7791f;--green:#4d7c0f;--blue:#1d4f91;--red:#9f1239;--purple:#6d4c8d;--olive:#6b6b17;--slate:#475569;--shadow:0 24px 70px rgba(30,25,15,.14);--mono:"JetBrains Mono",ui-monospace,monospace;--sans:"IBM Plex Sans",ui-sans-serif,system-ui}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0%,rgba(183,121,31,.12),transparent 34%),linear-gradient(135deg,#f7f1e3,#eee8da);color:var(--ink);font-family:var(--sans);line-height:1.55}.shell{display:grid;grid-template-columns:290px minmax(0,1fr);min-height:100vh}.toc{position:sticky;top:0;height:100vh;border-right:1px solid var(--line);background:rgba(255,250,240,.76);backdrop-filter:blur(18px);padding:24px;overflow:auto}.brand{display:flex;gap:12px;align-items:center;margin-bottom:28px}.mark{width:44px;height:44px;border-radius:16px;background:var(--ink);color:var(--paper);display:grid;place-items:center;font-family:var(--mono);font-weight:800}.brand strong{display:block}.brand small{color:var(--muted);font-family:var(--mono)}.toc a{display:flex;gap:12px;text-decoration:none;padding:11px 10px;border-radius:12px;color:var(--muted);font-size:14px}.toc a:hover,.toc a.active{background:rgba(24,32,28,.07);color:var(--ink)}.toc span{font-family:var(--mono);font-size:12px;color:var(--amber)}main{padding:34px;min-width:0}.hero{position:relative;overflow:hidden;border:1px solid var(--line2);border-radius:30px;padding:38px;background:linear-gradient(135deg,rgba(255,250,240,.94),rgba(235,229,213,.96));box-shadow:var(--shadow)}.hero:after{content:'IIOT · AGENTIC · RFC';position:absolute;right:-20px;top:10px;font-family:var(--mono);font-size:clamp(42px,8vw,120px);letter-spacing:-.08em;color:rgba(24,32,28,.045);white-space:nowrap}.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin:0 0 10px}h1{font-size:clamp(38px,6vw,82px);line-height:.92;margin:0 0 18px;letter-spacing:-.06em}.hero p{max-width:850px;color:#3b443e;font-size:18px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:24px}.metric,.panel,.card,.doc{border:1px solid var(--line);border-radius:24px;background:rgba(255,250,240,.72);box-shadow:0 10px 30px rgba(30,25,15,.06)}.metric{padding:16px}.metric b{display:block;font-size:30px}.metric span,.footer{font-family:var(--mono);font-size:12px;color:var(--muted)}.route{display:grid;grid-template-columns:1.4fr .8fr;gap:18px;margin:22px 0}.panel{padding:22px}.sequence{display:grid;gap:12px}.step{display:grid;grid-template-columns:36px 1fr;gap:12px;align-items:start}.step b{width:36px;height:36px;border-radius:12px;background:#18201c;color:#fffaf0;display:grid;place-items:center;font-family:var(--mono)}.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:28px}.card{padding:18px;cursor:pointer;transition:.18s transform ease,.18s box-shadow ease;border-top:4px solid var(--accent)}.card:hover{transform:translateY(-3px);box-shadow:var(--shadow)}.card-top{display:flex;gap:10px;align-items:center;margin-bottom:10px}.card-top span{font-family:var(--mono);color:var(--accent)}.card p{color:#4a554d;min-height:78px}.card small{font-family:var(--mono);font-size:11px;color:var(--muted)}.accent-cyan{--accent:var(--cyan)}.accent-amber{--accent:var(--amber)}.accent-green{--accent:var(--green)}.accent-blue{--accent:var(--blue)}.accent-red{--accent:var(--red)}.accent-purple{--accent:var(--purple)}.accent-olive{--accent:var(--olive)}.accent-slate{--accent:var(--slate)}.doc{margin:28px 0;overflow:hidden;border-top:6px solid var(--accent)}.doc-head{display:flex;justify-content:space-between;gap:20px;padding:26px;border-bottom:1px solid var(--line);background:linear-gradient(90deg,rgba(255,255,255,.45),transparent)}.doc-head h2{font-size:32px;letter-spacing:-.04em;margin:0 0 8px}.wordmark{min-width:96px;height:96px;border-radius:26px;background:rgba(24,32,28,.08);display:grid;place-items:center;font-family:var(--mono);font-size:28px;color:var(--accent)}.wordmark span{display:block;font-size:10px;color:var(--muted);text-transform:uppercase}.doc-grid{display:grid;grid-template-columns:280px minmax(0,1fr);gap:0}.headings{padding:22px;border-right:1px solid var(--line);background:rgba(255,255,255,.35)}.headings h3{margin-top:0;font-family:var(--mono);font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}.headings ul{padding:0;margin:0;list-style:none;display:grid;gap:8px}.headings li{font-size:12px;color:#536057}.headings span{font-family:var(--mono);color:var(--accent);margin-right:8px}.markdown{padding:28px;min-width:0}.markdown h1{font-size:40px;line-height:1;margin-top:0}.markdown h2{font-size:28px;margin-top:34px;border-top:1px solid var(--line);padding-top:22px}.markdown h3{font-size:21px;margin-top:28px;color:var(--accent)}.markdown code{font-family:var(--mono);background:rgba(24,32,28,.08);padding:.12rem .32rem;border-radius:6px}pre{background:#18201c;color:#f8f3e8;border-radius:18px;padding:18px;overflow:auto;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}pre code{background:transparent;padding:0;color:inherit}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:16px;margin:18px 0}table{border-collapse:collapse;width:100%;min-width:650px;background:rgba(255,255,255,.35)}th,td{border-bottom:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top}th{font-family:var(--mono);font-size:12px;color:var(--accent);background:rgba(24,32,28,.04)}li{margin:.35rem 0}.footer{margin:40px 0}@media(max-width:1050px){.shell{grid-template-columns:1fr}.toc{position:relative;height:auto;border-right:0;border-bottom:1px solid var(--line);display:flex;gap:8px;overflow:auto}.brand{min-width:190px;margin:0}.toc a{min-width:200px}main{padding:20px}.metrics,.cards{grid-template-columns:repeat(2,1fr)}.route,.doc-grid{grid-template-columns:1fr}.headings{border-right:0;border-bottom:1px solid var(--line)}}@media(max-width:680px){.metrics,.cards{grid-template-columns:1fr}.hero{padding:24px}}`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, render(readDocs()))
console.log(outPath)
