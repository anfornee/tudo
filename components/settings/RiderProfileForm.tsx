"use client";

import { onAuthStateChanged } from "firebase/auth";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auth } from "@/lib/firebase-client";
import {
  centimetersToInches,
  inchesToCentimeters,
  kilogramsToPounds,
  isIsoDate,
  normalizeWeightHistory,
  poundsToKilograms,
  validateRiderProfile,
} from "@/lib/rider-profile/profile";
import { getRiderProfile, saveRiderProfile } from "@/lib/rider-profile/persistence";
import type { RiderProfile } from "@/lib/rider-profile/types";

const emptyProfile: RiderProfile = {
  version: 0,
  preferredUnits: "imperial",
  heightCm: null,
  dateOfBirth: null,
  physiologicalSex: null,
  restingHeartRateBpm: null,
  maxHeartRateBpm: null,
  weightHistory: [],
};

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RiderProfileForm({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<RiderProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [weightDate, setWeightDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (!user || user.uid !== userId) {
      window.location.assign("/api/auth/logout");
      return;
    }
    void getRiderProfile(userId)
      .then((saved) => setProfile(saved ?? emptyProfile))
      .catch(() => {
        setLoadFailed(true);
        setError("Unable to load your Rider Profile. Saving is disabled to protect existing data.");
      })
      .finally(() => setLoading(false));
  }), [userId]);

  const heightInches = profile.heightCm === null ? null : centimetersToInches(profile.heightCm);
  const heightFeet = heightInches === null ? "" : String(Math.floor(heightInches / 12));
  const remainingHeightInches = heightInches === null ? "" : String(Math.round((heightInches % 12) * 10) / 10);
  const sortedWeights = useMemo(
    () => [...profile.weightHistory].sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate)),
    [profile.weightHistory],
  );

  function updateImperialHeight(feetValue: string, inchesValue: string) {
    const feet = optionalNumber(feetValue);
    const inches = optionalNumber(inchesValue);
    setProfile((current) => ({
      ...current,
      heightCm: feet === null && inches === null ? null : inchesToCentimeters((feet ?? 0) * 12 + (inches ?? 0)),
    }));
  }

  function addWeight() {
    setError(null);
    const entered = optionalNumber(weight);
    const weightKg = entered === null ? null : profile.preferredUnits === "imperial" ? poundsToKilograms(entered) : entered;
    if (weightKg === null || weightKg < 30 || weightKg > 300 || !isIsoDate(weightDate) || weightDate > new Date().toISOString().slice(0, 10)) {
      setError(profile.preferredUnits === "imperial" ? "Enter a weight between 66 and 661 lb and a valid date." : "Enter a weight between 30 and 300 kg and a valid date.");
      return;
    }
    setProfile((current) => ({
      ...current,
      weightHistory: normalizeWeightHistory([...current.weightHistory, { effectiveDate: weightDate, weightKg }]),
    }));
    setWeight("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loadFailed) return;
    setError(null);
    setMessage(null);
    const errors = validateRiderProfile(profile);
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveRiderProfile(userId, profile);
      setProfile(saved);
      setMessage("Rider Profile saved. Existing ride estimates keep their original profile snapshot.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your Rider Profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-48 items-center justify-center rounded-xl border bg-card"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <div>
        <h2 className="font-semibold">Rider Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">Optional physiological details improve calorie estimates. Tudo stores calculations with a profile snapshot, so later changes do not silently alter past rides.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Display units</Label>
        <Select value={profile.preferredUnits} onValueChange={(units) => units && setProfile({ ...profile, preferredUnits: units })}>
          <SelectTrigger className="w-full" aria-label="Display units"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="imperial">Imperial (lb, ft/in)</SelectItem><SelectItem value="metric">Metric (kg, cm)</SelectItem></SelectContent>
        </Select>
      </div>

      <fieldset className="space-y-3 rounded-xl border bg-background p-4">
        <legend className="px-1 text-sm font-medium">Weight history</legend>
        <p className="text-xs text-muted-foreground">Date each weight so older activities use the value that was known at the time.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5"><Label htmlFor="rider-weight">Weight ({profile.preferredUnits === "imperial" ? "lb" : "kg"})</Label><Input id="rider-weight" type="number" inputMode="decimal" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="rider-weight-date">Effective date</Label><Input id="rider-weight-date" type="date" max={new Date().toISOString().slice(0, 10)} value={weightDate} onChange={(event) => setWeightDate(event.target.value)} /></div>
          <Button type="button" variant="outline" onClick={addWeight}><Plus />Add</Button>
        </div>
        {sortedWeights.length ? (
          <ul className="divide-y rounded-lg border">
            {sortedWeights.map((record) => (
              <li key={record.effectiveDate} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span><strong className="font-medium tabular-nums">{profile.preferredUnits === "imperial" ? `${kilogramsToPounds(record.weightKg).toFixed(1)} lb` : `${record.weightKg.toFixed(1)} kg`}</strong><span className="ml-2 text-muted-foreground">from {record.effectiveDate}</span></span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove weight from ${record.effectiveDate}`} onClick={() => setProfile({ ...profile, weightHistory: profile.weightHistory.filter((item) => item.effectiveDate !== record.effectiveDate) })}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">No weight records yet.</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {profile.preferredUnits === "metric" ? (
          <div className="space-y-1.5"><Label htmlFor="rider-height-cm">Height (cm)</Label><Input id="rider-height-cm" type="number" inputMode="decimal" min="100" max="250" step="0.1" value={profile.heightCm ?? ""} onChange={(event) => setProfile({ ...profile, heightCm: optionalNumber(event.target.value) })} /></div>
        ) : (
          <div className="space-y-1.5"><Label>Height</Label><div className="grid grid-cols-2 gap-2"><Input aria-label="Height feet" type="number" inputMode="numeric" min="3" max="8" placeholder="ft" value={heightFeet} onChange={(event) => updateImperialHeight(event.target.value, remainingHeightInches)} /><Input aria-label="Height inches" type="number" inputMode="decimal" min="0" max="11.9" step="0.1" placeholder="in" value={remainingHeightInches} onChange={(event) => updateImperialHeight(heightFeet, event.target.value)} /></div></div>
        )}
        <div className="space-y-1.5"><Label htmlFor="rider-birth-date">Date of birth</Label><Input id="rider-birth-date" type="date" max={new Date().toISOString().slice(0, 10)} value={profile.dateOfBirth ?? ""} onChange={(event) => setProfile({ ...profile, dateOfBirth: event.target.value || null })} /></div>
        <div className="space-y-1.5"><Label>Sex for physiological equations</Label><Select value={profile.physiologicalSex ?? "unspecified"} onValueChange={(sex) => setProfile({ ...profile, physiologicalSex: sex === "female" || sex === "male" ? sex : null })}><SelectTrigger className="w-full" aria-label="Sex for physiological equations"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unspecified">Not specified</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="male">Male</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">Optional; only used when an equation requires one of its studied categories.</p></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5"><Label htmlFor="rider-resting-hr">Resting HR</Label><Input id="rider-resting-hr" type="number" inputMode="numeric" min="30" max="120" placeholder="bpm" value={profile.restingHeartRateBpm ?? ""} onChange={(event) => setProfile({ ...profile, restingHeartRateBpm: optionalNumber(event.target.value) })} /></div>
          <div className="space-y-1.5"><Label htmlFor="rider-max-hr">Maximum HR</Label><Input id="rider-max-hr" type="number" inputMode="numeric" min="100" max="240" placeholder="bpm" value={profile.maxHeartRateBpm ?? ""} onChange={(event) => setProfile({ ...profile, maxHeartRateBpm: optionalNumber(event.target.value) })} /></div>
        </div>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{message}</p> : null}
      <Button type="submit" disabled={saving || loadFailed} className="w-full sm:w-auto">{saving ? <Loader2 className="animate-spin" /> : null}{saving ? "Saving…" : "Save Rider Profile"}</Button>
    </form>
  );
}
