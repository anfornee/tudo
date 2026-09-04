"use client";

import { ListTodo } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TaskCheckbox } from "@/components/tasks/TaskCheckbox";
import { TaskInput } from "@/components/tasks/TaskInput";
import { useTasks } from "@/components/tasks/useTasks";
import { dashboardTasks, remainingTaskCount } from "@/lib/tasks/utils";

export function TasksCard({ dragHandle }: { dragHandle?: React.ReactNode }) {
  const state = useTasks();
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const shown = dashboardTasks(state.tasks, 4);
  async function toggle(task: (typeof shown)[number]) {
    if (busyIds.has(task.id)) return;
    setBusyIds((ids) => new Set(ids).add(task.id));
    await state.toggle(task);
    setBusyIds((ids) => { const next = new Set(ids); next.delete(task.id); return next; });
  }
  return <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b px-5 py-3"><div className="flex min-w-0 items-center gap-2"><ListTodo className="size-4 shrink-0 text-muted-foreground" /><h2 className="text-sm font-medium">Tasks</h2><span className="truncate text-xs text-muted-foreground">{state.loading ? "Loading…" : `${remainingTaskCount(state.tasks)} remaining`}</span></div>{dragHandle}</div>
    <div className="space-y-3 px-5 py-4">{state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state.loading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : shown.length ? <ul className="space-y-2.5">{shown.map((task) => <li key={task.id} className="flex min-w-0 items-center gap-2.5"><TaskCheckbox checked={false} label={`Complete ${task.title}`} disabled={busyIds.has(task.id)} onChange={() => void toggle(task)} className="size-5" /><span className="min-w-0 truncate text-sm">{task.title}</span></li>)}</ul> : <p className="py-3 text-center text-sm text-muted-foreground">Nothing left to do. Nice work.</p>}<TaskInput compact onAdd={state.add} /><Link href="/tasks" className="inline-flex min-h-8 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View all</Link></div>
  </section>;
}
