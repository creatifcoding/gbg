import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type MutableRefObject,
} from 'react'
import { cn } from '@/lib/utils'

function mergeRefs<T>(
  ...refs: Array<MutableRefObject<T | null> | ((value: T | null) => void) | null | undefined>
) {
  return (value: T | null) => {
    refs.forEach((ref) => {
      if (!ref) return
      if (typeof ref === 'function') {
        ref(value)
      } else {
        ref.current = value
      }
    })
  }
}

export interface RvnComposerContentEditableProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange' | 'children'> {
  value?: string
  defaultValue?: string
  onValueChange?: (next: string) => void
  placeholder?: string
  disabled?: boolean
}

export const RvnComposerContentEditable = forwardRef<HTMLDivElement, RvnComposerContentEditableProps>(
  (
    {
      value,
      defaultValue = '',
      onValueChange,
      placeholder = 'Ask about work orders, alarms, sensors...',
      disabled = false,
      className,
      onInput,
      ...props
    },
    ref,
  ) => {
    const isControlled = value !== undefined
    const [internalValue, setInternalValue] = useState(defaultValue)
    const resolvedValue = isControlled ? value : internalValue
    const elementRef = useRef<HTMLDivElement | null>(null)

    const setResolvedValue = useCallback(
      (next: string) => {
        if (!isControlled) {
          setInternalValue(next)
        }
        onValueChange?.(next)
      },
      [isControlled, onValueChange],
    )

    useEffect(() => {
      const element = elementRef.current
      if (!element) return
      const currentText = element.textContent ?? ''
      if (currentText !== resolvedValue) {
        element.textContent = resolvedValue
      }
    }, [resolvedValue])

    const handleInput = useCallback(
      (event: FormEvent<HTMLDivElement>) => {
        const next = event.currentTarget.textContent ?? ''
        setResolvedValue(next)
        onInput?.(event)
      },
      [onInput, setResolvedValue],
    )

    const mergedRef = useMemo(
      () => mergeRefs<HTMLDivElement>(elementRef, ref),
      [ref],
    )

    return (
      <div
        ref={mergedRef}
        role="textbox"
        aria-multiline="true"
        aria-disabled={disabled}
        data-slot="rvn-chat-composer-contenteditable"
        data-placeholder={placeholder}
        data-empty={(resolvedValue ?? '').trim().length === 0 || undefined}
        contentEditable={!disabled}
        suppressContentEditableWarning
        className={cn('rvn-chat__composer-input', className)}
        onInput={handleInput}
        {...props}
      />
    )
  },
)

RvnComposerContentEditable.displayName = 'RvnComposerContentEditable'
