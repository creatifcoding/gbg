/**
 * useThrottledHighlight — robust incremental Shiki highlighting.
 *
 * Theory of Constraints (TOC): the bottleneck is Shiki `codeToHtml`, not
 * the incoming stream rate. So we run at most one highlight at a time,
 * coalesce all incoming updates into a single "latest" snapshot, and flush
 * immediately when the highlighter is free.
 *
 * This avoids arbitrary fixed throttles drifting behind long streams.
 *
 * @module chat/msg/shared/use-throttled-highlight
 */

import { useEffect, useRef, useState } from 'react'
import { codeToHtml, type BundledLanguage } from 'shiki'

const MIN_STREAM_INTERVAL_MS = 60
const MAX_STREAM_INTERVAL_MS = 220

/**
 * Detect language from file extension.
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rs: 'rust', go: 'go', json: 'json', yaml: 'yaml',
    yml: 'yaml', md: 'markdown', css: 'css', html: 'html', sh: 'bash',
    toml: 'toml', sql: 'sql', nix: 'nix', xml: 'xml', vue: 'vue',
    svelte: 'svelte', scss: 'scss', less: 'less', c: 'c', cpp: 'cpp',
    h: 'c', hpp: 'cpp', rb: 'ruby', swift: 'swift', kt: 'kotlin',
    java: 'java', php: 'php', lua: 'lua', zig: 'zig', el: 'elisp',
    ex: 'elixir', exs: 'elixir', erl: 'erlang', hs: 'haskell',
    ml: 'ocaml', tf: 'hcl', dockerfile: 'dockerfile',
  }
  return map[ext] ?? 'text'
}

/**
 * Resolve display name from a file path.
 * Returns { dir, filename } for structured rendering.
 */
export function resolveFileParts(filePath: string): { dir: string; filename: string } {
  if (!filePath || filePath === '(unknown)') return { dir: '', filename: '(unknown)' }
  const parts = filePath.replace(/\\/g, '/').split('/')
  const filename = parts.pop() ?? filePath
  const dir = parts.length > 0 ? parts.join('/') + '/' : ''
  return { dir, filename }
}

/**
 * Streaming-safe shiki highlight hook.
 *
 * Guarantees:
 * - Never runs concurrent `codeToHtml` calls (prevents queue pileups)
 * - Coalesces to latest code snapshot while a highlight is in-flight
 * - Adaptive pacing based on code size while streaming
 */
export function useThrottledHighlight(
  code: string,
  language: string,
  isStreaming: boolean,
): string {
  const [html, setHtml] = useState('')

  const mountedRef = useRef(true)
  const pendingRef = useRef<string>('')
  const lastCompletedRef = useRef<string>('')
  const inFlightRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRunAtRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!code) {
      pendingRef.current = ''
      lastCompletedRef.current = ''
      setHtml('')
      return
    }

    pendingRef.current = code

    const computeInterval = (src: string): number => {
      // Scale interval with size during streaming; no arbitrary fixed throttle.
      // Small blocks stay snappy, large blocks avoid starving UI.
      if (!isStreaming) return 0
      const sizeFactor = Math.floor(src.length / 4000) * 25
      return Math.min(MAX_STREAM_INTERVAL_MS, Math.max(MIN_STREAM_INTERVAL_MS, MIN_STREAM_INTERVAL_MS + sizeFactor))
    }

    const runHighlight = () => {
      if (!mountedRef.current || inFlightRef.current) return
      const src = pendingRef.current
      if (!src || src === lastCompletedRef.current) return

      const now = Date.now()
      const minInterval = computeInterval(src)
      const elapsed = now - lastRunAtRef.current
      if (elapsed < minInterval) {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(runHighlight, minInterval - elapsed)
        return
      }

      inFlightRef.current = true
      const highlightedSource = src

      codeToHtml(highlightedSource, {
        lang: language as BundledLanguage,
        theme: 'one-dark-pro',
      })
        .then((result) => {
          if (!mountedRef.current) return
          setHtml(result)
          lastCompletedRef.current = highlightedSource
        })
        .catch(() => {
          if (!mountedRef.current) return
          // Fallback to raw <pre><code>
          setHtml('')
          lastCompletedRef.current = highlightedSource
        })
        .finally(() => {
          inFlightRef.current = false
          lastRunAtRef.current = Date.now()

          // If content changed while we were highlighting, flush latest next.
          if (pendingRef.current !== highlightedSource) {
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(runHighlight, 0)
          }
        })
    }

    runHighlight()

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [code, language, isStreaming])

  return html
}
