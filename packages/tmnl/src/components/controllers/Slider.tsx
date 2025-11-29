/**
 * TMNL Slider Controller
 *
 * Horizontal slider control for parameter adjustment.
 * Extracted from tmnl-ui.tsx for modular encapsulation.
 */

import { useRef, useCallback } from 'react';

// =============================================================================
// SLIDER
// =============================================================================

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const percent = ((value - min) / (max - min)) * 100;

  const handleInteraction = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
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
      handleInteraction(e.clientX);

      const onMove = (ev: PointerEvent) => handleInteraction(ev.clientX);
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
    <div className="flex flex-col gap-0.5 w-full">
      {label && (
        <div className="flex justify-between">
          <span
            className="font-mono uppercase text-neutral-500 tracking-wider"
            style={{ fontSize: 'calc(var(--tmnl-text-xs, 12px) * 0.6)' }}
          >
            {label}
          </span>
          <span
            className="font-mono text-neutral-400 tabular-nums"
            style={{ fontSize: 'calc(var(--tmnl-text-xs, 12px) * 0.6)' }}
          >
            {value.toFixed(1)}
          </span>
        </div>
      )}
      <div
        className="relative h-4 cursor-pointer touch-none flex items-center"
        onPointerDown={handlePointerDown}
      >
        <div
          ref={trackRef}
          className="absolute left-0 right-0 h-1 bg-neutral-900 border border-neutral-800"
        >
          <div
            className="absolute top-0 left-0 bottom-0 bg-neutral-600"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div
          className="absolute w-3 h-3 -translate-x-1/2 bg-neutral-800 border border-neutral-600"
          style={{ left: `${percent}%` }}
        >
          <div className="absolute inset-0.5 bg-neutral-700 flex items-center justify-center">
            <div className="w-0.5 h-1.5 bg-white/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
