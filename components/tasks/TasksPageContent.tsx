"use client";

import { Check, ChevronDown, GripVertical, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TaskCheckbox } from "@/components/tasks/TaskCheckbox";
import { TaskInput } from "@/components/tasks/TaskInput";
import { useTasks } from "@/components/tasks/useTasks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Task } from "@/lib/tasks/types";
import { moveTask, remainingTaskCount } from "@/lib/tasks/utils";
import { cn } from "@/lib/utils";

export function TasksPageContent({ userId }: { userId: string }) {
  const taskState = useTasks(userId);
  const [visibleActive, setVisibleActive] = useState<Task[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const draggingId = useRef<string | null>(null);
  const startingOrder = useRef<Task[]>([]);
  const activeRef = useRef<Task[]>([]);

  useEffect(() => { if (!draggingId.current) { setVisibleActive(taskState.activeTasks); activeRef.current = taskState.activeTasks; } }, [taskState.activeTasks]);
  function setOrder(tasks: Task[]) { activeRef.current = tasks; setVisibleActive(tasks); }
  async function withBusy(id: string, operation: () => Promise<unknown>) { setBusyIds((ids) => new Set(ids).add(id)); await operation(); setBusyIds((ids) => { const next = new Set(ids); next.delete(id); return next; }); }
  function beginDrag(taskId: string) { draggingId.current = taskId; setActiveDraggingId(taskId); startingOrder.current = activeRef.current; }
  async function finishDrag() { const taskId = draggingId.current; draggingId.current = null; setActiveDraggingId(null); if (taskId && activeRef.current.some((task, index) => task.id !== startingOrder.current[index]?.id)) await taskState.reorder(activeRef.current); }
  function move(taskId: string, targetId: string) { const index = activeRef.current.findIndex((task) => task.id === targetId); if (index >= 0) setOrder(moveTask(activeRef.current, taskId, index)); }
  async function saveEdit(taskId: string) { if (await taskState.rename(taskId, editTitle)) setEditingId(null); }

  return <div className="space-y-4">
    {taskState.error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{taskState.error}</p>}
    <Card size="sm">
      <CardHeader className="border-b"><div className="flex items-center justify-between gap-3"><CardTitle>Active tasks</CardTitle><span className="text-sm text-muted-foreground">{remainingTaskCount(taskState.tasks)} remaining</span></div><div className="mt-3"><TaskInput onAdd={taskState.add} /></div></CardHeader>
      <CardContent className="px-0">
        {taskState.loading ? <div className="mx-4 h-36 animate-pulse rounded-xl bg-muted" /> : visibleActive.length === 0 ? <div className="px-5 py-12 text-center"><p className="font-medium">You’re all caught up</p><p className="mt-1 text-sm text-muted-foreground">Add a task whenever something comes to mind.</p></div> : <div className="divide-y">{visibleActive.map((task) => <div key={task.id} data-task-id={task.id} className={cn("group flex min-w-0 items-center gap-3 px-4 py-3", activeDraggingId === task.id && "bg-muted/70")}>
          <button type="button" aria-label={`Reorder ${task.title}`} className="touch-none cursor-grab rounded-lg p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing" onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); beginDrag(task.id); }} onPointerMove={(event) => { if (draggingId.current !== task.id) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-task-id]"); if (target?.dataset.taskId) move(task.id, target.dataset.taskId); }} onPointerUp={(event) => { if (draggingId.current !== task.id) return; event.currentTarget.releasePointerCapture(event.pointerId); void finishDrag(); }} onPointerCancel={() => { setOrder(startingOrder.current); draggingId.current = null; setActiveDraggingId(null); }} onKeyDown={(event) => { const index = activeRef.current.findIndex((item) => item.id === task.id); let next = index; if (event.key === "ArrowUp") next--; if (event.key === "ArrowDown") next++; if (event.key === "Home") next = 0; if (event.key === "End") next = activeRef.current.length - 1; if (next !== index) { event.preventDefault(); const ordered = moveTask(activeRef.current, task.id, next); setOrder(ordered); void taskState.reorder(ordered); } }}><GripVertical className="size-5" /></button>
          <TaskCheckbox checked={false} label={`Complete ${task.title}`} disabled={busyIds.has(task.id)} onChange={() => void withBusy(task.id, () => taskState.toggle(task))} />
          {editingId === task.id ? <form className="flex min-w-0 flex-1 gap-1" onSubmit={(event) => { event.preventDefault(); void saveEdit(task.id); }}><Input autoFocus value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={500} aria-label="Edit task title" /><Button size="icon-sm" type="submit" disabled={!editTitle.trim()} aria-label="Save task"><Check /></Button><Button size="icon-sm" variant="ghost" type="button" onClick={() => setEditingId(null)} aria-label="Cancel editing"><X /></Button></form> : <><span className="min-w-0 flex-1 break-words">{task.title}</span><Button size="icon-sm" variant="ghost" aria-label={`Edit ${task.title}`} onClick={() => { setEditTitle(task.title); setEditingId(task.id); }}><Pencil /></Button><Button size="icon-sm" variant="ghost" aria-label={`Delete ${task.title}`} disabled={busyIds.has(task.id)} onClick={() => void withBusy(task.id, () => taskState.remove(task.id))}><Trash2 /></Button></>}
        </div>)}</div>}
      </CardContent>
    </Card>
    <Card size="sm"><CardHeader><button type="button" className="flex min-h-10 w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={completedOpen} onClick={() => setCompletedOpen((open) => !open)}><span className="font-medium">Completed <span className="font-normal text-muted-foreground">({taskState.completedTasks.length})</span></span><ChevronDown className={cn("size-5 text-muted-foreground transition-transform", completedOpen && "rotate-180")} /></button></CardHeader>{completedOpen && <CardContent className="border-t px-0 pt-2">{taskState.completedTasks.length === 0 ? <p className="px-5 py-6 text-center text-sm text-muted-foreground">Completed tasks will appear here.</p> : <div className="divide-y">{taskState.completedTasks.map((task) => <div key={task.id} className="flex min-w-0 items-center gap-3 px-5 py-3 text-muted-foreground"><TaskCheckbox checked label={`Restore ${task.title}`} disabled={busyIds.has(task.id)} onChange={() => void withBusy(task.id, () => taskState.toggle(task))} /><span className="min-w-0 flex-1 break-words line-through decoration-muted-foreground/60">{task.title}</span><Button size="icon-sm" variant="ghost" aria-label={`Delete ${task.title}`} disabled={busyIds.has(task.id)} onClick={() => void withBusy(task.id, () => taskState.remove(task.id))}><Trash2 /></Button></div>)}</div>}</CardContent>}</Card>
  </div>;
}
