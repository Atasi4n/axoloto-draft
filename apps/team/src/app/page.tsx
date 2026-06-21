"use client";

import Link from "next/link";
import { Sparkles, Swords } from "lucide-react";
import type { Mode } from "@/features/pokemon/types";
import { useWishlist } from "@/features/wishlist/useWishlist";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 p-6">
      <header className="space-y-1 text-center">
        <h1 className="text-3xl font-bold">Pokémon Picker</h1>
        <p className="text-sm text-zinc-400">
          Swipe right on the ones you like, up on the ones you love.
        </p>
      </header>

      <div className="space-y-4">
        <ModeCard
          mode="normal"
          title="Normal"
          subtitle="Every Pokémon and its forms"
          icon={<Swords className="size-6" />}
        />
        <ModeCard
          mode="mega"
          title="Mega"
          subtitle="Mega Evolutions only"
          icon={<Sparkles className="size-6" />}
        />
      </div>
    </main>
  );
}

function ModeCard({
  mode,
  title,
  subtitle,
  icon,
}: {
  mode: Mode;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  const { verdicts, ready } = useWishlist(mode);
  const counts = Object.values(verdicts).reduce(
    (acc, d) => {
      if (d.verdict === "like") acc.like++;
      else if (d.verdict === "superlike") acc.love++;
      return acc;
    },
    { like: 0, love: 0 },
  );
  const hasPicks = ready && counts.like + counts.love > 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10">
          {icon}
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-xs text-zinc-400">{subtitle}</p>
        </div>
      </div>

      {hasPicks && (
        <p className="mt-3 text-xs text-zinc-400">
          ★ {counts.love} loved · ♥ {counts.like} liked
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Link
          href={`/swipe/${mode}`}
          className="flex-1 rounded-full bg-white px-4 py-2.5 text-center text-sm font-medium text-zinc-900"
        >
          {hasPicks ? "Continue" : "Start"}
        </Link>
        <Link
          href={`/results/${mode}`}
          className="rounded-full border border-white/20 px-4 py-2.5 text-center text-sm font-medium"
        >
          Picks
        </Link>
      </div>
    </div>
  );
}
