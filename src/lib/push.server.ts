import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface PushPayload {
  [key: string]: string | undefined;
  title: string;
  body: string;
  link?: string;
  tag?: string;
}


export async function pushToUser(recipientId: string, payload: PushPayload) {
  const vapid = {
    subject: process.env["VAPID_SUBJECT"] ?? "mailto:hello@perfectspot.love",
    publicKey: process.env["VAPID_PUBLIC_KEY"],
    privateKey: process.env["VAPID_PRIVATE_KEY"],
  };
  if (!vapid.publicKey || !vapid.privateKey) return { sent: 0, skipped: "no-vapid-keys" };

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", recipientId);

  if (!subs || subs.length === 0) return { sent: 0 };

  let sent = 0;
  await Promise.all(
    subs.map(async (row) => {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        const request = await buildPushPayload(
          { data: payload, options: { ttl: 60 * 60 * 24, urgency: "high" } },
          subscription,
          vapid,
        );
        const res = await fetch(subscription.endpoint, {
          method: request.method,
          headers: request.headers,
          body: request.body as unknown as BodyInit,
        });
        if (res.status === 404 || res.status === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        } else if (res.ok) {
          sent += 1;
        } else {
          console.error("push failed", res.status, await res.text());
        }
      } catch (err) {
        console.error("push error", err);
      }
    }),
  );

  return { sent };
}
