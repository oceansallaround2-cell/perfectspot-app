import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Music2, Pause, Play, Upload, Volume2, VolumeX, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const BUCKET = "app-music";

interface Track {
  id: string;
  title: string;
  storage_path: string;
  uploader_id: string;
}

interface MusicApi {
  track: Track | null;
  playing: boolean;
  muted: boolean;
  volume: number;
  toggle: () => void;
  setMuted: (v: boolean) => void;
  setVolume: (v: number) => void;
  /** Temporarily fade the soundtrack out (used while a voice note plays). */
  duck: () => void;
  /** Fade it back in. */
  unduck: () => void;
}

const MusicContext = createContext<MusicApi | null>(null);

export function useGlobalMusic() {
  return useContext(MusicContext);
}

function readPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Smoothly ramp an audio element's volume. */
function fade(audio: HTMLAudioElement, to: number, ms = 500) {
  const from = audio.volume;
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * App-wide soundtrack. The <audio> element lives in this provider, which sits
 * above the router outlet, so navigating between pages never restarts the song.
 */
export function GlobalMusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const duckedRef = useRef(false);
  const [track, setTrack] = useState<Track | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMutedState] = useState(() => readPref("ps-music-muted", false));
  const [volume, setVolumeState] = useState(() => readPref("ps-music-volume", 0.35));

  const loadLatest = useCallback(async () => {
    const { data } = await supabase
      .from("app_music")
      .select("id,title,storage_path,uploader_id")
      .order("created_at", { ascending: false })
      .limit(1);
    const next = (data?.[0] as Track | undefined) ?? null;
    setTrack(next);
    if (!next) {
      setUrl(null);
      return;
    }
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(next.storage_path, 60 * 60 * 12);
    setUrl(signed?.signedUrl ?? null);
  }, []);

  useEffect(() => {
    loadLatest();
    const ch = supabase
      .channel("app-music-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_music" }, () => loadLatest())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadLatest]);

  // Create the element once per track URL.
  useEffect(() => {
    if (!url) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }
    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audio.muted = muted;
    audioRef.current = audio;

    const tryPlay = () =>
      audio
        .play()
        .then(() => {
          setPlaying(true);
          fade(audio, volume, 900);
        })
        .catch(() => setPlaying(false));

    tryPlay();
    // Autoplay is usually blocked until the user touches the page once.
    const onFirstTouch = () => {
      if (audio.paused) tryPlay();
      window.removeEventListener("pointerdown", onFirstTouch);
    };
    window.addEventListener("pointerdown", onFirstTouch);

    return () => {
      window.removeEventListener("pointerdown", onFirstTouch);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
    try {
      window.localStorage.setItem("ps-music-muted", JSON.stringify(muted));
    } catch {
      /* ignore */
    }
  }, [muted]);

  useEffect(() => {
    if (audioRef.current && !duckedRef.current) audioRef.current.volume = volume;
    try {
      window.localStorage.setItem("ps-music-volume", JSON.stringify(volume));
    } catch {
      /* ignore */
    }
  }, [volume]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const duck = useCallback(() => {
    const audio = audioRef.current;
    duckedRef.current = true;
    if (audio && !audio.paused) fade(audio, 0, 400);
  }, []);

  const unduck = useCallback(() => {
    const audio = audioRef.current;
    duckedRef.current = false;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    fade(audio, volume, 700);
  }, [volume]);

  const api = useMemo<MusicApi>(
    () => ({ track, playing, muted, volume, toggle, setMuted: setMutedState, setVolume: setVolumeState, duck, unduck }),
    [track, playing, muted, volume, toggle, duck, unduck],
  );

  return <MusicContext.Provider value={api}>{children}</MusicContext.Provider>;
}

/** Header control: play / pause / mute / volume / upload. */
export function GlobalMusicButton({ userId }: { userId: string }) {
  const music = useGlobalMusic();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (!music) return null;

  async function upload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (error) throw error;
      const title = file.name.replace(/\.\w+$/, "");
      const { error: dbError } = await supabase.from("app_music").insert({ uploader_id: userId, title, storage_path: path });
      if (dbError) throw dbError;
      toast.success("Background music updated 🎶");
    } catch {
      toast.error("Couldn't upload that track");
    }
    setUploading(false);
  }

  async function removeTrack() {
    if (!music?.track) return;
    await supabase.storage.from(BUCKET).remove([music.track.storage_path]);
    await supabase.from("app_music").delete().eq("id", music.track.id);
    toast.success("Track removed");
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="press-pop relative rounded-full p-2 text-muted-foreground transition hover:text-primary" aria-label="Background music">
          {music.muted || !music.playing ? <VolumeX className="h-4 w-4" /> : <Music2 className="h-4 w-4 animate-soft-pulse text-primary" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-3xl p-4">
        <div className="flex items-center gap-2">
          <Music2 className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{music.track?.title ?? "No track yet"}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Our soundtrack</div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button size="icon" className="h-9 w-9 rounded-full" onClick={music.toggle} disabled={!music.track} aria-label="Play or pause">
            {music.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-9 w-9 rounded-full"
            onClick={() => music.setMuted(!music.muted)}
            disabled={!music.track}
            aria-label="Mute"
          >
            {music.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={music.volume}
            onChange={(e) => music.setVolume(Number(e.target.value))}
            className="h-1 flex-1 accent-[var(--primary)]"
            aria-label="Volume"
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="secondary" className="flex-1 rounded-full" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            Upload music
          </Button>
          {music.track?.uploader_id === userId && (
            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full text-destructive" onClick={removeTrack} aria-label="Remove track">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">The newest upload becomes the soundtrack for both of you.</p>
      </PopoverContent>
    </Popover>
  );
}
