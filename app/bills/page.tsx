import { redirect } from "next/navigation";
import { BillsPageContent } from "@/components/bills/BillsPageContent";
import { getCurrentUser } from "@/lib/auth";

export default async function BillsPage() { const user = await getCurrentUser(); if (!user) redirect("/api/auth/logout"); return <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6"><div><h1 className="text-2xl font-semibold tracking-tight">Bills</h1><p className="mt-1 text-sm text-muted-foreground">Your recurring monthly expenses.</p></div><BillsPageContent userId={user.uid} /></main>; }
