"use client";

import { notFound, useParams } from "next/navigation";
import { isMode } from "@/features/pokemon/types";
import { ResultsView } from "@/features/wishlist/ResultsView";

export default function ResultsPage() {
  const params = useParams<{ mode: string }>();
  const mode = params.mode;
  if (!isMode(mode)) notFound();

  return (
    <main className="flex flex-1 flex-col">
      <ResultsView mode={mode} />
    </main>
  );
}
