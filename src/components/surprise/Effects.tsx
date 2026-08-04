import { useEffect, useRef, useMemo } from "react";

/** Soft drifting stars + glowing purple orbs behind the surprise experience. */
export function StarField({ count = 60 }: { count?: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 2.4 + 0.8,
        delay: Math.random() * 6,
        dur: 3 + Math.random() * 5,
        opacity: 0.25 + Math.random() * 0.6,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -left-24 top-1/4 h-72 w-72 rounded-full blur-[90px]"
        style={{ background: "radial-gradient(circle, rgba(138,95,201,0.55), transparent 70%)" }}
      />
      <div
        className="absolute -right-20 bottom-1/5 h-80 w-80 rounded-full blur-[100px]"
        style={{ background: "radial-gradient(circle, rgba(75,46,131,0.6), transparent 70%)" }}
      />
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            animation: `ps-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
}

const COLORS = ["#C4A7F5", "#8A5FC9", "#F2E7FF", "#FFD9F0", "#5E3AA5", "#FFFFFF"];

/** Full-screen confetti burst. Increment `fire` to trigger another burst. */
export function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const piecesRef = useRef<Piece[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!fire) return;
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = canvas.clientWidth;
    const pieces: Piece[] = Array.from({ length: 160 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.6,
      y: -20 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 3.4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      size: 5 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    }));
    piecesRef.current = pieces;

    const start = performance.now();
    const tick = (t: number) => {
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, canvas.clientWidth, h);
      for (const p of piecesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (t - start < 5200) rafRef.current = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.clientWidth, h);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [fire]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-30 h-full w-full" />;
}
