/**
 * GeniferResearchPage
 *
 * Brutalist research document browser for Genifer mathematical foundations.
 * Lists all research docs with inline expansion (accordion style).
 *
 * @module docs/genifer-research
 */

import { useState, useMemo } from "react"

// ─────────────────────────────────────────────────────────────
// Load markdown files via Vite glob import
// ─────────────────────────────────────────────────────────────

const docs = import.meta.glob('/docs/genifer/research/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// ─────────────────────────────────────────────────────────────
// Document metadata extraction
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

function extractMetadata(filepath: string, content: string): DocMeta {
  const filename = filepath.split('/').pop() ?? 'unknown.md'
  const id = filename.replace('.md', '')

  // Extract title from first heading or filename
  const titleMatch = content.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1] ?? id.replace(/-/g, ' ')

  // Extract status from frontmatter block (```...```)
  const statusMatch = content.match(/Status:\s*(DRAFT|COMPLETE|LIVING DOCUMENT)/i)
  const status = (statusMatch?.[1]?.toUpperCase() ?? 'UNKNOWN') as DocStatus

  // Extract date
  const dateMatch = content.match(/(?:Date|Created):\s*(\d{4}-\d{2}-\d{2})/i)
  const date = dateMatch?.[1] ?? '—'

  // Extract author
  const authorMatch = content.match(/(?:Author|Maintained by):\s*(.+)/i)
  const author = authorMatch?.[1]?.trim() ?? 'Unknown'

  return { id, filename, title, date, status, author, content }
}

function parseAllDocs(): DocMeta[] {
  return Object.entries(docs)
    .map(([path, content]) => extractMetadata(path, content))
    .sort((a, b) => {
      // Sort: BIBLIOGRAPHY first, then DECISIONs, then plans, then research
      const priority = (id: string) => {
        if (id === 'BIBLIOGRAPHY') return 0
        if (id.startsWith('DECISION')) return 1
        if (id.includes('plan')) return 2
        return 3
      }
      return priority(a.id) - priority(b.id) || a.id.localeCompare(b.id)
    })
}

// ─────────────────────────────────────────────────────────────
// Status Badge Component
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DocStatus }) {
  const styles: Record<DocStatus, string> = {
    DRAFT: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    COMPLETE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'LIVING DOCUMENT': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    UNKNOWN: 'bg-stone-700/50 text-stone-400 border-stone-600/30',
  }

  return (
    <span
      className={`px-2 py-0.5 font-mono border rounded ${styles[status]}`}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {status}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Document Row (Accordion Item)
// ─────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  isExpanded,
  onToggle,
}: {
  doc: DocMeta
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-stone-800 last:border-b-0">
      {/* Header (clickable) */}
      <button
        onClick={onToggle}
        className={`w-full px-5 py-4 text-left flex items-center gap-4 transition-colors hover:bg-stone-900/50 ${
          isExpanded ? 'bg-stone-900/30' : ''
        }`}
      >
        {/* Expand/collapse indicator */}
        <span
          className={`text-stone-500 transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          ▶
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h3
            className="font-mono text-stone-100 truncate"
            style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
          >
            {doc.title}
          </h3>
          <div
            className="font-mono text-stone-500 mt-1 flex items-center gap-3"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <span>{doc.filename}</span>
            <span className="text-stone-700">│</span>
            <span>{doc.author}</span>
          </div>
        </div>

        {/* Date */}
        <div
          className="font-mono text-stone-500 shrink-0"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {doc.date}
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          <StatusBadge status={doc.status} />
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-stone-800/50 bg-stone-950">
          <pre
            className="p-5 overflow-x-auto font-mono text-stone-300 whitespace-pre-wrap"
            style={{
              fontSize: 'var(--tmnl-text-sm, 14px)',
              lineHeight: '1.6',
            }}
          >
            {doc.content}
          </pre>
        </div>
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

  const statusCounts = useMemo(() => {
    const counts: Record<DocStatus, number> = {
      DRAFT: 0,
      COMPLETE: 0,
      'LIVING DOCUMENT': 0,
      UNKNOWN: 0,
    }
    documents.forEach((d) => counts[d.status]++)
    return counts
  }, [documents])

  const handleToggle = (id: string) => {
    setExpandedId((current) => (current === id ? null : id))
  }

  return (
    <div className="min-h-screen bg-stone-950 font-mono">
      {/* Header */}
      <header className="border-b border-stone-800 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-cyan-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              TMNL / DOCS / GENIFER
            </span>
          </div>
          <h1
            className="text-stone-100"
            style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
          >
            Genifer Research
          </h1>
          <p
            className="text-stone-500 mt-1"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            Mathematical foundations for generative UI streaming
          </p>

          {/* Stats */}
          <div
            className="flex items-center gap-4 mt-4 text-stone-500"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <span>{documents.length} documents</span>
            <span className="text-stone-700">│</span>
            {statusCounts.DRAFT > 0 && (
              <span className="text-cyan-400">{statusCounts.DRAFT} draft</span>
            )}
            {statusCounts['LIVING DOCUMENT'] > 0 && (
              <span className="text-amber-400">
                {statusCounts['LIVING DOCUMENT']} living
              </span>
            )}
            {statusCounts.COMPLETE > 0 && (
              <span className="text-emerald-400">
                {statusCounts.COMPLETE} complete
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Document list */}
      <main className="max-w-5xl mx-auto">
        <div className="border-x border-stone-800">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              isExpanded={expandedId === doc.id}
              onToggle={() => handleToggle(doc.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 border border-stone-800 border-t-0 text-stone-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          <span className="text-stone-500">Source:</span>{' '}
          <span className="text-cyan-400/70">docs/genifer/research/</span>
        </div>
      </main>
    </div>
  )
}

export default GeniferResearchPage
