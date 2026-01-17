/**
 * Output Adapters
 *
 * Mode-specific implementations of OutputPort.
 *
 * @module @gbg/ctl/adapters/output
 */

export { ConsoleOutputLayer } from "./console.js"
export { AgentOutputLayer, makeAgentOutputLayer, setCommand } from "./agent.js"
export { TuiOutputLayer, startTui, isTuiRunning, type TuiView } from "./tui.js"
