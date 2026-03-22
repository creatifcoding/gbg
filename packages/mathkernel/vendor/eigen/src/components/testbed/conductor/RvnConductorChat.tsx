import {
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type ReactNode,
  createContext,
  useContext,
  useMemo,
} from 'react'

export type RvnConductorChatMode = 'collapsed' | 'expanded' | 'chat_full'
export type RvnConductorMessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface RvnConductorChatRootProps extends ComponentPropsWithoutRef<'section'> {
  nodeId: string
  mode: RvnConductorChatMode
  onModeChange?: (mode: RvnConductorChatMode) => void
  onExitChat?: () => void
  children: ReactNode
}

export interface RvnConductorChatStatusRowProps extends ComponentPropsWithoutRef<'div'> {
  tone?: 'info' | 'warn' | 'error'
}

export interface RvnConductorChatMessageRowBaseProps
  extends Omit<ComponentPropsWithoutRef<'article'>, 'children'> {
  role: RvnConductorMessageRole
  at?: string
  children: ReactNode
  footer?: ReactNode
}

export interface RvnConductorChatHeaderModeControlProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  targetMode?: Extract<RvnConductorChatMode, 'collapsed' | 'expanded'>
}

interface RvnConductorChatContextValue {
  nodeId: string
  mode: RvnConductorChatMode
  onModeChange?: (mode: RvnConductorChatMode) => void
  onExitChat?: () => void
}

const RvnConductorChatContext = createContext<RvnConductorChatContextValue | null>(null)

function useRvnConductorChatContext(): RvnConductorChatContextValue {
  const context = useContext(RvnConductorChatContext)
  if (!context) {
    throw new Error('RvnConductorChat compound components must be used inside RvnConductorChat.Root')
  }
  return context
}

function RvnConductorChatRoot({
  nodeId,
  mode,
  onModeChange,
  onExitChat,
  children,
  style,
  ...props
}: RvnConductorChatRootProps) {
  const value = useMemo<RvnConductorChatContextValue>(
    () => ({ nodeId, mode, onModeChange, onExitChat }),
    [nodeId, mode, onModeChange, onExitChat],
  )

  return (
    <RvnConductorChatContext.Provider value={value}>
      <section
        data-slot="rvn-conductor-chat"
        data-mode={mode}
        data-node-id={nodeId}
        style={{
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr auto',
          minHeight: 280,
          border: '2px solid #000',
          borderRadius: 0,
          background: '#fff',
          ...style,
        }}
        {...props}
      >
        {children}
      </section>
    </RvnConductorChatContext.Provider>
  )
}

function RvnConductorChatHeaderRoot({ style, ...props }: ComponentPropsWithoutRef<'header'>) {
  const { nodeId, mode } = useRvnConductorChatContext()

  return (
    <header
      data-slot="rvn-conductor-chat-header"
      data-node-id={nodeId}
      data-mode={mode}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        borderBottom: '2px solid #000',
        background: '#fff',
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--rvn-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatHeaderAgentSwitch({
  style,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="rvn-conductor-chat-header-agent-switch"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}
      {...props}
    />
  )
}

function RvnConductorChatHeaderSessionStatus({
  style,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  const { mode } = useRvnConductorChatContext()

  return (
    <div
      data-slot="rvn-conductor-chat-header-session-status"
      data-mode={mode}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 6px',
        border: '1px solid #000',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatHeaderResetSession({
  type,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type ?? 'button'}
      data-slot="rvn-conductor-chat-header-reset-session"
      style={{
        border: '1px solid #000',
        borderRadius: 0,
        padding: '2px 8px',
        background: '#fff',
        fontFamily: 'var(--rvn-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        textTransform: 'uppercase',
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatHeaderCollapseToL2({
  targetMode = 'expanded',
  type,
  onClick,
  style,
  ...props
}: RvnConductorChatHeaderModeControlProps) {
  const { onModeChange } = useRvnConductorChatContext()

  return (
    <button
      type={type ?? 'button'}
      data-slot="rvn-conductor-chat-header-collapse-to-l2"
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) {
          return
        }
        onModeChange?.(targetMode)
      }}
      style={{
        border: '1px solid #000',
        borderRadius: 0,
        padding: '2px 8px',
        background: '#fff',
        fontFamily: 'var(--rvn-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        textTransform: 'uppercase',
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatHeaderExitL3({
  type,
  onClick,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onExitChat } = useRvnConductorChatContext()

  return (
    <button
      type={type ?? 'button'}
      data-slot="rvn-conductor-chat-header-exit-l3"
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) {
          return
        }
        onExitChat?.()
      }}
      style={{
        border: '1px solid #000',
        borderRadius: 0,
        padding: '2px 8px',
        background: '#fff',
        fontFamily: 'var(--rvn-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        textTransform: 'uppercase',
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatContextRoot({ style, ...props }: ComponentPropsWithoutRef<'section'>) {
  const { nodeId } = useRvnConductorChatContext()

  return (
    <section
      data-slot="rvn-conductor-chat-context"
      data-node-id={nodeId}
      style={{
        borderBottom: '1px solid #000',
        background: '#f8f8f8',
        padding: '4px 10px',
        display: 'grid',
        gap: 4,
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatContextTopChips({
  style,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="rvn-conductor-chat-context-top-chips"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}
      {...props}
    />
  )
}

function RvnConductorChatContextInputChips({
  style,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="rvn-conductor-chat-context-input-chips"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}
      {...props}
    />
  )
}

function RvnConductorChatContextCollapseToggle({
  type,
  onClick,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { mode, onModeChange } = useRvnConductorChatContext()

  return (
    <button
      type={type ?? 'button'}
      data-slot="rvn-conductor-chat-context-collapse-toggle"
      data-mode={mode}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) {
          return
        }
        onModeChange?.(mode === 'collapsed' ? 'expanded' : 'collapsed')
      }}
      style={{
        border: '1px solid #000',
        borderRadius: 0,
        padding: '2px 8px',
        background: '#fff',
        width: 'fit-content',
        fontFamily: 'var(--rvn-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        textTransform: 'uppercase',
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatThreadRoot({ style, ...props }: ComponentPropsWithoutRef<'div'>) {
  const { nodeId } = useRvnConductorChatContext()

  return (
    <div
      data-slot="rvn-conductor-chat-thread"
      data-node-id={nodeId}
      style={{
        minHeight: 180,
        overflow: 'auto',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatStatusRow({ tone = 'info', style, ...props }: RvnConductorChatStatusRowProps) {
  const color = tone === 'error' ? '#7f1d1d' : tone === 'warn' ? '#78350f' : '#0f172a'
  const background = tone === 'error' ? '#fee2e2' : tone === 'warn' ? '#fef3c7' : '#ecfeff'

  return (
    <div
      data-slot="rvn-conductor-chat-status-row"
      data-tone={tone}
      style={{
        border: '1px solid #000',
        background,
        color,
        padding: '4px 8px',
        fontFamily: 'var(--rvn-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatErrorBanner({
  style,
  role,
  ...props
}: Omit<RvnConductorChatStatusRowProps, 'tone'>) {
  return (
    <RvnConductorChatStatusRow
      role={role ?? 'alert'}
      tone="error"
      data-slot="rvn-conductor-chat-error-banner"
      style={style}
      {...props}
    />
  )
}

function RvnConductorChatMessageRowBase({
  role,
  at,
  children,
  footer,
  style,
  ...props
}: RvnConductorChatMessageRowBaseProps) {
  const roleAccent =
    role === 'assistant'
      ? '#0e7490'
      : role === 'user'
        ? '#4338ca'
        : role === 'tool'
          ? '#a16207'
          : '#374151'

  return (
    <article
      data-slot="rvn-conductor-chat-message-row"
      data-role={role}
      style={{
        border: '1px solid #000',
        borderLeft: `3px solid ${roleAccent}`,
        background: '#fff',
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        ...style,
      }}
      {...props}
    >
      <header
        data-slot="rvn-conductor-chat-message-meta"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--rvn-font-mono)',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          textTransform: 'uppercase',
          color: '#475569',
        }}
      >
        <span>{role}</span>
        <span>{at ?? ''}</span>
      </header>

      <div
        data-slot="rvn-conductor-chat-message-body"
        style={{
          fontFamily: 'var(--rvn-font-mono)',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: '#111827',
        }}
      >
        {children}
      </div>

      {footer ? (
        <footer
          data-slot="rvn-conductor-chat-message-footer"
          style={{ display: 'flex', justifyContent: 'flex-end' }}
        >
          {footer}
        </footer>
      ) : null}
    </article>
  )
}

function RvnConductorChatUserMessage(props: Omit<RvnConductorChatMessageRowBaseProps, 'role'>) {
  return <RvnConductorChatMessageRowBase role="user" {...props} />
}

function RvnConductorChatSystemMessage(props: Omit<RvnConductorChatMessageRowBaseProps, 'role'>) {
  return <RvnConductorChatMessageRowBase role="system" {...props} />
}

function RvnConductorChatAssistantMessage(props: Omit<RvnConductorChatMessageRowBaseProps, 'role'>) {
  return <RvnConductorChatMessageRowBase role="assistant" {...props} />
}

function RvnConductorChatAssistantStreamingBody({
  style,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="rvn-conductor-chat-assistant-streaming-body"
      style={{
        opacity: 0.9,
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatAssistantFinalBody({ style, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="rvn-conductor-chat-assistant-final-body"
      style={{
        opacity: 1,
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatBreakoutAction({
  type,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type ?? 'button'}
      data-slot="rvn-conductor-chat-breakout-action"
      style={{
        border: '1px solid #000',
        borderRadius: 0,
        padding: '2px 8px',
        background: '#fff',
        fontFamily: 'var(--rvn-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        textTransform: 'uppercase',
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatComposerRoot({ style, ...props }: ComponentPropsWithoutRef<'footer'>) {
  const { nodeId } = useRvnConductorChatContext()

  return (
    <footer
      data-slot="rvn-conductor-chat-composer"
      data-node-id={nodeId}
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 2,
        borderTop: '2px solid #000',
        background: '#fff',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        ...style,
      }}
      {...props}
    />
  )
}

export interface RvnConductorChatContentEditableProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  value: string
  onValueChange: (next: string) => void
  placeholder?: string
  disabled?: boolean
}

function RvnConductorChatContentEditable({
  value,
  onValueChange,
  placeholder = 'Ask about work orders, alarms, sensors…',
  disabled = false,
  style,
  'aria-label': ariaLabel,
  ...props
}: RvnConductorChatContentEditableProps) {
  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const next = event.currentTarget.textContent ?? ''
    onValueChange(next)
  }

  return (
    <div
      data-slot="rvn-conductor-chat-contenteditable"
      role="textbox"
      aria-label={ariaLabel ?? 'Conductor message composer'}
      aria-multiline="true"
      aria-disabled={disabled}
      data-placeholder={placeholder}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      style={{
        minHeight: 96,
        maxHeight: 192,
        overflowY: 'auto',
        border: '2px solid #000',
        borderRadius: 0,
        padding: 8,
        background: disabled ? '#efefef' : '#f6f6f6',
        fontFamily: 'var(--rvn-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        outline: 'none',
        ...style,
      }}
      {...props}
    >
      {value}
    </div>
  )
}

function RvnConductorChatComposerSuggestionRail({
  style,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="rvn-conductor-chat-composer-suggestion-rail"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}
      {...props}
    />
  )
}

function RvnConductorChatComposerSuggestionPopup({
  style,
  role,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="rvn-conductor-chat-composer-suggestion-popup"
      role={role ?? 'listbox'}
      style={{ border: '1px solid #000', padding: 4, background: '#fff', ...style }}
      {...props}
    />
  )
}

function RvnConductorChatComposerPrimaryAction({
  type,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type ?? 'button'}
      data-slot="rvn-conductor-chat-composer-primary-action"
      style={{
        border: '1px solid #000',
        borderRadius: 0,
        padding: '2px 10px',
        background: '#fff',
        fontFamily: 'var(--rvn-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        textTransform: 'uppercase',
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatComposerReconnectAction({
  type,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type ?? 'button'}
      data-slot="rvn-conductor-chat-composer-reconnect-action"
      style={{
        border: '1px solid #000',
        borderRadius: 0,
        padding: '2px 10px',
        background: '#fff',
        fontFamily: 'var(--rvn-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        textTransform: 'uppercase',
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
}

function RvnConductorChatComposerSlashRoot({ style, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div data-slot="rvn-conductor-chat-composer-slash" style={{ display: 'contents', ...style }} {...props} />
  )
}

function RvnConductorChatComposerMentionRoot({
  style,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div data-slot="rvn-conductor-chat-composer-mention" style={{ display: 'contents', ...style }} {...props} />
  )
}

const Header = Object.assign(RvnConductorChatHeaderRoot, {
  Root: RvnConductorChatHeaderRoot,
  AgentSwitch: RvnConductorChatHeaderAgentSwitch,
  SessionStatus: RvnConductorChatHeaderSessionStatus,
  ResetSession: RvnConductorChatHeaderResetSession,
  CollapseToL2: RvnConductorChatHeaderCollapseToL2,
  ExitL3: RvnConductorChatHeaderExitL3,
})

const Context = Object.assign(RvnConductorChatContextRoot, {
  Root: RvnConductorChatContextRoot,
  TopChips: RvnConductorChatContextTopChips,
  InputChips: RvnConductorChatContextInputChips,
  CollapseToggle: RvnConductorChatContextCollapseToggle,
})

const AssistantMessage = Object.assign(RvnConductorChatAssistantMessage, {
  StreamingBody: RvnConductorChatAssistantStreamingBody,
  FinalBody: RvnConductorChatAssistantFinalBody,
})

const Thread = Object.assign(RvnConductorChatThreadRoot, {
  Root: RvnConductorChatThreadRoot,
  StatusRow: RvnConductorChatStatusRow,
  MessageRowBase: RvnConductorChatMessageRowBase,
  UserMessage: RvnConductorChatUserMessage,
  AssistantMessage,
  SystemMessage: RvnConductorChatSystemMessage,
  ErrorBanner: RvnConductorChatErrorBanner,
  BreakoutAction: RvnConductorChatBreakoutAction,
})

const Slash = Object.assign(RvnConductorChatComposerSlashRoot, {
  Root: RvnConductorChatComposerSlashRoot,
})

const Mention = Object.assign(RvnConductorChatComposerMentionRoot, {
  Root: RvnConductorChatComposerMentionRoot,
})

const Composer = Object.assign(RvnConductorChatComposerRoot, {
  Root: RvnConductorChatComposerRoot,
  ContentEditable: RvnConductorChatContentEditable,
  Slash,
  Mention,
  SuggestionRail: RvnConductorChatComposerSuggestionRail,
  SuggestionPopup: RvnConductorChatComposerSuggestionPopup,
  PrimaryAction: RvnConductorChatComposerPrimaryAction,
  ReconnectAction: RvnConductorChatComposerReconnectAction,
})

export const RvnConductorChat = Object.assign(RvnConductorChatRoot, {
  Root: RvnConductorChatRoot,
  Header,
  Context,
  Thread,
  Composer,
  ContentEditable: RvnConductorChatContentEditable,
})
