import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, X, Search, Filter, Trash2, Play, Loader2, Image as ImageIcon, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MemoriesLock, useMemoriesUnlocked, lockMemories } from "@/components/MemoriesLock";

export const Route = createFileRoute("/_authenticated/memories")({
  component: MemoriesGate,
});

function MemoriesGate() {
  const [unlocked, setUnlocked] = useMemoriesUnlocked();
  if (!unlocked) return <MemoriesLock onUnlock={() => setUnlocked(true)} />;
  return <MemoriesPage onLock={() => { lockMemories(); setUnlocked(false); }} />;
}


interface Memory {
  id: string;
  uploader_id: string;
  media_url: string;
  media_path: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  uploader_name?: string;
  signed_url?: string;
}

type FilterMode = "all" | "photo" | "video";

async function signUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("memories").createSignedUrl(path, 60 * 60 * 6);
  if (error) return null;
  return data.signedUrl;
}

function MemoriesPage({ onLock }: { onLock: () => void }) {
  const { user } = Route.useRouteContext();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState("");
  const [pending, setPending] = useState<File | null>(null);
  const [viewer, setViewer] = useState<Memory | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("memories").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error("Couldn't load memories");
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase.from("profiles").select("id,display_name");
    const map: Record<string, string> = {};
    (profs ?? []).forEach((p) => { map[p.id] = p.display_name; });
    setProfiles(map);

    const enriched = await Promise.all(
      (data ?? []).map(async (m) => ({
        ...m,
        uploader_name: map[m.uploader_id] ?? "Someone",
        signed_url: (await signUrl(m.media_path)) ?? m.media_url,
      })),
    );
    setMemories(enriched as Memory[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const ch = supabase
      .channel("memories-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "memories" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadAll]);

  function onPick(f: File) {
    setPending(f);
    setCaption("");
  }

  async function doUpload() {
    if (!pending) return;
    setUploading(true);
    setProgress(10);
    try {
      const ext = pending.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("memories").upload(path, pending, {
        contentType: pending.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      setProgress(70);
      const { data: pub } = supabase.storage.from("memories").getPublicUrl(path);
      const mediaType = pending.type.startsWith("video") ? "video" : "photo";
      const { error: insErr } = await supabase.from("memories").insert({
        uploader_id: user.id,
        media_url: pub.publicUrl,
        media_path: path,
        media_type: mediaType,
        caption: caption.trim() || null,
      });
      if (insErr) throw insErr;
      setProgress(100);
      toast.success("Memory saved 💜");
      setPending(null);
      setCaption("");
      if (fileInput.current) fileInput.current.value = "";
      loadAll();
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : "Try again" });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 500);
    }
  }

  async function remove(m: Memory) {
    if (!confirm("Delete this memory?")) return;
    await supabase.storage.from("memories").remove([m.media_path]);
    await supabase.from("memories").delete().eq("id", m.id);
    toast.success("Removed");
    loadAll();
  }

  const filtered = useMemo(() => memories.filter((m) => {
    if (filter !== "all" && m.media_type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (m.caption ?? "").toLowerCase().includes(q) || (m.uploader_name ?? "").toLowerCase().includes(q);
    }
    return true;
  }), [memories, search, filter]);

  const timeline = useMemo(() => {
    const groups: Record<string, Memory[]> = {};
    filtered.forEach((m) => {
      const key = new Date(m.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      (groups[key] ??= []).push(m);
    });
    return Object.entries(groups);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Memories</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every photo and video, kept safe forever.</p>
        </div>
        <button
          onClick={onLock}
          className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          style={{ background: "color-mix(in oklab, var(--card) 85%, transparent)" }}
        >
          <Lock className="h-3.5 w-3.5" /> Lock
        </button>
      </div>

      <div className="glass-card p-4">
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
        />
        {!pending ? (
          <Button onClick={() => fileInput.current?.click()} className="btn-romantic w-full rounded-2xl py-6 text-base font-semibold hover:-translate-y-0.5">
            <Upload className="mr-2 h-4 w-4" /> Add a memory
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
              {pending.type.startsWith("image") ? <ImageIcon className="h-5 w-5 text-primary" /> : <Play className="h-5 w-5 text-primary" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{pending.name}</div>
                <div className="text-xs text-muted-foreground">{(pending.size / (1024 * 1024)).toFixed(2)} MB</div>
              </div>
              <button onClick={() => { setPending(null); if (fileInput.current) fileInput.current.value = ""; }} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
            </div>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption… ✨" rows={2} className="rounded-xl bg-background/70" />
            {uploading && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full transition-all" style={{ width: `${progress}%`, background: "var(--gradient-primary)" }} />
              </div>
            )}
            <Button disabled={uploading} onClick={doUpload} className="btn-romantic w-full rounded-full py-5 font-semibold">
              {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</> : "Save memory 💜"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search captions or uploader…" className="rounded-full bg-background/70 pl-9" />
        </div>
        <div className="flex gap-2">
          {(["all","photo","video"] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex items-center gap-1 rounded-full border border-border/60 px-4 py-2 text-xs font-medium capitalize transition"
              style={filter === f ? { background: "var(--gradient-primary)", color: "var(--primary-foreground)", borderColor: "transparent" } : { background: "var(--card)" }}
            >
              <Filter className="h-3 w-3" /> {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-muted-foreground">
          <ImageIcon className="mx-auto mb-2 h-10 w-10 text-primary/50" />
          No memories here yet. Add your first ✨
        </div>
      ) : (
        <div className="space-y-8">
          {timeline.map(([month, items]) => (
            <div key={month}>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{month}</span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setViewer(m)}
                    className="animate-fade-up group relative aspect-square overflow-hidden rounded-2xl border border-border/50 bg-muted"
                  >
                    {m.media_type === "photo" ? (
                      <img src={m.signed_url} alt={m.caption ?? "memory"} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                    ) : (
                      <>
                        <video src={m.signed_url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-8 w-8 text-white" fill="currentColor" />
                        </div>
                      </>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
                      <div className="line-clamp-1 text-[10px] font-medium text-white">{m.caption ?? "\u00A0"}</div>
                      <div className="text-[9px] text-white/70">{m.uploader_name} · {new Date(m.created_at).toLocaleDateString()}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
          {viewer && (
            <div className="glass-card overflow-hidden">
              <div className="relative bg-black">
                {viewer.media_type === "photo" ? (
                  <img src={viewer.signed_url} alt={viewer.caption ?? ""} className="max-h-[70vh] w-full object-contain" />
                ) : (
                  <video src={viewer.signed_url} controls autoPlay className="max-h-[70vh] w-full" />
                )}
              </div>
              <div className="flex items-start justify-between gap-4 p-4">
                <div>
                  {viewer.caption && <p className="font-serif text-lg">{viewer.caption}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">By {viewer.uploader_name} · {new Date(viewer.created_at).toLocaleString()}</p>
                </div>
                {viewer.uploader_id === user.id && (
                  <button onClick={() => { remove(viewer); setViewer(null); }} className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
