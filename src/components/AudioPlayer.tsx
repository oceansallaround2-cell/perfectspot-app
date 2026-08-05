import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/media";

/**
 * Premium audio player used for every voice note in the app.
 * Handles the awkward bits: MediaRecorder webm files that report an infinite
 * duration, autoplay rejections, and files that fail to load at all.
 */
export function AudioPlayer({
  url,
  autoPlay = false,
  onStart,
  onEnded,
  compact = false,
}: {
  url: string | null;
  autoPlay?: boolean;
  onStart?: () => void;
  onEnded?: () => void;
  compact?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  // Keep the latest callbacks without re-creating the audio element.
  const startRef = useRef(onStart);
  const endRef = useRef(onEnded);
  startRef.current = onStart;
  endRef.current = onEnded;

  useEffect(() => {
    startedRef.current = false;
    setReady(false);
    setError(false);
    setPlaying(false);
    setDuration(0);
    setCurrent(0);
    if (!url) return;

    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const readDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      } else {
        // Chrome reports Infinity for MediaRecorder blobs until we seek to the end.
        const onSeeked = () => {
          if (Number.isFinite(audio.duration)) setDuration(audio.duration);
          audio.currentTime = 0;
          audio.removeEventListener("seeked", onSeeked);
        };
        audio.addEventListener("seeked", onSeeked);
        try {
          audio.currentTime = 1e101;
        } catch {
          /* ignore */
        }
      }
    };

    const onCanPlay = () => {
      setReady(true);
      if (autoPlay && !startedRef.current) {
        startedRef.current = true;
        startRef.current?.();
        audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
    };
    const onTime = () => setCurrent(audio.currentTime);
    const onEnd = () => {
      setPlaying(false);
      endRef.current?.();
    };
    const onErr = () => {
      setError(true);
      setReady(false);
    };

    audio.addEventListener("loadedmetadata", readDuration);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onErr);
    audio.src = url;
    audio.load();

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", readDuration);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onErr);
      audio.src = "";
      audioRef.current = null;
    };
  }, [url, autoPlay]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (!startedRef.current) {
        startedRef.current = true;
        startRef.current?.();
      }
      audio.play().then(() => setPlaying(true)).catch(() => setError(true));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const replay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().then(() => setPlaying(true)).catch(() => {});
  }, []);

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = Number(e.target.value);
    setCurrent(Number(e.target.value));
  }

  if (!url) return null;

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-destructive/40 px-4 py-2 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" /> This voice note couldn&apos;t be loaded.
      </div>
    );
  }

  const progress = duration ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div
      className={`flex w-full items-center gap-3 rounded-full border border-border/50 px-3 py-2 ${compact ? "max-w-xs" : "max-w-sm"}`}
      style={{ background: "color-mix(in oklab, var(--card) 80%, transparent)", backdropFilter: "blur(14px)" }}
    >
      <Button size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={toggle} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>
        {!ready ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <div className="min-w-0 flex-1">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${progress}%`, background: "var(--gradient-primary)" }} />
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={seek}
          disabled={!ready || !duration}
          aria-label="Seek"
          className="mt-1 h-1 w-full cursor-pointer accent-[var(--primary)] opacity-60"
        />
      </div>

      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {formatTime(current)} / {duration ? formatTime(duration) : "--:--"}
      </span>

      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 rounded-full" onClick={replay} disabled={!ready} aria-label="Replay">
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
