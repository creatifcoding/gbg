/**
 * CodeBlockView - Code Block with Per-Block Copy Button
 *
 * TipTap NodeView component for code blocks with:
 * - Syntax highlighting via lowlight
 * - Per-block copy button (top-right)
 * - Language label
 * - Proper alignment and styling
 *
 * @module terminal/v3/components/AIResponse/CodeBlockView
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// Constants
// =============================================================================

const COPY_FEEDBACK_DURATION_MS = 2000

// Language display names
const LANGUAGE_DISPLAY: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  csharp: 'C#',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  scala: 'Scala',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  json: 'JSON',
  yaml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  markdown: 'Markdown',
  sql: 'SQL',
  graphql: 'GraphQL',
  bash: 'Bash',
  shell: 'Shell',
  powershell: 'PowerShell',
  dockerfile: 'Dockerfile',
  plaintext: 'Plain Text',
}

// =============================================================================
// Copy Button Component
// =============================================================================

interface CopyButtonProps {
  text: string
  className?: string
}

function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS)
    } catch (err) {
      console.error('[CodeBlockView] Copy failed:', err)
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'p-1.5 rounded transition-all duration-200',
        copied
          ? 'text-green-400 bg-green-400/10'
          : 'text-white/40 hover:text-white/70 hover:bg-white/10',
        className
      )}
      title={copied ? 'Copied!' : 'Copy code'}
      aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

// =============================================================================
// CodeBlockView Component (TipTap NodeView)
// =============================================================================

function CodeBlockViewComponent({ node, updateAttributes, extension }: NodeViewProps) {
  const language = node.attrs.language || 'plaintext'
  const displayLanguage = LANGUAGE_DISPLAY[language] || language
  const codeRef = useRef<HTMLPreElement>(null)
  const [codeText, setCodeText] = useState('')

  // Extract text content from the node for copy
  useEffect(() => {
    if (codeRef.current) {
      setCodeText(codeRef.current.textContent || '')
    }
  }, [node.textContent])

  // Also update from node.textContent directly
  useEffect(() => {
    setCodeText(node.textContent || '')
  }, [node.textContent])

  return (
    <NodeViewWrapper className="tmnl-code-block-wrapper">
      <div className="tmnl-code-block">
        {/* Header with language and copy button */}
        <div className="tmnl-code-block-header">
          <span className="tmnl-code-block-language">{displayLanguage}</span>
          <CopyButton text={codeText} />
        </div>

        {/* Code content */}
        <pre ref={codeRef}>
          <NodeViewContent as="code" className={`language-${language}`} />
        </pre>
      </div>
    </NodeViewWrapper>
  )
}

export const CodeBlockView = memo(CodeBlockViewComponent)

// =============================================================================
// Standalone Code Block Component (for non-TipTap use)
// =============================================================================

export interface StandaloneCodeBlockProps {
  code: string
  language?: string
  className?: string
  showLineNumbers?: boolean
}

function StandaloneCodeBlockComponent({
  code,
  language = 'plaintext',
  className,
  showLineNumbers = false,
}: StandaloneCodeBlockProps) {
  const displayLanguage = LANGUAGE_DISPLAY[language] || language

  return (
    <div className={cn('tmnl-code-block', className)}>
      {/* Header */}
      <div className="tmnl-code-block-header">
        <span className="tmnl-code-block-language">{displayLanguage}</span>
        <CopyButton text={code} />
      </div>

      {/* Code */}
      <pre>
        <code className={`language-${language}`}>
          {showLineNumbers ? (
            code.split('\n').map((line, i) => (
              <span key={i} className="tmnl-code-line">
                <span className="tmnl-code-line-number">{i + 1}</span>
                <span className="tmnl-code-line-content">{line}</span>
                {i < code.split('\n').length - 1 && '\n'}
              </span>
            ))
          ) : (
            code
          )}
        </code>
      </pre>
    </div>
  )
}

export const StandaloneCodeBlock = memo(StandaloneCodeBlockComponent)

// =============================================================================
// Styles (CSS-in-JS for injection)
// =============================================================================

export const codeBlockViewStyles = `
  /* Code block wrapper */
  .tmnl-code-block-wrapper {
    margin: 0.75rem 0;
  }

  .tmnl-code-block {
    position: relative;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid #262626;
    background: rgb(23, 23, 23);
  }

  /* Header with language label and copy button */
  .tmnl-code-block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid #262626;
  }

  .tmnl-code-block-language {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 11px;
    color: #2dd4bf;
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }

  /* Code content */
  .tmnl-code-block pre {
    margin: 0;
    padding: 0.875rem 1rem;
    overflow-x: auto;
    background: transparent;
    border: none;
  }

  .tmnl-code-block code {
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace;
    font-size: 13px;
    line-height: 1.5;
    background: transparent;
    padding: 0;
    color: #abb2bf;
    white-space: pre;
  }

  /* Line numbers */
  .tmnl-code-line {
    display: block;
  }

  .tmnl-code-line-number {
    display: inline-block;
    width: 2.5em;
    margin-right: 1em;
    text-align: right;
    color: #4b5563;
    user-select: none;
  }

  .tmnl-code-line-content {
    /* Content styling */
  }

  /* =========================================================================
   * Syntax Highlighting (oneDark theme)
   * ========================================================================= */

  .tmnl-code-block .hljs-keyword,
  .tmnl-code-block .hljs-selector-tag,
  .tmnl-code-block .hljs-literal,
  .tmnl-code-block .hljs-section,
  .tmnl-code-block .hljs-link {
    color: #c678dd;
  }

  .tmnl-code-block .hljs-function,
  .tmnl-code-block .hljs-title.function_ {
    color: #61afef;
  }

  .tmnl-code-block .hljs-string,
  .tmnl-code-block .hljs-meta .hljs-string,
  .tmnl-code-block .hljs-doctag,
  .tmnl-code-block .hljs-regexp {
    color: #98c379;
  }

  .tmnl-code-block .hljs-number {
    color: #d19a66;
  }

  .tmnl-code-block .hljs-variable,
  .tmnl-code-block .hljs-params,
  .tmnl-code-block .hljs-template-variable {
    color: #e06c75;
  }

  .tmnl-code-block .hljs-title,
  .tmnl-code-block .hljs-class .hljs-title,
  .tmnl-code-block .hljs-type,
  .tmnl-code-block .hljs-built_in {
    color: #e5c07b;
  }

  .tmnl-code-block .hljs-comment,
  .tmnl-code-block .hljs-quote {
    color: #5c6370;
    font-style: italic;
  }

  .tmnl-code-block .hljs-attr,
  .tmnl-code-block .hljs-attribute {
    color: #d19a66;
  }

  .tmnl-code-block .hljs-tag,
  .tmnl-code-block .hljs-name {
    color: #e06c75;
  }

  .tmnl-code-block .hljs-operator,
  .tmnl-code-block .hljs-punctuation {
    color: #abb2bf;
  }

  .tmnl-code-block .hljs-meta,
  .tmnl-code-block .hljs-meta .hljs-keyword {
    color: #61afef;
  }

  .tmnl-code-block .hljs-emphasis {
    font-style: italic;
  }

  .tmnl-code-block .hljs-strong {
    font-weight: bold;
  }

  .tmnl-code-block .hljs-deletion {
    color: #e06c75;
    background-color: rgba(224, 108, 117, 0.15);
  }

  .tmnl-code-block .hljs-addition {
    color: #98c379;
    background-color: rgba(152, 195, 121, 0.15);
  }

  .tmnl-code-block .hljs-symbol,
  .tmnl-code-block .hljs-bullet {
    color: #56b6c2;
  }

  .tmnl-code-block .hljs-selector-class,
  .tmnl-code-block .hljs-selector-id {
    color: #e5c07b;
  }

  .tmnl-code-block .hljs-selector-pseudo,
  .tmnl-code-block .hljs-selector-attr {
    color: #c678dd;
  }
`
