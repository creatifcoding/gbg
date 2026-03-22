import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type MutableRefObject,
  type Ref,
  type UIEvent,
} from 'react'
import { cn } from '@/lib/utils'
import { RVN_CHAT_SHELL_SCROLL_CONTRACT, resolveRvnChatShellThreadScrollStyle } from '../scroll-contract'

export type RvnChatThreadAutoScrollMode = 'off' | 'follow' | 'lock'

export interface RvnChatThreadBandProps extends ComponentPropsWithoutRef<'div'> {
  autoScroll?: RvnChatThreadAutoScrollMode
  bottomThreshold?: number
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === 'function') {
    ref(value)
    return
  }
  ;(ref as MutableRefObject<T | null>).current = value
}

export const RvnChatThreadBand = forwardRef<HTMLDivElement, RvnChatThreadBandProps>(
  (
    {
      className,
      style,
      children,
      autoScroll = 'off',
      bottomThreshold = 24,
      onScroll,
      ...props
    },
    ref,
  ) => {
    const localRef = useRef<HTMLDivElement | null>(null)
    const isProgrammaticScrollRef = useRef(false)
    const atBottomRef = useRef(true)

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node
        assignRef(ref, node)
      },
      [ref],
    )

    const distanceFromBottom = useCallback((node: HTMLDivElement) => {
      return node.scrollHeight - node.scrollTop - node.clientHeight
    }, [])

    const updateAtBottom = useCallback(() => {
      const node = localRef.current
      if (!node) return
      atBottomRef.current = distanceFromBottom(node) <= bottomThreshold
    }, [bottomThreshold, distanceFromBottom])

    const scrollToBottom = useCallback(() => {
      const node = localRef.current
      if (!node) return

      isProgrammaticScrollRef.current = true
      node.scrollTop = node.scrollHeight

      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false
        updateAtBottom()
      })
    }, [updateAtBottom])

    useLayoutEffect(() => {
      if (autoScroll === 'off') {
        return
      }

      if (autoScroll === 'lock' || atBottomRef.current) {
        scrollToBottom()
      }
    }, [autoScroll, children, scrollToBottom])

    useEffect(() => {
      const node = localRef.current
      if (!node) {
        return
      }

      updateAtBottom()

      if (typeof ResizeObserver === 'undefined') {
        return
      }

      const observer = new ResizeObserver(() => {
        if (autoScroll === 'off') {
          return
        }

        if (autoScroll === 'lock' || atBottomRef.current) {
          scrollToBottom()
        }
      })

      observer.observe(node)

      return () => {
        observer.disconnect()
      }
    }, [autoScroll, scrollToBottom, updateAtBottom])

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
      updateAtBottom()

      if (autoScroll === 'lock' && !isProgrammaticScrollRef.current) {
        scrollToBottom()
      }

      onScroll?.(event)
    }

    return (
      <div
        ref={setRefs}
        data-slot="rvn-chat-shell-thread-band"
        data-scroll-contract={RVN_CHAT_SHELL_SCROLL_CONTRACT.id}
        className={cn('rvn-chat__thread', 'rvn-chat-shell__thread-band', className)}
        style={resolveRvnChatShellThreadScrollStyle(style)}
        onScroll={handleScroll}
        {...props}
      >
        {children}
      </div>
    )
  },
)

RvnChatThreadBand.displayName = 'RvnChatShell.ThreadBand'
