import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

// =============================================================================
// TMNL UI COMPONENT LIBRARY - Cognitive Electronic Warfare Design System
// =============================================================================

// --- TYPOGRAPHY COMPONENTS ---

const Label = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'text-[10px] font-mono uppercase tracking-[0.15em] text-neutral-500',
      className
    )}
  >
    {children}
  </span>
);

const LabelSmall = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'text-[8px] font-mono uppercase tracking-[0.2em] text-neutral-600',
      className
    )}
  >
    {children}
  </span>
);

const Heading = ({
  children,
  size = 'base',
  className,
}: {
  children: ReactNode;
  size?: 'base' | 'lg' | 'xl';
  className?: string;
}) => {
  const sizeClass = {
    base: 'text-[11px] font-mono uppercase tracking-[0.15em] text-white',
    lg: 'text-[13px] font-mono uppercase tracking-[0.12em] text-white font-medium',
    xl: 'text-[16px] font-mono uppercase tracking-[0.1em] text-white font-bold',
  }[size];
  return <span className={cn(sizeClass, className)}>{children}</span>;
};

const Body = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'text-[11px] font-mono tracking-[0.03em] text-neutral-400',
      className
    )}
  >
    {children}
  </span>
);

const ID = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'text-[18px] font-mono font-light tracking-[0.08em] text-white',
      className
    )}
  >
    {children}
  </span>
);

const Stat = ({
  value,
  unit,
  className,
}: {
  value: string | number;
  unit?: string;
  className?: string;
}) => (
  <span className={cn('inline-flex items-baseline', className)}>
    <span className="text-[32px] font-mono font-thin tracking-tight text-white">
      {value}
    </span>
    {unit && (
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500 ml-1">
        {unit}
      </span>
    )}
  </span>
);

const CardLabel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'text-[8px] font-mono uppercase tracking-[0.2em] text-neutral-500 bg-neutral-950 px-2',
      className
    )}
  >
    {children}
  </span>
);

const Coords = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'text-[10px] font-mono tracking-[0.08em] text-neutral-600',
      className
    )}
  >
    {children}
  </span>
);

const GroupHeader = ({
  children,
  color = 'gray',
  className,
}: {
  children: ReactNode;
  color?: 'gray' | 'red' | 'orange' | 'blue' | 'green';
  className?: string;
}) => {
  const colorClass = {
    gray: 'bg-neutral-500',
    red: 'bg-red-600',
    orange: 'bg-amber-600',
    blue: 'bg-blue-500',
    green: 'bg-emerald-600',
  }[color];
  return (
    <div
      className={cn(
        'text-[18px] font-mono font-medium tracking-tight text-white flex items-center gap-3',
        className
      )}
    >
      <div className={cn('w-2.5 h-2.5', colorClass)} />
      {children}
    </div>
  );
};

const ItemNumber = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'text-[10px] font-mono uppercase tracking-[0.15em] text-neutral-400',
      className
    )}
  >
    {children}
  </span>
);

const ItemSubtitle = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'text-[11px] font-mono tracking-[0.05em] text-red-900',
      className
    )}
  >
    {children}
  </span>
);

// --- ATOMIC COMPONENTS ---

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost' | 'danger' | 'outline' | 'tmnl';
    size?: 'xs' | 'sm' | 'md' | 'icon';
  }
>(
  (
    { className, variant = 'primary', size = 'md', children, ...props },
    ref
  ) => {
    const variants = {
      primary: 'bg-white text-black border-white hover:bg-neutral-200',
      ghost:
        'bg-transparent text-neutral-500 hover:text-white hover:bg-neutral-900',
      danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700',
      outline:
        'bg-transparent border-neutral-800 text-neutral-500 hover:bg-neutral-900 hover:border-white hover:text-white',
      tmnl: 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:border-neutral-600 hover:text-white',
    };
    const sizes = {
      xs: 'px-2 py-1 text-[8px]',
      sm: 'px-3 py-1.5 text-[9px]',
      md: 'px-4 py-2 text-[10px]',
      icon: 'p-1.5 w-7 h-7 flex items-center justify-center',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'font-mono uppercase tracking-[0.15em] border transition-all relative overflow-hidden',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        <span className="relative z-10 flex items-center gap-1.5 justify-center">
          {children}
        </span>
      </button>
    );
  }
);
Button.displayName = 'Button';

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label?: string; className?: string }
>(({ className = '', label, ...props }, ref) => (
  <div className="space-y-1 w-full">
    {label && <Label>{label}</Label>}
    <div className="relative group">
      <input
        ref={ref}
        className={cn(
          'w-full bg-black border border-neutral-800 px-3 py-2 text-[10px] font-mono text-neutral-400 outline-none focus:border-white focus:text-white placeholder:text-neutral-700 transition-colors',
          className
        )}
        {...props}
      />
      <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-white opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-white opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
    </div>
  </div>
));
Input.displayName = 'Input';

const Badge = ({
  children,
  variant = 'default',
  className,
}: {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'critical' | 'success' | 'live';
  className?: string;
}) => {
  const styles = {
    default: 'bg-neutral-900 text-neutral-400 border-neutral-800',
    outline: 'border-neutral-800 text-neutral-500',
    critical: 'bg-red-950/50 border-red-900 text-red-500 animate-pulse',
    success: 'bg-emerald-950/50 border-emerald-900 text-emerald-500',
    live: 'bg-red-950/50 border-red-800 text-red-500',
  };
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-[0.15em] inline-flex items-center gap-1 border',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'animate-pulse bg-neutral-900 border border-neutral-800',
      className
    )}
  />
);

const Separator = ({
  orientation = 'horizontal',
  className,
}: {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}) => (
  <div
    className={cn(
      'bg-neutral-800 shrink-0',
      orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
      className
    )}
  />
);

const Kbd = ({ children }: { children: ReactNode }) => (
  <span className="border border-neutral-800 bg-neutral-900 px-1 py-0.5 text-[8px] font-mono text-neutral-500">
    {children}
  </span>
);

const Checkbox = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange?: () => void;
}) => (
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

const Switch = ({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (c: boolean) => void;
}) => (
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

const RadioGroup = ({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) => (
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
            'text-[10px] font-mono uppercase tracking-[0.1em]',
            value === opt
              ? 'text-white'
              : 'text-neutral-500 group-hover:text-neutral-400'
          )}
        >
          {opt}
        </span>
      </button>
    ))}
  </div>
);

// --- COMPOUND DRAWER ---

type DrawerSide = 'left' | 'right';
const DrawerContext = createContext<{ side: DrawerSide }>({ side: 'left' });

const DrawerRoot = ({
  children,
  open,
  onClose,
  side = 'left',
  width = 'w-64',
}: {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  side?: DrawerSide;
  width?: string;
}) => {
  const slideFrom = side === 'left' ? { x: '-100%' } : { x: '100%' };
  const slideTo = { x: 0 };

  return (
    <DrawerContext.Provider value={{ side }}>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className={cn(
                'fixed top-0 bottom-0 z-50 bg-black flex flex-col',
                side === 'left'
                  ? 'left-0 border-r border-neutral-800'
                  : 'right-0 border-l border-neutral-800',
                width
              )}
              initial={slideFrom}
              animate={slideTo}
              exit={slideFrom}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            >
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DrawerContext.Provider>
  );
};

const DrawerHeader = ({
  title,
  onClose,
}: {
  title: string;
  onClose?: () => void;
}) => (
  <div className="h-12 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
    <Label>{title}</Label>
    {onClose && (
      <button
        onClick={onClose}
        className="text-neutral-600 hover:text-white transition-colors"
      >
        <X size={14} />
      </button>
    )}
  </div>
);

const DrawerContent = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex-1 overflow-y-auto p-4 no-scrollbar', className)}>
    {children}
  </div>
);

const DrawerFooter = ({ children }: { children: ReactNode }) => (
  <div className="border-t border-neutral-800 p-3 shrink-0">{children}</div>
);

const DrawerNav = ({
  items,
  activeIndex = 0,
  onSelect,
}: {
  items: string[];
  activeIndex?: number;
  onSelect?: (i: number) => void;
}) => (
  <nav className="space-y-1">
    {items.map((item, i) => (
      <button
        key={item}
        onClick={() => onSelect?.(i)}
        className={cn(
          'w-full text-left px-3 py-2 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors',
          i === activeIndex
            ? 'text-white bg-neutral-900 border-l-2 border-white'
            : 'text-neutral-500 hover:text-white hover:bg-neutral-900'
        )}
      >
        {item}
      </button>
    ))}
  </nav>
);

const DrawerSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="space-y-3">
    <Label>{title}</Label>
    {children}
  </div>
);

const Drawer = {
  Root: DrawerRoot,
  Header: DrawerHeader,
  Content: DrawerContent,
  Footer: DrawerFooter,
  Nav: DrawerNav,
  Section: DrawerSection,
};

const LeftDrawer = ({
  children,
  open,
  onClose,
  width = 'w-72',
}: {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  width?: string;
}) => (
  <DrawerRoot open={open} onClose={onClose} side="left" width={width}>
    {children}
  </DrawerRoot>
);

const RightDrawer = ({
  children,
  open,
  onClose,
  width = 'w-80',
}: {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  width?: string;
}) => (
  <DrawerRoot open={open} onClose={onClose} side="right" width={width}>
    {children}
  </DrawerRoot>
);

// --- COMMAND BAR ---

const CommandBar = ({
  open,
  onClose,
  onExecute,
}: {
  open: boolean;
  onClose: () => void;
  onExecute?: (cmd: string) => void;
}) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    if (!open) setInput('');
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-50"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        >
          <div className="bg-black border-t border-neutral-800">
            <div className="flex items-center px-4 py-3 gap-3">
              <span className="text-red-500 text-[10px] font-mono tracking-wider">
                M-x
              </span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter command..."
                className="flex-1 bg-transparent text-[11px] font-mono text-white placeholder:text-neutral-600 outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onClose();
                  if (e.key === 'Enter') {
                    onExecute?.(input);
                    onClose();
                  }
                }}
              />
              <Kbd>ESC</Kbd>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- MODAL ---

const Modal = ({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-black border border-neutral-800 w-full max-w-md pointer-events-auto"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              {title && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                  <Label>{title}</Label>
                  <button
                    onClick={onClose}
                    className="text-neutral-600 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="p-4">{children}</div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- CARDS ---

const Card = ({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) => (
  <div className={cn('relative', className)}>
    {label && (
      <div className="absolute -top-3 left-4">
        <CardLabel>{label}</CardLabel>
      </div>
    )}
    <div className="border border-neutral-800 bg-black p-4">{children}</div>
  </div>
);

const MissionCard = ({
  code,
  description,
  className,
  onDetails,
  onJoin,
}: {
  code: string;
  description: string;
  className?: string;
  onDetails?: () => void;
  onJoin?: () => void;
}) => (
  <div
    className={cn(
      'border border-neutral-800 bg-black p-3 space-y-2',
      className
    )}
  >
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-neutral-500">
        Mission Code: {code}
      </span>
      <Wifi size={12} className="text-neutral-700" />
    </div>
    <p className="text-[12px] font-mono text-white tracking-wide">
      {description}
    </p>
    <div className="flex gap-2 pt-1">
      <Button variant="outline" size="xs" onClick={onDetails}>
        Details
      </Button>
      <Button variant="outline" size="xs" onClick={onJoin}>
        Join
      </Button>
    </div>
  </div>
);

// --- STATUS FOOTER ---

const StatusFooter = ({
  status = 'connected',
  message,
  value,
  unit,
}: {
  status?: 'connected' | 'disconnected' | 'warning';
  message?: string;
  value?: number | string;
  unit?: string;
}) => {
  const statusColors = {
    connected: 'bg-emerald-500',
    disconnected: 'bg-neutral-600',
    warning: 'bg-amber-500',
  };
  return (
    <footer className="h-8 border-t border-neutral-800 flex items-center justify-between px-4 bg-black shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className={cn('w-1.5 h-1.5 animate-pulse', statusColors[status])}
          />
          <LabelSmall>{status}</LabelSmall>
        </div>
        {message && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <LabelSmall>{message}</LabelSmall>
          </>
        )}
      </div>
      {value !== undefined && (
        <div className="flex items-baseline gap-1">
          <span className="text-[14px] font-mono text-white font-light">
            {value}
          </span>
          {unit && <LabelSmall>{unit}</LabelSmall>}
        </div>
      )}
    </footer>
  );
};

// --- TMNL CONTROLS ---

function TmnlKnob({
  value,
  min = 0,
  max = 100,
  onChange,
  size = 36,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  size?: number;
  label?: string;
}) {
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
        <span className="text-[7px] font-mono uppercase text-neutral-500 tracking-wider">
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
      <span className="text-[8px] font-mono text-neutral-400 tabular-nums">
        {typeof value === 'number'
          ? value < 10
            ? value.toFixed(2)
            : value.toFixed(1)
          : value}
      </span>
    </div>
  );
}

function TmnlSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
}) {
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
          <span className="text-[7px] font-mono uppercase text-neutral-500 tracking-wider">
            {label}
          </span>
          <span className="text-[7px] font-mono text-neutral-400 tabular-nums">
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

function TmnlFader({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  height = 60,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
  height?: number;
}) {
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
        <span className="text-[7px] font-mono uppercase text-neutral-500 tracking-wider">
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
      <span className="text-[8px] font-mono text-neutral-400 tabular-nums">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// --- EXPORTS ---

export const Tmnl = {
  // Typography
  Label,
  LabelSmall,
  Heading,
  Body,
  ID,
  Stat,
  CardLabel,
  Coords,
  GroupHeader,
  ItemNumber,
  ItemSubtitle,
  // Atoms
  Button,
  Input,
  Badge,
  Skeleton,
  Separator,
  Kbd,
  Checkbox,
  Switch,
  RadioGroup,
  // Drawer
  Drawer,
  LeftDrawer,
  RightDrawer,
  // Overlays
  CommandBar,
  Modal,
  // Cards
  Card,
  MissionCard,
  // Layout
  StatusFooter,
  // Controller Components
  Controller: {
    Knob: TmnlKnob,
    Slider: TmnlSlider,
    Fader: TmnlFader,
  },
};

// Also export individual components for backward compatibility
export { TmnlKnob, TmnlSlider, TmnlFader };
