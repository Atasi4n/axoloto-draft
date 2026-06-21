"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Share2, Star, Trash2 } from "lucide-react";
import type { Mode } from "@/features/pokemon/types";
import { usePokemon } from "@/features/pokemon/usePokemon";
import { titleCase } from "@/features/pokemon/display";
import { useWishlist } from "./useWishlist";
import { buildSummary, shareSummary } from "./share";
import { cn } from "@/lib/utils";

type Row = {
  speciesId: number;
  name: string;
  formName: string;
  formId: number;
  sprite: string | null;
};

export function ResultsView({ mode }: { mode: Mode }) {
  const { cards, loading } = usePokemon(mode);
  const { verdicts, ready, setVerdict, remove, reset } = useWishlist(mode);
  const [toast, setToast] = useState<string | null>(null);

  const byId = useMemo(
    () => new Map(cards.map((c) => [c.speciesId, c])),
    [cards],
  );

  const { superlikes, likes, passCount } = useMemo(() => {
    const sl: Row[] = [];
    const lk: Row[] = [];
    let passes = 0;
    for (const [idStr, d] of Object.entries(verdicts)) {
      if (d.verdict === "pass") {
        passes++;
        continue;
      }
      const card = byId.get(Number(idStr));
      if (!card) continue;
      const form =
        card.forms.find((f) => f.formId === d.preferredFormId) ?? card.forms[0];
      const row: Row = {
        speciesId: card.speciesId,
        name: card.name,
        formName: titleCase(form.name),
        formId: form.formId,
        sprite: form.sprite,
      };
      (d.verdict === "superlike" ? sl : lk).push(row);
    }
    const sort = (a: Row, b: Row) => a.formName.localeCompare(b.formName);
    return { superlikes: sl.sort(sort), likes: lk.sort(sort), passCount: passes };
  }, [verdicts, byId]);

  async function onShare() {
    const result = await shareSummary(buildSummary(mode, cards, verdicts));
    setToast(
      result === "copied"
        ? "Copied to clipboard"
        : result === "shared"
          ? "Shared!"
          : "Couldn't share",
    );
    setTimeout(() => setToast(null), 2000);
  }

  function onReset() {
    if (window.confirm("Clear all your picks in this mode?")) reset();
  }

  if (loading || !ready) {
    return <p className="p-6 text-center text-zinc-400">Loading…</p>;
  }

  const empty = superlikes.length === 0 && likes.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-400">
          ← Home
        </Link>
        <button
          onClick={onShare}
          disabled={empty}
          className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-40"
        >
          <Share2 className="size-4" /> Share
        </button>
      </div>

      <h1 className="text-2xl font-bold capitalize">{mode} picks</h1>

      {empty ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 text-center text-sm text-zinc-400">
          No likes yet.{" "}
          <Link href={`/swipe/${mode}`} className="text-white underline">
            Start swiping
          </Link>
          .
        </div>
      ) : (
        <>
          <Section title="★ Loves" rows={superlikes} verdict="superlike" onSet={setVerdict} onRemove={remove} />
          <Section title="♥ Likes" rows={likes} verdict="like" onSet={setVerdict} onRemove={remove} />
        </>
      )}

      {passCount > 0 && (
        <p className="text-center text-xs text-zinc-500">{passCount} passed</p>
      )}

      <button onClick={onReset} className="text-center text-xs text-rose-400/80">
        Reset this mode
      </button>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  verdict,
  onSet,
  onRemove,
}: {
  title: string;
  rows: Row[];
  verdict: "like" | "superlike";
  onSet: (speciesId: number, v: "like" | "superlike", formId: number) => void;
  onRemove: (speciesId: number) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-400">
        {title} ({rows.length})
      </h2>
      <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
        {rows.map((row) => (
          <li key={row.speciesId} className="flex items-center gap-3 p-3">
            {row.sprite ? (
              <img src={row.sprite} alt={row.formName} className="size-12 object-contain" />
            ) : (
              <div className="size-12 rounded-full bg-zinc-800" />
            )}
            <span className="flex-1 truncate text-sm">{row.formName}</span>
            <button
              aria-label="Mark as love"
              onClick={() => onSet(row.speciesId, "superlike", row.formId)}
              className={cn("p-1.5", verdict === "superlike" ? "text-sky-400" : "text-zinc-600")}
            >
              <Star className="size-5" />
            </button>
            <button
              aria-label="Mark as like"
              onClick={() => onSet(row.speciesId, "like", row.formId)}
              className={cn("p-1.5", verdict === "like" ? "text-emerald-400" : "text-zinc-600")}
            >
              <Heart className="size-5" />
            </button>
            <button aria-label="Remove" onClick={() => onRemove(row.speciesId)} className="p-1.5 text-zinc-600">
              <Trash2 className="size-5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
