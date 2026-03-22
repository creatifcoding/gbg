/**
 * TMNL Fader Controller
 *
 * Vertical fader control for parameter adjustment.
 * Extracted from tmnl-ui.tsx for modular encapsulation.
 */

import { useRef, useCallback } from 'react';

// =============================================================================
// FADER
// =============================================================================

export interface FaderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  height?: number;
}

export function Fader({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  height = 60,
}: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const percent = ((value - min) / (max - min)) * 100;

  const handleInteraction = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct =
        1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const rawValue = min + pct * (max - min);
      const steppedValue = Math.round(rawValue / step) * step;
      onChange(Math.max(min, Math.min(max, steppedValue)));
    },
    [min, max, step, onChange]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleInteraction(e.clientY);

      const onMove = (ev: PointerEvent) => handleInteraction(ev.clientY);
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [handleInteraction]
  );

  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && (
        <span
          className="font-mono uppercase text-neutral-500 tracking-wider"
          style={{ fontSize: 'calc(var(--tmnl-text-xs, 12px) * 0.6)' }}
        >
          {label}
        </span>
      )}
      <div
        className="relative w-5 cursor-pointer touch-none flex justify-center"
        style={{ height }}
        onPointerDown={handlePointerDown}
      >
        <div
          ref={trackRef}
          className="absolute top-0 bottom-0 w-1 bg-neutral-900 border border-neutral-800"
        >
          <div
            className="absolute left-0 right-0 bottom-0 bg-neutral-600"
            style={{ height: `${percent}%` }}
          />
        </div>
        <div
          className="absolute w-4 h-2.5 bg-neutral-800 border border-neutral-600"
          style={{ bottom: `${percent}%`, transform: 'translateY(50%)' }}
        >
          <div className="absolute inset-0.5 bg-neutral-700 flex items-center justify-center">
            <div className="w-2 h-0.5 bg-white/50" />
          </div>
        </div>
      </div>
      <span
        className="font-mono text-neutral-400 tabular-nums"
        style={{ fontSize: 'calc(var(--tmnl-text-xs, 12px) * 0.7)' }}
      >
        {value.toFixed(1)}
      </span>
    </div>
  );
}
