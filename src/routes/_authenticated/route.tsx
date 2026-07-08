import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, LogOut, LayoutDashboard, Image as ImageIcon, Send, Calendar, BookHeart, Tv } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { accountByEmail } from "@/lib/accounts";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

interface Profile {
  display_name: string;
  partner_name: string;
  username: string;
}

const NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/memories", label: "Memories", icon: ImageIcon },
  { to: "/love", label: "Love", icon: Send },
  { to: "/dates", label: "Dates", icon: Calendar },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/watch", label: "Watch", icon: Tv },
] as const;

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Self-heal: the authoritative source of identity is the email → account map.
      // If a stored profile drifted (e.g. old seed data mapped both accounts to the
      // same name), overwrite it so every screen reads the correct identity.
      const account = accountByEmail(user.email);
      if (account) {
        await supabase.from("profiles").upsert({
          id: user.id,
          username: account.username,
          display_name: account.displayName,
          partner_name: account.partnerName,
        });
      }
      const { data } = await supabase
        .from("profiles")
        .select("display_name,partner_name,username")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && data) setProfile(data as Profile);
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id, user.email]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 border-b border-border/40 backdrop-blur-xl" style={{ background: "color-mix(in oklab, var(--background) 75%, transparent)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--gradient-primary)" }}>
              <Heart className="h-4 w-4 text-primary-foreground" fill="currentColor" />
            </div>
            <div className="leading-tight">
              <div className="font-serif text-lg font-semibold">Perfect Spot</div>
              {profile && <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Hi {profile.display_name} 💜</div>}
            </div>
          </Link>
          <Button variant="ghost" size="icon" onClick={signOut} className="rounded-full text-muted-foreground hover:text-primary">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-4 z-40 mx-auto flex max-w-md items-center justify-around rounded-full border border-border/50 px-2 py-2 shadow-lg" style={{ background: "color-mix(in oklab, var(--card) 92%, transparent)", backdropFilter: "blur(20px)", boxShadow: "var(--shadow-card)" }}>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-1.5 transition"
              style={active ? { background: "var(--gradient-primary)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-soft)" } : undefined}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
