/**
 * Terminal v2
 *
 * xterm.js-based terminal system for TMNL.
 * Ported from infinitty with Effect-TS integration.
 *
 * Features:
 * - XtermTerminal component with persistence registry
 * - TauriPtyService for native PTY operations
 * - Effect-atom state management
 * - Ghostty + OpenWarp mode support (Phase 2)
 *
 * @example
 * ```tsx
 * import { XtermTerminal } from '@/lib/terminal/v2'
 *
 * function MyTerminal() {
 *   const terminalRef = useRef<XtermTerminalHandle>(null)
 *
 *   return (
 *     <XtermTerminal
 *       ref={terminalRef}
 *       persistKey="main-terminal"
 *       onData={(data) => console.log('Output:', data)}
 *     />
 *   )
 * }
 * ```
 */

// Components
export {
  XtermTerminal,
  type XtermTerminalProps,
  type XtermTerminalHandle,
} from './components'

// Hooks
export {
  useXterm,
  disposeTerminal,
  disposeAllTerminals,
  getPersistedTerminalCount,
  type UseXtermOptions,
  type UseXtermReturn,
} from './hooks'

// Services
export {
  TauriPtyService,
  type TauriPtyServiceShape,
  type PtyHandle,
} from './services'

// Atoms
export {
  // Runtime
  terminalRuntimeAtom,
  // State atoms
  terminalModeAtom,
  terminalStatusAtom,
  activeTerminalIdAtom,
  terminalInstancesAtom,
  terminalConfigAtom,
  // Derived atoms
  activeTerminalAtom,
  isTerminalReadyAtom,
  activePwdAtom,
  terminalCountAtom,
  // Operations (synchronous)
  setTerminalMode,
  toggleTerminalMode,
  updateTerminalConfig,
  registerTerminal,
  updateTerminalInstance,
  unregisterTerminal,
  setActiveTerminal,
  // Operations (Effect-based)
  spawnTerminalOp,
  killTerminalOp,
  listTerminalsOp,
} from './atoms'

// Schemas
export type {
  TerminalStatus,
  TerminalMode,
  CursorStyle,
  TerminalTheme,
  TerminalConfig,
  TerminalInstanceState,
  PtySpawnOptions,
  TerminalEvent,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalPwdChangeEvent,
} from './schemas'
