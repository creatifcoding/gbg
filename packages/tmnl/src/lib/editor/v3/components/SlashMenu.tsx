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
  useEffect,
  useImperativeHandle,
  useState,
  useRef,
  useCallback,
  type ReactNode,
  type CSSProperties,
  type ComponentType,
} from 'react';
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
  registerItemRef: (index: number, el: HTMLButtonElement | null) => void;
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
    const itemRefsMap = useRef<Map<number, HTMLButtonElement>>(new Map());

    // Register item refs for scroll-into-view
    const registerItemRef = useCallback((index: number, el: HTMLButtonElement | null) => {
      if (el) {
        itemRefsMap.current.set(index, el);
      } else {
        itemRefsMap.current.delete(index);
      }
    }, []);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    // Scroll selected item into view
    // Use a more controlled approach for Radix ScrollArea compatibility
    useEffect(() => {
      const el = itemRefsMap.current.get(selectedIndex);
      if (!el) return;

      // Find the ScrollArea viewport (parent with overflow)
      const viewport = el.closest('[data-radix-scroll-area-viewport]');
      if (!viewport) {
        // Fallback to native scrollIntoView
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      // Check if element is above viewport
      if (elRect.top < viewportRect.top) {
        viewport.scrollTop -= viewportRect.top - elRect.top + 4;
      }
      // Check if element is below viewport
      else if (elRect.bottom > viewportRect.bottom) {
        viewport.scrollTop += elRect.bottom - viewportRect.bottom + 4;
      }
    }, [selectedIndex]);

    // Keyboard navigation
    // Store items length in ref to avoid stale closure issues
    const itemsLengthRef = useRef(items.length);
    itemsLengthRef.current = items.length;

    // Store items in ref for Enter key handler
    const itemsRef = useRef(items);
    itemsRef.current = items;

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (!open) return false;

        const len = itemsLengthRef.current;
        if (len === 0) return false;

        // Arrow Up or Shift+Tab
        if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
          event.preventDefault();
          setSelectedIndex((prev) => {
            const next = prev <= 0 ? len - 1 : prev - 1;
            return next;
          });
          return true;
        }
        // Arrow Down or Tab
        if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
          event.preventDefault();
          setSelectedIndex((prev) => {
            const next = prev >= len - 1 ? 0 : prev + 1;
            return next;
          });
          return true;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          setSelectedIndex((currentIndex) => {
            const item = itemsRef.current[currentIndex];
            if (item) {
              // Defer onSelect to avoid state update during render
              queueMicrotask(() => onSelect(item));
            }
            return currentIndex;
          });
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onOpenChange?.(false);
          return true;
        }
        return false;
      },
    }), [open, onSelect, onOpenChange]);

    const contextValue: SlashMenuContextValue = {
      selectedIndex,
      setSelectedIndex,
      onSelect,
      flatItems: items,
      registerItemRef,
    };

    if (!open) return null;

    return (
      <SlashMenuContext.Provider value={contextValue}>
        <div
          style={{
            position: 'fixed',
            top: anchorRect ? anchorRect.bottom + 8 : 0,
            left: anchorRect ? anchorRect.left : 0,
            zIndex: 9999,
          }}
        >
          {children}
        </div>
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
    <div
      className={className}
      style={{
        minWidth: '280px',
        maxHeight: '320px',
        background: VANTA_COLORS.surface.elevated,
        border: VANTA_BORDERS.style.default,
        borderRadius: VANTA_BORDERS.radius.md,
        boxShadow: VANTA_BORDERS.shadow.elevated,
        overflow: 'hidden',
        ...style,
      }}
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
    </div>
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
  const { selectedIndex, setSelectedIndex, onSelect, registerItemRef } = useSlashMenu();
  const isSelected = index === selectedIndex;

  // Register ref for scroll-into-view
  const refCallback = useCallback(
    (el: HTMLButtonElement | null) => {
      registerItemRef(index, el);
    },
    [registerItemRef, index]
  );

  return (
    <button
      ref={refCallback}
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
  AlertCircle,
  MapPin,
  Box,
  Columns2,
  Columns3,
  LayoutGrid,
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
  AlertCircle,
  MapPin,
  Box,
  Columns2,
  Columns3,
  LayoutGrid,
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

  console.log('[SlashMenu] createSlashMenuRender factory called');

  return {
    onStart: (props: SuggestionProps<SlashMenuItem>) => {
      console.log('[SlashMenu] onStart called', { items: props.items?.length, query: props.query });
      component = new ReactRenderer(DefaultSlashMenu, {
        props,
        editor: props.editor,
      });

      // Append to the editor's DOM element for proper positioning
      const editorElement = props.editor.view.dom.parentElement;
      if (editorElement) {
        editorElement.appendChild(component.element);
        console.log('[SlashMenu] Component appended to editor DOM', component.element);
      } else {
        // Fallback to body if editor element not found
        document.body.appendChild(component.element);
        console.log('[SlashMenu] Component appended to document.body (fallback)');
      }
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
