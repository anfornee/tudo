import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "@google-cloud/firestore";
import { adminMessaging } from "@/lib/firebase-admin";
import { db } from "@/lib/firestore";
import { addCalendarDays, effectiveDueDay } from "@/lib/bills/reminder-schedule";

export const runtime = "nodejs";

interface StoredBill { name: string; amount: number; dueDay: number; isAutopay: boolean; isActive: boolean; notificationsEnabled: boolean }
interface LocalParts { year: number; month: number; day: number; hour: number; minute: number }

function localParts(now: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function money(amount: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount); }

export async function POST(request: NextRequest) {
  const secret = process.env.BILLS_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const billsSnapshot = await db.collectionGroup("bills").get();
  const billsByUser = new Map<string, StoredBill[]>();
  for (const item of billsSnapshot.docs) {
    const bill = item.data() as StoredBill;
    if (!bill.isActive || !bill.notificationsEnabled) continue;
    const userId = item.ref.parent.parent?.id;
    if (!userId) continue;
    billsByUser.set(userId, [...(billsByUser.get(userId) ?? []), bill]);
  }
  let sent = 0;
  for (const [userId, bills] of billsByUser) {
    const settings = await db.doc(`users/${userId}/preferences/notifications`).get();
    const timeZone = settings.data()?.timeZone as string | undefined;
    if (!timeZone) continue;
    let local: LocalParts;
    try { local = localParts(now, timeZone); } catch { continue; }
    const autopayWindow = local.hour === 20 && local.minute < 30;
    const dueWindow = local.hour === 9 && local.minute >= 30;
    if (!autopayWindow && !dueWindow) continue;
    const target = autopayWindow ? addCalendarDays(local, 1) : local;
    const matching = bills.filter((bill) => bill.isAutopay === autopayWindow && effectiveDueDay(bill.dueDay, target.year, target.month) === target.day);
    if (!matching.length) continue;
    const kind = autopayWindow ? "autopay" : "due";
    const key = `${target.year}-${String(target.month).padStart(2, "0")}-${String(target.day).padStart(2, "0")}-${kind}`;
    const deliveryRef = db.doc(`users/${userId}/billNotificationDeliveries/${key}`);
    const tokenDocuments = (await db.collection(`users/${userId}/notificationTokens`).get()).docs
      .map((item) => ({ ref: item.ref, token: item.data().token as unknown }))
      .filter((item): item is typeof item & { token: string } => typeof item.token === "string" && item.token.length > 0);
    if (!tokenDocuments.length) continue;
    const total = matching.reduce((sum, bill) => sum + bill.amount, 0);
    const single = matching.length === 1;
    const title = single ? `${matching[0].name} ${autopayWindow ? "tomorrow" : "due today"}` : `${matching.length} bills ${autopayWindow ? "coming out tomorrow" : "due today"}`;
    const body = single ? `${money(total)} is ${autopayWindow ? "scheduled for autopay tomorrow" : "due today"}.` : `${money(total)} total ${autopayWindow ? "scheduled for autopay" : "due"}.`;
    const claimedDelivery = await db.runTransaction(async (transaction) => {
      if ((await transaction.get(deliveryRef)).exists) return false;
      transaction.create(deliveryRef, { createdAt: FieldValue.serverTimestamp(), timeZone, billCount: matching.length, status: "sending" });
      return true;
    });
    if (!claimedDelivery) continue;
    let notificationWasDelivered = false;
    try {
      const response = await adminMessaging.sendEachForMulticast({ tokens: tokenDocuments.map((item) => item.token), notification: { title, body }, data: { url: "/bills" }, webpush: { notification: { tag: `bills-${key}` } } });
      const invalidTokenCodes = new Set([
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered",
      ]);
      const invalidTokens = response.responses.flatMap((result, index) =>
        !result.success && result.error?.code && invalidTokenCodes.has(result.error.code)
          ? [tokenDocuments[index]]
          : [],
      );

      await Promise.all(invalidTokens.map((item) => item.ref.delete())).catch((error) => {
        console.error("Unable to remove invalid notification tokens:", error);
      });

      if (response.successCount === 0) {
        await deliveryRef.delete();
        continue;
      }

      notificationWasDelivered = true;
      await deliveryRef.update({
        status: "delivered",
        deliveredAt: FieldValue.serverTimestamp(),
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
      sent += response.successCount;
    } catch (error) {
      if (!notificationWasDelivered) {
        await deliveryRef.delete();
      }
      throw error;
    }
  }
  return NextResponse.json({ ok: true, sent });
}
