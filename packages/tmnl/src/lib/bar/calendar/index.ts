/**
 * Calendar System — Public API
 *
 * @example
 * ```tsx
 * import { Calendar } from '@/lib/bar/calendar'
 *
 * // Preset (batteries included):
 * <Calendar.Preset
 *   onDayClick={(meta) => console.log(meta.dateKey)}
 *   showEventList
 * />
 *
 * // Full compound control:
 * <Calendar onDayClick={handler} selectionMode="multiple">
 *   <Calendar.Header />
 *   <Calendar.DayLabels />
 *   <Calendar.Grid renderDay={(meta) => <CustomDay meta={meta} />} />
 *   <Calendar.EventList renderEvent={(ev) => <CustomRow event={ev} />} />
 *   <Calendar.Footer />
 * </Calendar>
 * ```
 */

// Compound component
export { Calendar } from './Calendar'

// Types
export type {
  DayMeta,
  CalendarActions,
  CalendarEvent,
  SelectionMode,
  CalendarSource,
  EventPriority,
  DateKey,
} from './types'
export { CalendarEvent as CalendarEventSchema } from './types'

// Atoms (for external integrations — read from nearest RegistryProvider)
export {
  viewYearAtom,
  viewMonthAtom,
  selectedDatesAtom,
  eventsMapAtom,
  selectionModeAtom,
  monthGridAtom,
  monthLabelAtom,
  selectedEventsAtom,
  monthEventCountAtom,
  // Ops
  addEvent,
  removeEvent,
  loadEvents,
  clearSelection,
} from './atoms'

// Math (pure, testable)
export { toDateKey, getWeekNumber, buildMonthGrid, weekdayLabels, monthName } from './math'
