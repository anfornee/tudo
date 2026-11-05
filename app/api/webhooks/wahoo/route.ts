import { createHash, timingSafeEqual } from "node:crypto";
import { MAX_RIDE_FILE_SIZE, processRideFile } from "@/lib/rides/import";
import { resolveTudoUidForWahooUser } from "@/lib/rides/wahoo-connection";
import { hasWahooRide, saveWahooRide } from "@/lib/rides/wahoo-persistence";

export const runtime = "nodejs";
export const maxDuration = 60;

// Cycling workout IDs from Wahoo's Cloud API workout types.
const cyclingTypes = new Set([0, 11, 12, 13, 14, 15, 16, 21, 49, 61, 64, 68, 70]);

async function readBytes(body: ReadableStream<Uint8Array> | null, limit: number) {
  if (!body) return new ArrayBuffer(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new Error("Body exceeds size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes.buffer;
}

function tokenMatches(received: unknown, expected: string) {
  if (typeof received !== "string") return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

interface WahooEvent {
  webhook_token?: unknown;
  event_type?: string;
  user?: { id?: number };
  workout_summary?: {
    file?: { url?: string };
    workout?: { id?: number; workout_type_id?: number };
  };
}

export async function POST(request: Request) {
  const token = process.env.WAHOO_WEBHOOK_TOKEN;

  if (!token) {
    return new Response(null, { status: 503 });
  }

  let event: WahooEvent;
  try {
    const bytes = await readBytes(request.body, 64 * 1024);
    event = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!tokenMatches(event?.webhook_token, token)) {
    return new Response(null, { status: 401 });
  }

  const summary = event.workout_summary;
  const workout = summary?.workout;
  const wahooUserId = event.user?.id;
  const workoutId = workout?.id;
  const fileUrl = summary?.file?.url;
  if (
    event.event_type !== "workout_summary" ||
    typeof wahooUserId !== "number" || !Number.isSafeInteger(wahooUserId) || wahooUserId <= 0 ||
    typeof workout?.workout_type_id !== "number" ||
    !cyclingTypes.has(workout.workout_type_id) ||
    typeof fileUrl !== "string" ||
    typeof workoutId !== "number" || !Number.isSafeInteger(workoutId) || workoutId <= 0
  ) {
    return new Response(null, { status: 200 });
  }

  const url = URL.canParse(fileUrl) ? new URL(fileUrl) : null;
  if (url?.origin !== "https://cdn.wahooligan.com" || url.username || url.password) {
    return new Response(null, { status: 400 });
  }

  try {
    const tudoUid = await resolveTudoUidForWahooUser(wahooUserId);
    if (!tudoUid) return new Response(null, { status: 200 });
    const rideId = `wahoo-${workoutId}`;
    if (!(await hasWahooRide(tudoUid, rideId))) {
      const download = await fetch(url, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (!download.ok) throw new Error("Wahoo FIT download failed");
      const bytes = await readBytes(download.body, MAX_RIDE_FILE_SIZE);
      const ride = await processRideFile(new File([bytes], `${rideId}.fit`));
      await saveWahooRide(tudoUid, rideId, ride);
    }
    return new Response(null, { status: 200 });
  } catch {
    console.error("Wahoo ride import failed", { workoutId });
    return new Response(null, { status: 500 });
  }
}
