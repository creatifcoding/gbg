/**
 * Calendar Math — Pure functions for grid generation.
 *
 * No React, no atoms, no side effects. Just date arithmetic.
 */

import type { DayMeta, CalendarEvent } from './types'

/** Build ISO date key "YYYY-MM-DD" */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** ISO week number */
export function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** Build the full 6-week grid for a month view. */
export function buildMonthGrid(
  year: number,
  month: number,
  selected: ReadonlySet<string>,
  events: ReadonlyMap<string, readonly CalendarEvent[]>,
  startOfWeek: 0 | 1 = 0,
): DayMeta[][] {
  const now = new Date()
  const todayKey = toDateKey(now)

  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  let startDay = firstOfMonth.getDay() - startOfWeek
  if (startDay < 0) startDay += 7

  const prevMonthDays = new Date(year, month, 0).getDate()
  const padStart = startDay

  const weeks: DayMeta[][] = []
  let currentWeek: DayMeta[] = []
  let dayCounter = 1
  let nextMonthDay = 1

  for (let i = 0; i < 42; i++) {
    let date: Date
    let isCurrentMonth: boolean
    let dayNum: number

    if (i < padStart) {
      dayNum = prevMonthDays - padStart + i + 1
      date = new Date(year, month - 1, dayNum)
      isCurrentMonth = false
    } else if (dayCounter <= daysInMonth) {
      dayNum = dayCounter
      date = new Date(year, month, dayNum)
      isCurrentMonth = true
      dayCounter++
    } else {
      dayNum = nextMonthDay
      date = new Date(year, month + 1, dayNum)
      isCurrentMonth = false
      nextMonthDay++
    }

    const dateKey = toDateKey(date)
    const dow = date.getDay()

    currentWeek.push({
      day: dayNum,
      date,
      dateKey,
      isCurrentMonth,
      isToday: dateKey === todayKey,
      isSelected: selected.has(dateKey),
      isWeekend: dow === 0 || dow === 6,
      isFuture: date > now,
      events: events.get(dateKey) ?? [],
      dayOfWeek: dow,
      weekNumber: getWeekNumber(date),
    })

    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  return weeks
}

/** Day labels for a given startOfWeek */
export function weekdayLabels(startOfWeek: 0 | 1 = 0): string[] {
  const base = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  if (startOfWeek === 1) return [...base.slice(1), base[0]]
  return base
}

/** Month name */
export function monthName(month: number, locale = 'en'): string {
  return new Date(2000, month).toLocaleDateString(locale, { month: 'long' })
}
