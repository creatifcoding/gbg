/**
 * Terminal v3 Machines
 */

export {
  terminalMachine,
  type TerminalMachineContext,
  type TerminalMachineEvent,
  type TerminalMachineSnapshot,
  type TerminalMachineState,
  type InputMode,
  getTerminalState,
  canSubmit,
  isActive,
  isStreaming,
  isExecuting,
} from './terminal-machine'
