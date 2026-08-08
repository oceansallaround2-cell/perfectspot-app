import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Calendar as CalendarIcon, Loader2, Sparkles, Pencil } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EVENT_TYPES, eventTypeMeta, type EventTypeValue } from "@/lib/event-types";
import { getPartnerId, notifyPartner } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/dates")({
  component: DatesPage,
});

interface DateRow {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  date: string;
  event_time: string | null;
  repeat_yearly: boolean | null;
  is_anniversary: boolean;
  event_type: string | null;
  created_at: string;
  updated_at?: string | null;
}

type SortMode = "upcoming" | "recent" | "anniversary";

function computeCountdown(dateStr: string, recurring: boolean) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const target = new Date(y, (m || 1) - 1, d || 1);
  target.setHours(0, 0, 0, 0);

  if (!recurring) {
    const days = Math.round((target.getTime() - today.getTime()) / 86400000);
    return {
      daysUntil: days,
      daysSinceLast: -days,
      yearsSince: null as number | null,
      passedThisYear: days < 0,
    };
  }

  const thisYear = new Date(today.getFullYear(), target.getMonth(), target.getDate());
  thisYear.setHours(0, 0, 0, 0);
  const passedThisYear = thisYear.getTime() < today.getTime();
  const next = new Date(thisYear);
  if (passedThisYear) next.setFullYear(today.getFullYear() + 1);

  const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000);
  const daysSinceLast = Math.round((today.getTime() - thisYear.getTime()) / 86400000);

  const rawYears = today.getFullYear() - target.getFullYear();
  const yearsSince = Math.max(0, rawYears - (passedThisYear ? 0 : 1));

  return { daysUntil, daysSinceLast, yearsSince, passedThisYear };
}

const emptyForm = {
  title: "",
  desc: "",
  dateVal: "",
  timeVal: "",
  type: "custom" as EventTypeValue,
  repeatYearly: false,
};

function formatTime(t: string | null | undefined) {
  if (!t) return null;
  const [h, m] = t.split(":");
  const d = new Date();
  d.setHours(parseInt(h ?? "0", 10), parseInt(m ?? "0", 10), 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function DatesPage() {
  const { user } = Route.useRouteContext();
  const [dates, setDates] = useState<DateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>("upcoming");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  useEffect(() => { getPartnerId(user.id).then(setPartnerId); }, [user.id]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("important_dates").select("*");
    setDates((data ?? []) as unknown as DateRow[]);
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

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: DateRow) {
    const type = (row.event_type as EventTypeValue) ?? (row.is_anniversary ? "anniversary" : "custom");
    setEditingId(row.id);
    setForm({
      title: row.title,
      desc: row.description ?? "",
      dateVal: row.date,
      timeVal: row.event_time ? row.event_time.slice(0, 5) : "",
      type,
      repeatYearly: row.repeat_yearly ?? eventTypeMeta(type).recurring,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title || !form.dateVal) return;
    setSaving(true);
    const meta = eventTypeMeta(form.type);
    const repeats = meta.recurring || form.repeatYearly;
    const payload = {
      title,
      description: form.desc.trim() || null,
      date: form.dateVal,
      event_time: form.timeVal || null,
      repeat_yearly: repeats,
      event_type: form.type,
      is_anniversary: repeats,
    };

    if (editingId) {
      const { error } = await supabase
        .from("important_dates")
        .update({ ...payload, updated_at: new Date().toISOString() } as never)
        .eq("id", editingId)
        .eq("creator_id", user.id);
      setSaving(false);
      if (error) return toast.error("Couldn't update", { description: error.message });
      toast.success("Date updated");
      setOpen(false);
      return;
    }

    const { error } = await supabase
      .from("important_dates")
      .insert({ creator_id: user.id, ...payload } as never);
    setSaving(false);
    if (error) return toast.error("Couldn't save", { description: error.message });

    toast.success("Date added 💜");
    notifyPartner({
      actorId: user.id,
      recipientId: partnerId,
      type: "date",
      title: `${meta.emoji} New ${meta.label.toLowerCase()}: ${title}`,
      body: new Date(`${form.dateVal}T00:00:00`).toLocaleDateString(),
      link: "/dates",
    });
    setForm(emptyForm);
    setOpen(false);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("important_dates").delete().eq("id", id).eq("creator_id", user.id);
    if (error) toast.error("Couldn't delete", { description: error.message });
    else toast.success("Date removed");
  }

  const sorted = useMemo(() => {
    const withMeta = dates.map((d) => {
      const meta = eventTypeMeta(d.event_type ?? (d.is_anniversary ? "anniversary" : "custom"));
      return { ...d, type: meta, meta: computeCountdown(d.date, meta.recurring) };
    });
    if (sort === "anniversary") {
      return withMeta.filter((d) => d.type.recurring).sort((a, b) => a.meta.daysUntil - b.meta.daysUntil);
    }
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
        <Button onClick={openCreate} className="btn-romantic press-pop shine rounded-full">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-card max-h-[90vh] overflow-y-auto border-none">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editingId ? "Edit date" : "New date"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Event type</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {EVENT_TYPES.map((t) => {
                  const active = form.type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                      className="press-pop flex items-center gap-1.5 rounded-2xl border border-border/60 px-3 py-2 text-xs font-medium transition"
                      style={active
                        ? { background: "var(--gradient-primary)", color: "var(--primary-foreground)", borderColor: "transparent", boxShadow: "var(--shadow-soft)" }
                        : { background: "var(--card)" }}
                    >
                      <span className="text-base">{t.emoji}</span> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Our first date" required />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.dateVal} onChange={(e) => setForm((f) => ({ ...f, dateVal: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} rows={2} placeholder="Anything you want to remember" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {eventTypeMeta(form.type).recurring ? "Repeats every year with a live countdown." : "A one-time event with a countdown."}
            </p>
            <Button type="submit" disabled={saving} className="btn-romantic press-pop shine w-full rounded-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Save changes" : "Save"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex gap-2">
        {(["upcoming","recent","anniversary"] as SortMode[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className="press-pop rounded-full border border-border/60 px-4 py-1.5 text-xs font-medium capitalize"
            style={sort === s ? { background: "var(--gradient-primary)", color: "var(--primary-foreground)", borderColor: "transparent" } : { background: "var(--card)" }}
          >{s === "anniversary" ? "recurring" : s}</button>
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
            const mine = d.creator_id === user.id;
            return (
              <li key={d.id} className="animate-fade-up glass-card group flex items-center gap-4 p-4">
                <div className="relative flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl text-center" style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-soft)" }}>
                  <div className="text-[9px] uppercase tracking-widest opacity-80">{new Date(`${d.date}T00:00:00`).toLocaleString(undefined, { month: "short" })}</div>
                  <div className="font-serif text-2xl leading-none">{new Date(`${d.date}T00:00:00`).getDate()}</div>
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-card px-1 text-sm shadow">{d.type.emoji}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-serif text-lg font-semibold">{d.title}</div>
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] uppercase tracking-widest text-primary">{d.type.label}</span>
                  </div>
                  {d.description && <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{d.description}</div>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${soon ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                      {soon && <Sparkles className="h-3 w-3" />}
                      {d.meta.daysUntil === 0
                        ? "Today!"
                        : d.meta.daysUntil < 0
                          ? `Passed ${Math.abs(d.meta.daysUntil)} day${Math.abs(d.meta.daysUntil) === 1 ? "" : "s"} ago`
                          : d.meta.passedThisYear && d.meta.daysSinceLast > 0 && d.meta.daysSinceLast <= 30
                            ? `Passed ${d.meta.daysSinceLast} day${d.meta.daysSinceLast === 1 ? "" : "s"} ago`
                            : `${d.meta.daysUntil} day${d.meta.daysUntil === 1 ? "" : "s"} left`}
                    </span>
                    {d.type.recurring && d.meta.yearsSince !== null && d.meta.yearsSince > 0 && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                        {d.meta.yearsSince} yr{d.meta.yearsSince === 1 ? "" : "s"}
                      </span>
                    )}
                    {d.updated_at && <span className="text-muted-foreground">edited</span>}
                  </div>
                </div>
                {mine && (
                  <div className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <button onClick={() => openEdit(d)} className="press-pop rounded-full p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary" aria-label="Edit date">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <ConfirmDialog
                      title="Remove this date?"
                      description={`"${d.title}" will be deleted for both of you. This can't be undone.`}
                      confirmLabel="Delete"
                      onConfirm={() => remove(d.id)}
                      trigger={
                        <button className="press-pop rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive" aria-label="Delete date">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      }
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
