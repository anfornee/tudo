"use client";

import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BillForm } from "@/components/bills/BillForm";
import { BillMetadata } from "@/components/bills/BillMetadata";
import { Button } from "@/components/ui/button";
import { deleteBill, getBill, updateBill } from "@/lib/bills/persistence";
import type { Bill, BillInput } from "@/lib/bills/types";
import { formatCurrency, formatOrdinalDay } from "@/lib/bills/utils";
import { auth } from "@/lib/firebase-client";

export function BillDetailContent({ userId, billId }: { userId: string; billId: string }) {
  const router = useRouter(); const [bill, setBill] = useState<Bill | null>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [deleting, setDeleting] = useState(false); const [confirming, setConfirming] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => auth.onAuthStateChanged((user) => { if (!user || user.uid !== userId) window.location.assign("/api/auth/logout"); else void getBill(userId, billId).then(setBill).catch(() => setError("Unable to load this bill.")).finally(() => setLoading(false)); }), [billId, userId]);
  if (loading) return <div className="flex min-h-48 items-center justify-center rounded-xl border bg-card"><Loader2 className="size-6 animate-spin" /></div>;
  if (!bill) return <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">{error ?? "This bill could not be found."}</div>;
  const input: BillInput = { name: bill.name, amount: bill.amount, dueDay: bill.dueDay, category: bill.category, isAutopay: bill.isAutopay, isSubscription: bill.isSubscription, notificationsEnabled: bill.notificationsEnabled, isActive: bill.isActive };
  async function save(value: BillInput) { setSaving(true); setError(null); try { await updateBill(userId, billId, value); setBill({ ...bill!, ...value }); } catch { setError("Unable to save your changes."); } finally { setSaving(false); } }
  async function remove() { setDeleting(true); try { await deleteBill(userId, billId); router.push("/bills"); router.refresh(); } catch { setError("Unable to delete this bill."); setDeleting(false); } }
  return <div className="space-y-4"><section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"><Link href="/bills" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back to bills</Link><div className="mb-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{bill.name}</h2><p className="mt-1 text-sm text-muted-foreground">{formatCurrency(bill.amount)} · due the {formatOrdinalDay(bill.dueDay)}</p></div></div><div className="mt-3"><BillMetadata bill={bill} expanded /></div></div>{error && <p className="mb-4 text-sm text-destructive">{error}</p>}<BillForm initialValue={input} submitLabel="Save changes" busy={saving} onSubmit={save} /></section><section className="rounded-xl border border-destructive/20 bg-card p-4"><h2 className="font-medium">Delete bill</h2><p className="mt-1 text-sm text-muted-foreground">This permanently removes the recurring bill.</p>{confirming ? <div className="mt-4 flex flex-wrap gap-2"><Button variant="destructive" disabled={deleting} onClick={remove}>{deleting && <Loader2 className="animate-spin" />}Delete permanently</Button><Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button></div> : <Button variant="destructive" className="mt-4" onClick={() => setConfirming(true)}><Trash2 />Delete bill</Button>}</section></div>;
}
