import { useEffect, useState } from "react";
import { Lock, Delete, Heart } from "lucide-react";

const PIN_STORAGE_KEY = "memories.pin";
const UNLOCK_SESSION_KEY = "memories.unlocked";
const DEFAULT_PIN = "143";

export function getMemoriesPin(): string {
  if (typeof window === "undefined") return DEFAULT_PIN;
  return localStorage.getItem(PIN_STORAGE_KEY) ?? DEFAULT_PIN;
}

export function lockMemories() {
  if (typeof window !== "undefined") sessionStorage.removeItem(UNLOCK_SESSION_KEY);
}

export function MemoriesLock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (pin.length === 3) {
      const expected = getMemoriesPin();
      if (pin === expected) {
        sessionStorage.setItem(UNLOCK_SESSION_KEY, "1");
        onUnlock();
      } else {
        setError("Incorrect PIN. Please try again.");
        setShake(true);
        setTimeout(() => {
          setPin("");
          setShake(false);
        }, 450);
      }
    } else {
      setError(null);
    }
  }, [pin, onUnlock]);

  function press(v: string) {
    setPin((p) => (p.length < 3 ? p + v : p));
  }
  function back() {
    setPin((p) => p.slice(0, -1));
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="glass-card w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
          <Lock className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="font-serif text-2xl">Memories are locked</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your 3-digit PIN to unlock</p>

        <div className={`mt-6 flex justify-center gap-3 ${shake ? "animate-[shake_0.4s_ease]" : ""}`}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex h-14 w-12 items-center justify-center rounded-2xl border border-border/60 text-2xl font-semibold"
              style={{
                background: "color-mix(in oklab, var(--card) 90%, transparent)",
                boxShadow: pin.length > i ? "var(--shadow-soft)" : undefined,
                borderColor: pin.length > i ? "var(--accent)" : undefined,
              }}
            >
              {pin[i] ? <Heart className="h-4 w-4 text-primary-glow" fill="currentColor" /> : <span className="text-muted-foreground/30">•</span>}
            </div>
          ))}
        </div>

        <div className="mt-4 h-5 text-xs text-destructive">{error}</div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className="rounded-2xl border border-border/50 py-4 text-xl font-medium transition hover:-translate-y-0.5"
              style={{ background: "color-mix(in oklab, var(--card) 85%, transparent)" }}
            >
              {k}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => press("0")}
            className="rounded-2xl border border-border/50 py-4 text-xl font-medium transition hover:-translate-y-0.5"
            style={{ background: "color-mix(in oklab, var(--card) 85%, transparent)" }}
          >
            0
          </button>
          <button
            type="button"
            onClick={back}
            className="flex items-center justify-center rounded-2xl border border-border/50 py-4 text-muted-foreground transition hover:text-foreground"
            style={{ background: "color-mix(in oklab, var(--card) 85%, transparent)" }}
            aria-label="Delete"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-6 text-[10px] uppercase tracking-widest text-muted-foreground">Private · Just for us</p>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

export function useMemoriesUnlocked() {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    setUnlocked(sessionStorage.getItem(UNLOCK_SESSION_KEY) === "1");
  }, []);
  return [unlocked, setUnlocked] as const;
}
