/**
 * Floating STX constants
 * @module
 */

export const STORAGE_KEY = 'tmnl-floating-panels'
export const DEFAULT_WIDTH = 320
export const DEFAULT_HEIGHT = 240
export const BASE_Z_INDEX = 1000
/** Maximized panels sit above siblings but below workspace chrome */
export const MAXIMIZED_Z_INDEX = 2000
/** Workspace chrome (spawn bar, status bar) — always reachable */
export const WORKSPACE_CHROME_Z_INDEX = 2500
/** Sentinel panelId for empty workspace zone in split tree */
export const WORKSPACE_SENTINEL = '__workspace__'
