/**
 * TMNL Input Primitives
 *
 * Extracted from tmnl-ui.tsx for modular encapsulation.
 * Uses CSS custom properties from ScaleProvider.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from './typography';

// =============================================================================
// INPUT
// =============================================================================

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, ...props }, ref) => (
    <div className="space-y-1 w-full">
      {label && <Label>{label}</Label>}
      <div className="relative group">
        <input
          ref={ref}
          className={cn(
            'w-full bg-black border border-neutral-800 px-3 py-2 font-mono text-neutral-400 outline-none focus:border-white focus:text-white placeholder:text-neutral-700 transition-colors',
            className
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          {...props}
        />
        <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-white opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-white opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
      </div>
    </div>
  )
);

Input.displayName = 'Input';

// =============================================================================
// CHECKBOX
// =============================================================================

export interface CheckboxProps {
  checked: boolean;
  onChange?: () => void;
}

export const Checkbox = ({ checked, onChange }: CheckboxProps) => (
  <button
    onClick={onChange}
    className={cn(
      'w-3 h-3 border border-neutral-800 flex items-center justify-center transition-colors',
      checked ? 'bg-white border-white text-black' : 'bg-black'
    )}
  >
    {checked && <Check size={8} strokeWidth={4} />}
  </button>
);

// =============================================================================
// SWITCH
// =============================================================================

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Switch = ({ checked, onCheckedChange }: SwitchProps) => (
  <button
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      'w-7 h-3.5 border border-neutral-800 flex items-center p-0.5 transition-colors',
      checked ? 'bg-neutral-900 border-neutral-600' : 'bg-black'
    )}
  >
    <motion.div
      className={cn('w-2 h-2', checked ? 'bg-white' : 'bg-neutral-600')}
      animate={{ x: checked ? 12 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    />
  </button>
);

// =============================================================================
// RADIO GROUP
// =============================================================================

export interface RadioGroupProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export const RadioGroup = ({ options, value, onChange }: RadioGroupProps) => (
  <div className="flex flex-col gap-2">
    {options.map((opt) => (
      <button
        key={opt}
        onClick={() => onChange(opt)}
        className="flex items-center gap-2 group"
      >
        <div
          className={cn(
            'w-2.5 h-2.5 border border-neutral-800 rounded-full flex items-center justify-center',
            value === opt ? 'border-white' : ''
          )}
        >
          {value === opt && <div className="w-1 h-1 bg-white rounded-full" />}
        </div>
        <span
          className={cn(
            'font-mono uppercase tracking-[0.1em]',
            value === opt
              ? 'text-white'
              : 'text-neutral-500 group-hover:text-neutral-400'
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {opt}
        </span>
      </button>
    ))}
  </div>
);
