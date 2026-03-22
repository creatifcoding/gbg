/**
 * TMNL Bar — Niri Effect Service
 *
 * Bridges Tauri IPC commands to Effect services.
 * Uses Effect.tryPromise to wrap invoke() calls.
 * The service is consumed by barRuntimeAtom for React integration.
 */

import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Context from 'effect/Context'

import type { Workspace, NiriWindow } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────────────────

export class NiriService extends Context.Tag('bar/NiriService')<
  NiriService,
  {
    readonly getWorkspaces: Effect.Effect<readonly Workspace[]>
    readonly getWindows: Effect.Effect<readonly NiriWindow[]>
    readonly focusWorkspace: (idx: number) => Effect.Effect<void>
  }
>() {
  /**
   * Live implementation — calls Tauri commands via invoke()
   */
  static Live = Layer.succeed(
    NiriService,
    NiriService.of({
      getWorkspaces: Effect.tryPromise({
        try: async () => {
          const { invoke } = await import('@tauri-apps/api/core')
          const data = await invoke<Workspace[]>('get_workspaces')
          return Array.isArray(data) ? data : []
        },
        catch: (e) => new Error(`get_workspaces failed: ${e}`),
      }),

      getWindows: Effect.tryPromise({
        try: async () => {
          const { invoke } = await import('@tauri-apps/api/core')
          const data = await invoke<NiriWindow[]>('get_windows')
          return Array.isArray(data) ? data : []
        },
        catch: (e) => new Error(`get_windows failed: ${e}`),
      }),

      focusWorkspace: (idx: number) =>
        Effect.tryPromise({
          try: async () => {
            const { invoke } = await import('@tauri-apps/api/core')
            await invoke('focus_workspace', { idx })
          },
          catch: (e) => new Error(`focus_workspace failed: ${e}`),
        }),
    })
  )

  /**
   * Default layer — uses Live
   */
  static Default = NiriService.Live

  /**
   * Test layer — returns mock data
   */
  static Test = Layer.succeed(
    NiriService,
    NiriService.of({
      getWorkspaces: Effect.succeed([
        { idx: 1, name: null, output: 'eDP-1', is_active: true, is_focused: true, active_window_id: 1 },
        { idx: 2, name: null, output: 'eDP-1', is_active: false, is_focused: false, active_window_id: 2 },
        { idx: 3, name: null, output: 'eDP-1', is_active: false, is_focused: false, active_window_id: null },
      ] as any),
      getWindows: Effect.succeed([
        { id: 1, title: 'Terminal', app_id: 'kitty', workspace_id: 1, is_focused: true },
        { id: 2, title: 'Firefox', app_id: 'firefox', workspace_id: 2, is_focused: false },
      ] as any),
      focusWorkspace: () => Effect.void,
    })
  )
}
