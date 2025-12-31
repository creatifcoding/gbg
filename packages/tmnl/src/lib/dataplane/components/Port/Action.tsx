/**
 * Port Action Component
 *
 * Individual action button with icon and tooltip.
 * Common actions: link, settings, delete.
 */

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface ActionProps {
  readonly icon: LucideIcon;
  readonly onClick: () => void;
  readonly label: string;
  readonly variant?: 'default' | 'destructive';
  readonly disabled?: boolean;
  readonly className?: string;
}

/**
 * Action button variants
 */
const variantStyles = {
  default: 'text-muted-foreground hover:text-foreground hover:bg-surface-2',
  destructive: 'text-muted-foreground hover:text-red-400 hover:bg-red-400/10',
} as const;

/**
 * PortAction
 *
 * Icon button with tooltip label.
 * - Props: icon (Lucide), onClick, label (tooltip text)
 * - Variants: default, destructive
 */
export function Action({
  icon: Icon,
  onClick,
  label,
  variant = 'default',
  disabled = false,
  className,
}: ActionProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onClick();
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className={cn(
              'p-1 rounded-sm',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent',
              disabled && 'opacity-50 cursor-not-allowed',
              !disabled && variantStyles[variant],
              className
            )}
            aria-label={label}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
