import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase-client";
import type { Task } from "@/lib/tasks/types";

const tasksCollection = (userId: string) => collection(db, "users", userId, "tasks");

export function subscribeToTasks(
  userId: string,
  onTasks: (tasks: Task[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    tasksCollection(userId),
    { includeMetadataChanges: true },
    (snapshot) => onTasks(snapshot.docs.map((item) => ({ id: item.id, ...item.data({ serverTimestamps: "estimate" }) }) as Task)),
    onError,
  );
}

export async function addTask(userId: string, title: string, order: number): Promise<void> {
  await addDoc(tasksCollection(userId), {
    title,
    completed: false,
    order,
    createdAt: serverTimestamp(),
    completedAt: null,
  });
}

export async function setTaskCompleted(userId: string, taskId: string, completed: boolean, order: number): Promise<void> {
  await updateDoc(doc(tasksCollection(userId), taskId), {
    completed,
    order,
    completedAt: completed ? serverTimestamp() : null,
  });
}

export async function updateTaskTitle(userId: string, taskId: string, title: string): Promise<void> {
  await updateDoc(doc(tasksCollection(userId), taskId), { title });
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  await deleteDoc(doc(tasksCollection(userId), taskId));
}

export async function saveTaskOrder(userId: string, tasks: readonly Task[]): Promise<void> {
  const batch = writeBatch(db);
  tasks.forEach((task, order) => batch.update(doc(tasksCollection(userId), task.id), { order }));
  await batch.commit();
}
