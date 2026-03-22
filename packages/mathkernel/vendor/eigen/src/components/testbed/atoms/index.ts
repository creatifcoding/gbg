/**
 * Testbed Atoms
 *
 * Effect-based state management for testbed components.
 *
 * @module testbed/atoms
 */

export {
  // Schemas
  LogLevel,
  TestbedLogEntry,
  type LogLevel as LogLevelType,

  // Atoms
  logsAtom,
  logCountAtom,
  filteredLogsAtom,
  logsBySourceAtom,

  // Operations
  appendLog,
  clearLogs,
  clearLogsForSource,
  createLogger,
  type TestbedLogger,

  // Hooks
  useTestbedLogger,
  useTestbedLogs,
  useTestbedLogCount,
} from "./testbed-log"
