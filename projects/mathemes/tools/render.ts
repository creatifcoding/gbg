/**
 * Mathemes document renderer.
 * 
 * Usage:
 *   bun run tools/render.ts [file.md]        — render one doc, open in browser
 *   bun run tools/render.ts --all             — render all docs + index, open index
 *   bun run tools/render.ts --index           — render just the index page
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from "fs";
import { basename, join, relative, dirname } from "path";
import { marked } from "marked";
import { execSync } from "child_process";

const PROJ = dirname(dirname(new URL(import.meta.url).pathname));
const OUT = join(PROJ, ".rendered");
mkdirSync(OUT, { recursive: true });

// ── Stylesheet ──────────────────────────────────────────────
const CSS = `
:root {
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  --bg: #faf8f4;
  --surface: #ffffff;
  --surface2: #f4f1eb;
  --border: rgba(0,0,0,0.08);
  --border-bright: rgba(0,0,0,0.15);
  --text: #1c1917;
  --text-dim: #78716c;
  --accent: #1e3a5f;
  --accent-dim: rgba(30,58,95,0.06);
  --gold: #b8860b;
  --gold-dim: rgba(184,134,11,0.07);
  --sage: #4d7c0f;
  --sage-dim: rgba(77,124,15,0.07);
  --rose: #9f1239;
  --rose-dim: rgba(159,18,57,0.06);
  --teal: #0f766e;
  --teal-dim: rgba(15,118,110,0.06);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #131210; --surface: #1c1b18; --surface2: #252320;
    --border: rgba(255,255,255,0.06); --border-bright: rgba(255,255,255,0.12);
    --text: #e7e5e4; --text-dim: #a8a29e;
    --accent: #93c5fd; --accent-dim: rgba(147,197,253,0.1);
    --gold: #fbbf24; --gold-dim: rgba(251,191,36,0.1);
    --sage: #a3e635; --sage-dim: rgba(163,230,53,0.08);
    --rose: #fda4af; --rose-dim: rgba(253,164,175,0.08);
    --teal: #5eead4; --teal-dim: rgba(94,234,212,0.08);
  }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: var(--bg);
  background-image: radial-gradient(ellipse at 15% 0%, var(--accent-dim) 0%, transparent 50%),
                    radial-gradient(ellipse at 85% 90%, var(--gold-dim) 0%, transparent 40%);
  color: var(--text);
  font-family: var(--font-body);
  line-height: 1.7;
  padding: 48px 40px;
  min-height: 100vh;
}
.wrap { max-width: 860px; margin: 0 auto; }
.breadcrumb {
  font-family: var(--font-mono); font-size: 11px; color: var(--text-dim);
  letter-spacing: 0.5px; margin-bottom: 32px;
}
.breadcrumb a { color: var(--accent); text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }

h1 {
  font-family: var(--font-display); font-size: 42px; font-weight: 400;
  letter-spacing: -1.2px; line-height: 1.15; margin-bottom: 8px;
}
h2 {
  font-family: var(--font-display); font-size: 28px; font-weight: 400;
  margin-top: 48px; margin-bottom: 16px;
  padding-bottom: 8px; border-bottom: 1px solid var(--border);
}
h3 {
  font-family: var(--font-body); font-size: 18px; font-weight: 700;
  margin-top: 32px; margin-bottom: 10px; color: var(--accent);
}
h4 {
  font-family: var(--font-mono); font-size: 13px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 1.5px;
  margin-top: 24px; margin-bottom: 8px; color: var(--text-dim);
}
p { margin-bottom: 14px; font-size: 15px; }
p strong { color: var(--text); }
em { font-style: italic; }
blockquote {
  border-left: 3px solid var(--gold);
  background: var(--gold-dim);
  padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;
  font-size: 15px;
}
blockquote p { margin-bottom: 8px; }
blockquote p:last-child { margin-bottom: 0; }

ul, ol { margin: 12px 0 16px 24px; font-size: 15px; }
li { margin-bottom: 6px; }
li ul, li ol { margin-top: 6px; margin-bottom: 6px; }

a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
a:hover { color: var(--gold); }

code {
  font-family: var(--font-mono); font-size: 13px;
  background: var(--accent-dim); padding: 2px 6px; border-radius: 4px;
}
pre {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 16px 20px; overflow-x: auto;
  margin: 16px 0; font-size: 13px; line-height: 1.5;
}
pre code { background: none; padding: 0; }

table {
  width: 100%; border-collapse: collapse; margin: 16px 0;
  font-size: 14px;
}
thead th {
  font-family: var(--font-mono); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim);
  text-align: left; padding: 10px 14px;
  border-bottom: 2px solid var(--border-bright);
  position: sticky; top: 0; background: var(--bg);
}
td {
  padding: 10px 14px; border-bottom: 1px solid var(--border);
  vertical-align: top;
}
tr:nth-child(even) td { background: var(--surface2); }

hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }

.status-badge {
  display: inline-block; font-family: var(--font-mono);
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1px; padding: 3px 10px; border-radius: 4px;
  margin-bottom: 16px;
}
.meta {
  font-family: var(--font-mono); font-size: 12px; color: var(--text-dim);
  margin-bottom: 32px;
}
.footer {
  margin-top: 64px; padding-top: 20px; border-top: 1px solid var(--border);
  font-family: var(--font-mono); font-size: 11px; color: var(--text-dim);
  text-align: center;
}
@media (max-width: 600px) {
  body { padding: 24px 16px; }
  h1 { font-size: 28px; }
  h2 { font-size: 22px; }
  table { font-size: 12px; }
  td, th { padding: 6px 8px; }
}
`;

// ── Template ────────────────────────────────────────────────
function wrap(title: string, body: string, breadcrumb: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Mathemes</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="breadcrumb">${breadcrumb}</div>
  ${body}
  <div class="footer">Mathemes · a compositional naming system for mathematics · 2025</div>
</div>
</body>
</html>`;
}

// ── Render a single MD file ─────────────────────────────────
function renderFile(mdPath: string): string {
  const md = readFileSync(mdPath, "utf-8");
  const rel = relative(PROJ, mdPath);
  const name = basename(mdPath, ".md");
  
  // Extract title from first # heading
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : name;
  
  // Extract status line if present
  const statusMatch = md.match(/\*\*Status\*\*:\s*(.+)/);
  const status = statusMatch ? statusMatch[1] : null;
  
  const html = marked.parse(md) as string;
  const breadcrumb = `<a href="index.html">Mathemes</a> / ${rel.replace(/\//g, " / ").replace(".md", "")}`;
  
  const outFile = join(OUT, rel.replace(/\//g, "--").replace(".md", ".html"));
  const page = wrap(title, html, breadcrumb);
  writeFileSync(outFile, page, "utf-8");
  return outFile;
}

// ── Collect all MD files ────────────────────────────────────
function collectMdFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory() && !entry.startsWith(".") && entry !== "node_modules" && entry !== "assets") {
      results.push(...collectMdFiles(full));
    } else if (entry.endsWith(".md")) {
      results.push(full);
    }
  }
  return results.sort();
}

// ── Build index page ────────────────────────────────────────
function buildIndex(files: string[]): string {
  type Section = { title: string; files: { rel: string; href: string; title: string; size: string }[] };
  const sections: Record<string, Section> = {};
  
  for (const f of files) {
    const rel = relative(PROJ, f);
    const dir = dirname(rel);
    const sectionKey = dir === "." ? "root" : dir;
    
    if (!sections[sectionKey]) {
      const titles: Record<string, string> = {
        root: "Project",
        research: "Research Foundations",
        system: "System Design",
        "system/morphemes": "Morpheme Inventory",
        "system/polysemy": "Polysemy Networks",
      };
      sections[sectionKey] = { title: titles[sectionKey] || sectionKey, files: [] };
    }
    
    const md = readFileSync(f, "utf-8");
    const titleMatch = md.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : basename(f, ".md");
    const size = statSync(f).size;
    const href = rel.replace(/\//g, "--").replace(".md", ".html");
    
    sections[sectionKey].files.push({ rel, href, title, size: `${Math.round(size / 1024)}KB` });
  }
  
  let body = `<h1>Mathemes</h1>
<p style="font-size:18px; color:var(--text-dim); margin-bottom:40px; max-width:640px;">
  A compositional naming system for mathematical concepts.<br>
  <span style="font-family:var(--font-mono); font-size:12px;">
    ${files.length} documents · ${Math.round(files.reduce((s, f) => s + statSync(f).size, 0) / 1024)}KB total
  </span>
</p>`;

  const order = ["root", "research", "system", "system/morphemes", "system/polysemy"];
  const sortedKeys = Object.keys(sections).sort((a, b) => {
    const ai = order.indexOf(a), bi = order.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  for (const key of sortedKeys) {
    const sec = sections[key];
    body += `<h2>${sec.title}</h2>\n<table><thead><tr><th>Document</th><th>Size</th></tr></thead><tbody>`;
    for (const f of sec.files) {
      body += `<tr><td><a href="${f.href}">${f.title}</a><br><small style="color:var(--text-dim); font-family:var(--font-mono); font-size:11px;">${f.rel}</small></td><td style="font-family:var(--font-mono); font-size:12px; white-space:nowrap;">${f.size}</td></tr>`;
    }
    body += `</tbody></table>`;
  }
  
  // Reference library summary
  const pdfDir = join(PROJ, "assets/references");
  if (existsSync(pdfDir)) {
    const pdfs = readdirSync(pdfDir).filter(f => f.endsWith(".pdf"));
    body += `<h2>Reference Library</h2><p style="font-size:14px; color:var(--text-dim);">${pdfs.length} acquired papers. See <code>assets/references/ACQUISITION_LOG.md</code> for details.</p>`;
    body += `<details style="margin-top:12px;"><summary style="cursor:pointer; font-family:var(--font-mono); font-size:12px; color:var(--accent);">Show all ${pdfs.length} PDFs</summary><table><thead><tr><th>Paper</th><th>Size</th></tr></thead><tbody>`;
    for (const pdf of pdfs.sort()) {
      const size = statSync(join(pdfDir, pdf)).size;
      body += `<tr><td style="font-family:var(--font-mono); font-size:12px;">${pdf}</td><td style="font-family:var(--font-mono); font-size:12px; white-space:nowrap;">${Math.round(size / 1024)}KB</td></tr>`;
    }
    body += `</tbody></table></details>`;
  }
  
  const outFile = join(OUT, "index.html");
  writeFileSync(outFile, wrap("Index", body, "Mathemes"), "utf-8");
  return outFile;
}

// ── Main ────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--all") || args.includes("--index") || args.length === 0) {
  const files = collectMdFiles(PROJ);
  console.log(`Found ${files.length} documents`);
  
  if (!args.includes("--index")) {
    for (const f of files) {
      const out = renderFile(f);
      console.log(`  ✓ ${relative(PROJ, f)} → ${basename(out)}`);
    }
  }
  
  const indexFile = buildIndex(files);
  console.log(`\n  ★ Index → ${basename(indexFile)}`);
  execSync(`xdg-open ${indexFile} 2>/dev/null &`, { stdio: "ignore" });
  console.log(`\nOpened in browser: ${indexFile}`);
} else {
  // Render specific file
  const mdPath = args[0].startsWith("/") ? args[0] : join(process.cwd(), args[0]);
  const out = renderFile(mdPath);
  execSync(`xdg-open ${out} 2>/dev/null &`, { stdio: "ignore" });
  console.log(`Rendered: ${out}`);
}
