import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Calendar as CalendarIcon, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/dates")({
  component: DatesPage,
});

interface DateRow {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  date: string;
  is_anniversary: boolean;
  created_at: string;
}

type SortMode = "upcoming" | "recent" | "anniversary";

function computeCountdown(dateStr: string, anniversary: boolean) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  if (anniversary) {
    const next = new Date(target);
    next.setFullYear(today.getFullYear());
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    const diff = Math.round((next.getTime() - today.getTime()) / 86400000);
    const years = today.getFullYear() - target.getFullYear() - (next.getFullYear() > today.getFullYear() ? 1 : 0);
    return { daysUntil: diff, yearsSince: Math.max(0, years) };
  }
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  return { daysUntil: diff, yearsSince: null as number | null };
}

function DatesPage() {
  const { user } = Route.useRouteContext();
  const [dates, setDates] = useState<DateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>("upcoming");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [dateVal, setDateVal] = useState("");
  const [isAnn, setIsAnn] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("important_dates").select("*");
    setDates((data ?? []) as DateRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("dates-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "important_dates" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !dateVal) return;
    setSaving(true);
    const { error } = await supabase.from("important_dates").insert({
      creator_id: user.id,
      title: title.trim(),
      description: desc.trim() || null,
      date: dateVal,
      is_anniversary: isAnn,
    });
    setSaving(false);
    if (error) toast.error("Couldn't save", { description: error.message });
    else {
      toast.success("Date added 💜");
      setTitle(""); setDesc(""); setDateVal(""); setIsAnn(false); setOpen(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this date?")) return;
    await supabase.from("important_dates").delete().eq("id", id);
  }

  const sorted = useMemo(() => {
    const withMeta = dates.map((d) => ({ ...d, meta: computeCountdown(d.date, d.is_anniversary) }));
    if (sort === "anniversary") return withMeta.filter((d) => d.is_anniversary).sort((a, b) => a.meta.daysUntil - b.meta.daysUntil);
    if (sort === "recent") return withMeta.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return withMeta.sort((a, b) => a.meta.daysUntil - b.meta.daysUntil);
  }, [dates, sort]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl">Important Dates</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every day worth counting toward.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-romantic rounded-full"><Plus className="mr-1 h-4 w-4" /> Add</Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-none">
            <DialogHeader><DialogTitle className="font-serif text-2xl">New date</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Our first date" required />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Anything you want to remember" />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-3">
                <div>
                  <div className="text-sm font-medium">Anniversary</div>
                  <div className="text-xs text-muted-foreground">Repeats every year</div>
                </div>
                <Switch checked={isAnn} onCheckedChange={setIsAnn} />
              </div>
              <Button type="submit" disabled={saving} className="btn-romantic w-full rounded-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {(["upcoming","recent","anniversary"] as SortMode[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className="rounded-full border border-border/60 px-4 py-1.5 text-xs font-medium capitalize"
            style={sort === s ? { background: "var(--gradient-primary)", color: "var(--primary-foreground)", borderColor: "transparent" } : { background: "var(--card)" }}
          >{s}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : sorted.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-muted-foreground">
          <CalendarIcon className="mx-auto mb-2 h-10 w-10 text-primary/50" />
          Add your first date to start counting.
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((d) => {
            const soon = d.meta.daysUntil >= 0 && d.meta.daysUntil <= 7;
            return (
              <li key={d.id} className="animate-fade-up glass-card group flex items-center gap-4 p-4">
                <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl text-center" style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}>
                  <div className="text-[9px] uppercase tracking-widest opacity-80">{new Date(d.date).toLocaleString(undefined, { month: "short" })}</div>
                  <div className="font-serif text-2xl leading-none">{new Date(d.date).getDate()}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-serif text-lg font-semibold">{d.title}</div>
                    {d.is_anniversary && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] uppercase tracking-widest text-primary">Anniversary</span>}
                  </div>
                  {d.description && <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{d.description}</div>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${soon ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                      {soon && <Sparkles className="h-3 w-3" />}
                      {d.meta.daysUntil === 0 ? "Today!" : d.meta.daysUntil > 0 ? `in ${d.meta.daysUntil} days` : `${Math.abs(d.meta.daysUntil)} days ago`}
                    </span>
                    {d.is_anniversary && d.meta.yearsSince !== null && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                        {d.meta.yearsSince} yr{d.meta.yearsSince === 1 ? "" : "s"} together
                      </span>
                    )}
                  </div>
                </div>
                {d.creator_id === user.id && (
                  <button onClick={() => remove(d.id)} className="rounded-full p-2 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
