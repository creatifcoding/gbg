/**
 * Terminal Integration
 *
 * React wrapper for ghostty-web (coder/ghostty-web)
 * Provides Effect-integrated terminal services for TMNL
 *
 * ## Usage
 *
 * ```tsx
 * import { GhosttyTerminal, useTerminalConnection } from '@/lib/terminal'
 *
 * function Terminal() {
 *   const termRef = useRef<GhosttyTerminalRef>(null)
 *   const terminal = useTerminalConnection({
 *     onReady: (session) => console.log(`Connected to ${session.backend}`),
 *   })
 *
 *   useEffect(() => {
 *     terminal.attachTerminal(termRef)
 *   }, [])
 *
 *   return (
 *     <GhosttyTerminal
 *       ref={termRef}
 *       onData={terminal.write}
 *       onResize={terminal.resize}
 *     />
 *   )
 * }
 * ```
 */

// Core component
export { GhosttyTerminal } from './GhosttyTerminal';
export type { GhosttyTerminalProps, GhosttyTerminalRef } from './GhosttyTerminal';

// Terminal connection hook (backend-agnostic: PTY or SSH)
export { useTerminalConnection, usePtyConnection } from './usePtyConnection';
export type {
  UseTerminalConnectionOptions,
  UseTerminalConnectionReturn,
  TerminalSessionInfo,
  // Deprecated aliases for backwards compatibility
  UsePtyConnectionOptions,
  UsePtyConnectionReturn,
} from './usePtyConnection';

// Theme utilities
export { tmnlTerminalTheme, createTerminalTheme } from './theme';
export type { TerminalThemeConfig } from './theme';

// Tauri server management (only available in Tauri context)
export {
  useTerminalServer,
  startTerminalServer,
  stopTerminalServer,
  getTerminalServerStatus,
  restartTerminalServer,
} from './tauri-server';
export type {
  TerminalBackend as TauriTerminalBackend,
  TerminalServerStatus,
  UseTerminalServerReturn,
} from './tauri-server';

// Re-export useful types from ghostty-web
export type { ITerminalOptions, ITheme } from 'ghostty-web';
