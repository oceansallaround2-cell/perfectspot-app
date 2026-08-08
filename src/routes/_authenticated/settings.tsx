import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const tooShort = next.length > 0 && next.length < 6;
  const mismatch = confirm.length > 0 && confirm !== next;
  const valid = current.trim().length > 0 && next.length >= 6 && next === confirm;

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !user.email) return;
    setSaving(true);
    try {
      const { error: reauth } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current.trim(),
      });
      if (reauth) {
        toast.error("Current password is incorrect");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        toast.error("Couldn't update password", { description: error.message });
        return;
      }
      toast.success("Password updated 💜", {
        description: "Please sign in again with your new passcode.",
      });
      await supabase.auth.signOut({ scope: "global" });
      navigate({ to: "/auth", replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account, kept safe and yours alone.</p>
      </header>

      <section className="glass-card p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-serif text-xl">Security</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Change your passcode. You'll be signed out everywhere after.</p>

        <form onSubmit={changePassword} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current">Current passcode</Label>
            <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="rounded-2xl" autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next">New passcode</Label>
            <Input id="next" type="password" value={next} onChange={(e) => setNext(e.target.value)} className="rounded-2xl" autoComplete="new-password" />
            {tooShort && <p className="text-[11px] text-destructive">Use at least 6 characters.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPw">Confirm new passcode</Label>
            <Input id="confirmPw" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded-2xl" autoComplete="new-password" />
            {mismatch && <p className="text-[11px] text-destructive">Passcodes don't match.</p>}
          </div>
          <Button type="submit" disabled={!valid || saving} className="btn-romantic press-pop w-full rounded-full">
            <Lock className="mr-2 h-4 w-4" />
            {saving ? "Updating…" : "Update passcode"}
          </Button>
        </form>
      </section>

      <section className="glass-card p-6">
        <h2 className="font-serif text-xl">Session</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          You stay signed in on this device until you log out here.
        </p>
        <ConfirmDialog
          title="Log out of Perfect Spot?"
          description="You'll need your passcode to come back in."
          onConfirm={signOut}
          trigger={
            <Button variant="secondary" className="press-pop mt-4 rounded-full">
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </Button>
          }
        />
      </section>
    </div>
  );
}
