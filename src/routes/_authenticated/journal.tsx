import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Star, Trash2, Loader2, Search, Plus, BookHeart, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReactionsProvider, ReactionBar } from "@/components/Reactions";
import { getPartnerId, notifyPartner } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/journal")({
  component: JournalPage,
});

interface Entry {
  id: string;
  author_id: string;
  content: string;
  mood: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at?: string | null;
}

const MOODS = ["💜","😊","🥰","🥺","😍","😢","😴","✨","🌸","🔥"];

function JournalPage() {
  const { user } = Route.useRouteContext();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string>("💜");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editMood, setEditMood] = useState("💜");

  const load = useCallback(async () => {
    const { data } = await supabase.from("journal_entries").select("*").order("created_at", { ascending: false });
    const { data: profs } = await supabase.from("profiles").select("id,display_name");
    const map: Record<string, string> = {};
    (profs ?? []).forEach((p) => { map[p.id] = p.display_name; });
    setProfiles(map);
    setEntries((data ?? []) as Entry[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getPartnerId(user.id).then(setPartnerId); }, [user.id]);
  useEffect(() => {
    const ch = supabase
      .channel("journal-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "journal_entries" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function write(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    const text = content.trim();
    const { error } = await supabase.from("journal_entries").insert({
      author_id: user.id,
      content: text,
      mood,
    });
    setSaving(false);
    if (error) toast.error("Couldn't save", { description: error.message });
    else {
      setContent("");
      toast.success("Saved 💜");
      notifyPartner({
        actorId: user.id,
        recipientId: partnerId,
        type: "journal",
        title: `New journal entry ${mood}`,
        body: text.slice(0, 120),
        link: "/journal",
      });
    }
  }

  async function toggleFav(entry: Entry) {
    if (entry.author_id !== user.id) return;
    // Optimistic flip so the star responds instantly; realtime confirms it.
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, is_favorite: !e.is_favorite } : e)));
    const { error } = await supabase
      .from("journal_entries")
      .update({ is_favorite: !entry.is_favorite })
      .eq("id", entry.id)
      .eq("author_id", user.id);
    if (error) {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, is_favorite: entry.is_favorite } : e)));
      toast.error("Couldn't update favorite", { description: error.message });
    }
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setEditText(entry.content);
    setEditMood(entry.mood ?? "💜");
  }

  async function saveEdit() {
    if (!editingId) return;
    const text = editText.trim();
    if (!text) return;
    const id = editingId;
    setEditingId(null);
    const { error } = await supabase
      .from("journal_entries")
      .update({ content: text, mood: editMood, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("author_id", user.id);
    if (error) toast.error("Couldn't update", { description: error.message });
    else toast.success("Entry updated");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("journal_entries").delete().eq("id", id).eq("author_id", user.id);
    if (error) toast.error("Couldn't delete", { description: error.message });
    else toast.success("Entry deleted");
  }

  const filtered = useMemo(() => entries.filter((e) => {
    if (favOnly && !e.is_favorite) return false;
    if (search && !e.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [entries, search, favOnly]);

  return (
    <ReactionsProvider targetType="journal_entry" userId={user.id}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl">Love Journal</h1>
          <p className="mt-1 text-sm text-muted-foreground">A private diary, two pens.</p>
        </div>

        <form onSubmit={write} className="glass-card space-y-3 p-5">
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                className="press-pop h-9 w-9 rounded-full text-lg transition"
                style={mood === m ? { background: "var(--gradient-primary)", boxShadow: "var(--shadow-soft)" } : { background: "var(--muted)" }}
              >{m}</button>
            ))}
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write to us…"
            rows={4}
            className="rounded-xl bg-background/70"
          />
          <Button type="submit" disabled={saving || !content.trim()} className="btn-romantic press-pop shine w-full rounded-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Plus className="mr-1 h-4 w-4" /> Add entry</>)}
          </Button>
        </form>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entries…" className="rounded-full bg-background/70 pl-9" />
          </div>
          <button
            onClick={() => setFavOnly((v) => !v)}
            className="press-pop inline-flex items-center gap-1 rounded-full border border-border/60 px-4 py-2 text-xs font-medium"
            style={favOnly ? { background: "var(--gradient-primary)", color: "var(--primary-foreground)", borderColor: "transparent" } : { background: "var(--card)" }}
          >
            <Star className="h-3 w-3" fill={favOnly ? "currentColor" : "none"} /> Favorites
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-10 text-center text-sm text-muted-foreground">
            <BookHeart className="mx-auto mb-2 h-10 w-10 text-primary/50" />
            {search || favOnly ? "Nothing matches yet." : "Write the first page 💜"}
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((e) => (
              <li key={e.id} className="animate-fade-up glass-card group p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{e.mood ?? "💜"}</span>
                    <div>
                      <div className="text-sm font-medium">{profiles[e.author_id] ?? "Someone"}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}{e.updated_at ? " · edited" : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {e.author_id === user.id ? (
                      <>
                        <button
                          onClick={() => toggleFav(e)}
                          aria-label={e.is_favorite ? "Remove from favorites" : "Add to favorites"}
                          className="press-pop rounded-full p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                        >
                          <Star className="h-4 w-4 transition-transform" fill={e.is_favorite ? "currentColor" : "none"} style={e.is_favorite ? { color: "var(--primary)" } : {}} />
                        </button>
                        <button onClick={() => startEdit(e)} aria-label="Edit entry" className="press-pop rounded-full p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <ConfirmDialog
                          title="Delete this entry?"
                          description="This page of your journal will be removed for both of you."
                          onConfirm={() => remove(e.id)}
                          trigger={
                            <button aria-label="Delete entry" className="press-pop rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          }
                        />
                      </>
                    ) : (
                      e.is_favorite && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                          <Star className="h-3 w-3" fill="currentColor" /> Favorite
                        </span>
                      )
                    )}
                  </div>

                </div>

                {editingId === e.id ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {MOODS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setEditMood(m)}
                          className="press-pop h-8 w-8 rounded-full text-base transition"
                          style={editMood === m ? { background: "var(--gradient-primary)" } : { background: "var(--muted)" }}
                        >{m}</button>
                      ))}
                    </div>
                    <Textarea value={editText} onChange={(ev) => setEditText(ev.target.value)} rows={4} className="rounded-xl bg-background/70" />
                    <div className="flex gap-2">
                      <Button onClick={saveEdit} className="btn-romantic press-pop rounded-full px-4"><Check className="mr-1 h-4 w-4" /> Save</Button>
                      <Button variant="ghost" onClick={() => setEditingId(null)} className="press-pop rounded-full px-4"><X className="mr-1 h-4 w-4" /> Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 whitespace-pre-wrap font-serif text-base leading-relaxed">{e.content}</p>
                )}

                <div className="mt-3">
                  <ReactionBar
                    targetId={e.id}
                    onReacted={(emoji) =>
                      notifyPartner({
                        actorId: user.id,
                        recipientId: partnerId,
                        type: "reaction",
                        title: `Reacted ${emoji} to a journal entry`,
                        body: e.content.slice(0, 120),
                        link: "/journal",
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ReactionsProvider>
  );
}
