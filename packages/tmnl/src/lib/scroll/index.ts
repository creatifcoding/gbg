/**
 * @module scroll
 *
 * Domain-agnostic scroll primitives for tail-following, sentinel-based
 * scroll tracking, and container-scoped scroll operations.
 *
 * Extracted from agent-task log viewer — battle-tested with IntersectionObserver,
 * interrupt detection (scroll/wheel/mouse/touch/keyboard), re-engagement guards,
 * and reduced-motion awareness.
 *
 * Usage:
 * ```tsx
 * import { useTailFollow } from '@/lib/scroll'
 *
 * const tf = useTailFollow(items.length)
 *
 * <div ref={tf.scrollRef} {...tf.tailInterruptProps}>
 *   <div ref={tf.head.ref} className="h-px" />
 *   {items.map(renderItem)}
 *   <div ref={tf.tail.ref} className="h-px" />
 * </div>
 * ```
 */

// Scroll anchors — low-level primitives
export {
  scrollInContainer,
  useScrollAnchor,
  useScrollPointer,
  type ScrollAnchorOptions,
  type ScrollAnchorHandle,
  type ScrollPointerOptions,
  type ScrollPointerHandle,
} from './scroll-anchors'

// Tail-follow controller — composed from anchors
export {
  useTailFollow,
  type TailMode,
  type TailFollowConfig,
  type TailFollowHandle,
  type TailInterruptProps,
} from './use-tail-follow'
