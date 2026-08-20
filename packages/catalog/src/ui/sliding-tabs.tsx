import { useLayoutEffect, useRef } from 'react'

type TabOption<T extends string> = {
  readonly value: T
  readonly label: string
}

export function SlidingTabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: ReadonlyArray<TabOption<T>>
  onChange: (value: T) => void
  ariaLabel: string
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const bar = barRef.current
    const pill = pillRef.current
    if (!bar || !pill) return
    const active = bar.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!active) return
    const prev = pill.style.transition
    pill.style.transition = 'none'
    pill.style.transform = `translateX(${active.offsetLeft}px)`
    pill.style.width = `${active.offsetWidth}px`
    void pill.offsetWidth
    pill.style.transition = prev
  }, [value, options])

  return (
    <div ref={barRef} className="t-tabs catalog-sans" role="tablist" aria-label={ariaLabel}>
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="t-tab"
          role="tab"
          aria-selected={value === option.value}
          onClick={(event) => {
            const pill = pillRef.current
            const tab = event.currentTarget
            if (pill) {
              pill.style.transform = `translateX(${tab.offsetLeft}px)`
              pill.style.width = `${tab.offsetWidth}px`
            }
            onChange(option.value)
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
