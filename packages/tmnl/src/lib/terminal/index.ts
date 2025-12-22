/**
 * Terminal Integration
 *
 * React wrapper for ghostty-web (coder/ghostty-web)
 * Provides Effect-integrated terminal services for TMNL
 *
 * ## Usage
 *
 * ```tsx
 * import { GhosttyTerminal, usePtyConnection } from '@/lib/terminal'
 *
 * function Terminal() {
 *   const termRef = useRef<GhosttyTerminalRef>(null)
 *   const pty = usePtyConnection({
 *     onData: (data) => termRef.current?.write(data),
 *   })
 *
 *   useEffect(() => {
 *     pty.attachTerminal(termRef)
 *   }, [])
 *
 *   return (
 *     <GhosttyTerminal
 *       ref={termRef}
 *       onData={pty.write}
 *       onResize={pty.resize}
 *     />
 *   )
 * }
 * ```
 */

// Core component
export { GhosttyTerminal } from './GhosttyTerminal';
export type { GhosttyTerminalProps, GhosttyTerminalRef } from './GhosttyTerminal';

// PTY connection hook
export { usePtyConnection } from './usePtyConnection';
export type { UsePtyConnectionOptions, UsePtyConnectionReturn } from './usePtyConnection';

// Theme utilities
export { tmnlTerminalTheme, createTerminalTheme } from './theme';
export type { TerminalThemeConfig } from './theme';

// Re-export useful types from ghostty-web
export type { ITerminalOptions, ITheme } from 'ghostty-web';
