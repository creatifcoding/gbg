import type { RendererTheme } from './render-core.ts'

export function themeBold(theme: RendererTheme, text: string): string {
  return typeof theme.bold === 'function' ? theme.bold(text) : text
}
