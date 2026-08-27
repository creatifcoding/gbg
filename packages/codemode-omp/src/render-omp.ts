/**
 * OMP-native Metatool tool renderer.
 *
 * This host adapter uses @oh-my-pi rendering primitives directly. It is not a
 * port of the Pi renderer: framing, code cells, status headers, and output
 * sections are owned by OMP's TUI APIs.
 *
 * @module
 */

import type { Component } from '@oh-my-pi/pi-tui'
import { Text, visibleWidth, truncateToWidth } from '@oh-my-pi/pi-tui'
import type { Theme } from '@oh-my-pi/pi-coding-agent/modes/theme/theme'
import { highlightCode } from '@oh-my-pi/pi-coding-agent/modes/theme/theme'
import type { ToolRenderResultOptions } from '@oh-my-pi/pi-coding-agent/extensibility/extensions'
import {
  framedBlock,
  outputBlockContentWidth,
  renderCodeCell,
  renderStatusLine,
  type State,
} from '@oh-my-pi/pi-coding-agent/tui'
import {
  formatStyledTruncationWarning,
  stripOutputNotice,
  type OutputMeta,
} from '@oh-my-pi/pi-coding-agent/tools/output-meta'
import { gridLines } from './grid.ts'
import { steer, renderAnnotations } from './steer.ts'
import { type Primitive } from './primitives/types.ts'
import {
  createPrimitiveRegistry,
  registerAllPrimitives,
  type PrimitiveRegistry,
} from './primitives/index.ts'
import { tryParseJSON, typeLabel, type RenderContext, type RendererTheme } from './render-core.ts'

export interface MsToolDetails {
  code: string
  result?: unknown
  primitive?: Primitive
  error?: string
  sanitizerWarnings?: string[]
  meta?: OutputMeta
}

type OmpMsResult = {
  content?: Array<{ type: string; text?: string }>
  details?: MsToolDetails
  isError?: boolean
}

const DEFAULT_CODE_PREVIEW_LINES = 8
const DEFAULT_RESULT_PREVIEW_LINES = 15
const OMP_EXPAND_HINT = 'ctrl+o to expand'

/** Consumer-facing knobs: the frame/header title (the eval namespace the
 * framed code was written in, e.g. "as", "digishell") and the running-state
 * description shown before any code arrives. */
export interface OmpToolRendererOptions {
  readonly title?: string
  readonly runningDescription?: string
}

interface RendererCfg {
  readonly title: string
  readonly runningDescription: string
}

function createOmpPrimitiveRegistry(): PrimitiveRegistry {
  const registry = createPrimitiveRegistry()
  registerAllPrimitives(registry)
  return registry
}

const ompPrimitiveRegistry = createOmpPrimitiveRegistry()

function createOmpRenderContext(theme: Theme): RenderContext {
  return {
    theme: theme as unknown as RendererTheme,
    text: { visibleWidth, truncateToWidth },
    code: { highlight: (src, lang) => highlightCode(src, lang, theme) },
    keys: { hint: (_key, label) => label },
  }
}



function statusForResult(result: OmpMsResult, options: ToolRenderResultOptions, details?: MsToolDetails): State {
  if (options.isPartial) return 'running'
  if (result.isError || details?.error) return 'error'
  if ((details?.sanitizerWarnings?.length ?? 0) > 0) return 'warning'
  return 'success'
}

function iconForState(state: State): 'running' | 'error' | 'warning' | 'success' {
  if (state === 'running' || state === 'pending') return 'running'
  if (state === 'error') return 'error'
  if (state === 'warning') return 'warning'
  return 'success'
}

function clampRows(lines: readonly string[], width: number): string[] {
  return lines.map(line => visibleWidth(line) > width ? truncateToWidth(line, width) : line)
}

function renderCodePreviewComponent(cfg: RendererCfg, code: string, options: ToolRenderResultOptions, theme: Theme): Component {
  let cachedWidth: number | undefined
  let cachedLines: readonly string[] | undefined
  return {
    render(width: number): readonly string[] {
      if (cachedWidth === width && cachedLines) return cachedLines
      cachedWidth = width
      cachedLines = renderCodeCell({
        code,
        language: 'javascript',
        title: cfg.title,
        status: options.spinnerFrame !== undefined ? 'running' : 'pending',
        spinnerFrame: options.spinnerFrame,
        width,
        codeTail: true,
        codeMaxLines: DEFAULT_CODE_PREVIEW_LINES,
        expanded: options.expanded,
      }, theme)
      return cachedLines
    },
    invalidate() {
      cachedWidth = undefined
      cachedLines = undefined
    },
  }
}

function renderCallWith(
  cfg: RendererCfg,
  args: { code?: string },
  options: ToolRenderResultOptions,
  theme: Theme,
): Component {
  const code = args.code ?? ''
  if (!code) {
    const header = renderStatusLine({ icon: 'pending', title: cfg.title, description: '(empty)' }, theme)
    return new Text(header, 0, 0)
  }

  const lines = code.split('\n')
  if (lines.length === 1 && code.length <= 80) {
    const highlighted = highlightCode(code, 'javascript', theme)[0] ?? code
    const header = renderStatusLine({ icon: 'pending', title: cfg.title }, theme)
    return new Text(`${header} ${highlighted}`, 0, 0)
  }

  return renderCodePreviewComponent(cfg, code, options, theme)
}

function renderResultWith(
  cfg: RendererCfg,
  result: OmpMsResult,
  options: ToolRenderResultOptions,
  theme: Theme,
  _args?: { code?: string },
): Component {
  const details = result.details
  const code = details?.code ?? _args?.code ?? ''
  const rawOutput = stripOutputNotice((result.content?.find(c => c.type === 'text' && typeof c.text === 'string')?.text ?? '').trimEnd(), details?.meta)

  return framedBlock(theme, width => {
    const innerWidth = outputBlockContentWidth(width)
    try {
      const state = statusForResult(result, options, details)
      const sections: Array<{ label?: string; lines: readonly string[]; separator?: boolean }> = []

      if (options.isPartial) {
        if (code) {
          sections.push({
            label: 'eval',
            lines: renderCodeCell({
              code,
              language: 'javascript',
              title: 'evaluating',
              status: 'running',
              spinnerFrame: options.spinnerFrame,
              width: innerWidth,
              codeTail: true,
              codeMaxLines: DEFAULT_CODE_PREVIEW_LINES,
              expanded: options.expanded,
            }, theme),
          })
        } else {
          sections.push({ label: 'eval', lines: [theme.fg('muted', cfg.runningDescription)] })
        }
        return {
          header: renderStatusLine({ icon: 'running', spinnerFrame: options.spinnerFrame, title: cfg.title, description: 'evaluating' }, theme),
          state,
          sections,
          width,
        }
      }

      const { parsed, isStructured } = tryParseJSON(rawOutput)
      const primitive = details?.primitive
      const primitiveTag = primitive?._v
      const description = primitiveTag ? primitiveTag : isStructured ? typeLabel(parsed) : undefined

      if (result.isError || details?.error) {
        if (options.expanded && code) {
          sections.push({
            label: 'eval',
            lines: renderCodeCell({
              code,
              language: 'javascript',
              title: cfg.title,
              status: 'error',
              width: innerWidth,
              expanded: true,
            }, theme),
          })
        }
        sections.push({
          label: 'error',
          lines: clampRows((rawOutput || details?.error || 'Unknown error').split('\n').map(line => theme.fg('error', line)), innerWidth),
          separator: sections.length > 0,
        })
        appendWarningSections(sections, details, theme)
        return {
          header: renderStatusLine({ icon: 'error', title: cfg.title, description }, theme),
          state,
          sections,
          width,
        }
      }

      const ctx = createOmpRenderContext(theme)
      const resultContent = primitive
        ? (ompPrimitiveRegistry.tryRenderPrimitive(primitive, innerWidth, ctx) ?? gridLines(parsed ?? rawOutput, innerWidth, ctx))
        : isStructured
          ? gridLines(parsed, innerWidth, ctx)
          : renderPlainText(rawOutput, theme)

      if (options.expanded && code) {
        sections.push({
          label: 'eval',
          lines: renderCodeCell({
            code,
            language: 'javascript',
            title: cfg.title,
            status: 'complete',
            width: innerWidth,
            expanded: true,
          }, theme),
        })
      }

      const visibleResult = options.expanded ? resultContent : resultContent.slice(0, DEFAULT_RESULT_PREVIEW_LINES)
      const outputLines = [...visibleResult]
      if (!options.expanded && resultContent.length > visibleResult.length) {
        outputLines.push(theme.fg('muted', `… ${resultContent.length - visibleResult.length} more (${OMP_EXPAND_HINT})`))
      }
      sections.push({
        label: primitiveTag ? 'primitive' : isStructured ? 'result' : 'output',
        lines: clampRows(outputLines, innerWidth),
        separator: sections.length > 0,
      })

      appendWarningSections(sections, details, theme)

      const steerData = details?.primitive ?? details?.result ?? parsed
      if ((isStructured || primitive) && steerData) {
        const annotations = renderAnnotations(steer(steerData, code), innerWidth, ctx)
        if (annotations.length > 0) {
          sections.push({ label: 'next', lines: clampRows(annotations, innerWidth), separator: true })
        }
      }

      return {
        header: renderStatusLine({ icon: iconForState(state), title: cfg.title, description }, theme),
        state,
        sections,
        width,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        header: renderStatusLine({ icon: 'error', title: cfg.title, description: 'render error' }, theme),
        state: 'error',
        sections: [
          { label: 'error', lines: [theme.fg('error', truncateToWidth(msg, innerWidth))] },
          { label: 'raw', lines: clampRows(rawOutput.split('\n').slice(0, 10), innerWidth), separator: true },
        ],
        width,
      }
    }
  })
}

function renderPlainText(rawOutput: string, theme: Theme): string[] {
  if (rawOutput.startsWith('(void')) return [theme.fg('muted', rawOutput)]
  if (!rawOutput) return [theme.fg('muted', '(empty)')]
  return rawOutput.split('\n').map(line => theme.fg('toolOutput', line))
}

function appendWarningSections(
  sections: Array<{ label?: string; lines: readonly string[]; separator?: boolean }>,
  details: MsToolDetails | undefined,
  theme: Theme,
): void {
  const lines: string[] = []
  const metaWarning = formatStyledTruncationWarning(details?.meta, theme)
  if (metaWarning) lines.push(metaWarning)

  const sanitizerWarnings = details?.sanitizerWarnings ?? []
  if (sanitizerWarnings.length > 0) {
    lines.push(theme.fg('warning', `sanitized ${sanitizerWarnings.length} non-clone-safe value${sanitizerWarnings.length === 1 ? '' : 's'}`))
    for (const warning of sanitizerWarnings.slice(0, 5)) {
      lines.push(theme.fg('muted', `• ${warning}`))
    }
    if (sanitizerWarnings.length > 5) {
      lines.push(theme.fg('muted', `• … ${sanitizerWarnings.length - 5} more`))
    }
  }

  if (lines.length > 0) {
    sections.push({ label: 'warnings', lines, separator: sections.length > 0 })
  }
}

/** Build a renderer pair bound to a consumer title. Every knob beyond the
 * title/running text stays shared - one grid, one primitive registry, one
 * steer surface across every codemode host tool. */
export function createOmpToolRenderer(options: OmpToolRendererOptions = {}) {
  const cfg: RendererCfg = {
    title: options.title ?? 'as',
    runningDescription: options.runningDescription ?? 'evaluating in isolated worker...',
  }
  return {
    renderCall: (args: { code?: string }, opts: ToolRenderResultOptions, theme: Theme) =>
      renderCallWith(cfg, args, opts, theme),
    renderResult: (result: OmpMsResult, opts: ToolRenderResultOptions, theme: Theme, args?: { code?: string }) =>
      renderResultWith(cfg, result, opts, theme, args),
    mergeCallAndResult: true,
    inline: true,
    animatedPendingPreview: true,
    animatedPartialResult: true,
    provisionalPendingPreview: 'collapsed',
    provisionalPartialResult: true,
  } as const
}

// Legacy surface: the agentstore "ms" renderer, unchanged behavior.
const defaultRenderer = createOmpToolRenderer()
export const renderCall = defaultRenderer.renderCall
export const renderResult = defaultRenderer.renderResult
export const ompMsToolRenderer = defaultRenderer
