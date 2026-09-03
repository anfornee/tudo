import type { Timestamp } from "firebase/firestore";

export const billCategories = [
  "housing", "utilities", "transportation", "insurance", "debt",
  "entertainment", "fitness", "health", "education", "other",
] as const;

export type BillCategory = (typeof billCategories)[number];

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: BillCategory;
  isAutopay: boolean;
  isSubscription: boolean;
  notificationsEnabled: boolean;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type BillInput = Omit<Bill, "id" | "createdAt" | "updatedAt">;
