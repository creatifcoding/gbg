import { useLayoutEffect, useMemo, useRef } from 'react';
import type { MutableRefObject, ReactNode, Ref } from 'react';

import { cn } from '../../tmnl-ui/utils/cn';

export type LayoutGuardMode = 'none' | 'transform' | 'flip';

type LayoutGuardProps = {
  mode?: LayoutGuardMode;
  layoutKey?: string | number;
  className?: string;
  durationMs?: number;
  easing?: string;
  containerRef?: Ref<HTMLDivElement>;
  contentRef?: Ref<HTMLDivElement>;
  lockParent?: boolean;
  children: ReactNode;
};

const DEFAULT_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as MutableRefObject<T | null>).current = value;
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (value: T | null) => {
    refs.forEach((ref) => assignRef(ref, value));
  };
}

export function LayoutGuard({
  mode = 'none',
  layoutKey,
  className,
  durationMs = 320,
  easing = DEFAULT_EASING,
  containerRef,
  contentRef,
  lockParent = true,
  children,
}: LayoutGuardProps) {
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const internalContentRef = useRef<HTMLDivElement>(null);
  const previousContentRectRef = useRef<DOMRect | null>(null);
  const previousContainerRectRef = useRef<DOMRect | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const lockTimeoutRef = useRef<number | null>(null);

  const mergedContainerRef = useMemo(
    () => mergeRefs(containerRef, internalContainerRef),
    [containerRef]
  );
  const mergedContentRef = useMemo(
    () => mergeRefs(contentRef, internalContentRef),
    [contentRef]
  );

  useLayoutEffect(() => {
    const contentEl = internalContentRef.current;
    const containerEl = internalContainerRef.current;
    if (!contentEl) return;

    if (animationRef.current) {
      animationRef.current.cancel();
      animationRef.current = null;
    }
    if (lockTimeoutRef.current) {
      window.clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }

    const shouldLock = lockParent && mode !== 'none' && containerEl;
    if (shouldLock && containerEl) {
      const previousSize =
        previousContainerRectRef.current ?? containerEl.getBoundingClientRect();
      containerEl.style.width = `${previousSize.width}px`;
      containerEl.style.height = `${previousSize.height}px`;
      containerEl.style.minWidth = `${previousSize.width}px`;
      containerEl.style.minHeight = `${previousSize.height}px`;
      containerEl.style.maxWidth = `${previousSize.width}px`;
      containerEl.style.maxHeight = `${previousSize.height}px`;
      containerEl.style.overflow = 'hidden';
    }

    if (mode === 'transform') {
      animationRef.current = contentEl.animate(
        [
          { transform: 'translate3d(0px, 8px, 0px) scale(0.98)' },
          { transform: 'translate3d(0px, 0px, 0px) scale(1)' },
        ],
        { duration: durationMs, easing, fill: 'both' }
      );
      previousContentRectRef.current = contentEl.getBoundingClientRect();
      previousContainerRectRef.current = containerEl?.getBoundingClientRect() ?? null;
      return;
    }

    if (mode === 'flip') {
      const previousRect = previousContentRectRef.current;
      const nextRect = contentEl.getBoundingClientRect();

      if (previousRect) {
        const deltaX = previousRect.left - nextRect.left;
        const deltaY = previousRect.top - nextRect.top;
        const scaleX = previousRect.width / Math.max(nextRect.width, 1);
        const scaleY = previousRect.height / Math.max(nextRect.height, 1);

        if (
          deltaX !== 0 ||
          deltaY !== 0 ||
          Math.abs(scaleX - 1) > 0.001 ||
          Math.abs(scaleY - 1) > 0.001
        ) {
          animationRef.current = contentEl.animate(
            [
              {
                transform: `translate3d(${deltaX}px, ${deltaY}px, 0px) scale(${scaleX}, ${scaleY})`,
              },
              { transform: 'translate3d(0px, 0px, 0px) scale(1)' },
            ],
            { duration: durationMs, easing, fill: 'both' }
          );
        }
      }
      previousContentRectRef.current = nextRect;
      previousContainerRectRef.current = containerEl?.getBoundingClientRect() ?? null;
      return;
    }

    previousContentRectRef.current = contentEl.getBoundingClientRect();
    previousContainerRectRef.current = containerEl?.getBoundingClientRect() ?? null;
  }, [durationMs, easing, layoutKey, lockParent, mode]);

  useLayoutEffect(() => {
    if (!lockParent || mode === 'none') return;
    const containerEl = internalContainerRef.current;
    if (!containerEl) return;

    lockTimeoutRef.current = window.setTimeout(() => {
      containerEl.style.removeProperty('width');
      containerEl.style.removeProperty('height');
      containerEl.style.removeProperty('min-width');
      containerEl.style.removeProperty('min-height');
      containerEl.style.removeProperty('max-width');
      containerEl.style.removeProperty('max-height');
      containerEl.style.removeProperty('overflow');
      lockTimeoutRef.current = null;
    }, durationMs + 60);

    return () => {
      if (lockTimeoutRef.current) {
        window.clearTimeout(lockTimeoutRef.current);
        lockTimeoutRef.current = null;
      }
      containerEl.style.removeProperty('width');
      containerEl.style.removeProperty('height');
      containerEl.style.removeProperty('min-width');
      containerEl.style.removeProperty('min-height');
      containerEl.style.removeProperty('max-width');
      containerEl.style.removeProperty('max-height');
      containerEl.style.removeProperty('overflow');
    };
  }, [durationMs, lockParent, mode]);

  return (
    <div ref={mergedContainerRef} className={cn('relative', className)}>
      <div
        ref={mergedContentRef}
        data-layout-guard-content
        style={{ willChange: mode === 'none' ? undefined : 'transform' }}
      >
        {children}
      </div>
    </div>
  );
}
