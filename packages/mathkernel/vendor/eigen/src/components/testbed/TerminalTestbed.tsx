/**
 * TerminalTestbed - Validation testbed for Terminal Compound Component
 *
 * Tests:
 * - Compound component pattern (Terminal.Root/Screen/Controls/StatusBar)
 * - Zoom controls
 * - PTY/SSH backend integration
 * - Nerd Font rendering (for oh-my-posh, Powerline)
 * - Container-filling layout
 */

import { useRef, useCallback } from 'react'
import {
  Terminal,
  type GhosttyTerminalRef,
} from '@/lib/terminal'
import { Palette, Box, RotateCcw } from 'lucide-react'

export function TerminalTestbed() {
  const termRef = useRef<GhosttyTerminalRef>(null)

  // Test commands
  const runColorTest = useCallback(() => {
    if (!termRef.current) return

    termRef.current.writeln('\r\n')
    termRef.current.writeln('\x1b[1mANSI Color Test:\x1b[0m')
    termRef.current.writeln('')

    termRef.current.write('Standard:  ')
    for (let i = 0; i < 8; i++) {
      termRef.current.write(`\x1b[4${i}m  \x1b[0m`)
    }
    termRef.current.writeln('')

    termRef.current.write('Bright:    ')
    for (let i = 0; i < 8; i++) {
      termRef.current.write(`\x1b[10${i}m  \x1b[0m`)
    }
    termRef.current.writeln('')

    termRef.current.writeln('')
    termRef.current.writeln(
      '\x1b[1mBold\x1b[0m \x1b[3mItalic\x1b[0m \x1b[4mUnderline\x1b[0m \x1b[9mStrikethrough\x1b[0m'
    )
    termRef.current.writeln('')
  }, [])

  const runNerdFontTest = useCallback(() => {
    if (!termRef.current) return

    termRef.current.writeln('\r\n')
    termRef.current.writeln('\x1b[1mNerd Font / Powerline Glyph Test:\x1b[0m')
    termRef.current.writeln('')
    // Common Powerline/Nerd Font glyphs
    termRef.current.writeln('Powerline arrows: \ue0b0 \ue0b1 \ue0b2 \ue0b3')
    termRef.current.writeln('Git branch:       \ue0a0 \uf126 \uf418')
    termRef.current.writeln('Folder icons:     \uf115 \uf07c \uf07b')
    termRef.current.writeln('Devicons:         \ue7a8 \ue73c \ue781 \ue691')
    termRef.current.writeln('Weather:          \ue30d \ue302 \ue305')
    termRef.current.writeln('Box drawing:      ┌─┬─┐ ╔═╦═╗')
    termRef.current.writeln('                  │ │ │ ║ ║ ║')
    termRef.current.writeln('                  └─┴─┘ ╚═╩═╝')
    termRef.current.writeln('')
    termRef.current.writeln('\x1b[33mNote: If glyphs show as boxes, install a Nerd Font\x1b[0m')
    termRef.current.writeln('\x1b[90m(e.g., MesloLGS Nerd Font, JetBrainsMono Nerd Font)\x1b[0m')
    termRef.current.writeln('')
  }, [])

  const clearTerminal = useCallback(() => {
    if (!termRef.current) return
    termRef.current.clear()
  }, [])

  // Custom actions for the controls bar
  const customActions = (
    <>
      <button
        onClick={runColorTest}
        style={{
          padding: '4px 8px',
          background: 'rgba(255,255,255,0.05)',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
        title="Run color test"
      >
        <Palette size={14} />
        Colors
      </button>
      <button
        onClick={runNerdFontTest}
        style={{
          padding: '4px 8px',
          background: 'rgba(255,255,255,0.05)',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
        title="Run Nerd Font glyph test"
      >
        <Box size={14} />
        Glyphs
      </button>
      <button
        onClick={clearTerminal}
        style={{
          padding: '4px 8px',
          background: 'rgba(255,255,255,0.05)',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
        title="Clear terminal"
      >
        <RotateCcw size={14} />
        Clear
      </button>
    </>
  )

  return (
    <Terminal.Root
      width="100%"
      height="100%"
      initialZoom={1.0}
      enableConnection={true}
      connectionOptions={{
        autoConnect: false,
        onReady: (session) => {
          if (termRef.current) {
            const backendColor = session.backend === 'ssh' ? '36' : '32'
            const backendLabel = session.backend.toUpperCase()
            const details = session.backend === 'ssh'
              ? `host=${session.host ?? 'localhost'}`
              : `pid=${session.pid ?? 'unknown'}`
            termRef.current.writeln('')
            termRef.current.writeln(
              `\x1b[1;${backendColor}m[${backendLabel}]\x1b[0m Connected: session=${session.id?.slice(0, 8) ?? 'unknown'}... ${details}`
            )
          }
        },
        onError: (error) => {
          if (termRef.current) {
            termRef.current.writeln(`\x1b[1;31m[Error]\x1b[0m ${error}`)
          }
        },
      }}
    >
      <Terminal.Controls
        showZoom
        showModeToggle
        actions={customActions}
      />
      <Terminal.Screen
        ref={termRef}
        onReady={() => {
          if (termRef.current) {
            termRef.current.writeln(
              '\x1b[1;32m╔════════════════════════════════════════════════════╗\x1b[0m'
            )
            termRef.current.writeln(
              '\x1b[1;32m║\x1b[0m  \x1b[1;36mTMNL Terminal\x1b[0m - \x1b[33mCompound Component\x1b[0m              \x1b[1;32m║\x1b[0m'
            )
            termRef.current.writeln(
              '\x1b[1;32m╚════════════════════════════════════════════════════╝\x1b[0m'
            )
            termRef.current.writeln('')
            termRef.current.writeln('\x1b[90mMode: Local Echo (toggle above for Remote)\x1b[0m')
            termRef.current.writeln('\x1b[90mFor PTY: bunx tsx scripts/terminal-server.ts\x1b[0m')
            termRef.current.writeln('')
            termRef.current.writeln('\x1b[90mFeatures:\x1b[0m')
            termRef.current.writeln('  • Zoom: +/- buttons or Ctrl+Mouse wheel')
            termRef.current.writeln('  • Nerd Font support for oh-my-posh/Powerline')
            termRef.current.writeln('  • Auto-fit to container')
            termRef.current.writeln('  • Shell: prefers $SHELL, fallback to zsh')
            termRef.current.writeln('')
          }
        }}
      />
      <Terminal.StatusBar showConnection showSession />
    </Terminal.Root>
  )
}

export default TerminalTestbed
