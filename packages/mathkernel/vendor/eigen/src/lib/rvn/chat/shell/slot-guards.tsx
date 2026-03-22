import { Children, isValidElement, useEffect, type ReactNode } from 'react'

export type RvnChatShellSlotGuardMode = 'off' | 'warn' | 'strict'

export const RVN_CHAT_SHELL_REQUIRED_BANDS = [
  'rvn-chat-shell-header-band',
  'rvn-chat-shell-command-band',
  'rvn-chat-shell-thread-band',
  'rvn-chat-shell-composer-band',
] as const

export type RvnChatShellRequiredBandSlot = (typeof RVN_CHAT_SHELL_REQUIRED_BANDS)[number]

export function collectRvnChatShellBandSlots(children: ReactNode): ReadonlyArray<string> {
  const slots: string[] = []

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return
    }

    const slot = (child.props as { 'data-slot'?: unknown })['data-slot']
    if (typeof slot === 'string') {
      slots.push(slot)
    }
  })

  return slots
}

export function evaluateRvnChatShellSlotGuards(children: ReactNode): ReadonlyArray<string> {
  const slots = collectRvnChatShellBandSlots(children)
  const errors: string[] = []

  for (const required of RVN_CHAT_SHELL_REQUIRED_BANDS) {
    if (!slots.includes(required)) {
      errors.push(`missing required shell band slot: ${required}`)
    }
  }

  for (const required of RVN_CHAT_SHELL_REQUIRED_BANDS) {
    const count = slots.filter((slot) => slot === required).length
    if (count > 1) {
      errors.push(`duplicate shell band slot: ${required} (${count})`)
    }
  }

  return errors
}

export interface UseRvnChatShellSlotGuardsOptions {
  mode?: RvnChatShellSlotGuardMode
  componentName?: string
}

export function useRvnChatShellSlotGuards(
  children: ReactNode,
  { mode = 'off', componentName = 'RvnChatShell.Root' }: UseRvnChatShellSlotGuardsOptions = {},
) {
  const errors = mode === 'off' ? [] : evaluateRvnChatShellSlotGuards(children)

  if (mode === 'strict' && errors.length > 0) {
    throw new Error(`${componentName} slot guard failure:\n- ${errors.join('\n- ')}`)
  }

  useEffect(() => {
    if (mode !== 'warn' || errors.length === 0) {
      return
    }

    console.warn(`${componentName} slot guard warnings:\n- ${errors.join('\n- ')}`)
  }, [componentName, errors, mode])

  return errors
}

export interface RvnChatShellSlotGuardsProps {
  children: ReactNode
  mode?: RvnChatShellSlotGuardMode
  componentName?: string
}

export function RvnChatShellSlotGuards({
  children,
  mode = 'off',
  componentName = 'RvnChatShell.Root',
}: RvnChatShellSlotGuardsProps) {
  useRvnChatShellSlotGuards(children, { mode, componentName })
  return null
}
