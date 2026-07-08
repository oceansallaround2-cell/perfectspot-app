import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { findAccount, ACCOUNTS, type AccountInfo } from "@/lib/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

async function ensureAccountAndSignIn(account: AccountInfo) {
  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (!error) return;
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("invalid") || msg.includes("credential") || msg.includes("not found")) {
    const { error: signUpErr } = await supabase.auth.signUp({
      email: account.email,
      password: account.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { username: account.username, display_name: account.displayName, partner_name: account.partnerName },
      },
    });
    if (signUpErr) throw signUpErr;
    const { error: retryErr } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (retryErr) throw retryErr;
  } else {
    throw error;
  }
}

async function ensureProfile(userId: string, account: AccountInfo) {
  await supabase.from("profiles").upsert({
    id: userId,
    username: account.username,
    display_name: account.displayName,
    partner_name: account.partnerName,
  });
}

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const account = findAccount(username, password);
      if (!account) {
        toast.error("Invalid credentials", { description: "Only Mango and Anshalien can enter 💜" });
        return;
      }
      await ensureAccountAndSignIn(account);
      const { data } = await supabase.auth.getUser();
      if (data.user) await ensureProfile(data.user.id, account);
      toast.success(`Welcome ${account.displayName} 💜`);
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      toast.error("Sign in error", { description: message });
    } finally {
      setLoading(false);
    }
  }

  function quickFill(key: keyof typeof ACCOUNTS) {
    setUsername(ACCOUNTS[key].username);
    setPassword("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="animate-fade-up w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <Heart className="h-8 w-8 text-primary-foreground animate-soft-pulse" fill="currentColor" />
          </div>
          <h1 className="gradient-text text-5xl font-semibold">Perfect Spot</h1>
          <p className="mt-2 text-sm text-muted-foreground">Our little universe, just for two.</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs uppercase tracking-widest text-muted-foreground">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                autoCapitalize="none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Mango or Anshalien"
                className="rounded-xl bg-background/70 py-6 text-base"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-widest text-muted-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="rounded-xl bg-background/70 py-6 text-base"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="btn-romantic w-full rounded-full py-6 text-base font-semibold hover:-translate-y-0.5"
            >
              {loading ? "Opening the door…" : (<><Sparkles className="mr-2 h-4 w-4" /> Enter</>)}
            </Button>
          </form>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => quickFill("mango")} className="rounded-xl border border-border bg-background/50 py-2 text-xs font-medium text-muted-foreground transition hover:bg-primary/10">I'm Mango</button>
            <button type="button" onClick={() => quickFill("anshalien")} className="rounded-xl border border-border bg-background/50 py-2 text-xs font-medium text-muted-foreground transition hover:bg-primary/10">I'm Anshalien</button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">Only two hearts have keys to this place 💜</p>
      </div>
    </div>
  );
}
