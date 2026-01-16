/**
 * @module layout/hooks/useContainerSize
 * @description ResizeObserver hook for tracking container dimensions
 */

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Container dimensions
 */
export interface ContainerSize {
  width: number
  height: number
}

/**
 * Options for useContainerSize
 */
export interface UseContainerSizeOptions {
  /** Debounce delay in ms (default: 0 - no debounce) */
  debounce?: number
  /** Initial size (for SSR) */
  initialSize?: ContainerSize
  /** Callback when size changes */
  onResize?: (size: ContainerSize) => void
}

/**
 * Hook to track container dimensions using ResizeObserver
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { ref, size } = useContainerSize()
 *   return (
 *     <div ref={ref}>
 *       Width: {size.width}, Height: {size.height}
 *     </div>
 *   )
 * }
 * ```
 */
export function useContainerSize<T extends HTMLElement = HTMLDivElement>(
  options: UseContainerSizeOptions = {}
): {
  ref: React.RefObject<T>
  size: ContainerSize
} {
  const { debounce = 0, initialSize = { width: 0, height: 0 }, onResize } = options

  const ref = useRef<T>(null)
  const [size, setSize] = useState<ContainerSize>(initialSize)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateSize = useCallback(
    (entry: ResizeObserverEntry) => {
      const { width, height } = entry.contentRect
      const newSize = { width, height }

      if (debounce > 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          setSize(newSize)
          onResize?.(newSize)
        }, debounce)
      } else {
        setSize(newSize)
        onResize?.(newSize)
      }
    },
    [debounce, onResize]
  )

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        updateSize(entry)
      }
    })

    observer.observe(element)

    // Get initial size
    const rect = element.getBoundingClientRect()
    setSize({ width: rect.width, height: rect.height })

    return () => {
      observer.disconnect()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [updateSize])

  return { ref: ref as React.RefObject<T>, size }
}

/**
 * Hook variant that returns only width (optimized for horizontal layouts)
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(
  options: Omit<UseContainerSizeOptions, "onResize"> & {
    onResize?: (width: number) => void
  } = {}
): {
  ref: React.RefObject<T>
  width: number
} {
  const { onResize, ...rest } = options
  const { ref, size } = useContainerSize<T>({
    ...rest,
    onResize: onResize ? (s) => onResize(s.width) : undefined,
  })
  return { ref, width: size.width }
}

/**
 * Hook variant that returns only height (optimized for vertical layouts)
 */
export function useContainerHeight<T extends HTMLElement = HTMLDivElement>(
  options: Omit<UseContainerSizeOptions, "onResize"> & {
    onResize?: (height: number) => void
  } = {}
): {
  ref: React.RefObject<T>
  height: number
} {
  const { onResize, ...rest } = options
  const { ref, size } = useContainerSize<T>({
    ...rest,
    onResize: onResize ? (s) => onResize(s.height) : undefined,
  })
  return { ref, height: size.height }
}

/**
 * Hook that provides both ref and a measure function
 * Useful when you need to measure on-demand rather than continuously
 */
export function useContainerMeasure<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T>
  measure: () => ContainerSize
} {
  const ref = useRef<T>(null)

  const measure = useCallback((): ContainerSize => {
    if (!ref.current) return { width: 0, height: 0 }
    const rect = ref.current.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }, [])

  return { ref: ref as React.RefObject<T>, measure }
}
