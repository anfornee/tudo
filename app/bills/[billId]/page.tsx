import { redirect } from "next/navigation";
import { BillDetailContent } from "@/components/bills/BillDetailContent";
import { getCurrentUser } from "@/lib/auth";
export default async function BillPage({ params }: { params: Promise<{ billId: string }> }) { const user = await getCurrentUser(); if (!user) redirect("/api/auth/logout"); const { billId } = await params; return <main className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6"><BillDetailContent userId={user.uid} billId={billId} /></main>; }
