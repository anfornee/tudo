import type { Bill, BillCategory } from "@/lib/bills/types";

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function getEffectiveBillDate(dueDay: number, year: number, month: number) {
  return new Date(year, month, Math.min(dueDay, daysInMonth(year, month)));
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getNextBillOccurrence(dueDay: number, now = new Date()) {
  const today = startOfLocalDay(now);
  const thisMonth = getEffectiveBillDate(dueDay, today.getFullYear(), today.getMonth());
  return thisMonth >= today
    ? thisMonth
    : getEffectiveBillDate(dueDay, today.getFullYear(), today.getMonth() + 1);
}

export function sortBillsByDueDay(bills: readonly Bill[]) {
  return [...bills].filter((bill) => bill.isActive).sort((a, b) =>
    a.dueDay - b.dueDay || a.name.localeCompare(b.name));
}

export function sortBillsByUpcomingOccurrence(bills: readonly Bill[], now = new Date()) {
  return [...bills].filter((bill) => bill.isActive).sort((a, b) => {
    const dateDifference = getNextBillOccurrence(a.dueDay, now).getTime()
      - getNextBillOccurrence(b.dueDay, now).getTime();
    return dateDifference || a.dueDay - b.dueDay || a.name.localeCompare(b.name);
  });
}

export function formatOrdinalDay(day: number) {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`;
  return `${day}${day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th"}`;
}

export function calculateMonthlyBillTotal(bills: readonly Bill[]) {
  return bills.reduce((total, bill) => total + (bill.isActive ? bill.amount : 0), 0);
}

export function calculateCategoryTotal(bills: readonly Bill[], category: BillCategory | "subscriptions") {
  return bills.reduce((total, bill) => total + (
    bill.isActive && (category === "subscriptions" ? bill.isSubscription : bill.category === category)
      ? bill.amount : 0), 0);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatDueRelative(date: Date, now = new Date()) {
  const difference = Math.round((startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime()) / 86_400_000);
  if (difference === 0) return "Due today";
  if (difference === 1) return "Due tomorrow";
  return `Due ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)}`;
}
