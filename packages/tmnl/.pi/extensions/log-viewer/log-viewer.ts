/**
 * Interactive log viewer TUI component.
 * 
 * Follows the questionnaire pattern:
 * - Returns plain { render, invalidate, handleInput } from factory
 * - Uses tui.requestRender() after every state mutation
 * - Caches rendered lines, clears on invalidate
 */

import { Key, matchesKey, truncateToWidth } from '@mariozechner/pi-tui'
import type { SharedLogStore } from '../shared/logging/index.ts'
import type { LogLevel } from './types.ts'
import { LOG_LEVELS } from './types.ts'

interface LogViewerOptions {
  tui: any
  theme: any
  done: (value: void) => void
  store: SharedLogStore
  initialFilter: string
}

export function createLogViewer({ tui, theme, done, store, initialFilter }: LogViewerOptions) {
  // State
  let scrollOffset = 0
  let sourceFilter = initialFilter
  let levelFilter = new Set<LogLevel>(['debug', 'info', 'warn', 'error'])
  let cachedLines: string[] | undefined

  // Subscribe to store for live updates
  const unsub = store.onChange(() => {
    cachedLines = undefined
    tui.requestRender()
  })

  function refresh() {
    cachedLines = undefined
    tui.requestRender()
  }

  function getFiltered() {
    return store.getFiltered(levelFilter, sourceFilter)
  }

  function toggleLevel(level: LogLevel) {
    if (levelFilter.has(level)) {
      levelFilter.delete(level)
    } else {
      levelFilter.add(level)
    }
    scrollOffset = 0
    refresh()
  }

  function cycleSourceFilter() {
    const sources = store.getSources()
    if (sources.length === 0) return

    if (!sourceFilter) {
      sourceFilter = sources[0]
    } else {
      const idx = sources.indexOf(sourceFilter)
      if (idx === -1 || idx === sources.length - 1) {
        sourceFilter = '' // clear filter
      } else {
        sourceFilter = sources[idx + 1]
      }
    }
    scrollOffset = 0
    refresh()
  }

  // =========================================================================
  // Render
  // =========================================================================

  function render(width: number): string[] {
    if (cachedLines) return cachedLines

    const t = theme
    const filtered = getFiltered()
    const lines: string[] = []

    const add = (s: string) => lines.push(truncateToWidth(s, width))

    // Header bar
    add(t.fg('accent', '─'.repeat(width)))
    
    const title = t.bold(t.fg('accent', ' ◆ Extension Logs '))
    const count = t.fg('dim', `(${filtered.length}/${store.size})`)
    const filterLabel = sourceFilter
      ? t.fg('warning', ` ⏎ ${sourceFilter}`)
      : t.fg('dim', ' ⏎ all')
    add(`${title} ${count}${filterLabel}`)

    // Level toggles
    const toggles = LOG_LEVELS.map(l => {
      const active = levelFilter.has(l)
      const key = l[0].toUpperCase()
      const label = l.toUpperCase()
      if (active) {
        const color = l === 'error' ? 'error' : l === 'warn' ? 'warning' : l === 'info' ? 'success' : 'dim'
        return t.fg(color, `[${key}:${label}]`)
      }
      return t.fg('dim', ` ${key}:${label} `)
    })
    add(` ${toggles.join(' ')}`)
    add(t.fg('dim', ' d/i/w/e toggle levels · ↑↓/jk scroll · f filter source · q quit'))
    add(t.fg('accent', '─'.repeat(width)))

    // Log entries
    const visibleHeight = Math.max(10, 30)
    const maxScroll = Math.max(0, filtered.length - visibleHeight)
    const safeOffset = Math.min(scrollOffset, maxScroll)
    const start = Math.max(0, filtered.length - visibleHeight - safeOffset)
    const end = Math.min(filtered.length, start + visibleHeight)

    if (filtered.length === 0) {
      lines.push('')
      add(t.fg('dim', '  (no log entries match filters)'))
      lines.push('')
    } else {
      for (let i = start; i < end; i++) {
        const e = filtered[i]
        const ts = t.fg('dim', e.timestamp.slice(11, 23))

        const levelIcon = e.level === 'error' ? t.fg('error', 'ERR')
          : e.level === 'warn' ? t.fg('warning', 'WRN')
          : e.level === 'info' ? t.fg('success', 'INF')
          : t.fg('dim', 'DBG')

        const src = t.fg('accent', e.source.slice(0, 14).padEnd(14))
        const maxMsg = Math.max(20, width - 40)
        const msg = e.message.length > maxMsg
          ? e.message.slice(0, maxMsg - 1) + '…'
          : e.message

        add(` ${ts} ${levelIcon} ${src} ${msg}`)
      }
    }

    // Footer
    add(t.fg('accent', '─'.repeat(width)))
    if (filtered.length > visibleHeight) {
      const pct = Math.round((end / filtered.length) * 100)
      add(t.fg('dim', ` scroll: ${pct}% (${safeOffset}/${maxScroll})`))
    }

    cachedLines = lines
    return lines
  }

  // =========================================================================
  // Input
  // =========================================================================

  function handleInput(data: string) {
    // Quit
    if (matchesKey(data, 'q') || matchesKey(data, Key.escape)) {
      unsub()
      done()
      return
    }

    // Scroll
    if (matchesKey(data, Key.up) || matchesKey(data, 'k')) {
      scrollOffset = Math.min(scrollOffset + 1, Math.max(0, getFiltered().length - 10))
      refresh()
      return
    }
    if (matchesKey(data, Key.down) || matchesKey(data, 'j')) {
      scrollOffset = Math.max(0, scrollOffset - 1)
      refresh()
      return
    }
    if (matchesKey(data, Key.pageUp)) {
      scrollOffset = Math.min(scrollOffset + 10, Math.max(0, getFiltered().length - 10))
      refresh()
      return
    }
    if (matchesKey(data, Key.pageDown)) {
      scrollOffset = Math.max(0, scrollOffset - 10)
      refresh()
      return
    }

    // Home/End
    if (matchesKey(data, Key.home)) {
      scrollOffset = Math.max(0, getFiltered().length - 10)
      refresh()
      return
    }
    if (matchesKey(data, Key.end)) {
      scrollOffset = 0
      refresh()
      return
    }

    // Level toggles
    if (matchesKey(data, 'd')) { toggleLevel('debug'); return }
    if (matchesKey(data, 'i')) { toggleLevel('info'); return }
    if (matchesKey(data, 'w')) { toggleLevel('warn'); return }
    if (matchesKey(data, 'e')) { toggleLevel('error'); return }

    // Source filter cycle
    if (matchesKey(data, 'f')) { cycleSourceFilter(); return }
  }

  // =========================================================================
  // Component interface
  // =========================================================================

  return {
    render,
    handleInput,
    invalidate() { cachedLines = undefined },
  }
}
