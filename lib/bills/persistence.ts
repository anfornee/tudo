import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import type { Bill, BillInput } from "@/lib/bills/types";

const billsCollection = (userId: string) => collection(db, "users", userId, "bills");

export async function getBills(userId: string) {
  const snapshot = await getDocs(query(billsCollection(userId), orderBy("dueDay")));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Bill);
}

export async function getBill(userId: string, billId: string) {
  const snapshot = await getDoc(doc(billsCollection(userId), billId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Bill) : null;
}

export async function addBill(userId: string, input: BillInput) {
  return addDoc(billsCollection(userId), { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateBill(userId: string, billId: string, input: BillInput) {
  await updateDoc(doc(billsCollection(userId), billId), { ...input, updatedAt: serverTimestamp() });
}

export async function deleteBill(userId: string, billId: string) {
  await deleteDoc(doc(billsCollection(userId), billId));
}
