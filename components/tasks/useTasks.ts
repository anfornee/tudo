"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase-client";
import { addTask, deleteTask, saveTaskOrder, setTaskCompleted, subscribeToTasks, updateTaskTitle } from "@/lib/tasks/persistence";
import type { Task } from "@/lib/tasks/types";
import { getNextTaskOrder, normalizeTaskTitle, sortActiveTasks, sortCompletedTasks } from "@/lib/tasks/utils";

export function useTasks(userId?: string) {
  const [resolvedUserId, setResolvedUserId] = useState(userId ?? null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => auth.onAuthStateChanged((user) => {
    if (!user || (userId && user.uid !== userId)) {
      window.location.assign("/api/auth/logout");
      return;
    }
    setResolvedUserId(user.uid);
  }), [userId]);

  useEffect(() => {
    if (!resolvedUserId) return;
    return subscribeToTasks(resolvedUserId, (next) => {
      setTasks(next);
      setLoading(false);
      setError(null);
    }, (reason) => {
      console.error("Unable to load tasks:", reason);
      setError("Unable to load your tasks.");
      setLoading(false);
    });
  }, [resolvedUserId]);

  const activeTasks = useMemo(() => sortActiveTasks(tasks), [tasks]);
  const completedTasks = useMemo(() => sortCompletedTasks(tasks), [tasks]);
  const run = useCallback(async (operation: () => Promise<void>, message: string) => {
    setError(null);
    try { await operation(); return true; }
    catch (reason) { console.error(message, reason); setError(message); return false; }
  }, []);

  return {
    tasks, activeTasks, completedTasks, loading, error, clearError: () => setError(null),
    add: async (rawTitle: string) => {
      const title = normalizeTaskTitle(rawTitle);
      if (!title || !resolvedUserId) return false;
      return run(() => addTask(resolvedUserId, title, getNextTaskOrder(tasks)), "Unable to add that task. Please try again.");
    },
    toggle: (task: Task) => resolvedUserId
      ? run(() => setTaskCompleted(resolvedUserId, task.id, !task.completed, task.completed ? getNextTaskOrder(tasks) : task.order), "Unable to update that task. Please try again.")
      : Promise.resolve(false),
    rename: (taskId: string, rawTitle: string) => {
      const title = normalizeTaskTitle(rawTitle);
      return title && resolvedUserId
        ? run(() => updateTaskTitle(resolvedUserId, taskId, title), "Unable to rename that task. Please try again.")
        : Promise.resolve(false);
    },
    remove: (taskId: string) => resolvedUserId
      ? run(() => deleteTask(resolvedUserId, taskId), "Unable to delete that task. Please try again.")
      : Promise.resolve(false),
    reorder: (ordered: readonly Task[]) => resolvedUserId
      ? run(() => saveTaskOrder(resolvedUserId, ordered), "Unable to save task order. Please try again.")
      : Promise.resolve(false),
  };
}
