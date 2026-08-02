import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env["VAPID_PUBLIC_KEY"] ?? "" };
});

export const sendPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipientId: string; title: string; body: string; link?: string; tag?: string }) => input)
  .handler(async ({ data }) => {
    const { pushToUser } = await import("./push.server");
    return pushToUser(data.recipientId, {
      title: data.title,
      body: data.body,
      link: data.link,
      tag: data.tag,
    });
  });
