export interface CalendarDate { year: number; month: number; day: number }

export function effectiveDueDay(dueDay: number, year: number, month: number) {
  return Math.min(dueDay, new Date(Date.UTC(year, month, 0)).getUTCDate());
}

export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const result = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: result.getUTCFullYear(), month: result.getUTCMonth() + 1, day: result.getUTCDate() };
}

export function billMatchesReminderDate(dueDay: number, reminderDate: CalendarDate, isAutopay: boolean) {
  const dueDate = isAutopay ? addCalendarDays(reminderDate, 1) : reminderDate;
  return effectiveDueDay(dueDay, dueDate.year, dueDate.month) === dueDate.day;
}
