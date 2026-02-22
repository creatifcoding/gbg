/**
 * TUI renderer for questionnaires.
 *
 * Subscribes to atoms via Registry.subscribe → tui.requestRender().
 * Returns plain { render, handleInput, invalidate }.
 */

import { Key, matchesKey, truncateToWidth, visibleWidth } from '@mariozechner/pi-tui'
import { stateAtom, progressAtom, get, subscribe, type QuestionnaireState } from './atoms.ts'
import * as Engine from './engine.ts'
import type { Questionnaire, QuestionnaireResult } from './schema.ts'
import type { DynamicHookResolver } from './engine.ts'

interface RendererOptions {
  tui: any
  theme: any
  done: (result: QuestionnaireResult) => void
  spec: Questionnaire
  dynamicResolver?: DynamicHookResolver
}

const DEFAULT_DYNAMIC_TIMEOUT_MS = 10_000

function resolveDynamicTimeoutMs(state: QuestionnaireState): number {
  const payload = (typeof state.current?.nextHook?.payload === 'object' && state.current?.nextHook?.payload && !Array.isArray(state.current?.nextHook?.payload))
    ? state.current.nextHook.payload as Record<string, unknown>
    : {}

  const perHook = typeof payload.timeoutMs === 'number' ? payload.timeoutMs : undefined
  const fromEnv = Number(process.env.QUESTIONNAIRE_DYNAMIC_TIMEOUT_MS ?? DEFAULT_DYNAMIC_TIMEOUT_MS)
  const raw = perHook ?? fromEnv
  return Math.max(1_000, Math.min(120_000, Math.round(raw)))
}

function formatRemainingMs(ms: number): string {
  if (ms <= 0) return '0.0s'
  return `${(ms / 1000).toFixed(1)}s`
}

export function createRenderer({ tui, theme, done, spec, dynamicResolver }: RendererOptions) {
  let cache: string[] | undefined
  let pendingTicker: ReturnType<typeof setInterval> | null = null

  const stopPendingTicker = () => {
    if (!pendingTicker) return
    clearInterval(pendingTicker)
    pendingTicker = null
  }

  const syncPendingTicker = (state: QuestionnaireState) => {
    if (state.dynamicPending) {
      if (!pendingTicker) {
        pendingTicker = setInterval(() => {
          cache = undefined
          tui.requestRender()
        }, 100)
      }
      return
    }
    stopPendingTicker()
  }

  // Subscribe FIRST, then start — registry must see listeners before writes
  const unsub = subscribe(stateAtom, (s) => {
    syncPendingTicker(s)
    cache = undefined
    tui.requestRender()

    if (s.status === 'complete' || s.status === 'cancelled') {
      stopPendingTicker()
      unsub()
      done(Engine.getResult())
    }
  })

  // Now start — subscription is already live
  Engine.start(spec, { dynamicResolver })

  function refresh() {
    cache = undefined
    tui.requestRender()
  }

  // =========================================================================
  // Render
  // =========================================================================

  function render(width: number): string[] {
    if (cache) return cache
    const t = theme
    const s = get(stateAtom)
    const prog = get(progressAtom)
    const lines: string[] = []
    const add = (str: string) => lines.push(truncateToWidth(str, width))
    const addWithGutter = (
      left: string,
      gutterLabel: string,
      gutterTone: 'warning' | 'muted' | 'accent' = 'muted',
    ) => {
      const gutter = t.fg(gutterTone, `│ ${gutterLabel}`)
      const gutterW = visibleWidth(gutter)
      if (gutterW >= width) {
        lines.push(truncateToWidth(gutter, width))
        return
      }

      const minGap = 1
      const leftBudget = Math.max(0, width - gutterW - minGap)
      const leftText = truncateToWidth(left, leftBudget)
      const leftW = visibleWidth(leftText)
      const gap = Math.max(minGap, width - leftW - gutterW)
      lines.push(leftText + ' '.repeat(gap) + gutter)
    }

    // Header
    add(t.fg('accent', '─'.repeat(width)))
    const title = t.bold(t.fg('accent', ` ◆ ${spec.title} `))
    const pct = t.fg('dim', `(${prog.answered}/${prog.total})`)
    add(`${title} ${pct}`)
    if (spec.description) {
      add(t.fg('dim', `  ${spec.description}`))
    }
    add(t.fg('accent', '─'.repeat(width)))

    if (!s.current) {
      add(t.fg('dim', '  (no current question)'))
      cache = lines
      return lines
    }

    const q = s.current

    // Progress breadcrumb
    if (s.history.length > 0) {
      const crumbs = s.history.map(id => {
        const ans = s.answers.get(id)
        return ans && ans.length > 0 ? t.fg('success', '■') : t.fg('dim', '□')
      }).join(' ')
      add(` ${crumbs} ${t.fg('warning', '▸')}`)
      lines.push('')
    }

    // Question prompt
    add(t.fg('text', `  ${q.prompt}`))
    if (s.dynamicPending) {
      const timeoutMs = resolveDynamicTimeoutMs(s)
      const elapsedMs = s.dynamicPendingSinceMs ? Math.max(0, Date.now() - s.dynamicPendingSinceMs) : 0
      const remainingMs = Math.max(0, timeoutMs - elapsedMs)

      if (s.dynamicInterruptRequested) {
        addWithGutter('  Interrupt requested. Falling back to static branch…', '⟲ INT', 'warning')
      } else {
        addWithGutter('  Dynamic branch resolver active', `⟳ ${formatRemainingMs(remainingMs)}`, 'warning')
        addWithGutter('  Esc/Ctrl+C interrupt · Q cancel survey', 'ops', 'muted')
      }
    }
    lines.push('')

    const opts = Engine.getOptions(s)
    const answers = Engine.getCurrentAnswers(s)
    const answerByValue = new Map(answers.map(a => [a.value, a]))

    if (q.type === 'input' || s.inputMode) {
      const prompt = s.inputKind === 'note'
        ? (q.elaborationPrompt ?? spec.defaultElaborationPrompt ?? 'Add notes')
        : (q.placeholder ?? 'Type here')

      const targetLabel = s.inputKind === 'note' && s.inputTarget
        ? ` for ${s.inputTarget.label}`
        : ''

      add(t.fg('dim', `  ${prompt}${targetLabel}:`))
      add(`  ${t.fg('accent', '> ')}${s.inputText}${t.fg('dim', '█')}`)
      lines.push('')
      add(t.fg('dim', '  Enter submit · Esc cancel'))
    } else if (q.type === 'select' || q.type === 'confirm') {
      for (let i = 0; i < opts.length; i++) {
        const opt = opts[i]
        const selected = i === s.optionIndex
        const prefix = selected ? t.fg('accent', ' ▸ ') : '   '
        const color = selected ? 'accent' : 'text'
        add(prefix + t.fg(color, opt.label))
        if (opt.description) {
          add(`     ${t.fg('muted', opt.description)}`)
        }
      }
    } else if (q.type === 'multi-select') {
      for (let i = 0; i < opts.length; i++) {
        const opt = opts[i]
        const selected = i === s.optionIndex
        const picked = answerByValue.has(opt.value)
        const note = answerByValue.get(opt.value)?.note
        const prefix = selected ? t.fg('accent', ' ▸ ') : '   '
        const mark = picked ? t.fg('success', '✓') : t.fg('dim', ' ')
        add(prefix + t.fg(selected ? 'accent' : 'text', `[${mark}] ${opt.label}`))
        if (note) {
          add(`     ${t.fg('muted', note)}`)
        }
      }
    }

    // Footer
    lines.push('')
    const help: string[] = []

    if (s.dynamicPending) {
      help.push('Esc/Ctrl+C interrupt')
    } else if (q.type === 'multi-select') {
      help.push('↑↓ select')
      help.push('Space toggle')
      help.push('Enter note')
      help.push('S submit')
    } else if (q.type !== 'input' && !s.inputMode) {
      help.push('↑↓ select')
      help.push('Enter confirm')
    } else {
      help.push('Enter submit')
    }

    if (s.history.length > 0 && !s.dynamicPending) help.push('← back')
    help.push(s.dynamicPending ? 'Q cancel survey' : 'Esc cancel')
    add(t.fg('dim', `  ${help.join(' · ')}`))
    add(t.fg('accent', '─'.repeat(width)))

    cache = lines
    return lines
  }

  // =========================================================================
  // Input
  // =========================================================================

  function handleInput(data: string) {
    const s = get(stateAtom)
    if (!s.current || s.status !== 'active') return

    if (s.dynamicPending) {
      if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl('c'))) {
        Engine.interruptDynamicPending()
        return
      }
      if (matchesKey(data, 'q') || matchesKey(data, Key.shift('q'))) {
        Engine.cancel()
        return
      }
      // lock navigation/selection while dynamic microagent is producing next step
      return
    }

    // Cancel
    if (matchesKey(data, Key.escape)) {
      if (s.inputMode) {
        void Engine.cancelInput()
        return
      }
      Engine.cancel()
      return
    }

    // Input mode
    if (s.current.type === 'input' || s.inputMode) {
      if (matchesKey(data, Key.enter)) {
        void Engine.submitInput()
        return
      }
      if (matchesKey(data, Key.backspace)) {
        if (s.inputText.length > 0) {
          Engine.setInputText(s.inputText.slice(0, -1))
        }
        return
      }
      // Printable char
      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        Engine.setInputText(s.inputText + data)
        return
      }
      return
    }

    // Back
    if (matchesKey(data, Key.left)) {
      if (s.history.length > 0) {
        Engine.back()
      }
      return
    }

    // Navigation
    if (matchesKey(data, Key.up) || matchesKey(data, 'k')) {
      Engine.moveOption(-1)
      return
    }
    if (matchesKey(data, Key.down) || matchesKey(data, 'j')) {
      Engine.moveOption(1)
      return
    }

    const opts = Engine.getOptions(s)
    const opt = opts[s.optionIndex]
    if (!opt) return

    // Multi-select
    if (s.current.type === 'multi-select') {
      const existing = s.answers.get(s.current.id) ?? []
      const isSelected = existing.some(a => a.value === opt.value)

      if (matchesKey(data, Key.space)) {
        Engine.toggleMulti(opt.value, opt.label)
        return
      }
      if (matchesKey(data, 's') || matchesKey(data, 'S')) {
        void Engine.submitMulti()
        return
      }
      if (matchesKey(data, Key.enter)) {
        if (s.current.elaboration) {
          if (!isSelected) {
            Engine.toggleMulti(opt.value, opt.label)
          }
          Engine.editMultiNote({ value: opt.value, label: opt.label })
        } else {
          Engine.toggleMulti(opt.value, opt.label)
        }
        return
      }
      return
    }

    // Confirm/select
    if (matchesKey(data, Key.enter)) {
      if (opt.isOther) {
        Engine.openInput('answer')
        return
      }

      void Engine.selectOption(opt.value, opt.label)
      return
    }
  }

  return {
    render,
    handleInput,
    invalidate() { cache = undefined },
  }
}
