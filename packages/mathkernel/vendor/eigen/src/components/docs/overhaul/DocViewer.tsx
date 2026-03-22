/**
 * DocViewer
 *
 * Renders prose documentation with code examples, diagrams, and TMNL alignment notes.
 *
 * @module docs/overhaul
 */

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { DiagramViewer } from "../diagrams/DiagramViewer"
import { getDiagram } from "../diagrams/registry"
import type { DocEntry, DocSection, CodeExample, PatternMapping } from "./registry"

// =============================================================================
// Subcomponents
// =============================================================================

function CodeBlock({ example }: { example: CodeExample }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(example.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-teal-400">{example.language}</span>
          {example.filename && (
            <span className="text-xs font-mono text-neutral-500">{example.filename}</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={example.language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "rgb(23, 23, 23)",
          fontSize: "0.8125rem",
          lineHeight: 1.5,
        }}
      >
        {example.code}
      </SyntaxHighlighter>

      {/* Caption */}
      {example.caption && (
        <div className="px-4 py-2 bg-neutral-900/50 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 italic">{example.caption}</p>
        </div>
      )}
    </div>
  )
}

function PatternMappingTable({ mappings }: { mappings: PatternMapping[] }) {
  return (
    <div className="my-4 rounded-lg overflow-hidden border border-teal-800/30 bg-teal-950/10">
      <div className="px-4 py-2 bg-teal-900/20 border-b border-teal-800/30">
        <h4 className="text-sm font-medium text-teal-400">Pattern Mapping</h4>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-teal-800/20">
            <th className="px-4 py-2 text-left text-xs font-medium text-neutral-400">
              AFFiNE Pattern
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-neutral-400">
              TMNL Implementation
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-neutral-400">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((mapping, i) => (
            <tr key={i} className="border-b border-teal-800/10 last:border-b-0">
              <td className="px-4 py-2 font-mono text-xs text-amber-400">
                {mapping.affinePattern}
              </td>
              <td className="px-4 py-2 font-mono text-xs text-teal-400">
                {mapping.tmnlImplementation}
              </td>
              <td className="px-4 py-2 text-xs text-neutral-400">
                {mapping.notes || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionRenderer({ section, isActive }: { section: DocSection; isActive: boolean }) {
  const diagram = section.diagramId ? getDiagram(section.diagramId) : null

  return (
    <motion.section
      id={section.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`py-6 border-b border-neutral-800/50 last:border-b-0 ${
        isActive ? "bg-neutral-900/30" : ""
      }`}
    >
      <h2 className="text-xl font-semibold text-neutral-100 mb-4">{section.title}</h2>

      {/* Markdown content */}
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "")
              const isInline = !match
              return isInline ? (
                <code
                  className="bg-neutral-800 px-1.5 py-0.5 rounded text-teal-400 font-mono text-sm"
                  {...props}
                >
                  {children}
                </code>
              ) : (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: "0.5rem",
                    fontSize: "0.8125rem",
                  }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              )
            },
            table({ children }) {
              return (
                <div className="overflow-x-auto my-4">
                  <table className="min-w-full border border-neutral-800 rounded-lg overflow-hidden">
                    {children}
                  </table>
                </div>
              )
            },
            th({ children }) {
              return (
                <th className="px-4 py-2 bg-neutral-900 text-left text-xs font-medium text-neutral-400 border-b border-neutral-800">
                  {children}
                </th>
              )
            },
            td({ children }) {
              return (
                <td className="px-4 py-2 text-sm text-neutral-300 border-b border-neutral-800/50">
                  {children}
                </td>
              )
            },
            h3({ children }) {
              return <h3 className="text-lg font-medium text-neutral-200 mt-6 mb-3">{children}</h3>
            },
            ul({ children }) {
              return <ul className="list-disc list-inside space-y-1 text-neutral-300">{children}</ul>
            },
            ol({ children }) {
              return <ol className="list-decimal list-inside space-y-1 text-neutral-300">{children}</ol>
            },
            li({ children }) {
              return <li className="text-sm">{children}</li>
            },
            p({ children }) {
              return <p className="text-neutral-300 leading-relaxed mb-3">{children}</p>
            },
            strong({ children }) {
              return <strong className="text-neutral-100 font-semibold">{children}</strong>
            },
            a({ href, children }) {
              return (
                <a
                  href={href}
                  className="text-teal-400 hover:text-teal-300 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              )
            },
          }}
        >
          {section.content}
        </ReactMarkdown>
      </div>

      {/* Code examples */}
      {section.codeExamples?.map((example, i) => (
        <CodeBlock key={i} example={example} />
      ))}

      {/* Diagram */}
      {diagram && (
        <div className="my-6">
          <DiagramViewer diagram={diagram} />
        </div>
      )}

      {/* Pattern Mapping */}
      {section.patternMappings && section.patternMappings.length > 0 && (
        <PatternMappingTable mappings={section.patternMappings} />
      )}
    </motion.section>
  )
}

// =============================================================================
// Main Component
// =============================================================================

interface DocViewerProps {
  doc: DocEntry
}

export function DocViewer({ doc }: DocViewerProps) {
  const [activeSection, setActiveSection] = useState<string | null>(
    doc.sections[0]?.id ?? null
  )

  const categoryColors: Record<string, string> = {
    overview: "bg-blue-500/10 text-blue-400",
    architecture: "bg-purple-500/10 text-purple-400",
    patterns: "bg-teal-500/10 text-teal-400",
    guide: "bg-amber-500/10 text-amber-400",
    reference: "bg-neutral-500/10 text-neutral-400",
  }

  return (
    <div className="flex h-full">
      {/* Table of Contents */}
      <aside className="w-56 shrink-0 border-r border-neutral-800 p-4 overflow-y-auto">
        <nav className="space-y-1">
          {doc.sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={(e) => {
                e.preventDefault()
                setActiveSection(section.id)
                document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" })
              }}
              className={`block px-3 py-2 text-sm rounded transition-colors ${
                activeSection === section.id
                  ? "bg-teal-500/10 text-teal-400 border-l-2 border-teal-500"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              }`}
            >
              {section.title}
            </a>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur border-b border-neutral-800 px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${
                categoryColors[doc.category] || categoryColors.reference
              }`}
            >
              {doc.category.toUpperCase()}
            </span>
            {doc.updatedAt && (
              <span className="text-xs text-neutral-500 font-mono">
                Updated: {doc.updatedAt}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-neutral-100">{doc.title}</h1>
          <p className="text-neutral-400 mt-2">{doc.description}</p>

          {/* Related docs */}
          {doc.relatedDocs && doc.relatedDocs.length > 0 && (
            <div className="flex items-center gap-2 mt-4">
              <span className="text-xs text-neutral-500">Related:</span>
              {doc.relatedDocs.map((relatedId) => (
                <span
                  key={relatedId}
                  className="px-2 py-0.5 text-xs font-mono bg-neutral-800 text-neutral-400 rounded"
                >
                  {relatedId}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Sections */}
        <div className="px-8 pb-12">
          {doc.sections.map((section) => (
            <SectionRenderer
              key={section.id}
              section={section}
              isActive={activeSection === section.id}
            />
          ))}
        </div>
      </main>
    </div>
  )
}

export default DocViewer
