/**
 * Below-editor widget showing recent log entries.
 * 
 * Only shows when there's recent activity.
 * Auto-hides after FADE_MS of silence.
 * Errors persist longer (ERROR_FADE_MS).
 */

import type { SharedLogStore } from '../shared/logging/index.ts'

const WIDGET_LINES = 3
const FADE_MS = 5_000       // hide after 5s of silence
const ERROR_FADE_MS = 15_000 // errors linger 15s

export class LogWidget {
  private store: SharedLogStore
  private theme: any
  private setWidget: (id: string, content: string[] | undefined, opts?: any) => void
  private unsub: (() => void) | null = null
  private fadeTimer: ReturnType<typeof setTimeout> | null = null
  private visible = false

  constructor(
    store: SharedLogStore,
    theme: any,
    setWidget: (id: string, content: string[] | undefined, opts?: any) => void,
  ) {
    this.store = store
    this.theme = theme
    this.setWidget = setWidget
  }

  /** Start subscribing to updates. Widget starts hidden. */
  start() {
    this.unsub = this.store.onChange(() => this.show())
  }

  /** Stop and hide. */
  stop() {
    this.unsub?.()
    this.unsub = null
    this.hide()
  }

  private show() {
    const t = this.theme
    const recent = this.store.getLast(WIDGET_LINES)
    if (recent.length === 0) return

    const lines = recent.map(e => {
      const icon = e.level === 'error' ? t.fg('error', '✗')
        : e.level === 'warn' ? t.fg('warning', '⚠')
        : t.fg('dim', '·')

      const src = t.fg('accent', e.source.slice(0, 12).padEnd(12))
      const msg = t.fg('dim', e.message.slice(0, 60))
      return `${icon} ${src} ${msg}`
    })

    this.setWidget('ext-logs', lines, { placement: 'belowEditor' })
    this.visible = true

    // Schedule auto-hide
    if (this.fadeTimer) clearTimeout(this.fadeTimer)
    const hasError = recent.some(e => e.level === 'error')
    this.fadeTimer = setTimeout(() => this.hide(), hasError ? ERROR_FADE_MS : FADE_MS)
  }

  private hide() {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer)
      this.fadeTimer = null
    }
    if (this.visible) {
      this.setWidget('ext-logs', undefined)
      this.visible = false
    }
  }
}
