/**
 * Popover System — Public API.
 *
 * @example
 * ```tsx
 * import { Popover } from '@/lib/bar/popover'
 *
 * <Popover id="calendar" placement="right-end">
 *   <Popover.Trigger>
 *     <button>Open</button>
 *   </Popover.Trigger>
 *   <Popover.Content width={240} height={280}>
 *     <MyPanel />
 *   </Popover.Content>
 * </Popover>
 * ```
 */

export { Popover } from './Popover'
export { openPopover, closePopover, closeAllPopovers, activePopoversAtom, BAR_WIDTH } from './atoms'
export type { PopoverPlacement, PopoverRect, PopoverEntry } from './types'
