/**
 * Theia IDE Integration
 *
 * Embeddable Eclipse Theia IDE with Tauri process management.
 *
 * @module lib/theia
 */

export { TheiaPanel, type TheiaPanelProps } from './TheiaPanel';
export {
  theiaRegistry,
  theiaOps,
  getTheiaAtoms,
  getTheiaPanelAtoms,
  theiaServerStatusAtom,
  theiaServerUrlAtom,
  theiaServerPidAtom,
  theiaServerPortAtom,
  theiaServerErrorAtom,
  theiaReadyAtom,
  panelBouncedAtom,
  panelLoadedAtom,
  panelWorkspaceAtom,
  type TheiaStatus,
  type TheiaServerStatus,
  type TheiaAtoms,
  type TheiaPanelAtoms,
} from './theia-stx';
