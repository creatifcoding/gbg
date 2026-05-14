/**
 * Metaskill Extension
 *
 * Codemod API for skill governance with three interfaces:
 *
 * 1. Tool `ms` — JS REPL. Agent writes code against `ms.*` API.
 *    Example: ms.inspect('nx-workspace')
 *    Example: ms.discover().filter(s => !s.governed)
 *    Example: ms.adopt('my-skill'); ms.inspect('my-skill')
 *
 * 2. Command `/ms` — opens floating TUI overlay for interactive use
 *
 * 3. Shortcut Ctrl+Shift+M — same overlay
 *
 * Ctrl+O (expandTools) toggles between collapsed (15 lines) and expanded (eval code + full result).
 *
 * Phase I3: Extension rewired to use @tmnl/codemode SDK + metaskillPlugin overlay.
 * The SDK owns: store, procedures, builders, export/import, search, primitives.
 * The extension owns: pi TUI, tool registration, rendering, steering, history, guide.
 *
 * @module
 */

import type { ExtensionAPI, ExtensionContext } from '@mariozechner/pi-coding-agent'
import { DynamicBorder } from '@mariozechner/pi-coding-agent'
import { Container, Key, type SelectItem, SelectList, Spacer, Text } from '@mariozechner/pi-tui'
import { Type } from '@sinclair/typebox'

// ── @tmnl/codemode SDK imports ──────────────────────────────
import { createCodemode, type CodemodeInstance } from '@tmnl/codemode'
import { layer as sqliteNodeLayer } from '@tmnl/codemode/adapters/sqlite-node'
import { NodeFileSystemLayer } from '@tmnl/codemode/adapters/filesystem-node'
import { metaskillPlugin } from '@tmnl/codemode/plugins/metaskill'

// ── Pi-specific (stays local) ───────────────────────────────
import { renderCall as msRenderCall, renderResult as msRenderResult } from './render.ts'
import { steer, type Annotation } from './steer.ts'
import { createToolGuide } from './tool-guide.ts'
import { ToolManifest } from './manifest.ts'
import { ALL_SECTIONS } from './manifest-sections.ts'
import { isPrimitive, extractLlmContent } from './primitives/types.ts'
import { createHistoryManager, buildContext, HISTORY_CUSTOM_TYPE, type HistoryEntry } from './history.ts'
import { createLlmBridge } from './llm-bridge.ts'

// ─── Operations (for TUI routing) ────────────────────────────

type Entity = 'skill' | 'node' | 'util' | 'workspace'

interface Operation {
  entity: Entity
  op: string
  label: string
  description: string
  /** JS expression template. $TARGET is replaced with skill name. */
  code: string
}

const OPERATIONS: Operation[] = [
  { entity: 'skill', op: 'create',  label: 'Create',  description: 'Scaffold a new governed skill', code: `ms.scaffold('$TARGET', { refs: true })` },
  { entity: 'skill', op: 'inspect', label: 'Inspect',  description: 'Full health check', code: `ms.inspect('$TARGET')` },
  { entity: 'skill', op: 'update',  label: 'Update',   description: 'Read protocol, then act', code: `ms.protocol('§ skill:update')` },
  { entity: 'skill', op: 'delete',  label: 'Delete',   description: 'Remove a skill', code: `ms.sh('rm -rf .pi/skills/$TARGET')` },
  { entity: 'skill', op: 'adopt',   label: 'Adopt',    description: 'Add governance', code: `ms.adopt('$TARGET')` },
  { entity: 'skill', op: 'dogfood', label: 'Dogfood',  description: 'Self-verify with own tools', code: `const r = ms.inspect('$TARGET'); ({ ...r, utils: ms.runUtil('full-health', '$TARGET') })` },
  { entity: 'node',  op: 'create',  label: 'Create',   description: 'Add a doc', code: `ms.protocol('§ node:create')` },
  { entity: 'node',  op: 'inspect', label: 'Inspect',  description: 'Check doc integrity', code: `ms.frontmatter('$TARGET')` },
  { entity: 'node',  op: 'update',  label: 'Update',   description: 'Modify a doc', code: `ms.protocol('§ node:update')` },
  { entity: 'node',  op: 'delete',  label: 'Delete',   description: 'Remove a doc', code: `ms.protocol('§ node:delete')` },
  { entity: 'node',  op: 'refresh', label: 'Refresh',  description: 'Re-acquire stale REF.md', code: `ms.protocol('§ node:refresh')` },
  { entity: 'util',  op: 'create',  label: 'Create',   description: 'Write a new util', code: `ms.protocol('§ util:create')` },
  { entity: 'util',  op: 'run',     label: 'Run',      description: 'Execute a util', code: `ms.utils()` },
  { entity: 'util',  op: 'update',  label: 'Update',   description: 'Modify a util', code: `ms.protocol('§ util:update')` },
  { entity: 'util',  op: 'delete',  label: 'Delete',   description: 'Remove a util', code: `ms.protocol('§ util:delete')` },
  { entity: 'workspace', op: 'inspect', label: 'Inspect', description: 'Bulk audit', code: `ms.audit()` },
  { entity: 'workspace', op: 'adopt',   label: 'Adopt',   description: 'Bulk governance', code: `ms.discover().filter(s => !s.governed).map(s => ms.adopt(s.name))` },
]

const ENTITIES: Entity[] = ['skill', 'node', 'util', 'workspace']
const ENTITY_LABELS: Record<Entity, string> = { skill: 'SKILL', node: 'NODE', util: 'UTIL', workspace: 'WORKSPACE' }

// ─── Extension ───────────────────────────────────────────────

export default function metaskillExtension(pi: ExtensionAPI) {

  // ─── Codemode SDK Instance (persistent, shared across tool calls) ──

  let _codemode: CodemodeInstance | null = null

  function getCodemode(cwd: string): CodemodeInstance {
    if (!_codemode) {
      const { existsSync, mkdirSync } = require('node:fs')
      const { join } = require('node:path')

      const rlmDir = join(cwd, '.pi', 'rlm')
      if (!existsSync(rlmDir)) mkdirSync(rlmDir, { recursive: true })
      const dbPath = join(rlmDir, 'store.db')

      // Synchronous init — createCodemode returns a Promise but the
      // overlay loading (metaskillPlugin) is the only async part.
      // We eagerly create it and let the first tool call await the init.
      const initPromise = createCodemode({
        sqlLayer: sqliteNodeLayer({ filename: dbPath }),
        overlays: [metaskillPlugin(cwd, NodeFileSystemLayer)],
        cwd,
      })

      // Block on init — store the promise and await lazily
      ;(globalThis as any).__codemodeInit = initPromise
      initPromise.then(instance => {
        _codemode = instance
      })

      // Return a placeholder that will be replaced
      return null as any
    }
    return _codemode
  }

  async function ensureCodemode(cwd: string): Promise<CodemodeInstance> {
    if (_codemode) return _codemode

    const { existsSync, mkdirSync } = await import('node:fs')
    const { join } = await import('node:path')

    const rlmDir = join(cwd, '.pi', 'rlm')
    if (!existsSync(rlmDir)) mkdirSync(rlmDir, { recursive: true })
    const dbPath = join(rlmDir, 'store.db')

    _codemode = await createCodemode({
      sqlLayer: sqliteNodeLayer({ filename: dbPath }),
      overlays: [metaskillPlugin(cwd, NodeFileSystemLayer)],
      cwd,
    })

    return _codemode
  }

  // ─── RLM History (session-scoped REPL trace) ───────────

  const history = createHistoryManager()

  function reconstructHistory(ctx: ExtensionContext) {
    history.reconstruct(ctx.sessionManager.getBranch() as any[])
  }

  function recordHistory(code: string, result: string) {
    const entry = history.record(code, result)
    pi.appendEntry(HISTORY_CUSTOM_TYPE, entry)
  }

  // Reconstruct history on session lifecycle events
  pi.on('session_start', async (_event, ctx) => reconstructHistory(ctx))
  pi.on('session_switch', async (_event, ctx) => reconstructHistory(ctx))
  pi.on('session_fork', async (_event, ctx) => reconstructHistory(ctx))
  pi.on('session_tree', async (_event, ctx) => reconstructHistory(ctx))

  // ─── Tool: JS REPL against ms.* API ────────────────────

  pi.registerTool({
    name: 'ms',
    label: 'Metaskill',
    description: [
      'Skill governance codemod API. Execute JavaScript against `ms.*`.',
      '',
      '## API',
      '',
      '### Discovery',
      '  ms.discover()                   → SkillInfo[]  (all skills with metadata)',
      '  ms.info("name")                 → SkillInfo    (single skill)',
      '',
      '### Inspection',
      '  ms.inspect("name")              → HealthReport (governance, frontmatter, orphans, dead links, children sync, cross symmetry, graph, changelog, update-freshness)',
      '  ms.audit()                      → WorkspaceRow[] (one row per skill: governed, fileCount, fmMissing)',
      '',
      '### Frontmatter',
      '  ms.frontmatter("name")          → { "file.md": { up: "...", prereqs: "..." } }',
      '  ms.setFrontmatter(path, field, value)  → void',
      '',
      '### Protocols',
      '  ms.protocol("§ skill:inspect")  → string (protocol body from SKILL.md)',
      '  ms.protocols()                  → string[] (all protocol keys)',
      '',
      '### Utils',
      '  ms.utils()                      → UtilInfo[] (available utils)',
      '  ms.runUtil("full-health", "nx-workspace") → { output, exitCode }',
      '',
      '### Mutations',
      '  ms.adopt("name")                → string (adds governance line)',
      '  ms.scaffold("name", { refs })   → string[] (created files)',
      '',
      '### Primitives',
      '  ms.read(path)                   → string',
      '  ms.write(path, content)         → void',
      '  ms.sh(cmd)                      → string (shell output)',
      '',
      '## Composition examples',
      '  // Find ungoverned skills',
      '  ms.discover().filter(s => !s.governed).map(s => s.name)',
      '',
      '  // Inspect all, return only failing',
      '  ms.discover().map(s => ms.inspect(s.name)).filter(r => !r.clean)',
      '',
      '  // Adopt all ungoverned',
      '  ms.discover().filter(s => !s.governed).map(s => ms.adopt(s.name))',
      '',
      '  // Dogfood: inspect + run util + compare',
      '  const r = ms.inspect("metaskill");',
      '  const u = ms.runUtil("full-health", "metaskill");',
      '  ({ report: r.summary, util: u.output })',
      '',
      '  // Composed: profile replaces 3 separate calls',
      '  ms.profile("nx-workspace")',
      '',
      '  // Composed: workspace-wide freshness in one call',
      '  ms.freshnessAll()',
      '',
      '  // Composed: find all stale docs',
      '  ms.staleAll()',
      '',
      '## Eval Discipline',
      '',
      '  PREFER composed helpers over inline loops:',
      '    ms.profile("x")              over  const h=ms.inspect("x"); const c=ms.conformance("x"); ...',
      '    ms.each(s => s.name)          over  ms.discover().map(s => s.name)',
      '    ms.where(s => !s.governed, s => s.name)  over  ms.discover().filter(s => !s.governed).map(s => s.name)',
      '    ms.freshnessAll()             over  looping discover + freshness + manual counters',
      '',
      '  DEFINE helpers for multi-step logic:',
      '    const gap = s => ({ name: s.name, ...ms.profile(s.name) })',
      '    return ms.where(s => !s.governed, gap)',
      '',
      '  RETURN shaped objects, not console.log:',
      '    return { total, stale, clean }    not   console.log(`total: ${total}`)',
      '',
      '### Freshness',
      '  ms.freshness("name")            → FreshnessReport (update-policy status per doc)',
      '  ms.setUpdateStatus(path, "current"|"stale"|"pending")  → void (flip the switch)',
      '',
      '### Composed',
      '  ms.profile("name")              → { health, level, label, type, policies, stale, clean }',
      '  ms.each(s => expr)              → T[]  (map over all skills — replaces discover().map())',
      '  ms.where(pred, fn)              → T[]  (filter+map — replaces discover().filter().map())',
      '  ms.staleAll()                   → UpdatePolicy[] (all stale docs workspace-wide)',
      '  ms.freshnessAll()               → { total, current, stale, pending, untracked }',
      '',
      '### Persistent State (RLM)',
      '  ms.store(collection, key, data, tags?)  → void (persist object across sessions)',
      '  ms.get(collection, key)         → any | null (retrieve by key)',
      '  ms.query(collection, filter?)   → StoredObject[] (search by tags/JSON path)',
      '  ms.keys(collection)             → string[] (all keys)',
      '  ms.delete(collection, key)      → boolean (remove object)',
      '  ms.collections()                → CollectionInfo[] (list with counts)',
      '  ms.clear(collection)            → number (wipe, returns deleted count)',
      '  ms.vars()                       → VarInfo[] (metadata of ALL stored objects)',
      '',
      '### Persistent State v2 (RLM — Effect v4 backed)',
      '  ms.put(collection, key, data, tags?)    → void (canonical put — same as store)',
      '  ms.putNow(collection, prefix, data)     → { ns, key } (auto-timestamped key)',
      '  ms.getRaw(collection, key)              → any | null (data WITH _meta envelope)',
      '  ms.describe(collection, key)            → { summary, source, ... } | null (_meta only)',
      '  ms.catalog(nsGlob?)                     → CatalogEntry[] (summaries, filterable)',
      '  ms.search(text, nsGlob?)                → CatalogEntry[] (FTS5 full-text search)',
      '',
      '### Fluent Builders (RLM v2)',
      '  ms.from("ns").tagged("t1").entries()    → StoredObject[] (fluent query)',
      '  ms.from("ns").search("text").keys()     → string[] (FTS-filtered keys)',
      '  ms.from("ns").limit(5).summaries()      → CatalogEntry[] (capped catalog)',
      '  ms.from("ns").tagged("t").count()       → number (count matching)',
      '  ms.into("ns").key("k").data({}).meta({ summary: "..." }).put()  → { ns, key }',
      '  ms.into("ns").key("k").timestamped().data({}).meta({...}).put() → { ns, key }',
      '',
      '### Domains (RLM v2)',
      '  ms.domain(name, config)                 → void (register domain schema)',
      '  ms.domains()                            → { name, config }[] (list domains)',
      '',
      '### Context & History (RLM)',
      '  ms.context                      → { skills, collections, cwd, project } (lazy project metadata)',
      '  ms.history(n?)                  → HistoryEntry[] (last N ms calls this session, default 10)',
      '',
      '  ms.context fields:',
      '    skills:      { count, names[] }',
      '    collections: { name, count }[]',
      '    cwd:         working directory',
      '    project:     directory name',
      '',
      '  ms.history() returns: { code, result (truncated 500 chars), timestamp }[]',
      '  History is persisted via appendEntry — survives /tree navigation and session reload.',
      '  Use ms.history() to avoid re-running code and build on prior results.',
      '',
      '### Sub-LM Dispatch (RLM)',
      '  ms.llm(prompt, opts?)            → string (single sub-LM call via pi CLI)',
      '  ms.llm_batch(prompts, opts?)     → string[] (parallel sub-LM calls)',
      '',
      '  opts for ms.llm():',
      '    model:     e.g. "anthropic/claude-haiku-4-5" (default: haiku)',
      '    inject:    ["collection:key", ...] — load stored objects into prompt as <context>',
      '    timeout:   ms (default: 30000)',
      '',
      '  ms.llm_batch() accepts string[] or {prompt, model?, inject?}[]',
      '    opts: { concurrency?: number } (default: 3)',
      '',
      '  Safety: max 20 calls per ms invocation. Spawns pi -p --no-session --no-tools.',
      '  PREFER ms.llm_batch over sequential ms.llm — parallel is faster.',
      '  PREFER inject over pasting — inject: ["research:findings"] loads stored objects.',
      '  PREFER cheap models for bulk — haiku for extraction/summarization.',
      '',
      '### Export / Import / Profiles',
      '  ms.exportStore({ path, format?, glob?, keys?, keyGlob?, profile?, fromProfile?, since? })',
      '  ms.importStore({ path, mode?, glob?, keys?, keyGlob?, profile? })',
      '    Named imports tag objects with _meta.profile + record in _system.profiles',
      '  ms.profiles() → ProfileSummary[]',
      '  ms.removeProfile(name) → { removed, collections }',
      '',
      '### Stored Procedures (DPA)',
      '  ms.define("name", fn, opts)         → ProcedureRecord (opts.manifest is REQUIRED)',
      '  ms.defineCode("name", code, opts?)   → ProcedureRecord (store from code string)',
      '  ms.call("name", args?)               → any (execute a stored procedure)',
      '  ms.procedures()                      → ProcedureSummary[] (list all procedures)',
      '  ms.describeProcedure("name")         → ProcedureRecord | null (full record)',
      '  ms.removeProcedure("name")           → boolean (delete a procedure)',
      '  ms.source("name")                    → string | null (get source code)',
      '  ms.fn.name(args?)                    → any (proxy — same as ms.call("name", args))',
      '',
      '  Procedures receive (ms, args) — full ms API available inside.',
      '  Auto-version on redefine. Stored in _system.procedures.',
      '  PREFER ms.fn.name() for known procs, ms.call() for dynamic dispatch.',
      '',
      '### Conformance',
      '  ms.conformance("name")          → { level: 0-3, label, type, detail[] }',
      '  ms.conformanceAudit()           → { name, level, label, type }[]',
      '',
      '  Levels:',
      '    -1  missing     No SKILL.md',
      '     0  exists      Has SKILL.md but not governed/no changelog/fm gaps',
      '     1  governed    Governed + changelog + frontmatter, but inspect has failures',
      '     2  clean       All 10 health checks pass',
      '     3  complete    Type-specific ceiling reached (see below)',
      '',
      '  Skill types (auto-classified):',
      '    leaf         1-2 files, self-contained. Ceiling: level 2.',
      '    reference    Has references/ dir, knowledge-heavy. Ceiling: level 3 (needs GRAPH.md).',
      '    operational  Has utils/ dir, protocols, mutations. Ceiling: level 3 (needs utils/ + GRAPH.md).',
    ].join('\n'),
    parameters: Type.Object({
      code: Type.String({ description: 'JavaScript code to execute. `ms` is the API object. Return value is sent back.' }),
    }),
    renderCall: msRenderCall,
    renderResult: msRenderResult,

    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      const { code } = params as { code: string }

      // ── Ensure codemode SDK is initialized ──
      const codemode = await ensureCodemode(ctx.cwd)
      const store = codemode.core.store

      // Seed dynamic manifest sections on first tool call
      if (!_dynamicSeeded) {
        _dynamicSeeded = true
        refreshDynamicManifest(store).catch(() => {})
      }

      // ── Build ms.context lazily ──
      let _contextCache: any = null
      const getContext = () => {
        if (!_contextCache) {
          _contextCache = buildContext(
            ctx.cwd,
            // Discovery is now async (Effect-backed) — use sync fallback for context
            () => [],
            () => [],
          )
          // Async populate skills + collections in background
          Promise.all([
            (codemode.api.discover as Function)(),
            store.collections(),
          ]).then(([skills, colls]: [any[], any[]]) => {
            if (_contextCache) {
              _contextCache.skills = { count: skills.length, names: skills.map((s: any) => s.name) }
              _contextCache.collections = colls.map((c: any) => ({ name: c.name, count: c.count }))
            }
          }).catch(() => {})
        }
        return _contextCache
      }

      // ── Build LLM bridge (call-counted per invocation) ──
      const llmBridge = createLlmBridge(store, {
        defaultModel: 'anthropic/claude-haiku-4-5',
        maxCalls: 20,
        defaultTimeout: 30_000,
        defaultConcurrency: 3,
      })

      // ── Build the ms object from codemode.api + per-call additions ──
      const ms = {
        // All core + overlay methods from the SDK
        ...codemode.api,
        // Per-call additions (pi-specific, not SDK-owned)
        get context() { return getContext() },
        history: history.get.bind(history),
        llm: llmBridge.llm,
        llm_batch: llmBridge.llm_batch,
      }

      // Stream: show "evaluating..." while running
      onUpdate?.({
        content: [{ type: 'text' as const, text: 'evaluating...' }],
        details: { code },
      })

      try {
        // Wrap in async function so agent can use await if needed
        const fn = new Function('ms', `"use strict"; return (async () => { ${code} })()`)
        const result = await fn(ms)

        // ── Primitive detection: split LLM content from TUI rendering ──
        const hasPrimitive = isPrimitive(result)

        // Format output for LLM
        const llmData = hasPrimitive ? extractLlmContent(result) : result
        const output = llmData === undefined
          ? '(void — side effect only)'
          : typeof llmData === 'string'
            ? llmData
            : JSON.stringify(llmData, null, 2)

        // Record in REPL history (RLM)
        recordHistory(code, output)

        // Refresh dynamic manifest if code touched procedures or profiles
        if (/\b(define|defineCode|removeProcedure|importStore|removeProfile)\b/.test(code)) {
          refreshDynamicManifest(store).catch(() => {})
        }

        // Compute steering annotations from raw result
        const contextUsage = ctx.getContextUsage?.()
        const steerCtx = contextUsage ? {
          tokens: contextUsage.tokens,
          contextWindow: contextUsage.contextWindow,
          percent: contextUsage.percent,
        } : undefined
        const annotations = steer(result, code, steerCtx)
        if (annotations.length > 0) {
          const steering = formatSteering(annotations)
          pi.sendMessage({
            customType: 'ms-steer',
            content: steering,
            display: false,
          }, {
            deliverAs: 'steer',
            triggerTurn: false,
          })
        }

        return {
          content: [{ type: 'text' as const, text: output }],
          details: {
            code,
            result: hasPrimitive ? undefined : result,
            primitive: hasPrimitive ? result : undefined,
          },
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err.message}\n\nCode:\n${code}` }],
          details: { code, error: err.message },
          isError: true,
        }
      }
    },
  })


  // ─── Tool Guide (transactional context injection) ──────

  // ── Tool Manifest: compiled guide from contributed sections ──
  const manifest = new ToolManifest()
  for (const section of ALL_SECTIONS) {
    manifest.register(section)
  }

  // Dynamic sections: procedures and profiles contribute their manifest entries.
  let _cachedProcManifests: string[] = []
  let _cachedProfileManifests: string[] = []

  manifest.register({
    id: 'dynamic-procedures',
    slot: 'api',
    priority: 36,
    after: ['stored-procedures'],
    content: () => {
      if (_cachedProcManifests.length === 0) return ''
      return [
        '### Installed Procedures',
        ..._cachedProcManifests.map(m => `  ${m}`),
      ].join('\n')
    },
  })

  manifest.register({
    id: 'dynamic-profiles',
    slot: 'api',
    priority: 37,
    after: ['dynamic-procedures'],
    content: () => {
      if (_cachedProfileManifests.length === 0) return ''
      return [
        '### Installed Profiles',
        ..._cachedProfileManifests.map(m => `  ${m}`),
      ].join('\n')
    },
  })

  const guideHandle = createToolGuide(pi, {
    toolName: 'ms',
    guide: manifest.compile(),
  })

  async function refreshDynamicManifest(store: any) {
    try {
      const procs = await store.query('_system.procedures')
      _cachedProcManifests = procs
        .map((p: any) => p.data?.manifest as string | undefined)
        .filter((m): m is string => !!m)
        .sort()

      const profiles = await store.query('_system.profiles')
      _cachedProfileManifests = profiles
        .map((p: any) => p.data?.manifest as string | undefined)
        .filter((m): m is string => !!m)
        .sort()

      manifest.markDirty('dynamic-procedures')
      manifest.markDirty('dynamic-profiles')
      guideHandle.setGuide(manifest.compile())
    } catch {
      // Silently ignore — dynamic sections are best-effort
    }
  }

  let _dynamicSeeded = false

  // ─── TUI Overlay ───────────────────────────────────────

  function formatSteering(annotations: Annotation[]): string {
    const lines = ['[ms] Suggested next actions:']
    for (const a of annotations) {
      let line = `${a.icon} ${a.message}`
      if (a.command) line += `\n  → ${a.command}`
      lines.push(line)
    }
    return lines.join('\n')
  }

  async function showOpsOverlay(ctx: ExtensionContext, preselectedEntity?: Entity): Promise<void> {
    const entity = preselectedEntity ?? await pickEntity(ctx)
    if (!entity) return

    const ops = OPERATIONS.filter(o => o.entity === entity)
    const operation = await pickOperation(ctx, entity, ops)
    if (!operation) return

    let target: string | undefined
    const needsTarget = operation.code.includes('$TARGET')
    if (needsTarget) {
      if (operation.op === 'create' && operation.entity === 'skill') {
        target = await ctx.ui.input('Skill name:', 'my-skill')
        if (!target) return
      } else {
        target = await pickSkill(ctx, `${operation.label} ${operation.entity}`)
        if (target === undefined) return
      }
    }

    const code = target
      ? operation.code.replace(/\$TARGET/g, target)
      : operation.code

    const wrappedCode = code.startsWith('ms.protocol(')
      ? `return ${code}`
      : code.includes('return') ? code : `return ${code}`

    pi.sendUserMessage(
      `Use the \`ms\` tool to run this:\n\`\`\`js\n${wrappedCode}\n\`\`\`\nThen act on the results — follow the protocol steps if returned, fix issues if health check shows failures.`,
      { deliverAs: 'followUp' },
    )
  }

  async function pickEntity(ctx: ExtensionContext): Promise<Entity | null> {
    // For the TUI picker, use the SDK's discover (async)
    const codemode = await ensureCodemode(ctx.cwd)
    const skills: any[] = await (codemode.api.discover as Function)()
    const governed = skills.filter((s: any) => s.governed).length

    const items: SelectItem[] = ENTITIES.map(e => ({
      value: e,
      label: ENTITY_LABELS[e],
      description: OPERATIONS.filter(o => o.entity === e).map(o => o.op).join(' · '),
    }))

    return ctx.ui.custom<Entity | null>((tui, theme, _kb, done) => {
      const container = new Container()
      container.addChild(new DynamicBorder((s: string) => theme.fg('accent', s)))
      container.addChild(new Text(
        theme.fg('accent', theme.bold(' METASKILL ')) +
        theme.fg('dim', ` ${governed}/${skills.length} governed`), 1, 0))
      container.addChild(new Spacer(1))

      const selectList = new SelectList(items, Math.min(items.length + 1, 8), {
        selectedPrefix: (t: string) => theme.fg('accent', t),
        selectedText: (t: string) => theme.fg('accent', t),
        description: (t: string) => theme.fg('muted', t),
        scrollInfo: (t: string) => theme.fg('dim', t),
        noMatch: (t: string) => theme.fg('warning', t),
      })
      selectList.onSelect = (item) => done(item.value as Entity)
      selectList.onCancel = () => done(null)
      container.addChild(selectList)

      container.addChild(new Spacer(1))
      container.addChild(new Text(theme.fg('dim', ' ↑↓ navigate · enter · esc'), 1, 0))
      container.addChild(new DynamicBorder((s: string) => theme.fg('accent', s)))

      return {
        render: (w: number) => container.render(w),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => { selectList.handleInput(data); tui.requestRender() },
      }
    }, { overlay: true, overlayOptions: { anchor: 'center', width: '50%', minWidth: 44, maxHeight: '60%' } })
  }

  async function pickOperation(ctx: ExtensionContext, entity: Entity, ops: Operation[]): Promise<Operation | null> {
    const items: SelectItem[] = ops.map(o => ({
      value: o.op,
      label: o.label,
      description: o.description,
    }))

    const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
      const container = new Container()
      container.addChild(new DynamicBorder((s: string) => theme.fg('accent', s)))
      container.addChild(new Text(theme.fg('accent', theme.bold(` ${ENTITY_LABELS[entity]} `)), 1, 0))
      container.addChild(new Spacer(1))

      const selectList = new SelectList(items, Math.min(items.length + 1, 10), {
        selectedPrefix: (t: string) => theme.fg('accent', t),
        selectedText: (t: string) => theme.fg('accent', t),
        description: (t: string) => theme.fg('muted', t),
        scrollInfo: (t: string) => theme.fg('dim', t),
        noMatch: (t: string) => theme.fg('warning', t),
      })
      selectList.onSelect = (item) => done(item.value)
      selectList.onCancel = () => done(null)
      container.addChild(selectList)

      container.addChild(new Spacer(1))
      container.addChild(new Text(theme.fg('dim', ' ↑↓ · enter · esc'), 1, 0))
      container.addChild(new DynamicBorder((s: string) => theme.fg('accent', s)))

      return {
        render: (w: number) => container.render(w),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => { selectList.handleInput(data); tui.requestRender() },
      }
    }, { overlay: true, overlayOptions: { anchor: 'center', width: '50%', minWidth: 44, maxHeight: '60%' } })

    if (!result) return null
    return ops.find(o => o.op === result) ?? null
  }

  async function pickSkill(ctx: ExtensionContext, action: string): Promise<string | undefined> {
    const codemode = await ensureCodemode(ctx.cwd)
    const skills: any[] = await (codemode.api.discover as Function)()
    if (skills.length === 0) {
      ctx.ui.notify('No skills found', 'warning')
      return undefined
    }

    const items: SelectItem[] = skills.map((s: any) => ({
      value: s.name,
      label: `${s.governed ? '✓' : '✗'} ${s.name}`,
      description: `${s.type} · ${s.fileCount} files${s.hasRefs ? ' · refs' : ''}${s.hasUtils ? ' · utils' : ''}${s.hasGraph ? ' · graph' : ''}`,
    }))

    return ctx.ui.custom<string | undefined>((tui, theme, _kb, done) => {
      const container = new Container()
      container.addChild(new DynamicBorder((s: string) => theme.fg('accent', s)))
      container.addChild(new Text(theme.fg('accent', theme.bold(` ${action} `)), 1, 0))
      container.addChild(new Spacer(1))

      const selectList = new SelectList(items, Math.min(items.length, 15), {
        selectedPrefix: (t: string) => theme.fg('accent', t),
        selectedText: (t: string) => theme.fg('accent', t),
        description: (t: string) => theme.fg('muted', t),
        scrollInfo: (t: string) => theme.fg('dim', t),
        noMatch: (t: string) => theme.fg('warning', t),
      })
      selectList.onSelect = (item) => done(item.value)
      selectList.onCancel = () => done(undefined)
      container.addChild(selectList)

      container.addChild(new Spacer(1))
      container.addChild(new Text(theme.fg('dim', ' type to filter · ↑↓ · enter · esc'), 1, 0))
      container.addChild(new DynamicBorder((s: string) => theme.fg('accent', s)))

      return {
        render: (w: number) => container.render(w),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => { selectList.handleInput(data); tui.requestRender() },
      }
    }, { overlay: true, overlayOptions: { anchor: 'center', width: '50%', minWidth: 44, maxHeight: '70%' } })
  }

  // ─── Command: /ms ──────────────────────────────────────

  pi.registerCommand('ms', {
    description: 'Metaskill — skill governance (overlay or inline code)',
    handler: async (args, ctx) => {
      const trimmed = args?.trim() ?? ''

      if (!trimmed) {
        await showOpsOverlay(ctx)
        return
      }

      if (ENTITIES.includes(trimmed.toLowerCase() as Entity)) {
        await showOpsOverlay(ctx, trimmed.toLowerCase() as Entity)
        return
      }

      pi.sendUserMessage(
        `Use the \`ms\` tool to accomplish this. The ms API has: discover, info, inspect, audit, frontmatter, setFrontmatter, protocol, protocols, utils, runUtil, adopt, scaffold, read, write, sh.\n\nRequest: ${trimmed}`,
        { deliverAs: 'followUp' },
      )
    },
  })

  // ─── Shortcuts ─────────────────────────────────────────

  pi.registerShortcut(Key.ctrlShift('m'), {
    description: 'Metaskill ops overlay',
    handler: async (ctx) => { await showOpsOverlay(ctx) },
  })

  // ─── Footer Status ─────────────────────────────────────

  pi.on('session_start', async (_event, ctx) => {
    try {
      const codemode = await ensureCodemode(ctx.cwd)
      const skills: any[] = await (codemode.api.discover as Function)()
      const governed = skills.filter((s: any) => s.governed).length
      if (skills.length > 0) {
        ctx.ui.setStatus('metaskill', ctx.ui.theme.fg('dim', `ms: ${governed}/${skills.length}`))
      }
    } catch {
      // Silently ignore — status is best-effort
    }
  })
}
