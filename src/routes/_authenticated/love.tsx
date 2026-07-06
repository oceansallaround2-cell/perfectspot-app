import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Heart, Send, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/love")({
  component: LovePage,
});

const PRESETS = [
  "I miss you babyyyy 💜",
  "You are the besttt 💜",
  "I love you cupcake 💜",
  "I am thinking about you 💜",
  "Sending virtual hugs 💜",
  "Come back soon 💜",
];

interface LoveMsg { id: string; sender_id: string; message: string; created_at: string; }

function useHearts() {
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  function burst() {
    const newHearts = Array.from({ length: 8 }, (_, i) => ({ id: Date.now() + i, x: Math.random() * 100 }));
    setHearts((h) => [...h, ...newHearts]);
    setTimeout(() => {
      setHearts((h) => h.filter((x) => !newHearts.find((n) => n.id === x.id)));
    }, 1800);
  }
  return { hearts, burst };
}

function LovePage() {
  const { user } = Route.useRouteContext();
  const [messages, setMessages] = useState<LoveMsg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const { hearts, burst } = useHearts();

  const load = useCallback(async () => {
    const { data } = await supabase.from("love_messages").select("*").order("created_at", { ascending: false }).limit(100);
    const { data: profs } = await supabase.from("profiles").select("id,display_name");
    const map: Record<string, string> = {};
    (profs ?? []).forEach((p) => { map[p.id] = p.display_name; });
    setProfiles(map);
    setMessages((data ?? []) as LoveMsg[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("love-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "love_messages" }, (payload) => {
        const msg = payload.new as LoveMsg;
        setMessages((m) => [msg, ...m]);
        if (msg.sender_id !== user.id) {
          burst();
          toast(msg.message, { icon: "💜" });
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "love_messages" }, (payload) => {
        setMessages((m) => m.filter((x) => x.id !== (payload.old as LoveMsg).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id, burst]);

  async function send(text: string) {
    if (!text.trim()) return;
    setSending(true);
    burst();
    const { error } = await supabase.from("love_messages").insert({ sender_id: user.id, message: text.trim() });
    setSending(false);
    if (error) toast.error("Couldn't send", { description: error.message });
    else { setCustom(""); toast.success("Sent with love 💜"); }
  }

  async function remove(id: string) {
    await supabase.from("love_messages").delete().eq("id", id);
  }

  return (
    <div className="relative space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Send Love</h1>
        <p className="mt-1 text-sm text-muted-foreground">A tap. A smile on the other side.</p>
      </div>

      <section className="glass-card p-5">
        <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Quick love</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRESETS.map((p, i) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={sending}
              className="animate-fade-up group flex items-center justify-between rounded-2xl border border-border/50 bg-background/60 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="text-sm font-medium">{p}</span>
              <Send className="h-4 w-4 text-primary opacity-60 transition group-hover:opacity-100 group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </section>

      <section className="glass-card p-5">
        <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Custom note</div>
        <form onSubmit={(e) => { e.preventDefault(); send(custom); }} className="flex gap-2">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Say something sweet…" className="rounded-full bg-background/70" />
          <Button type="submit" disabled={sending || !custom.trim()} className="btn-romantic rounded-full px-5">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Heart className="h-3 w-3 text-primary" fill="currentColor" /> Love history
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">Send the first message 💜</div>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const mine = m.sender_id === user.id;
              return (
                <li key={m.id} className={`animate-fade-up flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className="group relative max-w-[80%] rounded-3xl px-4 py-2.5 shadow-sm"
                    style={mine
                      ? { background: "var(--gradient-primary)", color: "var(--primary-foreground)", borderBottomRightRadius: "0.5rem" }
                      : { background: "var(--card)", border: "1px solid var(--border)", borderBottomLeftRadius: "0.5rem" }}
                  >
                    <div className="text-sm">{m.message}</div>
                    <div className={`mt-1 text-[9px] uppercase tracking-widest ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {profiles[m.sender_id] ?? "Someone"} · {new Date(m.created_at).toLocaleString()}
                    </div>
                    {mine && (
                      <button onClick={() => remove(m.id)} className="absolute -right-2 -top-2 hidden rounded-full bg-destructive p-1 text-destructive-foreground group-hover:block">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        {hearts.map((h) => (
          <Heart
            key={h.id}
            className="animate-float-heart absolute bottom-24 h-8 w-8 text-primary"
            fill="currentColor"
            style={{ left: `${h.x}%` }}
          />
        ))}
      </div>
    </div>
  );
}
