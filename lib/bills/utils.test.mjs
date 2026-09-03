import assert from "node:assert/strict";
import test from "node:test";
import { calculateCategoryTotal, calculateMonthlyBillTotal, formatOrdinalDay, getEffectiveBillDate, getNextBillOccurrence, sortBillsByDueDay, sortBillsByUpcomingOccurrence } from "./utils.ts";
import { addCalendarDays, billMatchesReminderDate, effectiveDueDay } from "./reminder-schedule.ts";

test("today remains the next occurrence for the whole day", () => {
  const result = getNextBillOccurrence(3, new Date(2026, 8, 3, 23, 59));
  assert.deepEqual([result.getFullYear(), result.getMonth(), result.getDate()], [2026, 8, 3]);
});

test("passed bills roll into the next month and December crosses into January", () => {
  const result = getNextBillOccurrence(2, new Date(2026, 11, 20));
  assert.deepEqual([result.getFullYear(), result.getMonth(), result.getDate()], [2027, 0, 2]);
});

test("days beyond month end normalize, including leap years", () => {
  assert.equal(getEffectiveBillDate(31, 2026, 3).getDate(), 30);
  assert.equal(getEffectiveBillDate(31, 2026, 1).getDate(), 28);
  assert.equal(getEffectiveBillDate(31, 2028, 1).getDate(), 29);
  assert.equal(effectiveDueDay(31, 2028, 2), 29);
});

test("ordinal formatting handles teen exceptions", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(formatOrdinalDay), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st"]);
});

test("autopay reminder crosses the month boundary", () => {
  assert.equal(billMatchesReminderDate(1, { year: 2026, month: 9, day: 30 }, true), true);
  assert.deepEqual(addCalendarDays({ year: 2026, month: 12, day: 31 }, 1), { year: 2027, month: 1, day: 1 });
});

test("non-autopay reminder matches effective month-end due date", () => {
  assert.equal(billMatchesReminderDate(31, { year: 2026, month: 2, day: 28 }, false), true);
});

const bill = (id, dueDay, amount, extra = {}) => ({ id, name: id, dueDay, amount, category: "utilities", isActive: true, isAutopay: false, isSubscription: false, notificationsEnabled: true, ...extra });

test("monthly and upcoming ordering use their distinct rules", () => {
  const bills = [bill("late", 25, 10), bill("early", 2, 20)];
  assert.deepEqual(sortBillsByDueDay(bills).map((item) => item.id), ["early", "late"]);
  assert.deepEqual(sortBillsByUpcomingOccurrence(bills, new Date(2026, 8, 20)).map((item) => item.id), ["late", "early"]);
});

test("totals and filters exclude inactive bills", () => {
  const bills = [bill("active", 1, 10, { isSubscription: true }), bill("inactive", 2, 50, { isActive: false, isSubscription: true })];
  assert.equal(calculateMonthlyBillTotal(bills), 10);
  assert.equal(calculateCategoryTotal(bills, "subscriptions"), 10);
  assert.equal(calculateCategoryTotal(bills, "utilities"), 10);
});
