import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, BellRing, Check, Trash2, BellOff } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { enablePush, pushSupported, type AppNotification } from "@/lib/notifications";

const ICONS: Record<string, string> = {
  love: "💜",
  journal: "📖",
  memory: "📸",
  date: "📅",
  reaction: "✨",
  watch: "🎬",
  voice: "🎙️",
};

export function NotificationCenter({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [pushState, setPushState] = useState<NotificationPermission | "unsupported">("default");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as AppNotification[]);
  }, [userId]);

  useEffect(() => {
    load();
    setPushState(pushSupported() ? Notification.permission : "unsupported");
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("notifications-center")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const n = payload.new as AppNotification;
            setItems((prev) => [n, ...prev]);
            toast(n.title, { description: n.body ?? undefined, icon: ICONS[n.type] ?? "💜" });
          } else {
            load();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  const unread = useMemo(() => items.filter((i) => !i.is_read).length, [items]);

  async function markAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("recipient_id", userId).eq("is_read", false);
  }

  async function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.is_read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    }
    if (n.link) navigate({ to: n.link });
  }

  async function clearAll() {
    setItems([]);
    await supabase.from("notifications").delete().eq("recipient_id", userId);
  }

  async function turnOnPush() {
    const result = await enablePush(userId);
    if (result === "granted") {
      setPushState("granted");
      toast.success("Push notifications on 💜");
    } else if (result === "denied") {
      toast.error("Notifications blocked", { description: "Allow them in your browser settings." });
    } else if (result === "unsupported") {
      toast.error("This browser doesn't support push");
    } else {
      toast.error("Couldn't turn on push", { description: "Try again from the published app." });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="press-pop relative rounded-full p-2 text-muted-foreground transition hover:text-primary"
          aria-label="Notifications"
        >
          {unread > 0 ? <BellRing className="h-4 w-4 animate-soft-pulse text-primary" /> : <Bell className="h-4 w-4" />}
          {unread > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
              style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-3xl p-0">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <div className="font-serif text-base">Notifications</div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button onClick={markAllRead} className="press-pop rounded-full p-1.5 text-muted-foreground hover:text-primary" aria-label="Mark all read">
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
            {items.length > 0 && (
              <button onClick={clearAll} className="press-pop rounded-full p-1.5 text-muted-foreground hover:text-destructive" aria-label="Clear all">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {pushState !== "granted" && (
          <button
            onClick={turnOnPush}
            disabled={pushState === "unsupported"}
            className="flex w-full items-center gap-2 border-b border-border/50 px-4 py-2.5 text-left text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            <BellOff className="h-3.5 w-3.5" />
            {pushState === "unsupported" ? "Push isn't supported here" : "Turn on push notifications"}
          </button>
        )}

        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">Nothing yet — all quiet 💜</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className="flex w-full gap-3 border-b border-border/30 px-4 py-3 text-left transition hover:bg-muted/40"
                style={!n.is_read ? { background: "color-mix(in oklab, var(--primary) 10%, transparent)" } : undefined}
              >
                <span className="text-lg leading-none">{ICONS[n.type] ?? "💜"}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{n.title}</div>
                  {n.body && <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                  <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--primary-glow)" }} />}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 text-center text-[10px] text-muted-foreground">Notifications clear themselves after 9 days.</div>
      </PopoverContent>
    </Popover>
  );
}
