import type { Timestamp } from "firebase/firestore";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  createdAt: Timestamp;
  completedAt: Timestamp | null;
}

