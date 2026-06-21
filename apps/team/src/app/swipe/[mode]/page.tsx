"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { isMode } from "@/features/pokemon/types";
import { usePokemon } from "@/features/pokemon/usePokemon";
import { SwipeDeck } from "@/features/swiper/SwipeDeck";

export default function SwipePage() {
  const params = useParams<{ mode: string }>();
  const mode = params.mode;
  if (!isMode(mode)) notFound();

  return <SwipeScreen mode={mode} />;
}

function SwipeScreen({ mode }: { mode: "normal" | "mega" }) {
  const { cards, loading, error } = usePokemon(mode);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col p-4">
      <header className="mb-3 flex items-center justify-between text-sm">
        <Link href="/" className="text-zinc-400">
          ← Home
        </Link>
        <span className="font-medium capitalize">{mode}</span>
        <Link href={`/results/${mode}`} className="text-zinc-400">
          Picks
        </Link>
      </header>

      {error ? (
        <p className="flex flex-1 items-center justify-center text-center text-sm text-rose-400">
          {error}
        </p>
      ) : loading ? (
        <p className="flex flex-1 items-center justify-center text-zinc-400">
          Loading Pokémon…
        </p>
      ) : (
        <div className="flex flex-1 flex-col items-center">
          <SwipeDeck mode={mode} cards={cards} />
        </div>
      )}
    </main>
  );
}
