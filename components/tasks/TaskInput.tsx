"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TaskInput({ onAdd, compact = false }: { onAdd: (title: string) => Promise<boolean>; compact?: boolean }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    if (await onAdd(title)) setTitle("");
    setSaving(false);
  }
  return <form onSubmit={submit} className="flex min-w-0 gap-2">
    <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a task…" aria-label="New task title" maxLength={500} disabled={saving} className={compact ? "h-8 text-sm" : "h-11"} />
    <Button type="submit" size={compact ? "icon-sm" : "icon-lg"} disabled={saving || !title.trim()} aria-label="Add task"><Plus /></Button>
  </form>;
}

