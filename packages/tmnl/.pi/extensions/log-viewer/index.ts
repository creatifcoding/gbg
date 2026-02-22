/**
 * Log Viewer Extension for Pi
 * 
 * Unified logging system for pi extensions:
 * - Shared Effect-first logging service
 * - File-based unified sink (never pollutes stdout)
 * - Below-editor widget with recent entries
 * - /logs command with interactive TUI viewer
 * 
 * @module
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { getSharedLogStore } from '../shared/logging/index.ts'
import { LogWidget } from './log-widget.ts'
import { createLogViewer } from './log-viewer.ts'

export default function logViewerExtension(pi: ExtensionAPI) {
  const store = getSharedLogStore()

  let widget: LogWidget | null = null

  // Start widget on session start
  pi.on('session_start', async (_event, ctx) => {
    if (!ctx.hasUI) return

    widget?.stop()
    widget = new LogWidget(store, ctx.ui.theme, ctx.ui.setWidget.bind(ctx.ui))
    widget.start()
  })

  // Clean up widget on shutdown
  pi.on('session_shutdown', async () => {
    widget?.stop()
    widget = null
  })

  // /logs — interactive viewer
  pi.registerCommand('logs', {
    description: 'View extension logs (arg: source filter)',
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify('Log viewer requires interactive mode', 'warning')
        return
      }

      const filter = args?.trim() || ''

      await ctx.ui.custom<void>((tui, theme, _kb, done) => {
        return createLogViewer({ tui, theme, done, store, initialFilter: filter })
      })
    },
  })

  // /logs-clear — wipe everything
  pi.registerCommand('logs-clear', {
    description: 'Clear extension logs',
    handler: async (_args, ctx) => {
      store.clear()
      ctx.ui.notify('Logs cleared', 'info')
    },
  })
}
