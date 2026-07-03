import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = '/home/getbygenius/.agent/diagrams/lotprophet-wireflows';
mkdirSync(outDir, { recursive: true });

const scenarios = [
  {
    id: '01-triage-new-opportunity',
    title: 'Triage a new opportunity in under 60 seconds',
    persona: 'Deal Operator',
    goal: 'Pick one safe next move without reading every raw source.',
    trigger: 'A new row appears in the opportunity queue.',
    uncertainty: 'Source quality is unclear, contact path is unknown, and field reality may be stale.',
    end: 'The opportunity is set to Investigate with a concrete proof gap.',
    result: ['Safe next move: Investigate', 'Why: Contact path is not confirmed.', 'Proof missing: active listing or authorized contact source.', 'Alternate path: Validate in field if exterior proof would help.'],
    steps: [
      ['Queue', 'Open row', 'Understand why this is not contact-ready', 'Dossier'],
      ['Dossier', 'Review proof gap', 'See what would make outreach safe', 'Proof gap panel'],
      ['Proof gap panel', 'Start investigation', 'Create a focused research task', 'Queue updated'],
    ],
    screens: [
      { title: 'Opportunity queue', question: 'Which opportunity needs attention?', body: ['123 Mitchell St', 'Needs proof', 'Next: Investigate contact path'], cta: 'Open row' },
      { title: 'Dossier', question: 'What can we safely do next?', body: ['Recommended move: Investigate', 'Cannot contact broker/listing yet.', 'Reason: no confirmed contact path.'], cta: 'Review proof gap', disabled: ['Contact broker/listing — needs proof first'] },
      { title: 'Proof gap panel', question: 'What proof would change this?', body: ['Find active listing, owner contact, or trusted source.', 'If proof is not available, assign field check or exclude.'], cta: 'Start investigation', alt: ['Validate in field', 'Exclude opportunity'] },
    ],
  },
  {
    id: '02-resolve-blocked-opportunity',
    title: 'Resolve a blocked opportunity',
    persona: 'Deal Operator',
    goal: 'Turn a blocked item into a safer task instead of a dead end.',
    trigger: 'An opportunity is marked Needs proof.',
    uncertainty: 'The operator sees potential value but cannot safely contact anyone.',
    end: 'The opportunity becomes a field validation task.',
    result: ['Safe next move: Validate in field', 'Why: Physical condition is the fastest missing proof.', 'Proof missing: visible activity, access, signage, and frontage condition.', 'Alternate path: Investigate records if field check is not worth dispatch.'],
    steps: [
      ['Needs proof', 'Review proof gap', 'Understand the blocker', 'Proof gap review'],
      ['Proof gap review', 'Assign field check', 'Choose exterior verification', 'Field check draft'],
      ['Field check draft', 'Save update', 'Return with clear next step', 'Queue updated'],
    ],
    screens: [
      { title: 'Dossier', question: 'Why can’t we act yet?', body: ['Contact is unavailable until proof exists.', 'Missing: field condition and visible use.'], cta: 'Review proof gap', disabled: ['Prepare handoff — needs field proof'] },
      { title: 'Proof gap review', question: 'Which proof is fastest?', body: ['Exterior check can confirm frontage, access, signage, and visible activity.', 'No occupant contact. No entry.'], cta: 'Assign field check', alt: ['Investigate records'] },
      { title: 'Field check draft', question: 'What should the scout verify?', body: ['Confirm address and exterior access.', 'Photograph signage and frontage.', 'Note visible activity from public right-of-way.'], cta: 'Save update' },
    ],
  },
  {
    id: '03-assign-field-check',
    title: 'Assign a field check',
    persona: 'Deal Operator',
    goal: 'Create a safe, clear exterior verification task.',
    trigger: 'The recommended move is Validate in field.',
    uncertainty: 'The opportunity may be real, but ground truth is missing.',
    end: 'A scout receives a bounded exterior-only checklist.',
    result: ['Safe next move: Validate in field', 'Why: Field proof can unblock review or outreach.', 'Proof missing: exterior condition and visible activity.', 'Alternate path: Hold for later if scout coverage is unavailable.'],
    steps: [
      ['Dossier', 'Assign field check', 'Move from decision to task', 'Field task sheet'],
      ['Field task sheet', 'Choose checklist', 'Bound the scout’s work', 'Review task'],
      ['Review task', 'Save update', 'Queue records next step', 'Queue updated'],
    ],
    screens: [
      { title: 'Dossier', question: 'What should be verified in the field?', body: ['Recommended move: Validate in field', 'Field proof may unblock review.'], cta: 'Assign field check' },
      { title: 'Field task sheet', question: 'What is safe to ask for?', body: ['Exterior-only check.', 'Confirm frontage, access, visible activity, signage.', 'Do not enter. Do not contact occupants.'], cta: 'Choose checklist' },
      { title: 'Review task', question: 'Is the task clear enough to send?', body: ['Scout sees address, map context, checklist, and safety notes.', 'Next step returns to the queue after saving.'], cta: 'Save update' },
    ],
  },
  {
    id: '04-prepare-broker-safe-handoff',
    title: 'Prepare a broker-safe handoff',
    persona: 'Deal Operator',
    goal: 'Prepare a review summary without unsupported claims.',
    trigger: 'An opportunity becomes Ready for review.',
    uncertainty: 'The operator must preserve evidence and caveats for a reviewer.',
    end: 'A handoff summary is prepared with proof, caveats, and safe language.',
    result: ['Safe next move: Prepare handoff', 'Why: Required proof and caveats are present.', 'Proof missing: none blocking review.', 'Alternate path: Contact broker/listing if reviewer requests outreach first.'],
    steps: [
      ['Ready for review', 'Prepare handoff', 'Open review summary', 'Handoff summary'],
      ['Handoff summary', 'Review caveats', 'Confirm safe language', 'Caveat check'],
      ['Caveat check', 'Save update', 'Return with review-ready status', 'Queue updated'],
    ],
    screens: [
      { title: 'Dossier', question: 'What can be reviewed now?', body: ['Ready for review', 'Evidence and caveats are attached.', 'Recommended move: Prepare handoff.'], cta: 'Prepare handoff' },
      { title: 'Handoff summary', question: 'Is the summary safe?', body: ['Includes source evidence.', 'Calls out open caveats.', 'Avoids unverified occupancy or transaction claims.'], cta: 'Review caveats' },
      { title: 'Caveat check', question: 'Would a reviewer trust this?', body: ['Proof is separated from assumptions.', 'Suggested language stays controlled.'], cta: 'Save update', alt: ['Draft safe outreach'] },
    ],
  },
  {
    id: '05-exclude-safely',
    title: 'Exclude safely',
    persona: 'Deal Operator',
    goal: 'Remove a weak or risky opportunity without losing the reason.',
    trigger: 'The operator decides the opportunity should leave the active queue.',
    uncertainty: 'The team may need to understand why this was dropped later.',
    end: 'The opportunity is excluded with a clear reason and optional revisit note.',
    result: ['Safe next move: Exclude', 'Why: The opportunity is not actionable or carries unresolved risk.', 'Proof missing: reason depends on selected exclusion category.', 'Alternate path: Hold if new proof is likely soon.'],
    steps: [
      ['Dossier', 'Exclude opportunity', 'Start a reversible removal', 'Exclude sheet'],
      ['Exclude sheet', 'Choose reason', 'Make the decision explainable', 'Confirm exclusion'],
      ['Confirm exclusion', 'Save update', 'Return to active queue', 'Queue updated'],
    ],
    screens: [
      { title: 'Dossier', question: 'Why should this leave the active queue?', body: ['Current state: Needs proof', 'No clear contact path or useful field task.'], cta: 'Exclude opportunity', alt: ['Hold for later'] },
      { title: 'Exclude sheet', question: 'What is the reason?', body: ['Choose one: duplicate, stale, out of scope, unsafe claim, no useful path.', 'Add a short note for future review.'], cta: 'Choose reason' },
      { title: 'Confirm exclusion', question: 'Can someone understand this later?', body: ['Reason: stale signal with no contact path.', 'Revisit only if new source appears.'], cta: 'Save update' },
    ],
  },
];

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugTitle = (s) => s.replace(/^\d+-/, '').replace(/-/g, ' ');
const mermaid = (s) => `flowchart LR\n${s.steps.map((step, i) => `  A${i}["${step[0]}"] -->|"${step[1]}"| B${i}["${step[3]}"]`).join('\n')}\n`;

function page(s) {
  const visible = [s.title, s.persona, s.goal, s.trigger, s.uncertainty, s.end, ...s.result, ...s.steps.flat(), ...s.screens.flatMap((x) => [x.title, x.question, ...x.body, x.cta ?? '', ...(x.disabled ?? []), ...(x.alt ?? [])])].filter(Boolean).join('\n');
  const m = mermaid(s);
  const cards = s.screens.map((screen, idx) => `
    <article class="screen-card">
      <div class="screen-index">${idx + 1}</div>
      <h2>${escapeHtml(screen.title)}</h2>
      <p class="question">${escapeHtml(screen.question)}</p>
      <ul>${screen.body.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
      ${screen.disabled ? `<div class="disabled"><strong>Unavailable</strong>${screen.disabled.map((d) => `<p>${escapeHtml(d)}</p>`).join('')}</div>` : ''}
      ${screen.alt ? `<div class="alternate"><strong>Other path</strong>${screen.alt.map((a) => `<p>${escapeHtml(a)}</p>`).join('')}</div>` : ''}
      ${screen.cta ? `<button>${escapeHtml(screen.cta)}</button>` : ''}
    </article>`).join('\n');
  const pathRows = s.steps.map((step) => `<tr><td>${escapeHtml(step[0])}</td><td>${escapeHtml(step[1])}</td><td>${escapeHtml(step[2])}</td><td>${escapeHtml(step[3])}</td></tr>`).join('');
  return {
    visible,
    mermaid: m,
    html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>LotProphet Wireflow — ${escapeHtml(s.title)}</title>
<style>
:root { color-scheme: light; --ink:#16130f; --muted:#665f55; --paper:#f5efe4; --line:#221b12; --gold:#b8872b; --cream:#fffaf0; --danger:#6b1d13; }
* { box-sizing: border-box; }
body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background:#17130e; color:var(--ink); }
main { max-width:1180px; margin:0 auto; padding:28px; }
.hero { background:var(--paper); border:2px solid var(--line); box-shadow:8px 8px 0 #000; padding:24px; }
.eyebrow { text-transform:uppercase; letter-spacing:.12em; font-size:12px; color:var(--muted); }
h1 { margin:.25rem 0 1rem; font-size:40px; line-height:1; }
.grid { display:grid; grid-template-columns: 1.1fr .9fr; gap:18px; margin-top:18px; }
.panel { background:var(--cream); border:2px solid var(--line); padding:18px; }
.kv { display:grid; grid-template-columns:150px 1fr; gap:8px; font-size:14px; }
.kv b { text-transform:uppercase; font-size:11px; letter-spacing:.08em; color:var(--muted); }
.screens { display:grid; grid-template-columns: repeat(3, 1fr); gap:14px; margin-top:18px; }
.screen-card { position:relative; background:#fffdf7; min-height:275px; border:2px solid var(--line); padding:18px; box-shadow:4px 4px 0 #000; }
.screen-index { position:absolute; top:-12px; right:12px; background:var(--gold); color:#120d06; border:2px solid var(--line); font-weight:800; padding:3px 9px; }
h2 { margin:0 0 8px; font-size:20px; }
.question { font-weight:800; border-bottom:1px solid #c9bfae; padding-bottom:8px; }
ul { padding-left:18px; }
button { border:2px solid var(--line); background:#18130d; color:#fff8e8; padding:10px 14px; font-weight:800; width:100%; margin-top:10px; }
.disabled { border:1px dashed var(--danger); color:var(--danger); padding:10px; margin-top:10px; background:#fff4ef; }
.alternate { border:1px dashed #6a5525; color:#4b3711; padding:10px; margin-top:10px; background:#fff8df; }
table { width:100%; border-collapse:collapse; font-size:14px; }
th,td { border:1px solid #c7bba7; padding:8px; text-align:left; vertical-align:top; }
th { background:#eadcc5; }
.result { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; }
.result div { background:#fffdf7; border:1px solid #c7bba7; padding:12px; }
pre.mermaid { background:#fffdf7; border:1px solid #c7bba7; padding:12px; overflow:auto; }
@media (max-width: 900px) { .grid, .screens, .result { grid-template-columns:1fr; } }
</style>
<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'; mermaid.initialize({ startOnLoad:true, theme:'base' });</script>
</head>
<body>
<main>
<section class="hero">
<div class="eyebrow">LotProphet wireflow · ${escapeHtml(slugTitle(s.id))}</div>
<h1>${escapeHtml(s.title)}</h1>
<div class="grid">
  <div class="panel kv">
    <b>Persona</b><span>${escapeHtml(s.persona)}</span>
    <b>Goal</b><span>${escapeHtml(s.goal)}</span>
    <b>Trigger</b><span>${escapeHtml(s.trigger)}</span>
    <b>Uncertainty</b><span>${escapeHtml(s.uncertainty)}</span>
    <b>End state</b><span>${escapeHtml(s.end)}</span>
  </div>
  <div class="panel">
    <h2>Decision result</h2>
    <div class="result">${s.result.map((r) => `<div>${escapeHtml(r)}</div>`).join('')}</div>
  </div>
</div>
</section>
<section class="screens">${cards}</section>
<section class="grid">
  <div class="panel"><h2>Hotspot path</h2><table><thead><tr><th>From</th><th>Hotspot</th><th>Intent</th><th>Result</th></tr></thead><tbody>${pathRows}</tbody></table></div>
  <div class="panel"><h2>Path sketch</h2><pre class="mermaid">${m.replace(/<\/script/gi, '<\\/script')}</pre></div>
</section>
</main>
</body>
</html>` };
}

const indexLinks = [];
const allVisible = [];
for (const s of scenarios) {
  const rendered = page(s);
  const htmlPath = join(outDir, `${s.id}.html`);
  writeFileSync(htmlPath, rendered.html);
  writeFileSync(join(outDir, `${s.id}.visible-text.txt`), rendered.visible);
  writeFileSync(join(outDir, `${s.id}.mmd`), rendered.mermaid);
  indexLinks.push(`<li><a href="./${s.id}.html">${escapeHtml(s.title)}</a><p>${escapeHtml(s.goal)}</p></li>`);
  allVisible.push(`## ${s.title}\n${rendered.visible}`);
}
writeFileSync(join(outDir, 'visible-text.txt'), allVisible.join('\n\n'));
writeFileSync(join(outDir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>LotProphet Wireflows</title><style>body{font-family:system-ui;background:#17130e;color:#fff8e8;margin:0;padding:40px}main{max-width:900px;margin:auto}a{color:#ffd37a}li{margin:18px 0;padding:12px;border:1px solid #5f503d;background:#241d14}p{color:#d8c7ad}</style></head><body><main><h1>LotProphet persona-grounded wireflows</h1><p>Low-fidelity screen states, visible hotspots, and safe next moves for the Deal Operator.</p><ol>${indexLinks.join('')}</ol></main></body></html>`);
console.log(`Generated ${scenarios.length} wireflows in ${outDir}`);
