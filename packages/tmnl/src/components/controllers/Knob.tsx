/**
 * TMNL Knob Controller
 *
 * Rotary control for parameter adjustment.
 * Extracted from tmnl-ui.tsx for modular encapsulation.
 */

import { useRef, useCallback } from 'react';

// =============================================================================
// KNOB
// =============================================================================

export interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  size?: number;
  label?: string;
}

export function Knob({
  value,
  min = 0,
  max = 100,
  onChange,
  size = 36,
  label,
}: KnobProps) {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(value);
  const rotation = ((value - min) / (max - min)) * 270 - 135;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      startY.current = e.clientY;
      startValue.current = value;

      const onMove = (ev: PointerEvent) => {
        if (!isDragging.current) return;
        const delta = startY.current - ev.clientY;
        const range = max - min;
        const newValue = Math.max(
          min,
          Math.min(max, startValue.current + (delta / 100) * range)
        );
        onChange(newValue);
      };

      const onUp = () => {
        isDragging.current = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [value, min, max, onChange]
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
        className="relative cursor-pointer touch-none"
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
      >
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full bg-neutral-950 border border-neutral-700">
          {/* Inner ring */}
          <div className="absolute inset-[3px] rounded-full bg-black border border-neutral-800">
            {/* Knob face */}
            <div
              className="absolute inset-[2px] rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {/* Indicator line */}
              <div className="absolute top-1 w-0.5 h-1.5 bg-white rounded-full" />
              {/* Center dot */}
              <div className="w-1 h-1 rounded-full bg-neutral-600" />
            </div>
          </div>
        </div>
      </div>
      <span
        className="font-mono text-neutral-400 tabular-nums"
        style={{ fontSize: 'calc(var(--tmnl-text-xs, 12px) * 0.7)' }}
      >
        {typeof value === 'number'
          ? value < 10
            ? value.toFixed(2)
            : value.toFixed(1)
          : value}
      </span>
    </div>
  );
}
