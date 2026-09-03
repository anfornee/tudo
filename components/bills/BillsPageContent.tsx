"use client";

import { Bell, ChevronDown, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BillForm } from "@/components/bills/BillForm";
import { BillListItem } from "@/components/bills/BillListItem";
import { categoryColors, categoryLabels, subscriptionColor } from "@/components/bills/BillMetadata";
import { UpcomingBillCard } from "@/components/bills/UpcomingBillCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addBill, getBills } from "@/lib/bills/persistence";
import { billCategories, type Bill, type BillCategory, type BillInput } from "@/lib/bills/types";
import { calculateCategoryTotal, calculateMonthlyBillTotal, formatCurrency, sortBillsByDueDay } from "@/lib/bills/utils";
import { auth } from "@/lib/firebase-client";
import { enableBillNotifications } from "@/lib/bills/notifications";

type Filter = BillCategory | "subscriptions";

export function BillsPageContent({ userId }: { userId: string }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("subscriptions");
  const [expanded, setExpanded] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setBills(await getBills(userId)); } catch { setError("Unable to load your bills."); } finally { setLoading(false); } }, [userId]);
  useEffect(() => auth.onAuthStateChanged((user) => { if (!user || user.uid !== userId) window.location.assign("/api/auth/logout"); else void load(); }), [load, userId]);
  const ordered = useMemo(() => sortBillsByDueDay(bills), [bills]);
  const filtered = ordered.filter((bill) => filter === "subscriptions" ? bill.isSubscription : bill.category === filter);
  async function save(value: BillInput) { setSaving(true); setError(null); try { await addBill(userId, value); await load(); setShowAdd(false); } catch { setError("Unable to save this bill. Please try again."); } finally { setSaving(false); } }
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={async () => { setNotificationMessage(null); try { const tokenId = await enableBillNotifications(userId); localStorage.setItem("tudo-bill-notification-token", tokenId); setNotificationMessage("Bill reminders are enabled on this device."); } catch (error) { setNotificationMessage(error instanceof Error ? error.message : "Unable to enable reminders."); } }}><Bell />Enable reminders</Button><Button onClick={() => setShowAdd(true)}><Plus />Add bill</Button></div>
    {notificationMessage && <p role="status" className="text-right text-sm text-muted-foreground">{notificationMessage}</p>}
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
    <UpcomingBillCard bills={bills} loading={loading} />
    <Card size="sm"><CardHeader><CardTitle>Monthly expenses</CardTitle><p className="text-3xl font-semibold tracking-tight tabular-nums">{loading ? "—" : formatCurrency(calculateMonthlyBillTotal(bills))}</p></CardHeader><CardContent>{loading ? <div className="h-24 animate-pulse rounded-xl bg-muted" /> : ordered.length ? <div className="divide-y">{ordered.map((bill) => <BillListItem key={bill.id} bill={bill} />)}</div> : <div className="py-8 text-center text-sm text-muted-foreground">No monthly expenses yet. Add your first bill above.</div>}</CardContent></Card>
    <Card size="sm"><CardHeader className="grid-cols-[1fr_auto]"><div><CardTitle>Category total</CardTitle><p className="mt-2 text-2xl font-semibold tabular-nums">{loading ? "—" : `${formatCurrency(calculateCategoryTotal(bills, filter))} / month`}</p></div><Select value={filter} onValueChange={(value) => setFilter(value as Filter)}><SelectTrigger className="max-w-44" aria-label="Bill category filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="subscriptions" className={subscriptionColor}>Subscriptions</SelectItem>{billCategories.map((category) => <SelectItem key={category} value={category} className={categoryColors[category]}>{categoryLabels[category]}</SelectItem>)}</SelectContent></Select></CardHeader><CardContent><Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="-ml-2"><ChevronDown className={`transition-transform ${expanded ? "rotate-180" : ""}`} />{expanded ? "Hide expenses" : "Show expenses"}</Button>{expanded && <div className="mt-2 border-t pt-2">{filtered.length ? <div className="divide-y">{filtered.map((bill) => <BillListItem key={bill.id} bill={bill} />)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">No matching bills.</p>}</div>}</CardContent></Card>
    {showAdd && <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="add-bill-title" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}><div className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md shrink-0 overflow-y-auto overscroll-contain rounded-2xl border bg-card p-5 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 id="add-bill-title" className="text-lg font-semibold">Add bill</h2><Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setShowAdd(false)}><X /></Button></div><BillForm busy={saving} onSubmit={save} /></div></div>}
  </div>;
}
