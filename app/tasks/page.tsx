import { redirect } from "next/navigation";
import { TasksPageContent } from "@/components/tasks/TasksPageContent";
import { getCurrentUser } from "@/lib/auth";

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");
  return <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6"><div><h1 className="text-2xl font-semibold tracking-tight">Tasks</h1><p className="mt-1 text-sm text-muted-foreground">A simple list for what needs doing.</p></div><TasksPageContent userId={user.uid} /></main>;
}

