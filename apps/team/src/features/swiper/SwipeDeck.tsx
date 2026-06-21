"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Heart, RotateCcw, Star, X } from "lucide-react";
import type { Card, Mode } from "@/features/pokemon/types";
import { useWishlist } from "@/features/wishlist/useWishlist";
import type { Verdict } from "@/features/wishlist/storage";
import { cn } from "@/lib/utils";
import { SwipeCard } from "./SwipeCard";

export function SwipeDeck({ mode, cards }: { mode: Mode; cards: Card[] }) {
  const { verdicts, ready, setVerdict, remove } = useWishlist(mode);
  const byId = useMemo(
    () => new Map(cards.map((c) => [c.speciesId, c])),
    [cards],
  );

  // Explicit ordered queue of undecided species, so undo can re-insert at front.
  const [queue, setQueue] = useState<number[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const initialized = useRef(false);

  // Seed the queue once, after both the deck and saved verdicts are loaded.
  useEffect(() => {
    if (initialized.current || !ready || cards.length === 0) return;
    setQueue(cards.filter((c) => !verdicts[c.speciesId]).map((c) => c.speciesId));
    initialized.current = true;
  }, [ready, cards, verdicts]);

  const currentId = queue[0] ?? null;
  const currentCard = currentId != null ? byId.get(currentId) ?? null : null;

  // Reset the visible form whenever the top card changes.
  useEffect(() => {
    setSelectedFormId(currentCard ? currentCard.forms[0].formId : null);
  }, [currentCard]);

  function decide(verdict: Verdict) {
    if (!currentCard || selectedFormId == null) return;
    setVerdict(currentCard.speciesId, verdict, selectedFormId);
    setHistory((h) => [...h, currentCard.speciesId]);
    setQueue((q) => q.slice(1));
  }

  function undo() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    remove(last);
    setHistory(history.slice(0, -1));
    setQueue([last, ...queue]);
  }

  // Keyboard controls (desktop).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") decide("pass");
      else if (e.key === "ArrowRight") decide("like");
      else if (e.key === "ArrowUp") decide("superlike");
      else if (e.key === "Backspace" || e.key.toLowerCase() === "u") undo();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const decided = cards.length - queue.length;

  if (!ready || !initialized.current) {
    return <p className="text-center text-zinc-400">Loading…</p>;
  }

  return (
    <div className="flex w-full max-w-sm flex-1 flex-col gap-4">
      <Progress decided={decided} total={cards.length} />

      <div className="relative flex-1">
        {currentCard ? (
          <SwipeCard
            key={currentCard.speciesId}
            card={currentCard}
            selectedFormId={selectedFormId ?? currentCard.forms[0].formId}
            onSelectForm={setSelectedFormId}
            onVerdict={decide}
          />
        ) : (
          <Done mode={mode} />
        )}
      </div>

      {currentCard && (
        <div className="flex items-center justify-center gap-4">
          <ActionButton label="Undo" onClick={undo} disabled={history.length === 0} muted>
            <RotateCcw className="size-5" />
          </ActionButton>
          <ActionButton label="Pass" onClick={() => decide("pass")} className="border-rose-400 text-rose-400">
            <X className="size-7" />
          </ActionButton>
          <ActionButton label="Love" onClick={() => decide("superlike")} className="border-sky-400 text-sky-400">
            <Star className="size-6" />
          </ActionButton>
          <ActionButton label="Like" onClick={() => decide("like")} className="border-emerald-400 text-emerald-400">
            <Heart className="size-6" />
          </ActionButton>
        </div>
      )}
    </div>
  );
}

function Progress({ decided, total }: { decided: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((decided / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>
          {decided} / {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  muted,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  muted?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center rounded-full border-2 bg-zinc-900 transition active:scale-95 disabled:opacity-30",
        muted ? "size-12 border-white/20 text-zinc-400" : "size-16",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Done({ mode }: { mode: Mode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center">
      <p className="text-4xl">🎉</p>
      <h2 className="text-xl font-semibold">All done!</h2>
      <p className="text-sm text-zinc-400">
        You&apos;ve gone through every Pokémon in {mode} mode.
      </p>
      <Link
        href={`/results/${mode}`}
        className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-900"
      >
        See my picks
      </Link>
    </div>
  );
}
