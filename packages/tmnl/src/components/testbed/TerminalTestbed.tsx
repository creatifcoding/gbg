/**
 * TerminalTestbed - Validation testbed for GhosttyTerminal
 *
 * Tests:
 * - WASM loading
 * - Terminal rendering
 * - Input/output flow (local echo OR PTY backend)
 * - Resize behavior
 * - Theme application
 * - PTY WebSocket connection
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  GhosttyTerminal,
  useTerminalConnection,
  type GhosttyTerminalRef,
  type TerminalSessionInfo,
} from '@/lib/terminal';

type Mode = 'local' | 'remote';

export function TerminalTestbed() {
  const termRef = useRef<GhosttyTerminalRef>(null);
  const [mode, setMode] = useState<Mode>('local');
  const [isReady, setIsReady] = useState(false);
  const [lastInput, setLastInput] = useState<string>('');
  const [dimensions, setDimensions] = useState({ cols: 0, rows: 0 });

  // Terminal connection (PTY or SSH - server determines which)
  const terminal = useTerminalConnection({
    autoConnect: false, // We'll connect manually when switching to remote mode
    onReady: (session: TerminalSessionInfo) => {
      if (termRef.current) {
        termRef.current.writeln('');
        const backendColor = session.backend === 'ssh' ? '36' : '32'; // cyan for SSH, green for PTY
        const backendLabel = session.backend.toUpperCase();
        const details = session.backend === 'ssh'
          ? `host=${session.host ?? 'localhost'}`
          : `pid=${session.pid ?? 'unknown'}`;
        termRef.current.writeln(
          `\x1b[1;${backendColor}m[${backendLabel}]\x1b[0m Connected: session=${session.sessionId.slice(0, 8)}... ${details}`
        );
      }
    },
    onError: (error) => {
      if (termRef.current) {
        termRef.current.writeln(`\x1b[1;31m[Error]\x1b[0m ${error}`);
      }
    },
    onConnectionChange: (connected) => {
      if (termRef.current && mode === 'remote') {
        const backendLabel = terminal.backend?.toUpperCase() ?? 'TERMINAL';
        if (connected) {
          termRef.current.writeln(`\x1b[1;32m[${backendLabel}]\x1b[0m WebSocket connected`);
        } else {
          termRef.current.writeln(`\x1b[1;33m[${backendLabel}]\x1b[0m WebSocket disconnected`);
        }
      }
    },
  });

  // Attach terminal when in remote mode
  useEffect(() => {
    if (mode === 'remote') {
      terminal.attachTerminal(termRef);
    }
  }, [mode, terminal]);

  // Handle mode switch
  const switchMode = useCallback(
    (newMode: Mode) => {
      if (newMode === mode) return;

      if (termRef.current) {
        termRef.current.clear();
      }

      if (newMode === 'remote') {
        if (termRef.current) {
          termRef.current.writeln(
            '\x1b[1;36m[MODE]\x1b[0m Switching to remote mode...'
          );
          termRef.current.writeln(
            '\x1b[90mConnecting to ws://localhost:7681/ws (PTY or SSH)\x1b[0m'
          );
          termRef.current.writeln('');
          termRef.current.focus();
        }
        terminal.connect();
      } else {
        terminal.disconnect();
        if (termRef.current) {
          termRef.current.writeln(
            '\x1b[1;36m[MODE]\x1b[0m Switching to local echo mode'
          );
          termRef.current.writeln('');
          termRef.current.write('\x1b[1;35m❯\x1b[0m ');
        }
      }

      setMode(newMode);
    },
    [mode, terminal]
  );

  // Handle terminal data (user input)
  const handleData = useCallback(
    (data: string) => {
      setLastInput(data);

      if (mode === 'remote') {
        // Send to backend (PTY or SSH)
        terminal.write(data);
      } else {
        // Local echo for testing
        if (termRef.current) {
          if (data === '\r') {
            termRef.current.write('\r\n');
            termRef.current.write('\x1b[1;35m❯\x1b[0m ');
          } else if (data === '\x7f') {
            termRef.current.write('\b \b');
          } else {
            termRef.current.write(data);
          }
        }
      }
    },
    [mode, terminal]
  );

  // Handle resize
  const handleResize = useCallback(
    (cols: number, rows: number) => {
      setDimensions({ cols, rows });

      if (mode === 'remote' && terminal.connected) {
        terminal.resize(cols, rows);
      }
    },
    [mode, terminal]
  );

  // Handle ready
  const handleReady = useCallback(() => {
    setIsReady(true);

    if (termRef.current) {
      termRef.current.focus();
      termRef.current.writeln(
        '\x1b[1;32m╔════════════════════════════════════════════════════╗\x1b[0m'
      );
      termRef.current.writeln(
        '\x1b[1;32m║\x1b[0m  \x1b[1;36mTMNL Terminal\x1b[0m - \x1b[33mGhostty-web Integration\x1b[0m         \x1b[1;32m║\x1b[0m'
      );
      termRef.current.writeln(
        '\x1b[1;32m╚════════════════════════════════════════════════════╝\x1b[0m'
      );
      termRef.current.writeln('');
      termRef.current.writeln('\x1b[90mMode: Local Echo (toggle above for Remote)\x1b[0m');
      termRef.current.writeln(
        '\x1b[90mFor PTY: bunx tsx scripts/terminal-server.ts\x1b[0m'
      );
      termRef.current.writeln(
        '\x1b[90mFor SSH: bunx tsx scripts/terminal-server.ts --ssh\x1b[0m'
      );
      termRef.current.writeln('');
      termRef.current.write('\x1b[1;35m❯\x1b[0m ');
    }
  }, []);

  // Test commands
  const runColorTest = () => {
    if (!termRef.current) return;

    termRef.current.writeln('\r\n');
    termRef.current.writeln('\x1b[1mANSI Color Test:\x1b[0m');
    termRef.current.writeln('');

    termRef.current.write('Standard:  ');
    for (let i = 0; i < 8; i++) {
      termRef.current.write(`\x1b[4${i}m  \x1b[0m`);
    }
    termRef.current.writeln('');

    termRef.current.write('Bright:    ');
    for (let i = 0; i < 8; i++) {
      termRef.current.write(`\x1b[10${i}m  \x1b[0m`);
    }
    termRef.current.writeln('');

    termRef.current.writeln('');
    termRef.current.writeln(
      '\x1b[1mBold\x1b[0m \x1b[3mItalic\x1b[0m \x1b[4mUnderline\x1b[0m \x1b[9mStrikethrough\x1b[0m'
    );
    termRef.current.writeln('');
    if (mode === 'local') {
      termRef.current.write('\x1b[1;35m❯\x1b[0m ');
    }
  };

  const runUnicodeTest = () => {
    if (!termRef.current) return;

    termRef.current.writeln('\r\n');
    termRef.current.writeln('\x1b[1mUnicode Test:\x1b[0m');
    termRef.current.writeln('');
    termRef.current.writeln('Box Drawing: ┌─┬─┐ ╔═╦═╗');
    termRef.current.writeln('            │ │ │ ║ ║ ║');
    termRef.current.writeln('            └─┴─┘ ╚═╩═╝');
    termRef.current.writeln('Math: x^2 + y^2 = r^2');
    termRef.current.writeln('');
    if (mode === 'local') {
      termRef.current.write('\x1b[1;35m❯\x1b[0m ');
    }
  };

  const clearTerminal = () => {
    if (!termRef.current) return;
    termRef.current.clear();
    if (mode === 'local') {
      termRef.current.write('\x1b[1;35m❯\x1b[0m ');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-mono text-white/80">Terminal Testbed</h2>

          {/* Mode Toggle */}
          <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5">
            <button
              onClick={() => switchMode('local')}
              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                mode === 'local'
                  ? 'bg-white/20 text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              Local
            </button>
            <button
              onClick={() => switchMode('remote')}
              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                mode === 'remote'
                  ? 'bg-cyan-500/30 text-cyan-400'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              Remote
            </button>
          </div>

          {/* Status Indicators */}
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              isReady
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}
          >
            {isReady ? 'Ready' : 'Loading...'}
          </span>

          {mode === 'remote' && (
            <>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  terminal.connected
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {terminal.connected ? `WS Connected` : 'WS Disconnected'}
              </span>
              {terminal.backend && (
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    terminal.backend === 'ssh'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {terminal.backend.toUpperCase()}
                </span>
              )}
            </>
          )}

          {dimensions.cols > 0 && (
            <span className="text-xs text-white/40 font-mono">
              {dimensions.cols}×{dimensions.rows}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runColorTest}
            disabled={!isReady}
            className="px-3 py-1 text-xs font-mono bg-white/5 hover:bg-white/10 rounded disabled:opacity-50"
          >
            Color Test
          </button>
          <button
            onClick={runUnicodeTest}
            disabled={!isReady}
            className="px-3 py-1 text-xs font-mono bg-white/5 hover:bg-white/10 rounded disabled:opacity-50"
          >
            Unicode Test
          </button>
          <button
            onClick={clearTerminal}
            disabled={!isReady}
            className="px-3 py-1 text-xs font-mono bg-white/5 hover:bg-white/10 rounded disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 min-h-0">
        <GhosttyTerminal
          ref={termRef}
          onData={handleData}
          onResize={handleResize}
          onReady={handleReady}
          fontSize={14}
          autoFit
          className="h-full"
        />
      </div>

      {/* Debug Footer */}
      <div className="px-4 py-2 border-t border-white/10 text-xs font-mono text-white/40 flex justify-between">
        <div>
          Last input:{' '}
          <code className="text-cyan-400">
            {lastInput
              ? JSON.stringify(lastInput)
                  .slice(1, -1)
                  .replace(/\\u[\da-f]{4}/gi, (m) =>
                    String.fromCharCode(parseInt(m.slice(2), 16))
                  )
              : '(none)'}
          </code>
        </div>
        {mode === 'remote' && terminal.sessionId && (
          <div>
            Session: <code className="text-purple-400">{terminal.sessionId.slice(0, 12)}...</code>
            {terminal.backend === 'pty' && terminal.pid && (
              <>
                {' '}PID: <code className="text-green-400">{terminal.pid}</code>
              </>
            )}
            {terminal.backend === 'ssh' && terminal.host && (
              <>
                {' '}Host: <code className="text-cyan-400">{terminal.host}</code>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TerminalTestbed;
