import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Mic, Volume2, VolumeX, SkipForward, Wind } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Confetti, StarField } from "@/components/surprise/Effects";
import { Cake } from "@/components/surprise/Cake";
import { SharedCanvas } from "@/components/surprise/SharedCanvas";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlobalMusic } from "@/components/GlobalMusic";
import { preloadImages, signedUrls } from "@/lib/media";
import { notifyPartner } from "@/lib/notifications";
import {
  SURPRISE_BUCKET,
  surpriseMeta,
  surpriseUrl,
  type SurpriseEvent,
  type SurpriseNote,
  type SurprisePhoto,
} from "@/lib/surprise";

type Step = "welcome" | "wish" | "candle" | "voice" | "album" | "canvas";
const STEPS: Step[] = ["welcome", "wish", "candle", "voice", "album", "canvas"];

export const Route = createFileRoute("/_authenticated/surprise/$eventId")({
  validateSearch: (search: Record<string, unknown>) => ({
    step: typeof search["step"] === "string" ? (search["step"] as string) : undefined,
  }),
  component: SurpriseExperience,
});

function SurpriseExperience() {
  const { eventId } = Route.useParams();
  const { step: stepParam } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const [event, setEvent] = useState<SurpriseEvent | null>(null);
  const [photos, setPhotos] = useState<SurprisePhoto[]>([]);
  const [notes, setNotes] = useState<SurpriseNote[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>((stepParam as Step) ?? "welcome");
  const [muted, setMuted] = useState(false);
  const [burst, setBurst] = useState(0);

  const musicRef = useRef<HTMLAudioElement | null>(null);
  const globalMusic = useGlobalMusic();

  // The surprise brings its own soundtrack — fade the app-wide one out.
  useEffect(() => {
    globalMusic?.duck();
    return () => globalMusic?.unduck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: ev }, { data: ph }, { data: ms }] = await Promise.all([
        supabase.from("surprise_events").select("*").eq("id", eventId).maybeSingle(),
        supabase.from("surprise_photos").select("*").eq("event_id", eventId).order("position"),
        supabase.from("surprise_messages").select("*").eq("event_id", eventId).order("position"),
      ]);
      if (cancelled) return;
      setEvent((ev as SurpriseEvent) ?? null);
      setPhotos((ph as SurprisePhoto[]) ?? []);
      setNotes((ms as SurpriseNote[]) ?? []);
      if (ev) {
        const [m, v] = await Promise.all([
          surpriseUrl((ev as SurpriseEvent).music_path),
          surpriseUrl((ev as SurpriseEvent).voice_path),
        ]);
        if (cancelled) return;
        setMusicUrl(m);
        setVoiceUrl(v);
        const list = (ph as SurprisePhoto[]) ?? [];
        const byPath = await signedUrls(SURPRISE_BUCKET, list.map((p) => p.storage_path));
        const byId = Object.fromEntries(list.map((p) => [p.id, byPath[p.storage_path] ?? ""]));
        if (!cancelled) {
          setPhotoUrls(byId);
          preloadImages(Object.values(byId));
        }
        // Mark as opened so the experience doesn't hijack the app again.
        await supabase
          .from("surprise_progress")
          .upsert({ event_id: eventId, user_id: user.id }, { onConflict: "event_id,user_id", ignoreDuplicates: true });
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, user.id]);

  // Background music: loops for the whole experience.
  useEffect(() => {
    if (!musicUrl) return;
    const audio = new Audio(musicUrl);
    audio.loop = true;
    audio.volume = 0.55;
    musicRef.current = audio;
    audio.play().catch(() => {
      /* autoplay may need a tap — the Continue button starts it */
    });
    return () => {
      audio.pause();
      musicRef.current = null;
    };
  }, [musicUrl]);

  useEffect(() => {
    if (musicRef.current) musicRef.current.muted = muted;
  }, [muted]);

  const playMusic = useCallback(() => {
    musicRef.current?.play().catch(() => {});
  }, []);

  const go = useCallback(
    (next: Step) => {
      setStep(next);
      navigate({ to: "/surprise/$eventId", params: { eventId }, search: { step: next }, replace: true });
    },
    [eventId, navigate],
  );

  const advance = useCallback(() => {
    const idx = STEPS.indexOf(step);
    go(STEPS[Math.min(idx + 1, STEPS.length - 1)]!);
  }, [step, go]);

  const finish = useCallback(async () => {
    await supabase
      .from("surprise_progress")
      .upsert({ event_id: eventId, user_id: user.id, completed: true }, { onConflict: "event_id,user_id" });
    navigate({ to: "/dashboard" });
  }, [eventId, user.id, navigate]);

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-8"
        style={{ background: "linear-gradient(180deg,#0B0714 0%,#171321 45%,#221A35 100%)" }}
      >
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-10 w-64 rounded-full" />
        <Skeleton className="h-4 w-40 rounded-full" />
        <Skeleton className="h-11 w-36 rounded-full" />
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Setting the mood…
        </p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="font-serif text-2xl">Nothing here yet</p>
        <p className="mt-2 text-sm text-muted-foreground">This surprise isn&apos;t available (yet).</p>
        <Button className="mt-5 rounded-full" onClick={() => navigate({ to: "/dashboard" })}>
          Back home
        </Button>
      </div>
    );
  }

  const meta = surpriseMeta(event.event_type);
  const isCreator = event.creator_id === user.id;

  if (step === "canvas") {
    return (
      <CanvasStage
        event={event}
        userId={user.id}
        isCreator={isCreator}
        onLeave={finish}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: "linear-gradient(180deg,#0B0714 0%,#171321 45%,#221A35 100%)" }}>
      <StarField />
      <Confetti fire={burst} />

      <div className="absolute right-3 top-3 z-40 flex gap-2">
        {musicUrl && (
          <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={finish}>
          Exit
        </Button>
      </div>

      <div className="relative z-20 flex h-full flex-col items-center justify-center px-6 text-center">
        {step === "welcome" && (
          <WelcomeStage
            title={event.title}
            emoji={meta.emoji}
            onContinue={() => {
              playMusic();
              setBurst((b) => b + 1);
              advance();
            }}
          />
        )}

        {step === "wish" && (
          <WishStage
            eventId={event.id}
            userId={user.id}
            creatorId={event.creator_id}
            isCreator={isCreator}
            onDone={advance}
          />
        )}

        {step === "candle" && (
          <CandleStage
            onBlown={() => {
              setBurst((b) => b + 1);
              advance();
            }}
          />
        )}

        {step === "voice" && (
          <VoiceStage
            url={voiceUrl}
            onStart={() => musicRef.current?.pause()}
            onDone={() => {
              playMusic();
              advance();
            }}
          />
        )}

        {step === "album" && (
          <AlbumStage photos={photos} urls={photoUrls} notes={notes} onDone={advance} />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- stages */

function WelcomeStage({ title, emoji, onContinue }: { title: string; emoji: string; onContinue: () => void }) {
  return (
    <div className="animate-fade-up flex flex-col items-center gap-6">
      <div className="text-6xl" style={{ animation: "ps-float 3.4s ease-in-out infinite" }}>
        {emoji}
      </div>
      <h1
        className="gradient-text max-w-md font-serif text-5xl leading-tight"
        style={{ textShadow: "0 0 60px rgba(138,95,201,0.6)" }}
      >
        {title}
      </h1>
      <p className="max-w-xs text-sm text-muted-foreground">Someone made something just for you. Take your time.</p>
      <Button size="lg" className="mt-4 rounded-full px-10" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}

function WishStage({
  eventId,
  userId,
  creatorId,
  isCreator,
  onDone,
}: {
  eventId: string;
  userId: string;
  creatorId: string;
  isCreator: boolean;
  onDone: () => void;
}) {
  const [wish, setWish] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (isCreator || !wish.trim()) {
      onDone();
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("surprise_wishes").insert({
      event_id: eventId,
      author_id: userId,
      wish: wish.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't send your wish");
      return;
    }
    await notifyPartner({
      actorId: userId,
      recipientId: creatorId,
      type: "date",
      title: "A wish was made 🕯️",
      body: wish.trim().slice(0, 120),
      link: "/planner",
    });
    onDone();
  }

  return (
    <div className="animate-fade-up flex w-full max-w-sm flex-col items-center gap-5">
      <Cake lit />
      <h2 className="font-serif text-3xl">Make a wish…</h2>
      <Input
        value={wish}
        onChange={(e) => setWish(e.target.value)}
        placeholder="Whisper it here"
        className="rounded-full text-center"
      />
      <Button className="rounded-full px-10" onClick={submit} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
      </Button>
      <button className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={onDone}>
        Skip
      </button>
    </div>
  );
}

function CandleStage({ onBlown }: { onBlown: () => void }) {
  const [lit, setLit] = useState(true);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const doneRef = useRef(false);
  const cleanupRef = useRef<() => void>(() => {});

  const extinguish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLit(false);
    cleanupRef.current();
    window.setTimeout(onBlown, 1200);
  }, [onBlown]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let loudSince = 0;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        setListening(true);

        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += v * v;
          const rms = Math.sqrt(sum / buf.length);
          if (rms > 0.16) {
            if (!loudSince) loudSince = performance.now();
            else if (performance.now() - loudSince > 220) {
              extinguish();
              return;
            }
          } else {
            loudSince = 0;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setMicError("Microphone unavailable — use the button below instead.");
      }
    })();

    cleanupRef.current = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
    return () => cleanupRef.current();
  }, [extinguish]);

  return (
    <div className="animate-fade-up flex flex-col items-center gap-6">
      <button onClick={extinguish} aria-label="Blow out the candle">
        <Cake lit={lit} />
      </button>
      <h2 className="font-serif text-3xl">{lit ? "Blow out the candle" : "Beautiful ✨"}</h2>

      <Button size="lg" className="rounded-full px-10" onClick={extinguish} disabled={!lit}>
        <Wind className="mr-2 h-4 w-4" /> Blow the candle
      </Button>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mic className="h-3.5 w-3.5" />
        {micError ?? (listening ? "Or blow softly into your mic — I'm listening" : "Tap the button, or blow into your mic")}
      </p>
      <button className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={extinguish}>
        Skip
      </button>
    </div>
  );
}

function VoiceStage({ url, onStart, onDone }: { url: string | null; onStart: () => void; onDone: () => void }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!url) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (!url) return null;

  return (
    <div className="animate-fade-up flex flex-col items-center gap-6">
      <div
        className="flex h-28 w-28 items-center justify-center rounded-full"
        style={{
          background: "var(--gradient-primary)",
          boxShadow: "0 0 70px 18px rgba(138,95,201,0.45)",
          animation: playing ? "ps-pulse-glow 1.6s ease-in-out infinite" : undefined,
        }}
      >
        <Mic className="h-10 w-10 text-primary-foreground" />
      </div>
      <h2 className="font-serif text-3xl">A message for you</h2>

      <AudioPlayer
        url={url}
        autoPlay
        onStart={() => {
          setPlaying(true);
          onStart();
        }}
        onEnded={() => {
          setPlaying(false);
          onDone();
        }}
      />

      <Button variant="ghost" className="rounded-full text-muted-foreground" onClick={onDone}>
        <SkipForward className="mr-1.5 h-3.5 w-3.5" /> Skip
      </Button>
    </div>
  );
}

type Slide = { kind: "photo"; url: string; id: string } | { kind: "note"; text: string; id: string };

function AlbumStage({
  photos,
  urls,
  notes,
  onDone,
}: {
  photos: SurprisePhoto[];
  urls: Record<string, string>;
  notes: SurpriseNote[];
  onDone: () => void;
}) {
  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    const max = Math.max(photos.length, notes.length);
    for (let i = 0; i < max; i += 1) {
      const p = photos[i];
      if (p && urls[p.id]) out.push({ kind: "photo", url: urls[p.id]!, id: p.id });
      const n = notes[i];
      if (n) out.push({ kind: "note", text: n.content, id: n.id });
    }
    return out;
  }, [photos, notes, urls]);

  const [i, setI] = useState(0);

  useEffect(() => {
    if (slides.length === 0) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  const slide = slides[i];
  if (!slide) return null;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5">
      <div key={slide.id} className="animate-fade-up w-full">
        {slide.kind === "photo" ? (
          <div
            className="overflow-hidden rounded-[2rem] border border-border/40"
            style={{ boxShadow: "0 30px 90px -30px rgba(138,95,201,0.7)" }}
          >
            <img
              src={slide.url}
              alt="A memory"
              className="h-[52vh] w-full object-cover"
              style={{ animation: "ps-kenburns 9s ease-out both" }}
            />
          </div>
        ) : (
          <p className="gradient-text px-4 font-serif text-3xl leading-snug" style={{ animation: "ps-float 4s ease-in-out infinite" }}>
            {slide.text}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {i + 1} / {slides.length}
        </span>
        <Button
          size="icon"
          className="rounded-full"
          onClick={() => (i === slides.length - 1 ? onDone() : setI((v) => v + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <button className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={onDone}>
        Skip to the canvas
      </button>
    </div>
  );
}

function CanvasStage({
  event,
  userId,
  isCreator,
  onLeave,
}: {
  event: SurpriseEvent;
  userId: string;
  isCreator: boolean;
  onLeave: () => void;
}) {
  useEffect(() => {
    if (isCreator) return;
    notifyPartner({
      actorId: userId,
      recipientId: event.creator_id,
      type: "watch",
      title: "Your partner is waiting in the shared canvas 🎨",
      body: event.title,
      link: `/surprise/${event.id}?step=canvas`,
    }).catch(() => {});
  }, [isCreator, userId, event.creator_id, event.id, event.title]);

  return <SharedCanvas eventId={event.id} userId={userId} onLeave={onLeave} />;
}
