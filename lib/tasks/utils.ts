import type { Task } from "@/lib/tasks/types";

type OrderableTask = Pick<Task, "id" | "completed" | "order" | "completedAt" | "createdAt">;

export function normalizeTaskTitle(title: string): string | null {
  const normalized = title.trim();
  return normalized.length > 0 ? normalized : null;
}

export function sortActiveTasks<T extends OrderableTask>(tasks: readonly T[]): T[] {
  return tasks
    .filter((task) => !task.completed)
    .sort((a, b) => a.order - b.order || a.createdAt.toMillis() - b.createdAt.toMillis());
}

export function sortCompletedTasks<T extends OrderableTask>(tasks: readonly T[]): T[] {
  return tasks
    .filter((task) => task.completed)
    .sort((a, b) => (b.completedAt?.toMillis() ?? 0) - (a.completedAt?.toMillis() ?? 0));
}

export function getNextTaskOrder(tasks: readonly Pick<Task, "completed" | "order">[]): number {
  const activeOrders = tasks.filter((task) => !task.completed).map((task) => task.order);
  return activeOrders.length === 0 ? 0 : Math.max(...activeOrders) + 1;
}

export function moveTask<T extends { id: string }>(tasks: readonly T[], taskId: string, targetIndex: number): T[] {
  const currentIndex = tasks.findIndex((task) => task.id === taskId);
  const boundedIndex = Math.max(0, Math.min(tasks.length - 1, targetIndex));
  if (currentIndex === -1 || currentIndex === boundedIndex) return [...tasks];
  const next = [...tasks];
  const [task] = next.splice(currentIndex, 1);
  next.splice(boundedIndex, 0, task);
  return next;
}

export function dashboardTasks<T extends OrderableTask>(tasks: readonly T[], limit = 4): T[] {
  return sortActiveTasks(tasks).slice(0, limit);
}

export function remainingTaskCount(tasks: readonly Pick<Task, "completed">[]): number {
  return tasks.filter((task) => !task.completed).length;
}

