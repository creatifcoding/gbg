/**
 * SlashMenu Compound Component
 *
 * Notion-style slash command menu using Radix Popover and compound patterns.
 *
 * USAGE:
 * ```tsx
 * <SlashMenu.Root open={open} onOpenChange={setOpen}>
 *   <SlashMenu.Content>
 *     <SlashMenu.Group label="Basic">
 *       <SlashMenu.Item icon={Pilcrow} onSelect={handleText}>
 *         <SlashMenu.ItemTitle>Text</SlashMenu.ItemTitle>
 *         <SlashMenu.ItemDescription>Plain paragraph</SlashMenu.ItemDescription>
 *       </SlashMenu.Item>
 *     </SlashMenu.Group>
 *   </SlashMenu.Content>
 * </SlashMenu.Root>
 * ```
 *
 * @module editor/v3/components/SlashMenu
 */

import {
  createContext,
  useContext,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
  type CSSProperties,
  type ComponentType,
} from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { VANTA_COLORS, VANTA_BORDERS, VANTA_SPACING, VANTA_TYPOGRAPHY, VANTA_ANIMATION } from '@/components/portal/tokens';
import type { SlashMenuItem } from '../extensions/SlashCommand';
import { SLASH_GROUPS, groupSlashItems } from '../extensions/SlashCommand';

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface SlashMenuContextValue {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  onSelect: (item: SlashMenuItem) => void;
  flatItems: SlashMenuItem[];
}

const SlashMenuContext = createContext<SlashMenuContextValue | null>(null);

const useSlashMenu = () => {
  const ctx = useContext(SlashMenuContext);
  if (!ctx) throw new Error('SlashMenu components must be used within SlashMenu.Root');
  return ctx;
};

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export interface SlashMenuRootProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  items: SlashMenuItem[];
  onSelect: (item: SlashMenuItem) => void;
  /** Virtual anchor rect for positioning */
  anchorRect?: DOMRect | null;
}

const SlashMenuRoot = forwardRef<{ onKeyDown: (e: KeyboardEvent) => boolean }, SlashMenuRootProps>(
  function SlashMenuRoot(
    { children, open = false, onOpenChange, items, onSelect, anchorRect },
    ref
  ) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    // Keyboard navigation
    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (!open) return false;

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          const item = items[selectedIndex];
          if (item) onSelect(item);
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onOpenChange?.(false);
          return true;
        }
        return false;
      },
    }));

    const contextValue: SlashMenuContextValue = {
      selectedIndex,
      setSelectedIndex,
      onSelect,
      flatItems: items,
    };

    // Virtual anchor for Radix Popover
    const virtualRef = {
      getBoundingClientRect: () => anchorRect ?? new DOMRect(),
    };

    return (
      <SlashMenuContext.Provider value={contextValue}>
        <Popover.Root open={open} onOpenChange={onOpenChange}>
          <Popover.Anchor virtualRef={anchorRect ? { current: virtualRef } : undefined} />
          {children}
        </Popover.Root>
      </SlashMenuContext.Provider>
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────────

interface ContentProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function Content({ children, className = '', style }: ContentProps) {
  return (
    <Popover.Portal>
      <Popover.Content
        side="bottom"
        align="start"
        sideOffset={8}
        className={className}
        style={{
          minWidth: '280px',
          maxHeight: '320px',
          background: VANTA_COLORS.surface.elevated,
          border: VANTA_BORDERS.style.default,
          borderRadius: VANTA_BORDERS.radius.md,
          boxShadow: VANTA_BORDERS.shadow.elevated,
          overflow: 'hidden',
          zIndex: 50,
          ...style,
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea.Root style={{ height: '100%', maxHeight: '320px' }}>
          <ScrollArea.Viewport style={{ height: '100%', padding: VANTA_SPACING['1'] }}>
            {children}
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            style={{
              width: '8px',
              padding: '2px',
            }}
          >
            <ScrollArea.Thumb
              style={{
                background: VANTA_COLORS.surface.border,
                borderRadius: '4px',
              }}
            />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </Popover.Content>
    </Popover.Portal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Group
// ─────────────────────────────────────────────────────────────────────────────

interface GroupProps {
  children: ReactNode;
  label: string;
  className?: string;
  style?: CSSProperties;
}

function Group({ children, label, className = '', style }: GroupProps) {
  return (
    <div className={className} style={style}>
      <div
        style={{
          padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['2']}`,
          color: VANTA_COLORS.text.muted,
          ...VANTA_TYPOGRAPHY.preset.label,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Item
// ─────────────────────────────────────────────────────────────────────────────

interface ItemProps {
  children: ReactNode;
  item: SlashMenuItem;
  index: number;
  icon?: ComponentType<{ size?: number; className?: string }>;
  className?: string;
  style?: CSSProperties;
}

function Item({ children, item, index, icon: Icon, className = '', style }: ItemProps) {
  const { selectedIndex, setSelectedIndex, onSelect } = useSlashMenu();
  const isSelected = index === selectedIndex;

  return (
    <button
      onClick={() => onSelect(item)}
      onMouseEnter={() => setSelectedIndex(index)}
      className={className}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: VANTA_SPACING['3'],
        padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['2']}`,
        borderRadius: VANTA_BORDERS.radius.sm,
        border: 'none',
        background: isSelected ? VANTA_COLORS.surface.hover : 'transparent',
        color: isSelected ? VANTA_COLORS.text.primary : VANTA_COLORS.text.secondary,
        textAlign: 'left',
        cursor: 'pointer',
        transition: VANTA_ANIMATION.transition.colors,
        ...style,
      }}
    >
      {Icon && (
        <div
          style={{
            flexShrink: 0,
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: VANTA_BORDERS.radius.sm,
            background: VANTA_COLORS.surface.default,
            border: VANTA_BORDERS.style.subtle,
          }}
        >
          <Icon size={16} className="text-neutral-400" />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ItemTitle
// ─────────────────────────────────────────────────────────────────────────────

interface ItemTitleProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function ItemTitle({ children, className = '', style }: ItemTitleProps) {
  return (
    <div
      className={className}
      style={{
        ...VANTA_TYPOGRAPHY.preset.body,
        fontWeight: 500,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ItemDescription
// ─────────────────────────────────────────────────────────────────────────────

interface ItemDescriptionProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function ItemDescription({ children, className = '', style }: ItemDescriptionProps) {
  return (
    <div
      className={className}
      style={{
        ...VANTA_TYPOGRAPHY.preset.caption,
        color: VANTA_COLORS.text.muted,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function Empty({ children = 'No results found', className = '', style }: EmptyProps) {
  return (
    <div
      className={className}
      style={{
        padding: VANTA_SPACING['4'],
        textAlign: 'center',
        color: VANTA_COLORS.text.muted,
        ...VANTA_TYPOGRAPHY.preset.caption,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compound Export
// ─────────────────────────────────────────────────────────────────────────────

export const SlashMenu = Object.assign(SlashMenuRoot, {
  Content,
  Group,
  Item,
  ItemTitle,
  ItemDescription,
  Empty,
});

// ─────────────────────────────────────────────────────────────────────────────
// Icon Map (for convenience)
// ─────────────────────────────────────────────────────────────────────────────

import {
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Minus,
  Image,
  Table,
} from 'lucide-react';

export const SLASH_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Minus,
  Image,
  Table,
};

// ─────────────────────────────────────────────────────────────────────────────
// Prebuilt: DefaultSlashMenu (convenience wrapper)
// ─────────────────────────────────────────────────────────────────────────────

import { ReactRenderer } from '@tiptap/react';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';

interface DefaultSlashMenuProps {
  items: SlashMenuItem[];
  command: (item: SlashMenuItem) => void;
  clientRect?: (() => DOMRect | null) | null;
}

export interface DefaultSlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * Pre-built SlashMenu using compound components internally.
 * Use this with TipTap's suggestion render.
 */
export const DefaultSlashMenu = forwardRef<DefaultSlashMenuHandle, DefaultSlashMenuProps>(
  function DefaultSlashMenu({ items, command, clientRect }, ref) {
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

    useEffect(() => {
      if (clientRect) {
        const rect = clientRect();
        setAnchorRect(rect);
      }
    }, [clientRect]);

    const grouped = groupSlashItems(items);
    let flatIndex = 0;

    if (items.length === 0) {
      return (
        <SlashMenu
          ref={ref}
          open={true}
          items={items}
          onSelect={command}
          anchorRect={anchorRect}
        >
          <SlashMenu.Content>
            <SlashMenu.Empty />
          </SlashMenu.Content>
        </SlashMenu>
      );
    }

    return (
      <SlashMenu
        ref={ref}
        open={true}
        items={items}
        onSelect={command}
        anchorRect={anchorRect}
      >
        <SlashMenu.Content>
          {SLASH_GROUPS.map((groupName) => {
            const groupItems = grouped.get(groupName);
            if (!groupItems || groupItems.length === 0) return null;

            return (
              <SlashMenu.Group key={groupName} label={groupName}>
                {groupItems.map((item) => {
                  const itemIndex = flatIndex++;
                  const Icon = SLASH_ICONS[item.icon];

                  return (
                    <SlashMenu.Item key={item.title} item={item} index={itemIndex} icon={Icon}>
                      <SlashMenu.ItemTitle>{item.title}</SlashMenu.ItemTitle>
                      <SlashMenu.ItemDescription>{item.description}</SlashMenu.ItemDescription>
                    </SlashMenu.Item>
                  );
                })}
              </SlashMenu.Group>
            );
          })}
        </SlashMenu.Content>
      </SlashMenu>
    );
  }
);

/**
 * Creates the render function for TipTap suggestion
 */
export function createSlashMenuRender() {
  let component: ReactRenderer<DefaultSlashMenuHandle> | null = null;

  return {
    onStart: (props: SuggestionProps<SlashMenuItem>) => {
      component = new ReactRenderer(DefaultSlashMenu, {
        props,
        editor: props.editor,
      });

      // Append to DOM - ReactRenderer creates element but doesn't mount it
      document.body.appendChild(component.element);
    },

    onUpdate: (props: SuggestionProps<SlashMenuItem>) => {
      component?.updateProps(props);
    },

    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === 'Escape') {
        component?.destroy();
        component = null;
        return true;
      }
      return component?.ref?.onKeyDown(props.event) ?? false;
    },

    onExit: () => {
      // Remove from DOM before destroying
      if (component?.element?.parentNode) {
        component.element.parentNode.removeChild(component.element);
      }
      component?.destroy();
      component = null;
    },
  };
}

export type { SlashMenuRootProps, ContentProps as SlashMenuContentProps };
