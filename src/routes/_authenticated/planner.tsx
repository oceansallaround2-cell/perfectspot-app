import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Image as ImageIcon,
  Loader2,
  Mic,
  Music,
  Plus,
  Sparkles,
  Trash2,
  Square,
  ArrowUp,
  ArrowDown,
  MessageSquareHeart,
  PartyPopper,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getPartnerId, notifyPartner } from "@/lib/notifications";
import {
  SURPRISE_TYPES,
  eventPhase,
  fileExt,
  formatDateTime,
  removeSurpriseFile,
  surpriseMeta,
  surpriseUrl,
  toLocalInput,
  uploadSurpriseFile,
  type SurpriseEvent,
  type SurpriseNote,
  type SurprisePhoto,
} from "@/lib/surprise";

export const Route = createFileRoute("/_authenticated/planner")({
  component: PlannerPage,
});

function PlannerPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [events, setEvents] = useState<SurpriseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SurpriseEvent | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("surprise_events").select("*").order("start_at", { ascending: true });
    setEvents((data as SurpriseEvent[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("surprise-events-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "surprise_events" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const mine = events.filter((e) => e.creator_id === user.id);
  const upcoming = mine.filter((e) => eventPhase(e) === "upcoming");
  const live = events.filter((e) => eventPhase(e) === "live");
  const past = events.filter((e) => eventPhase(e) === "past");

  return (
    <div className="space-y-6">
      <header className="animate-fade-up glass-card flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Secret</p>
          <h1 className="font-serif text-3xl">🎉 Event Planner</h1>
          <p className="mt-1 text-xs text-muted-foreground">Prepare a surprise. It stays invisible until it begins.</p>
        </div>
        <Button className="rounded-full" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New
        </Button>
      </header>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <Section title="Live now" empty="Nothing happening right now.">
            {live.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                userId={user.id}
                onOpen={() => navigate({ to: "/surprise/$eventId", params: { eventId: e.id }, search: {} })}
                onEdit={() => setEditing(e)}
                onChanged={load}
              />
            ))}
          </Section>

          <Section title="Upcoming (only you can see these)" empty="No secret plans yet.">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} userId={user.id} onEdit={() => setEditing(e)} onChanged={load} />
            ))}
          </Section>

          <Section title="Past events" empty="Finished surprises will live here.">
            {past.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                userId={user.id}
                onOpen={() => navigate({ to: "/surprise/$eventId", params: { eventId: e.id }, search: {} })}
                onEdit={e.creator_id === user.id ? () => setEditing(e) : undefined}
                onChanged={load}
              />
            ))}
          </Section>
        </>
      )}

      <CreateDialog
        open={creating}
        onOpenChange={setCreating}
        userId={user.id}
        onCreated={async (ev) => {
          await load();
          setCreating(false);
          setEditing(ev);
        }}
      />

      {editing && (
        <PrepareDialog
          event={editing}
          userId={user.id}
          onClose={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children.length === 0 ? (
        <p className="glass-card p-4 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        children
      )}
    </section>
  );
}

function EventCard({
  event,
  userId,
  onOpen,
  onEdit,
  onChanged,
}: {
  event: SurpriseEvent;
  userId: string;
  onOpen?: () => void;
  onEdit?: () => void;
  onChanged: () => void;
}) {
  const meta = surpriseMeta(event.event_type);
  const isCreator = event.creator_id === userId;

  async function remove() {
    const { error } = await supabase.from("surprise_events").delete().eq("id", event.id).eq("creator_id", userId);
    if (error) toast.error("Couldn't delete this event");
    else {
      toast.success("Event deleted");
      onChanged();
    }
  }

  return (
    <article className="animate-fade-up glass-card p-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{meta.emoji}</div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-xl">{event.title}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            {formatDateTime(event.start_at)} → {formatDateTime(event.end_at)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {onOpen && (
          <Button size="sm" className="rounded-full" onClick={onOpen}>
            <PartyPopper className="mr-1.5 h-3.5 w-3.5" /> Open
          </Button>
        )}
        {onEdit && isCreator && (
          <Button size="sm" variant="secondary" className="rounded-full" onClick={onEdit}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Prepare
          </Button>
        )}
        {isCreator && (
          <ConfirmDialog
            title="Delete this surprise?"
            description="The music, voice note, photos and messages are removed for good."
            onConfirm={remove}
            trigger={
              <Button size="sm" variant="ghost" className="rounded-full text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            }
          />
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------- creation */

function CreateDialog({
  open,
  onOpenChange,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onCreated: (ev: SurpriseEvent) => void;
}) {
  const [type, setType] = useState<string>("birthday");
  const [title, setTitle] = useState<string>(SURPRISE_TYPES[0].defaultTitle);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);

  function pickType(v: string) {
    setType(v);
    const meta = surpriseMeta(v);
    setTitle(meta.defaultTitle);
  }

  async function submit() {
    if (!title.trim() || !start || !end) {
      toast.error("Title, start and end are required");
      return;
    }
    if (new Date(end) <= new Date(start)) {
      toast.error("The end must come after the start");
      return;
    }
    setSaving(true);
    const partnerId = await getPartnerId(userId);
    if (!partnerId) {
      setSaving(false);
      toast.error("Your partner's account wasn't found");
      return;
    }
    const { data, error } = await supabase
      .from("surprise_events")
      .insert({
        creator_id: userId,
        recipient_id: partnerId,
        event_type: type,
        title: title.trim(),
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
      })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Couldn't create the event");
      return;
    }
    toast.success("Secret event created 🤫");
    onCreated(data as SurpriseEvent);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-h-[85vh] overflow-y-auto border-none">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">New secret event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Event type</Label>
            <Select value={type} onValueChange={pickType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SURPRISE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.emoji} {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{type === "custom" ? "Occasion title" : "Event title"}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === "custom" ? "Promotion, Good Luck, I Miss You…" : "Happy Birthday!"}
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <Button className="w-full rounded-full" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & prepare"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------- preparing */

function PrepareDialog({ event, userId, onClose }: { event: SurpriseEvent; userId: string; onClose: () => void }) {
  const [ev, setEv] = useState(event);
  const [photos, setPhotos] = useState<SurprisePhoto[]>([]);
  const [notes, setNotes] = useState<SurpriseNote[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const refresh = useCallback(async () => {
    const [{ data: e }, { data: ph }, { data: ms }] = await Promise.all([
      supabase.from("surprise_events").select("*").eq("id", event.id).maybeSingle(),
      supabase.from("surprise_photos").select("*").eq("event_id", event.id).order("position"),
      supabase.from("surprise_messages").select("*").eq("event_id", event.id).order("position"),
    ]);
    const next = (e as SurpriseEvent) ?? event;
    setEv(next);
    setPhotos((ph as SurprisePhoto[]) ?? []);
    setNotes((ms as SurpriseNote[]) ?? []);
    setMusicUrl(await surpriseUrl(next.music_path));
    setVoiceUrl(await surpriseUrl(next.voice_path));
    const entries = await Promise.all(
      ((ph as SurprisePhoto[]) ?? []).map(async (p) => [p.id, (await surpriseUrl(p.storage_path)) ?? ""] as const),
    );
    setPhotoUrls(Object.fromEntries(entries));
  }, [event]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* --- details --- */
  async function saveDetails(patch: Partial<SurpriseEvent>) {
    const { error } = await supabase.from("surprise_events").update(patch).eq("id", ev.id);
    if (error) toast.error("Couldn't save");
    else refresh();
  }

  /* --- music --- */
  async function setMusic(file: File) {
    setBusy("music");
    try {
      const path = await uploadSurpriseFile(ev.id, "music", file, fileExt(file, "mp3"));
      await removeSurpriseFile(ev.music_path);
      await supabase.from("surprise_events").update({ music_path: path }).eq("id", ev.id);
      toast.success("Music saved");
      await refresh();
    } catch {
      toast.error("Upload failed");
    }
    setBusy(null);
  }

  async function clearMusic() {
    await removeSurpriseFile(ev.music_path);
    await supabase.from("surprise_events").update({ music_path: null }).eq("id", ev.id);
    refresh();
  }

  /* --- voice --- */
  async function setVoice(blob: Blob, ext: string) {
    setBusy("voice");
    try {
      const path = await uploadSurpriseFile(ev.id, "voice", blob, ext);
      await removeSurpriseFile(ev.voice_path);
      await supabase.from("surprise_events").update({ voice_path: path }).eq("id", ev.id);
      toast.success("Voice note saved");
      await refresh();
    } catch {
      toast.error("Upload failed");
    }
    setBusy(null);
  }

  async function clearVoice() {
    await removeSurpriseFile(ev.voice_path);
    await supabase.from("surprise_events").update({ voice_path: null }).eq("id", ev.id);
    refresh();
  }

  async function toggleRecord() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        await setVoice(blob, "webm");
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Microphone unavailable");
    }
  }

  /* --- photos --- */
  async function addPhotos(files: FileList) {
    const room = 6 - photos.length;
    if (room <= 0) {
      toast.error("Six photos is the maximum");
      return;
    }
    setBusy("photos");
    let position = photos.length;
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const path = await uploadSurpriseFile(ev.id, "photos", file, fileExt(file, "jpg"));
        await supabase.from("surprise_photos").insert({ event_id: ev.id, storage_path: path, position });
        position += 1;
      } catch {
        toast.error(`Couldn't upload ${file.name}`);
      }
    }
    setBusy(null);
    refresh();
  }

  async function deletePhoto(p: SurprisePhoto) {
    await removeSurpriseFile(p.storage_path);
    await supabase.from("surprise_photos").delete().eq("id", p.id);
    refresh();
  }

  async function movePhoto(index: number, dir: -1 | 1) {
    const a = photos[index];
    const b = photos[index + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from("surprise_photos").update({ position: b.position }).eq("id", a.id),
      supabase.from("surprise_photos").update({ position: a.position }).eq("id", b.id),
    ]);
    refresh();
  }

  /* --- messages --- */
  async function addNote() {
    if (!noteDraft.trim()) return;
    await supabase
      .from("surprise_messages")
      .insert({ event_id: ev.id, content: noteDraft.trim(), position: notes.length });
    setNoteDraft("");
    refresh();
  }

  async function deleteNote(id: string) {
    await supabase.from("surprise_messages").delete().eq("id", id);
    refresh();
  }

  async function announce() {
    const partnerId = ev.recipient_id;
    await notifyPartner({
      actorId: userId,
      recipientId: partnerId,
      type: "date",
      title: `${surpriseMeta(ev.event_type).emoji} A surprise is waiting for you`,
      body: ev.title,
      link: `/surprise/${ev.id}`,
    });
    toast.success("Your partner has been nudged");
  }

  const started = eventPhase(ev) !== "upcoming";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-card max-h-[88vh] max-w-lg overflow-y-auto border-none">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Prepare “{ev.title}”</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* details */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                defaultValue={ev.title}
                onBlur={(e) => e.target.value.trim() && e.target.value !== ev.title && saveDetails({ title: e.target.value.trim() })}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Starts</Label>
                <Input
                  type="datetime-local"
                  defaultValue={toLocalInput(ev.start_at)}
                  onChange={(e) => e.target.value && saveDetails({ start_at: new Date(e.target.value).toISOString() })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ends</Label>
                <Input
                  type="datetime-local"
                  defaultValue={toLocalInput(ev.end_at)}
                  onChange={(e) => e.target.value && saveDetails({ end_at: new Date(e.target.value).toISOString() })}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* music */}
          <Block icon={Music} title="Background music" hint="Loops through the whole surprise.">
            {musicUrl && <audio controls src={musicUrl} className="w-full" />}
            <div className="flex flex-wrap gap-2">
              <FilePick accept="audio/*" onPick={(f) => setMusic(f[0]!)} busy={busy === "music"}>
                {ev.music_path ? "Replace" : "Upload music"}
              </FilePick>
              {ev.music_path && (
                <ConfirmDialog
                  title="Remove the music?"
                  onConfirm={clearMusic}
                  trigger={
                    <Button size="sm" variant="ghost" className="rounded-full text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              )}
            </div>
          </Block>

          {/* voice */}
          <Block icon={Mic} title="Voice note" hint="Plays after the candle is blown out.">
            {voiceUrl && <audio controls src={voiceUrl} className="w-full" />}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={recording ? "destructive" : "secondary"} className="rounded-full" onClick={toggleRecord}>
                {recording ? <Square className="mr-1.5 h-3.5 w-3.5" /> : <Mic className="mr-1.5 h-3.5 w-3.5" />}
                {recording ? "Stop" : ev.voice_path ? "Re-record" : "Record"}
              </Button>
              <FilePick accept="audio/*" onPick={(f) => setVoice(f[0]!, fileExt(f[0]!, "mp3"))} busy={busy === "voice"}>
                Upload
              </FilePick>
              {ev.voice_path && (
                <ConfirmDialog
                  title="Remove the voice note?"
                  onConfirm={clearVoice}
                  trigger={
                    <Button size="sm" variant="ghost" className="rounded-full text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              )}
            </div>
          </Block>

          {/* photos */}
          <Block icon={ImageIcon} title={`Photo album (${photos.length}/6)`} hint="Five or six is the sweet spot.">
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-border/40">
                  <img src={photoUrls[p.id]} alt="" className="h-24 w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1">
                    <button onClick={() => movePhoto(i, -1)} disabled={i === 0} className="text-white disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => movePhoto(i, 1)} disabled={i === photos.length - 1} className="text-white disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deletePhoto(p)} className="text-red-300">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <FilePick accept="image/*" multiple onPick={addPhotos} busy={busy === "photos"}>
              Add photos
            </FilePick>
          </Block>

          {/* messages */}
          <Block icon={MessageSquareHeart} title="Personal messages" hint="Shown between the photos.">
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="flex items-start gap-2 rounded-2xl border border-border/40 p-2.5">
                  <p className="flex-1 text-sm">{n.content}</p>
                  <button onClick={() => deleteNote(n.id)} className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Write something they'll never forget…"
              className="rounded-2xl"
              rows={2}
            />
            <Button size="sm" className="rounded-full" onClick={addNote}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add message
            </Button>
          </Block>

          {started && (
            <Button variant="secondary" className="w-full rounded-full" onClick={announce}>
              Nudge your partner
            </Button>
          )}
          <Button className="w-full rounded-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Block({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5 rounded-3xl border border-border/40 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-medium">{title}</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      {children}
    </section>
  );
}

function FilePick({
  accept,
  multiple,
  busy,
  onPick,
  children,
}: {
  accept: string;
  multiple?: boolean;
  busy?: boolean;
  onPick: (files: FileList) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files);
          e.target.value = "";
        }}
      />
      <Button size="sm" variant="secondary" className="rounded-full" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        {children}
      </Button>
    </>
  );
}
