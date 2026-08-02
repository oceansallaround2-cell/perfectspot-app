import { supabase } from "@/integrations/supabase/client";
import { getVapidPublicKey, sendPush } from "@/lib/push.functions";

export type NotificationType =
  | "love"
  | "journal"
  | "memory"
  | "date"
  | "reaction"
  | "watch"
  | "voice";

export interface AppNotification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

/** Resolve the partner's user id (the other profile row). */
export async function getPartnerId(selfId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("id").neq("id", selfId).limit(1);
  return data?.[0]?.id ?? null;
}

interface NotifyArgs {
  actorId: string;
  recipientId: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/** Insert an in-app notification and fire a web push to the recipient. */
export async function notifyPartner({ actorId, recipientId, type, title, body, link }: NotifyArgs) {
  if (!recipientId || recipientId === actorId) return;
  await supabase.from("notifications").insert({
    recipient_id: recipientId,
    actor_id: actorId,
    type,
    title,
    body: body ?? null,
    link: link ?? null,
  });
  try {
    await sendPush({
      data: { recipientId, title, body: body ?? "", link: link ?? "/dashboard", tag: type },
    });
  } catch {
    /* push is best-effort */
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Register the worker and store this device's push subscription. */
export async function enablePush(userId: string): Promise<"granted" | "denied" | "unsupported" | "error"> {
  if (!pushSupported()) return "unsupported";
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const { key } = await getVapidPublicKey();
    if (!key) return "error";

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));

    const json = subscription.toJSON() as { keys?: { p256dh?: string; auth?: string } };
    if (!json.keys?.p256dh || !json.keys.auth) return "error";

    await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: "endpoint" },
    );
    return "granted";
  } catch (err) {
    console.error("enablePush failed", err);
    return "error";
  }
}
