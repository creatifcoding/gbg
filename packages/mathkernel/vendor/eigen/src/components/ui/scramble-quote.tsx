/**
 * ScrambleQuote
 *
 * Markdown-like quote block with scramble-on-entry text animation.
 * Supports imperative replay via ref handle for timeline coordination.
 */

import { useEffect, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { useScrambleText, type ScramblePreset } from '@/lib/animation/text-effects';

export interface ScrambleQuoteProps {
  text: string;
  author?: string;
  preset?: ScramblePreset;
  className?: string;
  /** If true, don't auto-play on mount - wait for imperative replay() */
  manual?: boolean;
}

export interface ScrambleQuoteHandle {
  replay: () => void;
}

export const ScrambleQuote = forwardRef<ScrambleQuoteHandle, ScrambleQuoteProps>(
  function ScrambleQuote({ text, author, preset = 'smooth', className, manual = false }, handleRef) {
    const { ref, replay } = useScrambleText({
      text,
      preset,
      playOnMount: !manual,
    });

    // Expose replay function to parent via ref
    useImperativeHandle(handleRef, () => ({
      replay: () => replay?.(),
    }), [replay]);

    // Auto-replay when text changes (unless manual mode)
    useEffect(() => {
      if (!manual) {
        replay?.();
      }
    }, [replay, text, manual]);

    return (
      <figure
        className={cn(
          'rounded-lg border border-neutral-800 bg-neutral-950/70 px-4 py-3',
          className
        )}
      >
        <blockquote className="text-sm leading-relaxed text-neutral-200">
          "<span ref={ref} />"
        </blockquote>
        {author ? (
          <figcaption className="mt-2 text-xs font-mono text-neutral-500">
            — {author}
          </figcaption>
        ) : null}
      </figure>
    );
  }
);

