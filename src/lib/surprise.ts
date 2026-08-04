import { supabase } from "@/integrations/supabase/client";

export const SURPRISE_TYPES = [
  { value: "birthday", label: "Birthday", emoji: "🎂", defaultTitle: "Happy Birthday!" },
  { value: "anniversary", label: "Anniversary", emoji: "💜", defaultTitle: "Happy Anniversary!" },
  { value: "valentines", label: "Valentine's Day", emoji: "🌹", defaultTitle: "Happy Valentine's Day!" },
  { value: "custom", label: "Custom Occasion", emoji: "✨", defaultTitle: "" },
] as const;

export type SurpriseType = (typeof SURPRISE_TYPES)[number]["value"];

export function surpriseMeta(value: string | null | undefined) {
  return SURPRISE_TYPES.find((t) => t.value === value) ?? SURPRISE_TYPES[SURPRISE_TYPES.length - 1];
}

export interface SurpriseEvent {
  id: string;
  creator_id: string;
  recipient_id: string;
  event_type: string;
  title: string;
  start_at: string;
  end_at: string;
  music_path: string | null;
  voice_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurprisePhoto {
  id: string;
  event_id: string;
  storage_path: string;
  position: number;
}

export interface SurpriseNote {
  id: string;
  event_id: string;
  content: string;
  position: number;
}

export const SURPRISE_BUCKET = "surprises";

/** Signed URL for a private surprise asset (6h). */
export async function surpriseUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(SURPRISE_BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

export async function uploadSurpriseFile(eventId: string, kind: string, file: File | Blob, ext: string) {
  const path = `${eventId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(SURPRISE_BUCKET)
    .upload(path, file, { contentType: (file as File).type || undefined, upsert: false });
  if (error) throw error;
  return path;
}

export async function removeSurpriseFile(path: string | null | undefined) {
  if (!path) return;
  await supabase.storage.from(SURPRISE_BUCKET).remove([path]);
}

export function fileExt(file: File, fallback: string) {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : fallback;
}

export type EventPhase = "upcoming" | "live" | "past";

export function eventPhase(ev: Pick<SurpriseEvent, "start_at" | "end_at">, now = Date.now()): EventPhase {
  const start = new Date(ev.start_at).getTime();
  const end = new Date(ev.end_at).getTime();
  if (now < start) return "upcoming";
  if (now > end) return "past";
  return "live";
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Local datetime value for <input type="datetime-local"> */
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
