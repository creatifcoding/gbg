/**
 * GeniferResearchPage — Peer Review Instrument
 *
 * Brutalist research document browser with inline scoring.
 * Expand a document → read it → score on 5 dimensions → export JSON.
 *
 * Export mechanism: "Copy Review JSON" button copies the full review
 * object to clipboard. Paste it to Val for gate resolution.
 *
 * Reviews persist to localStorage between sessions.
 *
 * @module docs/genifer-research
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

// ─────────────────────────────────────────────────────────────
// Markdown component overrides (adapted from DocViewer)
// ─────────────────────────────────────────────────────────────

const markdownComponents = {
  code({ className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '')
    const isInline = !match
    return isInline ? (
      <code className="bg-stone-800 px-1.5 py-0.5 rounded text-cyan-400 font-mono text-sm" {...props}>
        {children}
      </code>
    ) : (
      <SyntaxHighlighter
        style={oneDark}
        language={match[1]}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.8125rem' }}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    )
  },
  table({ children }: any) {
    return (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border border-stone-800 rounded-lg overflow-hidden">{children}</table>
      </div>
    )
  },
  th({ children }: any) {
    return (
      <th className="px-4 py-2 bg-stone-900 text-left font-medium text-stone-400 border-b border-stone-800"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        {children}
      </th>
    )
  },
  td({ children }: any) {
    return (
      <td className="px-4 py-2 text-stone-300 border-b border-stone-800/50"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        {children}
      </td>
    )
  },
  h1({ children }: any) { return <h1 className="text-stone-100 font-bold mt-6 mb-4" style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}>{children}</h1> },
  h2({ children }: any) { return <h2 className="text-stone-100 font-semibold mt-6 mb-3" style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}>{children}</h2> },
  h3({ children }: any) { return <h3 className="text-stone-200 font-medium mt-5 mb-2" style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}>{children}</h3> },
  h4({ children }: any) { return <h4 className="text-stone-300 font-medium mt-4 mb-2" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>{children}</h4> },
  p({ children }: any) { return <p className="text-stone-300 leading-relaxed mb-3" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>{children}</p> },
  ul({ children }: any) { return <ul className="list-disc list-inside space-y-1 text-stone-300 mb-3">{children}</ul> },
  ol({ children }: any) { return <ol className="list-decimal list-inside space-y-1 text-stone-300 mb-3">{children}</ol> },
  li({ children }: any) { return <li style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>{children}</li> },
  strong({ children }: any) { return <strong className="text-stone-100 font-semibold">{children}</strong> },
  em({ children }: any) { return <em className="text-stone-400 italic">{children}</em> },
  hr() { return <hr className="border-stone-800 my-6" /> },
  blockquote({ children }: any) { return <blockquote className="border-l-2 border-cyan-500/50 pl-4 my-4 text-stone-400 italic">{children}</blockquote> },
  a({ href, children }: any) {
    return (
      <a href={href} className="text-cyan-400 hover:text-cyan-300 underline" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
}

// ─────────────────────────────────────────────────────────────
// Load markdown files via Vite ?raw imports
// ─────────────────────────────────────────────────────────────

import bibRaw from '/docs/genifer/research/BIBLIOGRAPHY.md?raw'
import decision001Raw from '/docs/genifer/research/DECISION-001-prototype-selection.md?raw'
import implPlanRaw from '/docs/genifer/research/d2ts-implementation-plan.md?raw'
import catCompRaw from '/docs/genifer/research/research-categorical-composition.md?raw'
import compAlgRaw from '/docs/genifer/research/research-component-algebra.md?raw'
import d2tsRaw from '/docs/genifer/research/research-d2ts-streaming-json.md?raw'
import infoTheoryRaw from '/docs/genifer/research/research-info-theory-prompts.md?raw'
import treeGramRaw from '/docs/genifer/research/research-tree-grammars.md?raw'

// ─── Adversarial Review imports (glob for optional files) ───
const reviewGlob = import.meta.glob('/docs/genifer/reviews/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

type DocCategory = 'research' | 'review'

const rawDocs: Record<string, { content: string; category: DocCategory }> = {
  'BIBLIOGRAPHY.md': { content: bibRaw, category: 'research' },
  'DECISION-001-prototype-selection.md': { content: decision001Raw, category: 'research' },
  'd2ts-implementation-plan.md': { content: implPlanRaw, category: 'research' },
  'research-categorical-composition.md': { content: catCompRaw, category: 'research' },
  'research-component-algebra.md': { content: compAlgRaw, category: 'research' },
  'research-d2ts-streaming-json.md': { content: d2tsRaw, category: 'research' },
  'research-info-theory-prompts.md': { content: infoTheoryRaw, category: 'research' },
  'research-tree-grammars.md': { content: treeGramRaw, category: 'research' },
  // Dynamically loaded review docs
  ...Object.fromEntries(
    Object.entries(reviewGlob).map(([path, content]) => {
      const filename = path.split('/').pop()!
      return [filename, { content, category: 'review' as const }]
    })
  ),
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type DocStatus = 'DRAFT' | 'COMPLETE' | 'LIVING DOCUMENT' | 'UNKNOWN'

interface DocMeta {
  id: string
  filename: string
  title: string
  date: string
  status: DocStatus
  author: string
  content: string
  category: DocCategory
}

type Score = 0 | 1 | 2 | 3 // 0 = unscored

interface DocReview {
  correctness: Score
  utility: Score
  clarity: Score
  connection: Score
  actionability: Score
  verdict: 'pass' | 'revise' | null
  notes: string
}

interface ReviewExport {
  _type: 'GeniferPeerReview'
  _version: 1
  reviewer: string
  timestamp: string
  gate: 'F443-gate-1'
  documents: Record<string, DocReview & { title: string; filename: string }>
  summary: {
    total: number
    reviewed: number
    passed: number
    revise: number
    unreviewed: number
  }
}

const STORAGE_KEY = 'genifer-peer-review-v1'
const DIMENSIONS = ['correctness', 'utility', 'clarity', 'connection', 'actionability'] as const
type Dimension = (typeof DIMENSIONS)[number]

const DIMENSION_LABELS: Record<Dimension, { label: string; hint: string }> = {
  correctness:   { label: 'Correctness',   hint: 'Are the math claims sound?' },
  utility:       { label: 'Utility',       hint: 'Does this translate to code?' },
  clarity:       { label: 'Clarity',       hint: 'Could another engineer follow this?' },
  connection:    { label: 'Connection',    hint: 'Cites bibliography? Links to other spikes?' },
  actionability: { label: 'Actionability', hint: 'Clear path to an implementation task?' },
}

// ─────────────────────────────────────────────────────────────
// Document metadata extraction
// ─────────────────────────────────────────────────────────────

function extractMetadata(filename: string, content: string): DocMeta {
  const id = filename.replace('.md', '')

  const titleMatch = content.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1] ?? id.replace(/-/g, ' ')

  const statusMatch = content.match(/Status:\s*(DRAFT|COMPLETE|LIVING DOCUMENT)/i)
  const status = (statusMatch?.[1]?.toUpperCase() ?? 'UNKNOWN') as DocStatus

  const dateMatch = content.match(/(?:Date|Created):\s*(\d{4}-\d{2}-\d{2})/i)
  const date = dateMatch?.[1] ?? '—'

  const authorMatch = content.match(/(?:Author|Maintained by):\s*(.+)/i)
  const author = authorMatch?.[1]?.trim() ?? 'Unknown'

  return { id, filename, title, date, status, author, content, category: 'research' }
}

function parseAllDocs(): DocMeta[] {
  return Object.entries(rawDocs)
    .map(([path, entry]) => {
      const meta = extractMetadata(path, entry.content)
      return { ...meta, category: entry.category }
    })
    .sort((a, b) => {
      // Reviews sort after research
      if (a.category !== b.category) return a.category === 'review' ? 1 : -1
      const priority = (id: string) => {
        if (id === 'BIBLIOGRAPHY') return 0
        if (id.startsWith('DECISION')) return 1
        if (id.includes('plan')) return 2
        if (id.startsWith('REVIEW')) return 5
        return 3
      }
      return priority(a.id) - priority(b.id) || a.id.localeCompare(b.id)
    })
}

function emptyReview(): DocReview {
  return { correctness: 0, utility: 0, clarity: 0, connection: 0, actionability: 0, verdict: null, notes: '' }
}

function isReviewed(r: DocReview): boolean {
  return r.verdict !== null
}

// ─────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────

function loadReviews(): Record<string, DocReview> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveReviews(reviews: Record<string, DocReview>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews))
}

// ─────────────────────────────────────────────────────────────
// Small Components
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DocStatus }) {
  const styles: Record<DocStatus, string> = {
    DRAFT: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    COMPLETE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'LIVING DOCUMENT': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    UNKNOWN: 'bg-stone-700/50 text-stone-400 border-stone-600/30',
  }
  return (
    <span className={`px-2 py-0.5 font-mono border rounded ${styles[status]}`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
      {status}
    </span>
  )
}

function ReviewBadge({ review }: { review: DocReview }) {
  if (!isReviewed(review)) return null
  const isPassed = review.verdict === 'pass'
  return (
    <span className={`px-2 py-0.5 font-mono border rounded ${
      isPassed
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
    }`} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
      {isPassed ? '✓ PASS' : '⟳ REVISE'}
    </span>
  )
}

const SCORE_LABELS = ['', 'WEAK', 'OK', 'STRONG'] as const

function ScoreSelector({ value, onChange, dim }: { value: Score; onChange: (s: Score) => void; dim: string }) {
  return (
    <div className="flex items-center gap-1">
      {([1, 2, 3] as const).map((s) => {
        const isActive = value === s
        const colors = s === 1
          ? 'bg-rose-500/25 text-rose-300 border-rose-500/40'
          : s === 2
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`px-3 py-1.5 font-mono border rounded transition-all ${
              isActive
                ? colors
                : 'bg-stone-900/60 text-stone-600 border-stone-800 hover:border-stone-600 hover:text-stone-400'
            }`}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            title={`${dim}: ${SCORE_LABELS[s]}`}
          >
            {s} {isActive && <span className="ml-1 opacity-80">{SCORE_LABELS[s]}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Review Panel (inline under each document)
// ─────────────────────────────────────────────────────────────

function ReviewPanel({
  review,
  onChange,
}: {
  review: DocReview
  onChange: (r: DocReview) => void
}) {
  const setDim = (dim: Dimension, val: Score) => onChange({ ...review, [dim]: val })

  const scoredCount = DIMENSIONS.filter((d) => review[d] > 0).length
  const allScored = scoredCount === DIMENSIONS.length

  const avg = useMemo(() => {
    const scores = DIMENSIONS.map((d) => review[d]).filter((s) => s > 0)
    return scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—'
  }, [review])

  return (
    <div className="bg-stone-900/70 px-6 py-5">
      {/* Compact row: all 5 dimensions + notes + verdict on one horizontal band */}
      <div className="flex items-start gap-6">

        {/* Dimension scores — vertical stack, compact */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-stone-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              REVIEW
            </span>
            <span className="font-mono text-stone-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {scoredCount}/5 scored
            </span>
            {allScored && (
              <span className="font-mono text-cyan-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                · avg {avg}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {DIMENSIONS.map((dim) => (
              <div key={dim} className="flex items-center gap-4">
                <div className="w-32 shrink-0">
                  <span className="font-mono text-stone-200" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                    {DIMENSION_LABELS[dim].label}
                  </span>
                </div>
                <ScoreSelector value={review[dim]} onChange={(v) => setDim(dim, v)} dim={DIMENSION_LABELS[dim].label} />
                <span className="font-mono text-stone-600 hidden lg:inline" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  {DIMENSION_LABELS[dim].hint}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: notes + verdict */}
        <div className="w-72 shrink-0 flex flex-col gap-3">
          <textarea
            value={review.notes}
            onChange={(e) => onChange({ ...review, notes: e.target.value })}
            placeholder="Notes..."
            rows={3}
            className="w-full bg-stone-950 border border-stone-800 rounded px-3 py-2 font-mono
                       text-stone-300 placeholder:text-stone-700 resize-none
                       focus:outline-none focus:border-cyan-500/40"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => onChange({ ...review, verdict: 'revise' })}
              disabled={!allScored}
              className={`flex-1 py-2 font-mono border rounded transition-all ${
                review.verdict === 'revise'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                  : allScored
                    ? 'bg-stone-900 text-stone-500 border-stone-700 hover:border-rose-500/40 hover:text-rose-400'
                    : 'bg-stone-900/30 text-stone-800 border-stone-800/50 cursor-not-allowed'
              }`}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              ⟳ REVISE
            </button>
            <button
              onClick={() => onChange({ ...review, verdict: 'pass' })}
              disabled={!allScored}
              className={`flex-1 py-2 font-mono border rounded transition-all ${
                review.verdict === 'pass'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                  : allScored
                    ? 'bg-stone-900 text-stone-500 border-stone-700 hover:border-emerald-500/40 hover:text-emerald-400'
                    : 'bg-stone-900/30 text-stone-800 border-stone-800/50 cursor-not-allowed'
              }`}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              ✓ PASS
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Document Row (Accordion + Review)
// ─────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  isExpanded,
  onToggle,
  review,
  onReviewChange,
}: {
  doc: DocMeta
  isExpanded: boolean
  onToggle: () => void
  review: DocReview
  onReviewChange: (r: DocReview) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isExpanded && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [isExpanded])

  return (
    <div ref={rowRef} className="border-b border-stone-800 last:border-b-0">
      <button
        onClick={onToggle}
        className={`w-full text-left transition-colors hover:bg-stone-900/50 ${
          isExpanded
            ? 'bg-stone-900/90 sticky top-0 z-20 backdrop-blur-md border-b border-stone-700/80'
            : ''
        }`}
      >
        <div className="px-6 py-4 flex items-center gap-5">
          {/* Chevron */}
          <span className={`text-stone-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            ▶
          </span>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <h3 className="font-mono text-stone-100"
                style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}>
              {doc.title}
            </h3>
          </div>

          {/* Badges + date */}
          <div className="shrink-0 flex items-center gap-3">
            {doc.category === 'review' && (
              <span className="px-2 py-0.5 font-mono border rounded bg-rose-500/15 text-rose-400 border-rose-500/30"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                ADVERSARIAL
              </span>
            )}
            <ReviewBadge review={review} />
            <StatusBadge status={doc.status} />
            <span className="font-mono text-stone-600"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {doc.date}
            </span>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-stone-800/50 bg-stone-950 flex flex-col"
             style={{ height: 'calc(100vh - 80px)' }}>
          {/* Document content — scrollable middle */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-5 prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {doc.content}
              </ReactMarkdown>
            </div>
          </div>
          {/* Review panel — pinned bottom */}
          <div className="shrink-0 border-t border-stone-800">
            <ReviewPanel review={review} onChange={onReviewChange} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Export Panel
// ─────────────────────────────────────────────────────────────

function ExportPanel({
  documents,
  reviews,
}: {
  documents: DocMeta[]
  reviews: Record<string, DocReview>
}) {
  const [copied, setCopied] = useState(false)
  const [showJson, setShowJson] = useState(false)

  const exportObj = useMemo((): ReviewExport => {
    const docEntries: ReviewExport['documents'] = {}
    for (const doc of documents) {
      const r = reviews[doc.id] ?? emptyReview()
      docEntries[doc.id] = { ...r, title: doc.title, filename: doc.filename }
    }

    const reviewed = documents.filter((d) => isReviewed(reviews[d.id] ?? emptyReview()))
    const passed = reviewed.filter((d) => reviews[d.id]?.verdict === 'pass')
    const revise = reviewed.filter((d) => reviews[d.id]?.verdict === 'revise')

    return {
      _type: 'GeniferPeerReview',
      _version: 1,
      reviewer: 'Prime',
      timestamp: new Date().toISOString(),
      gate: 'F443-gate-1',
      documents: docEntries,
      summary: {
        total: documents.length,
        reviewed: reviewed.length,
        passed: passed.length,
        revise: revise.length,
        unreviewed: documents.length - reviewed.length,
      },
    }
  }, [documents, reviews])

  const json = useMemo(() => JSON.stringify(exportObj, null, 2), [exportObj])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [json])

  const { summary } = exportObj

  return (
    <div className="border border-stone-800 bg-stone-900/30 mt-6">
      <div className="px-5 py-4 flex items-center gap-4 border-b border-stone-800">
        <span className="font-mono text-stone-100"
              style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}>
          REVIEW EXPORT
        </span>
        <div className="flex-1" />

        {/* Progress */}
        <div className="font-mono flex items-center gap-3"
             style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          <span className="text-emerald-400">{summary.passed} pass</span>
          <span className="text-rose-400">{summary.revise} revise</span>
          <span className="text-stone-500">{summary.unreviewed} remaining</span>
        </div>

        <button
          onClick={() => setShowJson((v) => !v)}
          className="px-3 py-1.5 font-mono border border-stone-700 rounded text-stone-400
                     hover:border-stone-600 hover:text-stone-300 transition-colors"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {showJson ? 'HIDE JSON' : 'SHOW JSON'}
        </button>

        <button
          onClick={handleCopy}
          className={`px-4 py-1.5 font-mono border rounded transition-colors ${
            copied
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'
          }`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {copied ? '✓ COPIED' : 'COPY REVIEW JSON'}
        </button>
      </div>

      {showJson && (
        <pre className="p-5 font-mono text-stone-400 whitespace-pre-wrap overflow-x-auto max-h-[40vh] overflow-y-auto"
             style={{ fontSize: 'var(--tmnl-text-xs, 12px)', lineHeight: '1.5' }}>
          {json}
        </pre>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────

export function GeniferResearchPage() {
  const allDocuments = useMemo(() => parseAllDocs(), [])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reviews, setReviews] = useState<Record<string, DocReview>>(loadReviews)
  const [activeCategory, setActiveCategory] = useState<'all' | DocCategory>('all')

  // Persist on every review change
  useEffect(() => { saveReviews(reviews) }, [reviews])

  const documents = useMemo(() =>
    activeCategory === 'all' ? allDocuments : allDocuments.filter((d) => d.category === activeCategory),
    [allDocuments, activeCategory]
  )

  const researchCount = allDocuments.filter((d) => d.category === 'research').length
  const reviewCount = allDocuments.filter((d) => d.category === 'review').length

  const handleReviewChange = useCallback((docId: string, review: DocReview) => {
    setReviews((prev) => ({ ...prev, [docId]: review }))
  }, [])

  const handleToggle = (id: string) => {
    setExpandedId((current) => (current === id ? null : id))
  }

  const statusCounts = useMemo(() => {
    const counts: Record<DocStatus, number> = { DRAFT: 0, COMPLETE: 0, 'LIVING DOCUMENT': 0, UNKNOWN: 0 }
    documents.forEach((d) => counts[d.status]++)
    return counts
  }, [documents])

  const reviewedCount = documents.filter((d) => isReviewed(reviews[d.id] ?? emptyReview())).length

  return (
    <div className="min-h-screen bg-stone-950 font-mono">
      {/* Header */}
      <header className="border-b border-stone-800 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-cyan-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              TMNL / DOCS / GENIFER / PEER REVIEW
            </span>
          </div>
          <h1 className="text-stone-100" style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}>
            Genifer — Research & Adversarial Reviews
          </h1>
          <p className="text-stone-500 mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Read each document → score 5 dimensions (1–3) → pass or revise → export JSON
          </p>

          {/* Category toggle */}
          <div className="flex items-center gap-2 mt-3">
            {([['all', 'ALL'], ['research', 'RESEARCH'], ['review', 'REVIEWS']] as const).map(([cat, label]) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as typeof activeCategory)}
                className={`px-3 py-1.5 font-mono border rounded transition-colors ${
                  activeCategory === cat
                    ? cat === 'review'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                    : 'bg-stone-900 text-stone-500 border-stone-800 hover:border-stone-600'
                }`}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {label} {cat === 'research' ? `(${researchCount})` : cat === 'review' ? `(${reviewCount})` : `(${allDocuments.length})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 mt-4 text-stone-500"
               style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            <span>{documents.length} documents</span>
            <span className="text-stone-700">│</span>
            <span className={reviewedCount === documents.length ? 'text-emerald-400' : 'text-amber-400'}>
              {reviewedCount}/{documents.length} reviewed
            </span>
            <span className="text-stone-700">│</span>
            {statusCounts.DRAFT > 0 && <span className="text-cyan-400">{statusCounts.DRAFT} draft</span>}
            {statusCounts['LIVING DOCUMENT'] > 0 && (
              <span className="text-amber-400">{statusCounts['LIVING DOCUMENT']} living</span>
            )}
            {statusCounts.COMPLETE > 0 && (
              <span className="text-emerald-400">{statusCounts.COMPLETE} complete</span>
            )}
          </div>

          {/* Scoring legend */}
          <div className="mt-3 flex items-center gap-4 text-stone-600"
               style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            <span className="text-stone-500">SCORING:</span>
            <span>1 = weak</span>
            <span>2 = adequate</span>
            <span>3 = strong</span>
            <span className="text-stone-700">│</span>
            <span>Score all 5 to unlock verdict</span>
          </div>
        </div>
      </header>

      {/* Document list */}
      <main className="max-w-5xl mx-auto pb-8">
        <div className="border-x border-stone-800">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              isExpanded={expandedId === doc.id}
              onToggle={() => handleToggle(doc.id)}
              review={reviews[doc.id] ?? emptyReview()}
              onReviewChange={(r) => handleReviewChange(doc.id, r)}
            />
          ))}
        </div>

        {/* Export panel */}
        <ExportPanel documents={documents} reviews={reviews} />

        {/* Footer */}
        <div className="px-5 py-4 border border-stone-800 border-t-0 text-stone-600"
             style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          <span className="text-stone-500">Source:</span>{' '}
          <span className="text-cyan-400/70">docs/genifer/research/</span>
          <span className="text-stone-700 mx-2">│</span>
          <span className="text-stone-500">Gate:</span>{' '}
          <span className="text-cyan-400/70">F443 → peer review (gate 1)</span>
          <span className="text-stone-700 mx-2">│</span>
          <span className="text-stone-500">Storage:</span>{' '}
          <span className="text-cyan-400/70">localStorage ({STORAGE_KEY})</span>
        </div>
      </main>
    </div>
  )
}

export default GeniferResearchPage
