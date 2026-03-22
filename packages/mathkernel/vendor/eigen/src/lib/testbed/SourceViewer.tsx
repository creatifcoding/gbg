/**
 * Source Viewer Component
 *
 * Displays source code with syntax highlighting.
 * Uses a simple token-based highlighter for TSX/JSX.
 */

import * as React from 'react'
import type { SourceViewerProps } from './types'

// =============================================================================
// Simple Syntax Highlighting
// =============================================================================

/**
 * Token types for syntax highlighting
 */
type TokenType =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'tag'
  | 'attr-name'
  | 'attr-value'
  | 'punctuation'
  | 'operator'
  | 'plain'

interface Token {
  type: TokenType
  content: string
}

/**
 * Simple tokenizer for TSX/JSX
 */
function tokenize(code: string): Token[] {
  const tokens: Token[] = []

  // Patterns for different token types
  const patterns: [TokenType, RegExp][] = [
    ['comment', /\/\/.*$|\/\*[\s\S]*?\*\//gm],
    ['string', /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g],
    [
      'keyword',
      /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|typeof|instanceof|true|false|null|undefined|async|await|import|export|from|default|class|extends|implements|interface|type|enum|void|never|any|unknown|as|is)\b/g,
    ],
    ['number', /\b\d+\.?\d*\b/g],
    ['tag', /<\/?[A-Z][A-Za-z0-9.]*|<\/?[a-z][a-z0-9-]*/gi],
    ['attr-name', /\s[a-zA-Z][\w-]*(?==)/g],
    ['punctuation', /[{}[\]();,.:]/g],
    ['operator', /[=+\-*/<>!&|?]+/g],
  ]

  let remaining = code

  while (remaining.length > 0) {
    let matched = false
    let earliestMatch: { type: TokenType; match: RegExpExecArray } | null = null
    let earliestIndex = Infinity

    // Find earliest matching pattern
    for (const [type, pattern] of patterns) {
      pattern.lastIndex = 0
      const match = pattern.exec(remaining)
      if (match && match.index < earliestIndex) {
        earliestMatch = { type, match }
        earliestIndex = match.index
      }
    }

    if (earliestMatch && earliestIndex < remaining.length) {
      // Add plain text before match
      if (earliestIndex > 0) {
        tokens.push({
          type: 'plain',
          content: remaining.slice(0, earliestIndex),
        })
      }

      // Add matched token
      tokens.push({
        type: earliestMatch.type,
        content: earliestMatch.match[0],
      })

      remaining = remaining.slice(
        earliestIndex + earliestMatch.match[0].length
      )
      matched = true
    }

    if (!matched) {
      // No match - add rest as plain
      tokens.push({ type: 'plain', content: remaining })
      break
    }
  }

  return tokens
}

/**
 * Get CSS class for token type
 */
function getTokenClassName(type: TokenType): string {
  const classMap: Record<TokenType, string> = {
    keyword: 'text-purple-400',
    string: 'text-green-400',
    number: 'text-orange-400',
    comment: 'text-gray-500 italic',
    tag: 'text-blue-400',
    'attr-name': 'text-yellow-400',
    'attr-value': 'text-green-400',
    punctuation: 'text-gray-400',
    operator: 'text-cyan-400',
    plain: 'text-gray-200',
  }
  return classMap[type] || 'text-gray-200'
}

// =============================================================================
// Source Viewer Component
// =============================================================================

export function SourceViewer({
  source,
  language: _language = 'tsx',
  collapsed: initialCollapsed = false,
  maxHeight = 300,
  className,
}: SourceViewerProps) {
  const [collapsed, setCollapsed] = React.useState(initialCollapsed)
  const [copied, setCopied] = React.useState(false)

  const tokens = React.useMemo(() => tokenize(source), [source])
  const lineCount = source.split('\n').length

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }

  return (
    <div
      className={className}
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        fontSize: '12px',
        lineHeight: '1.5',
        border: '2px solid #000',
        background: '#1a1a1a',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '2px solid #000',
          background: '#0a0a0a',
          color: '#888',
        }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            padding: 0,
            fontSize: '12px',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {collapsed ? '▶' : '▼'} SOURCE ({lineCount} lines)
        </button>
        <button
          onClick={handleCopy}
          style={{
            background: 'none',
            border: '1px solid #333',
            color: copied ? '#4ade80' : '#888',
            cursor: 'pointer',
            padding: '2px 8px',
            fontSize: '10px',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {copied ? '✓ COPIED' : 'COPY'}
        </button>
      </div>

      {/* Code */}
      {!collapsed && (
        <div
          style={{
            maxHeight,
            overflow: 'auto',
            padding: '12px',
          }}
        >
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            <code>
              {tokens.map((token, i) => (
                <span
                  key={i}
                  className={getTokenClassName(token.type)}
                  style={{
                    color:
                      token.type === 'keyword'
                        ? '#c084fc'
                        : token.type === 'string'
                          ? '#4ade80'
                          : token.type === 'number'
                            ? '#fb923c'
                            : token.type === 'comment'
                              ? '#6b7280'
                              : token.type === 'tag'
                                ? '#60a5fa'
                                : token.type === 'attr-name'
                                  ? '#facc15'
                                  : token.type === 'punctuation'
                                    ? '#9ca3af'
                                    : token.type === 'operator'
                                      ? '#22d3ee'
                                      : '#e5e5e5',
                    fontStyle:
                      token.type === 'comment' ? 'italic' : 'normal',
                  }}
                >
                  {token.content}
                </span>
              ))}
            </code>
          </pre>
        </div>
      )}
    </div>
  )
}

export default SourceViewer
