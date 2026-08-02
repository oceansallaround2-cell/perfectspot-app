import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SmilePlus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ReactionTarget = "love_message" | "journal_entry" | "memory" | "watch_message";

export const REACTION_EMOJIS = ["💜", "😍", "🥺", "😂", "🔥", "🙌"] as const;

interface Row {
  id: string;
  target_type: string;
  target_id: string;
  user_id: string;
  emoji: string;
}

interface Ctx {
  rows: Row[];
  userId: string;
  toggle: (targetId: string, emoji: string) => Promise<boolean>;
}

const ReactionsCtx = createContext<Ctx | null>(null);

export function ReactionsProvider({
  targetType,
  userId,
  children,
}: {
  targetType: ReactionTarget;
  userId: string;
  children: ReactNode;
}) {
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("reactions").select("*").eq("target_type", targetType);
    setRows((data ?? []) as Row[]);
  }, [targetType]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`reactions-${targetType}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions", filter: `target_type=eq.${targetType}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [targetType, load]);

  const toggle = useCallback(
    async (targetId: string, emoji: string) => {
      const mine = rows.find((r) => r.target_id === targetId && r.user_id === userId && r.emoji === emoji);
      if (mine) {
        setRows((prev) => prev.filter((r) => r.id !== mine.id));
        await supabase.from("reactions").delete().eq("id", mine.id);
        return false;
      }
      await supabase.from("reactions").insert({
        target_type: targetType,
        target_id: targetId,
        user_id: userId,
        emoji,
      });
      load();
      return true;
    },
    [rows, targetType, userId, load],
  );

  const value = useMemo(() => ({ rows, userId, toggle }), [rows, userId, toggle]);

  return <ReactionsCtx.Provider value={value}>{children}</ReactionsCtx.Provider>;
}

export function ReactionBar({
  targetId,
  onReacted,
  align = "start",
}: {
  targetId: string;
  onReacted?: (emoji: string) => void;
  align?: "start" | "end";
}) {
  const ctx = useContext(ReactionsCtx);
  const [open, setOpen] = useState(false);
  if (!ctx) return null;

  const forTarget = ctx.rows.filter((r) => r.target_id === targetId);
  const grouped = new Map<string, { count: number; mine: boolean }>();
  forTarget.forEach((r) => {
    const cur = grouped.get(r.emoji) ?? { count: 0, mine: false };
    grouped.set(r.emoji, { count: cur.count + 1, mine: cur.mine || r.user_id === ctx.userId });
  });

  async function pick(emoji: string) {
    setOpen(false);
    const added = await ctx!.toggle(targetId, emoji);
    if (added) onReacted?.(emoji);
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${align === "end" ? "justify-end" : ""}`}>
      {Array.from(grouped.entries()).map(([emoji, info]) => (
        <button
          key={emoji}
          onClick={() => pick(emoji)}
          className="press-pop flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition"
          style={
            info.mine
              ? { borderColor: "transparent", background: "var(--gradient-primary)", color: "var(--primary-foreground)" }
              : { borderColor: "var(--border)", background: "color-mix(in oklab, var(--card) 85%, transparent)" }
          }
          aria-label={`React ${emoji}`}
        >
          <span>{emoji}</span>
          <span className="tabular-nums">{info.count}</span>
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="press-pop rounded-full border border-border/60 p-1 text-muted-foreground transition hover:text-primary"
            aria-label="Add reaction"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-auto rounded-2xl p-2">
          <div className="flex gap-1">
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => pick(e)}
                className="press-pop rounded-full px-2 py-1 text-lg transition hover:bg-muted"
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
