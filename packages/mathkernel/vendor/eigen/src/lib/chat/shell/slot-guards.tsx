import { Children, isValidElement, useEffect, type ReactNode } from 'react'

export type ChatShellSlotGuardMode = 'off' | 'warn' | 'strict'

export const CHAT_SHELL_REQUIRED_BANDS = [
  'tmnl-chat-shell-header-band',
  'tmnl-chat-shell-command-band',
  'tmnl-chat-shell-thread-band',
  'tmnl-chat-shell-composer-band',
] as const

export type ChatShellRequiredBandSlot = (typeof CHAT_SHELL_REQUIRED_BANDS)[number]

export function collectChatShellBandSlots(children: ReactNode): ReadonlyArray<string> {
  const slots: string[] = []

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return

    const slot = (child.props as { 'data-slot'?: unknown })['data-slot']
    if (typeof slot === 'string') {
      slots.push(slot)
    }
  })

  return slots
}

export function evaluateChatShellSlotGuards(children: ReactNode): ReadonlyArray<string> {
  const slots = collectChatShellBandSlots(children)
  const errors: string[] = []

  for (const required of CHAT_SHELL_REQUIRED_BANDS) {
    if (!slots.includes(required)) {
      errors.push(`missing required shell band slot: ${required}`)
    }
  }

  for (const required of CHAT_SHELL_REQUIRED_BANDS) {
    const count = slots.filter((slot) => slot === required).length
    if (count > 1) {
      errors.push(`duplicate shell band slot: ${required} (${count})`)
    }
  }

  return errors
}

export interface UseChatShellSlotGuardsOptions {
  mode?: ChatShellSlotGuardMode
  componentName?: string
}

export function useChatShellSlotGuards(
  children: ReactNode,
  { mode = 'off', componentName = 'ChatShell.Root' }: UseChatShellSlotGuardsOptions = {},
) {
  const errors = mode === 'off' ? [] : evaluateChatShellSlotGuards(children)

  if (mode === 'strict' && errors.length > 0) {
    throw new Error(`${componentName} slot guard failure:\n- ${errors.join('\n- ')}`)
  }

  useEffect(() => {
    if (mode !== 'warn' || errors.length === 0) return
    console.warn(`${componentName} slot guard warnings:\n- ${errors.join('\n- ')}`)
  }, [componentName, errors, mode])

  return errors
}

export interface ChatShellSlotGuardsProps {
  children: ReactNode
  mode?: ChatShellSlotGuardMode
  componentName?: string
}

export function ChatShellSlotGuards({
  children,
  mode = 'off',
  componentName = 'ChatShell.Root',
}: ChatShellSlotGuardsProps) {
  useChatShellSlotGuards(children, { mode, componentName })
  return null
}
