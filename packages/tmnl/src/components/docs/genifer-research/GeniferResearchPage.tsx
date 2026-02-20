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

import { useState, useMemo, useCallback, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────
// Load markdown files via Vite glob import
// ─────────────────────────────────────────────────────────────

const rawDocs = import.meta.glob('/docs/genifer/research/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

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

function extractMetadata(filepath: string, content: string): DocMeta {
  const filename = filepath.split('/').pop() ?? 'unknown.md'
  const id = filename.replace('.md', '')

  const titleMatch = content.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1] ?? id.replace(/-/g, ' ')

  const statusMatch = content.match(/Status:\s*(DRAFT|COMPLETE|LIVING DOCUMENT)/i)
  const status = (statusMatch?.[1]?.toUpperCase() ?? 'UNKNOWN') as DocStatus

  const dateMatch = content.match(/(?:Date|Created):\s*(\d{4}-\d{2}-\d{2})/i)
  const date = dateMatch?.[1] ?? '—'

  const authorMatch = content.match(/(?:Author|Maintained by):\s*(.+)/i)
  const author = authorMatch?.[1]?.trim() ?? 'Unknown'

  return { id, filename, title, date, status, author, content }
}

function parseAllDocs(): DocMeta[] {
  return Object.entries(rawDocs)
    .map(([path, content]) => extractMetadata(path, content))
    .sort((a, b) => {
      const priority = (id: string) => {
        if (id === 'BIBLIOGRAPHY') return 0
        if (id.startsWith('DECISION')) return 1
        if (id.includes('plan')) return 2
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

function ScoreSelector({ value, onChange }: { value: Score; onChange: (s: Score) => void }) {
  return (
    <div className="flex gap-1">
      {([1, 2, 3] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`w-8 h-8 font-mono border rounded transition-colors ${
            value === s
              ? 'bg-cyan-500/30 text-cyan-300 border-cyan-500/50'
              : 'bg-stone-900 text-stone-500 border-stone-700 hover:border-stone-600 hover:text-stone-400'
          }`}
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          {s}
        </button>
      ))}
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

  const avg = useMemo(() => {
    const scores = DIMENSIONS.map((d) => review[d]).filter((s) => s > 0)
    return scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—'
  }, [review])

  const allScored = DIMENSIONS.every((d) => review[d] > 0)

  return (
    <div className="border-t border-stone-800 bg-stone-900/50 px-5 py-4">
      {/* Dimension scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {DIMENSIONS.map((dim) => (
          <div key={dim} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-stone-200"
                   style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                {DIMENSION_LABELS[dim].label}
              </div>
              <div className="font-mono text-stone-600 truncate"
                   style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                {DIMENSION_LABELS[dim].hint}
              </div>
            </div>
            <ScoreSelector value={review[dim]} onChange={(v) => setDim(dim, v)} />
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="mt-4">
        <label className="block font-mono text-stone-400 mb-1"
               style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          NOTES (optional)
        </label>
        <textarea
          value={review.notes}
          onChange={(e) => onChange({ ...review, notes: e.target.value })}
          placeholder="Issues, questions, or observations..."
          rows={2}
          className="w-full bg-stone-950 border border-stone-700 rounded px-3 py-2 font-mono
                     text-stone-300 placeholder:text-stone-700 resize-y
                     focus:outline-none focus:border-cyan-500/50"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        />
      </div>

      {/* Verdict bar */}
      <div className="mt-4 flex items-center gap-4">
        <span className="font-mono text-stone-500"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          AVG: {avg}/3
        </span>
        <div className="flex-1" />
        <button
          onClick={() => onChange({ ...review, verdict: 'revise' })}
          disabled={!allScored}
          className={`px-4 py-2 font-mono border rounded transition-colors ${
            review.verdict === 'revise'
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
              : allScored
                ? 'bg-stone-900 text-stone-400 border-stone-700 hover:border-rose-500/50 hover:text-rose-400'
                : 'bg-stone-900/50 text-stone-700 border-stone-800 cursor-not-allowed'
          }`}
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          ⟳ REVISE
        </button>
        <button
          onClick={() => onChange({ ...review, verdict: 'pass' })}
          disabled={!allScored}
          className={`px-4 py-2 font-mono border rounded transition-colors ${
            review.verdict === 'pass'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
              : allScored
                ? 'bg-stone-900 text-stone-400 border-stone-700 hover:border-emerald-500/50 hover:text-emerald-400'
                : 'bg-stone-900/50 text-stone-700 border-stone-800 cursor-not-allowed'
          }`}
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          ✓ PASS
        </button>
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
  return (
    <div className="border-b border-stone-800 last:border-b-0">
      <button
        onClick={onToggle}
        className={`w-full px-5 py-4 text-left flex items-center gap-4 transition-colors hover:bg-stone-900/50 ${
          isExpanded ? 'bg-stone-900/30' : ''
        }`}
      >
        <span className={`text-stone-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          ▶
        </span>

        <div className="flex-1 min-w-0">
          <h3 className="font-mono text-stone-100 truncate"
              style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}>
            {doc.title}
          </h3>
          <div className="font-mono text-stone-500 mt-1 flex items-center gap-3"
               style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            <span>{doc.filename}</span>
            <span className="text-stone-700">│</span>
            <span>{doc.author}</span>
          </div>
        </div>

        <div className="font-mono text-stone-500 shrink-0"
             style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {doc.date}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <ReviewBadge review={review} />
          <StatusBadge status={doc.status} />
        </div>
      </button>

      {isExpanded && (
        <>
          {/* Document content */}
          <div className="border-t border-stone-800/50 bg-stone-950 max-h-[60vh] overflow-y-auto">
            <pre className="p-5 font-mono text-stone-300 whitespace-pre-wrap"
                 style={{ fontSize: 'var(--tmnl-text-sm, 14px)', lineHeight: '1.6' }}>
              {doc.content}
            </pre>
          </div>
          {/* Review panel */}
          <ReviewPanel review={review} onChange={onReviewChange} />
        </>
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
  const documents = useMemo(() => parseAllDocs(), [])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reviews, setReviews] = useState<Record<string, DocReview>>(loadReviews)

  // Persist on every review change
  useEffect(() => { saveReviews(reviews) }, [reviews])

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
            F443 — Mathematical Theory Foundations
          </h1>
          <p className="text-stone-500 mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Read each document → score 5 dimensions (1–3) → pass or revise → export JSON
          </p>

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
