import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Pencil, Redo2, Trash2, Undo2, LogOut, Loader2, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  userId: string;
  color: string;
  size: number;
  erase: boolean;
  points: Point[];
}

const PALETTE = ["#FFFFFF", "#C4A7F5", "#8A5FC9", "#FF9FD2", "#FFD98E", "#7CE7C8", "#FF7A7A"];

/**
 * Real-time shared drawing board. Strokes are broadcast over a Supabase
 * realtime channel and presence tells us when the partner has joined.
 */
export function SharedCanvas({
  eventId,
  userId,
  onLeave,
}: {
  eventId: string;
  userId: string;
  onLeave: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const redoRef = useRef<Stroke[]>([]);
  const [, forceRender] = useState(0);
  const [partnerHere, setPartnerHere] = useState(false);
  const partnerSeenRef = useRef(false);
  const [color, setColor] = useState(PALETTE[1]!);
  const [size, setSize] = useState(4);
  const [erase, setErase] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#07050C";
    ctx.fillRect(0, 0, w, h);
    const all = currentRef.current ? [...strokesRef.current, currentRef.current] : strokesRef.current;
    for (const s of all) {
      if (s.points.length === 0) continue;
      ctx.beginPath();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = s.erase ? "#07050C" : s.color;
      ctx.lineWidth = s.erase ? s.size * 4 : s.size;
      ctx.moveTo(s.points[0]!.x * w, s.points[0]!.y * h);
      for (const p of s.points.slice(1)) ctx.lineTo(p.x * w, p.y * h);
      ctx.stroke();
    }
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }, [redraw]);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  useEffect(() => {
    const channel = supabase.channel(`surprise-canvas-${eventId}`, {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        strokesRef.current = [...strokesRef.current, payload as Stroke];
        redraw();
      })
      .on("broadcast", { event: "undo" }, ({ payload }) => {
        strokesRef.current = strokesRef.current.filter((s) => s.id !== (payload as { id: string }).id);
        redraw();
      })
      .on("broadcast", { event: "clear" }, () => {
        strokesRef.current = [];
        redoRef.current = [];
        redraw();
      })
      .on("broadcast", { event: "sync" }, ({ payload }) => {
        const incoming = (payload as { strokes: Stroke[] }).strokes;
        if (strokesRef.current.length === 0 && incoming.length) {
          strokesRef.current = incoming;
          redraw();
        }
      })
      .on("broadcast", { event: "leave" }, () => onLeave())
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const others = Object.keys(state).filter((k) => k !== userId);
        if (others.length > 0) partnerSeenRef.current = true;
        setPartnerHere(others.length > 0);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (key === userId) return;
        // Share our current board with the person who just arrived.
        if (strokesRef.current.length) {
          channel.send({ type: "broadcast", event: "sync", payload: { strokes: strokesRef.current } });
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ at: Date.now() });
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [eventId, userId, redraw, onLeave]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    currentRef.current = {
      id: crypto.randomUUID(),
      userId,
      color,
      size,
      erase,
      points: [pos(e)],
    };
    redraw();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!currentRef.current) return;
    currentRef.current.points.push(pos(e));
    redraw();
  }

  function up() {
    const stroke = currentRef.current;
    currentRef.current = null;
    if (!stroke || stroke.points.length === 0) return;
    strokesRef.current = [...strokesRef.current, stroke];
    redoRef.current = [];
    channelRef.current?.send({ type: "broadcast", event: "stroke", payload: stroke });
    redraw();
    forceRender((n) => n + 1);
  }

  function undo() {
    const mine = [...strokesRef.current].reverse().find((s) => s.userId === userId);
    if (!mine) return;
    strokesRef.current = strokesRef.current.filter((s) => s.id !== mine.id);
    redoRef.current = [...redoRef.current, mine];
    channelRef.current?.send({ type: "broadcast", event: "undo", payload: { id: mine.id } });
    redraw();
    forceRender((n) => n + 1);
  }

  function redo() {
    const stroke = redoRef.current.at(-1);
    if (!stroke) return;
    redoRef.current = redoRef.current.slice(0, -1);
    strokesRef.current = [...strokesRef.current, stroke];
    channelRef.current?.send({ type: "broadcast", event: "stroke", payload: stroke });
    redraw();
    forceRender((n) => n + 1);
  }

  function clearAll() {
    strokesRef.current = [];
    redoRef.current = [];
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
    redraw();
    forceRender((n) => n + 1);
  }

  function leave() {
    // Only end the session for both of us if we were actually drawing together.
    if (partnerHere || partnerSeenRef.current) {
      channelRef.current?.send({ type: "broadcast", event: "leave", payload: {} });
    }
    onLeave();
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#07050C]">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />

      <div
        className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full border border-border/50 px-3 py-1.5 text-xs"
        style={{ background: "color-mix(in oklab, var(--card) 85%, transparent)", backdropFilter: "blur(16px)" }}
      >
        {partnerHere ? (
          <>
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">You&apos;re drawing together</span>
          </>
        ) : (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-muted-foreground">Waiting for your partner — draw anyway 💜</span>
          </>
        )}
      </div>

      <div className="absolute right-3 top-3 z-30">
        <ConfirmDialog
          title="Leave the canvas?"
          description="This ends the shared session for both of you."
          confirmLabel="Leave"
          onConfirm={leave}
          trigger={
            <Button size="sm" variant="secondary" className="rounded-full">
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Leave
            </Button>
          }
        />
      </div>

      <div
        className="absolute inset-x-3 bottom-4 z-30 mx-auto flex max-w-lg flex-wrap items-center justify-center gap-2 rounded-3xl border border-border/50 p-3"
        style={{ background: "color-mix(in oklab, var(--card) 88%, transparent)", backdropFilter: "blur(20px)" }}
      >
        <Button size="icon" variant={erase ? "ghost" : "default"} className="rounded-full" onClick={() => setErase(false)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant={erase ? "default" : "ghost"} className="rounded-full" onClick={() => setErase(true)}>
          <Eraser className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                setErase(false);
              }}
              className="h-6 w-6 rounded-full border-2 transition"
              style={{ background: c, borderColor: color === c && !erase ? "var(--primary)" : "transparent" }}
              aria-label={`Colour ${c}`}
            />
          ))}
        </div>
        <input
          type="range"
          min={2}
          max={18}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="h-1 w-20 accent-[var(--primary)]"
          aria-label="Brush size"
        />
        <Button size="icon" variant="ghost" className="rounded-full" onClick={undo}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="rounded-full" onClick={redo}>
          <Redo2 className="h-4 w-4" />
        </Button>
        <ConfirmDialog
          title="Clear the canvas?"
          description="Everything you have both drawn will be erased."
          confirmLabel="Clear"
          onConfirm={clearAll}
          trigger={
            <Button size="icon" variant="ghost" className="rounded-full text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        />
      </div>
    </div>
  );
}
