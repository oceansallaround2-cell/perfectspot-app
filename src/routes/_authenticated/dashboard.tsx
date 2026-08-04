import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Image as ImageIcon, Send, Calendar, BookHeart, Heart } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { surpriseMeta } from "@/lib/surprise";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

interface Profile { display_name: string; partner_name: string; }

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [surprise, setSurprise] = useState<{ id: string; title: string; event_type: string } | null>(null);
  const [counts, setCounts] = useState({ memories: 0, messages: 0, dates: 0, entries: 0 });
  const [daysTogether, setDaysTogether] = useState<number | null>(null);

  useEffect(() => {
    const nowIso = new Date().toISOString();
    supabase
      .from("surprise_events")
      .select("id,title,event_type")
      .lte("start_at", nowIso)
      .gte("end_at", nowIso)
      .order("start_at", { ascending: false })
      .limit(1)
      .then(({ data }) => setSurprise(data?.[0] ?? null));
  }, [user.id]);


  useEffect(() => {
    (async () => {
      const [{ data: p }, m, msg, d, j, ann] = await Promise.all([
        supabase.from("profiles").select("display_name,partner_name").eq("id", user.id).maybeSingle(),
        supabase.from("memories").select("id", { count: "exact", head: true }),
        supabase.from("love_messages").select("id", { count: "exact", head: true }),
        supabase.from("important_dates").select("id", { count: "exact", head: true }),
        supabase.from("journal_entries").select("id", { count: "exact", head: true }),
        supabase.from("important_dates").select("date").eq("is_anniversary", true).order("date", { ascending: true }).limit(1).maybeSingle(),
      ]);
      if (p) setProfile(p as Profile);
      setCounts({
        memories: m.count ?? 0,
        messages: msg.count ?? 0,
        dates: d.count ?? 0,
        entries: j.count ?? 0,
      });
      if (ann.data?.date) {
        const start = new Date(ann.data.date);
        const diff = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
        setDaysTogether(diff);
      }
    })();
  }, [user.id]);

  const tiles = [
    { to: "/memories", label: "Memories", desc: "Photos & videos, forever", icon: ImageIcon, count: counts.memories, tint: "from-[#2A1E48] to-[#4B2E83]" },
    { to: "/love", label: "Send Love", desc: "A little note across the miles", icon: Send, count: counts.messages, tint: "from-[#3B2469] to-[#7A4BB8]" },
    { to: "/dates", label: "Important Dates", desc: "Count every day that matters", icon: Calendar, count: counts.dates, tint: "from-[#221A35] to-[#5E3AA5]" },
    { to: "/journal", label: "Love Journal", desc: "Our private diary", icon: BookHeart, count: counts.entries, tint: "from-[#2E1F4D] to-[#8A5FC9]" },
  ];

  return (
    <div className="space-y-6">
      <section className="animate-fade-up glass-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Welcome back</p>
        <h1 className="mt-1 font-serif text-4xl">
          Hello <span className="gradient-text">{profile?.display_name ?? "love"}</span>{" "}
          <Heart className="ml-1 inline h-6 w-6 text-primary" fill="currentColor" />
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {profile?.display_name === "Sidrah"
            ? "Every memory I make here is another way of saying I love you, Priyanshu♥️"
            : profile?.display_name === "Priyanshu"
              ? "Someone loves you more than words can say ♥️"
              : "Everything you make here is only for the two of you."}
        </p>
        {daysTogether !== null && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-4 py-1.5 text-xs">
            <Heart className="h-3 w-3 text-primary" fill="currentColor" />
            <span className="font-medium">{daysTogether} days together</span>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        {tiles.map((t, i) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`animate-fade-up group relative overflow-hidden rounded-3xl border border-border/50 p-5 transition hover:-translate-y-1 hover:shadow-lg bg-gradient-to-br ${t.tint}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
              </div>
              <div className="mt-6">
                <div className="font-serif text-xl font-semibold text-foreground">{t.label}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-foreground/70">{t.desc}</div>
                <div className="mt-3 text-[10px] uppercase tracking-widest text-foreground/60">{t.count} {t.count === 1 ? "item" : "items"}</div>
              </div>
            </Link>
          );
        })}
      </section>

      <p className="pt-4 text-center text-[10px] tracking-wide text-muted-foreground/50">
        Created with love by Mango, for Anshalien. 🤍
      </p>
    </div>
  );
}
