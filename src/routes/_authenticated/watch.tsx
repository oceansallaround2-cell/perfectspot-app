import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tv, Copy, Check, LogOut, Send, Mic, MicOff, Users, Play, Pause, Link2, AlertCircle, Square, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/watch")({
  component: WatchTogether,
});

interface Room {
  id: string;
  code: string;
  creator_id: string;
  video_url: string | null;
  is_playing: boolean;
  position_seconds: number;
  last_sync_at: string;
  created_at: string;
}
interface Member {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  display_name?: string;
}
interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  kind?: string | null;
  audio_path?: string | null;
  duration_seconds?: number | null;
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
    }
    return null;
  } catch {
    return null;
  }
}

function WatchTogether() {
  const { user } = Route.useRouteContext();
  const [room, setRoom] = useState<Room | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      for (let i = 0; i < 5; i++) {
        const code = genCode();
        const { data, error: e } = await supabase
          .from("watch_rooms")
          .insert({ code, creator_id: user.id })
          .select()
          .single();
        if (!e && data) {
          await supabase.from("watch_room_members").upsert(
            { room_id: data.id, user_id: user.id },
            { onConflict: "room_id,user_id" },
          );
          setRoom(data as Room);
          return;
        }
        if (e && !e.message.toLowerCase().includes("duplicate")) throw e;
      }
      throw new Error("Could not generate a unique code, please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room.");
    } finally {
      setBusy(false);
    }
  }, [user.id]);

  const handleJoin = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.from("watch_rooms").select("*").eq("code", code).maybeSingle();
      if (e) throw e;
      if (!data) {
        setError("Invalid room code.");
        return;
      }
      await supabase.from("watch_room_members").upsert(
        { room_id: data.id, user_id: user.id },
        { onConflict: "room_id,user_id" },
      );
      setRoom(data as Room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room.");
    } finally {
      setBusy(false);
    }
  }, [joinCode, user.id]);

  const handleLeave = useCallback(async () => {
    if (!room) return;
    try {
      const { error: delErr } = await supabase
        .from("watch_room_members")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", user.id);
      if (delErr) throw delErr;

      // If the room is now empty, delete it so no orphaned rooms remain.
      const { data: remaining, error: countErr } = await supabase
        .from("watch_room_members")
        .select("id")
        .eq("room_id", room.id);
      if (countErr) throw countErr;
      if (!remaining || remaining.length === 0) {
        await supabase.from("watch_rooms").delete().eq("id", room.id);
      }

      setRoom(null);
      setJoinCode("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to leave the room.";
      toast.error(msg);
    }
  }, [room, user.id]);


  if (room) return <RoomView room={room} onLeave={handleLeave} setRoom={setRoom} />;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <Tv className="h-5 w-5" />
          <h1 className="font-serif text-2xl font-semibold">Watch Together</h1>
        </div>
        <p className="text-sm text-muted-foreground">Create a private room or join one with a code.</p>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-3xl border border-border/50 p-5" style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}>
        <h2 className="font-serif text-lg font-semibold">Create a room</h2>
        <p className="mt-1 text-xs opacity-90">You'll get a shareable code to invite your partner.</p>
        <Button onClick={handleCreate} disabled={busy} className="mt-4 w-full rounded-full bg-background/95 text-foreground hover:bg-background">
          Create Room
        </Button>
      </section>

      <section className="rounded-3xl border border-border/50 bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h2 className="font-serif text-lg font-semibold">Join a room</h2>
        <p className="mt-1 text-xs text-muted-foreground">Enter the code your partner shared with you.</p>
        <div className="mt-4 flex gap-2">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={8}
            className="rounded-full text-center font-mono tracking-widest"
          />
          <Button onClick={handleJoin} disabled={busy || !joinCode.trim()} className="rounded-full">
            Join
          </Button>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Room view ---------------- */

function RoomView({ room, onLeave, setRoom }: { room: Room; onLeave: () => void; setRoom: (r: Room) => void }) {
  const { user } = Route.useRouteContext();
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Load members + messages
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: mem }, { data: msgs }] = await Promise.all([
        supabase.from("watch_room_members").select("*").eq("room_id", room.id).order("joined_at"),
        supabase.from("watch_messages").select("*").eq("room_id", room.id).order("created_at"),
      ]);
      if (cancelled) return;
      if (mem) {
        const ids = Array.from(new Set((mem as Member[]).map((m) => m.user_id)));
        const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id as string, p.display_name as string]));
        setMembers((mem as Member[]).map((m) => ({ ...m, display_name: map.get(m.user_id) ?? "Partner" })));
      }
      if (msgs) setMessages(msgs as Message[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [room.id]);

  // Realtime: room state, members, messages
  useEffect(() => {
    const channel = supabase
      .channel(`watch-room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "watch_rooms", filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as Room),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "watch_rooms", filter: `id=eq.${room.id}` },
        () => {
          setNotice("This room was closed by the creator.");
          setTimeout(() => onLeave(), 1500);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "watch_room_members", filter: `room_id=eq.${room.id}` },
        async () => {
          const { data: mem } = await supabase
            .from("watch_room_members")
            .select("*")
            .eq("room_id", room.id)
            .order("joined_at");
          if (!mem) return;
          const ids = Array.from(new Set((mem as Member[]).map((m) => m.user_id)));
          const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", ids);
          const map = new Map((profs ?? []).map((p) => [p.id as string, p.display_name as string]));
          setMembers((mem as Member[]).map((m) => ({ ...m, display_name: map.get(m.user_id) ?? "Partner" })));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "watch_messages", filter: `room_id=eq.${room.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "watch_messages" },
        (payload) => {
          const removed = payload.old as { id?: string };
          if (!removed?.id) return;
          setMessages((prev) => prev.filter((m) => m.id !== removed.id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, onLeave, setRoom]);

  // Auto-remove membership on unmount / close
  useEffect(() => {
    const bye = () => {
      // fire-and-forget delete
      supabase.from("watch_room_members").delete().eq("room_id", room.id).eq("user_id", user.id);
    };
    window.addEventListener("beforeunload", bye);
    return () => {
      window.removeEventListener("beforeunload", bye);
    };
  }, [room.id, user.id]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy code");
    }
  };

  const shareCode = async () => {
    const text = `Join my Watch Together room with code: ${room.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Watch Together", text });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Invite copied to clipboard");
    }
  };

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{notice}</div>
      )}

      {/* Room info */}
      <div className="rounded-3xl border border-border/50 bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Room code</div>
            <div className="font-mono text-2xl font-semibold tracking-widest text-primary">{room.code}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyCode} className="rounded-full">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={shareCode} className="rounded-full">
              Share
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-destructive hover:text-destructive"
                  aria-label="Leave room"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave Room?</AlertDialogTitle>
                  <AlertDialogDescription>You will disconnect from the room.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onLeave}>Leave</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{members.length} online</span>
          <span>·</span>
          <span>{members.map((m) => m.display_name).join(", ")}</span>
        </div>
      </div>

      <VideoPanel room={room} />

      <VoicePanel roomId={room.id} userId={user.id} />

      <ChatPanel roomId={room.id} userId={user.id} messages={messages} members={members} />
    </div>
  );
}

/* ---------------- Video ---------------- */

function VideoPanel({ room }: { room: Room }) {
  const [urlInput, setUrlInput] = useState(room.video_url ?? "");
  const applyingRemoteRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setUrlInput(room.video_url ?? "");
  }, [room.video_url]);

  const ytId = room.video_url ? parseYouTubeId(room.video_url) : null;

  // HTML5 video sync
  useEffect(() => {
    if (ytId) return;
    const v = videoRef.current;
    if (!v) return;
    applyingRemoteRef.current = true;
    try {
      if (Math.abs(v.currentTime - room.position_seconds) > 1.5) {
        v.currentTime = room.position_seconds;
      }
      if (room.is_playing && v.paused) v.play().catch(() => {});
      if (!room.is_playing && !v.paused) v.pause();
    } finally {
      // release on next tick
      setTimeout(() => (applyingRemoteRef.current = false), 100);
    }
  }, [room.is_playing, room.position_seconds, room.video_url, ytId]);

  const updateState = useCallback(
    async (patch: Partial<Pick<Room, "is_playing" | "position_seconds" | "video_url">>) => {
      await supabase
        .from("watch_rooms")
        .update({ ...patch, last_sync_at: new Date().toISOString() })
        .eq("id", room.id);
    },
    [room.id],
  );

  const setUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    await updateState({ video_url: url, position_seconds: 0, is_playing: false });
  };

  const onPlay = () => {
    if (applyingRemoteRef.current) return;
    const v = videoRef.current;
    updateState({ is_playing: true, position_seconds: v?.currentTime ?? 0 });
  };
  const onPause = () => {
    if (applyingRemoteRef.current) return;
    const v = videoRef.current;
    updateState({ is_playing: false, position_seconds: v?.currentTime ?? 0 });
  };
  const onSeeked = () => {
    if (applyingRemoteRef.current) return;
    const v = videoRef.current;
    updateState({ position_seconds: v?.currentTime ?? 0 });
  };

  const togglePlayYt = () => updateState({ is_playing: !room.is_playing });
  const seekBack = () => updateState({ position_seconds: Math.max(0, room.position_seconds - 10) });
  const seekFwd = () => updateState({ position_seconds: room.position_seconds + 10 });

  return (
    <div className="rounded-3xl border border-border/50 bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="mb-3 flex gap-2">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Paste video URL (YouTube or .mp4)"
          className="rounded-full"
        />
        <Button onClick={setUrl} size="sm" className="rounded-full">
          <Link2 className="mr-1 h-4 w-4" /> Load
        </Button>
      </div>

      <div className="aspect-video overflow-hidden rounded-2xl bg-black">
        {!room.video_url ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Paste a video URL to start watching together.
          </div>
        ) : ytId ? (
          <YouTubePlayer videoId={ytId} isPlaying={room.is_playing} position={room.position_seconds} />
        ) : (
          <video
            ref={videoRef}
            src={room.video_url}
            controls
            className="h-full w-full"
            onPlay={onPlay}
            onPause={onPause}
            onSeeked={onSeeked}
          />
        )}
      </div>

      {ytId && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={seekBack} className="rounded-full">-10s</Button>
          <Button size="sm" onClick={togglePlayYt} className="rounded-full">
            {room.is_playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={seekFwd} className="rounded-full">+10s</Button>
          <span className="ml-2 text-xs text-muted-foreground">{Math.floor(room.position_seconds)}s</span>
        </div>
      )}
    </div>
  );
}

// YouTube iframe API loader
let ytApiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as unknown as { YT?: { Player: unknown }; onYouTubeIframeAPIReady?: () => void };
  if (w.YT && w.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    w.onYouTubeIframeAPIReady = () => resolve();
  });
  return ytApiPromise;
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  destroy: () => void;
}

function YouTubePlayer({
  videoId,
  isPlaying,
  position,
}: {
  videoId: string;
  isPlaying: boolean;
  position: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    loadYouTubeAPI().then(() => {
      if (!mounted || !containerRef.current) return;
      const YT = (window as unknown as { YT: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer } }).YT;
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            readyRef.current = true;
            playerRef.current?.seekTo(position, true);
            if (isPlaying) playerRef.current?.playVideo();
          },
        },
      });
    });
    return () => {
      mounted = false;
      try {
        playerRef.current?.destroy();
      } catch {
        /* noop */
      }
      playerRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // React to remote state
  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    const p = playerRef.current;
    try {
      const cur = p.getCurrentTime();
      if (Math.abs(cur - position) > 1.5) p.seekTo(position, true);
      if (isPlaying) p.playVideo();
      else p.pauseVideo();
    } catch {
      /* noop */
    }
  }, [isPlaying, position]);

  return <div ref={containerRef} className="h-full w-full" />;
}

/* ---------------- Voice (real WebRTC over Supabase Realtime signaling) ---------------- */

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type SignalPayload =
  | { kind: "hello"; from: string }
  | { kind: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { kind: "bye"; from: string };

function VoicePanel({ roomId, userId }: { roomId: string; userId: string }) {
  const [on, setOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peerCount, setPeerCount] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);

  const updateCount = useCallback(() => setPeerCount(peersRef.current.size), []);

  const cleanupPeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      try { pc.close(); } catch { /* noop */ }
      peersRef.current.delete(peerId);
    }
    const el = audiosRef.current.get(peerId);
    if (el) {
      el.srcObject = null;
      el.remove();
      audiosRef.current.delete(peerId);
    }
    updateCount();
  }, [updateCount]);

  const send = useCallback((payload: SignalPayload) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload });
  }, []);

  const createPeer = useCallback((peerId: string): RTCPeerConnection => {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(peerId, pc);

    streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));

    pc.onicecandidate = (e) => {
      if (e.candidate) send({ kind: "ice", from: userId, to: peerId, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      let audio = audiosRef.current.get(peerId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.autoplay = true;
        audio.setAttribute("playsinline", "true");
        audioContainerRef.current?.appendChild(audio);
        audiosRef.current.set(peerId, audio);
      }
      audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      audio.play().catch(() => { /* browsers may block; user gesture already given */ });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        cleanupPeer(peerId);
      }
    };
    updateCount();
    return pc;
  }, [send, userId, cleanupPeer, updateCount]);

  const startVoice = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const msg = err instanceof Error ? err.message : String(err);
      setError(`${name ? name + ": " : ""}${msg || "Microphone unavailable"}`);
      return;
    }
    streamRef.current = stream;
    setMuted(false);
    setOn(true);

    // Signaling channel — one per room, scoped to voice.
    const channel = supabase.channel(`voice-${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const p = payload as SignalPayload;
      if ("to" in p && p.to !== userId) return;
      if (p.from === userId) return;

      if (p.kind === "hello") {
        // Deterministic tiebreaker: the peer with the larger id initiates the offer
        // to the peer with the smaller id — prevents glare when both sides connect.
        if (userId > p.from) {
          const pc = createPeer(p.from);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({ kind: "offer", from: userId, to: p.from, sdp: offer });
        } else {
          // Ensure a peer slot exists so incoming offer finds it.
          createPeer(p.from);
        }
      } else if (p.kind === "offer") {
        const pc = createPeer(p.from);
        await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ kind: "answer", from: userId, to: p.from, sdp: answer });
      } else if (p.kind === "answer") {
        const pc = peersRef.current.get(p.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
      } else if (p.kind === "ice") {
        const pc = peersRef.current.get(p.from);
        if (pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(p.candidate)); } catch { /* noop */ }
        }
      } else if (p.kind === "bye") {
        cleanupPeer(p.from);
      }
    });

    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
      });
    });

    // Announce presence so existing peers initiate offers to us.
    send({ kind: "hello", from: userId });
  }, [roomId, userId, createPeer, send, cleanupPeer]);

  const stopVoice = useCallback(() => {
    if (channelRef.current) {
      try { channelRef.current.send({ type: "broadcast", event: "signal", payload: { kind: "bye", from: userId } }); } catch { /* noop */ }
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    peersRef.current.forEach((pc) => { try { pc.close(); } catch { /* noop */ } });
    peersRef.current.clear();
    audiosRef.current.forEach((el) => { el.srcObject = null; el.remove(); });
    audiosRef.current.clear();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
    setMuted(false);
    setPeerCount(0);
  }, [userId]);

  const toggleMute = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const next = !muted;
    s.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  useEffect(() => () => { stopVoice(); }, [stopVoice]);

  return (
    <div className="rounded-3xl border border-border/50 bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Voice chat</div>
          <div className="text-xs text-muted-foreground">
            {on ? (muted ? "Muted" : "Live") : "Off"}
            {on && peerCount > 0 && ` · ${peerCount} connected`}
          </div>
        </div>
        <div className="flex gap-2">
          {on && (
            <Button onClick={toggleMute} variant={muted ? "outline" : "default"} size="sm" className="rounded-full">
              {muted ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
              {muted ? "Unmute" : "Mute"}
            </Button>
          )}
          <Button onClick={on ? stopVoice : startVoice} variant={on ? "ghost" : "outline"} size="sm" className="rounded-full">
            {on ? "Leave voice" : "Join voice"}
          </Button>
        </div>
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div ref={audioContainerRef} className="hidden" aria-hidden />
    </div>
  );
}

/* ---------------- Chat ---------------- */

function ChatPanel({
  roomId,
  userId,
  messages,
  members,
}: {
  roomId: string;
  userId: string;
  messages: Message[];
  members: Member[];
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const missing = messages.filter((m) => m.kind === "voice" && m.audio_path && !audioUrls[m.id]);
    if (missing.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (m) => {
          const { data } = await supabase.storage.from("voice-notes").createSignedUrl(m.audio_path as string, 60 * 60 * 6);
          return [m.id, data?.signedUrl ?? ""] as const;
        }),
      );
      setAudioUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
  }, [messages, audioUrls]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((mem) => mem.display_name && m.set(mem.user_id, mem.display_name));
    return m;
  }, [members]);

  const send = async () => {
    const message = text.trim();
    if (!message) return;
    setText("");
    const { error } = await supabase.from("watch_messages").insert({ room_id: roomId, sender_id: userId, message, kind: "text" });
    if (error) {
      toast.error("Failed to send");
      setText(message);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const seconds = Math.round((Date.now() - startedAtRef.current) / 1000);
        setRecording(false);
        if (blob.size < 500) return;
        setUploading(true);
        const path = `${userId}/${crypto.randomUUID()}.webm`;
        const { error: upErr } = await supabase.storage.from("voice-notes").upload(path, blob, { contentType: blob.type });
        if (upErr) {
          setUploading(false);
          toast.error("Couldn't send voice note", { description: upErr.message });
          return;
        }
        const { error } = await supabase.from("watch_messages").insert({
          room_id: roomId,
          sender_id: userId,
          message: `Voice note · ${seconds}s`,
          kind: "voice",
          audio_path: path,
          duration_seconds: seconds,
        });
        setUploading(false);
        if (error) toast.error("Couldn't send voice note");
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone unavailable");
    }
  };

  const stopRecording = () => recorderRef.current?.stop();

  const removeMessage = async (m: Message) => {
    const { error } = await supabase
      .from("watch_messages")
      .delete()
      .eq("id", m.id)
      .eq("sender_id", userId);
    if (error) {
      toast.error("Couldn't delete", { description: error.message });
      return;
    }
    if (m.audio_path) {
      await supabase.storage.from("voice-notes").remove([m.audio_path]);
    }

  };

  return (
    <div className="rounded-3xl border border-border/50 bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="mb-2 text-sm font-medium">Chat</div>
      <div ref={scrollRef} className="mb-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && <div className="text-center text-xs text-muted-foreground">No messages yet.</div>}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          const isVoice = m.kind === "voice";
          return (
            <div key={m.id} className={`group flex items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
              {mine && (
                <ConfirmDialog
                  title={isVoice ? "Delete this voice note?" : "Delete this message?"}
                  description="It will disappear for both of you right away."
                  onConfirm={() => removeMessage(m)}
                  trigger={
                    <button
                      aria-label="Delete message"
                      className="press-pop rounded-full p-1.5 text-muted-foreground opacity-100 transition hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "text-primary-foreground" : "bg-muted"}`}
                style={mine ? { background: "var(--gradient-primary)" } : undefined}
              >
                {!mine && <div className="text-[10px] font-semibold opacity-80">{nameMap.get(m.sender_id) ?? "Partner"}</div>}
                {isVoice && audioUrls[m.id] ? (
                  <audio controls src={audioUrls[m.id]} className="mt-1 h-9 w-56 max-w-full" />
                ) : (
                  <div className="whitespace-pre-wrap break-words">{m.message}</div>
                )}
                <div className={`mt-0.5 text-[10px] ${mine ? "opacity-80" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );

        })}
      </div>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message…"
          className="rounded-full"
        />
        <Button
          onClick={recording ? stopRecording : startRecording}
          size="icon"
          variant={recording ? "destructive" : "secondary"}
          className="press-pop shrink-0 rounded-full"
          disabled={uploading}
          aria-label={recording ? "Stop recording" : "Record voice note"}
        >
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button onClick={send} size="icon" className="btn-romantic press-pop shrink-0 rounded-full" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
