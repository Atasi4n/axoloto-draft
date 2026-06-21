"use client";

import Image from "next/image";

// A single wave period (52px), tiled horizontally for the top/bottom lines.
const HWAVE = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='52' height='60' viewBox='0 0 52 60'><path d='M0 30 C25 4 27 56 52 30' fill='none' stroke='white' stroke-width='3'/></svg>`,
);
const hWaveStyle: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,${HWAVE}")`,
  backgroundRepeat: "repeat-x",
  backgroundSize: "52px 60px",
};

export type WaitingVariant = "host" | "coach-missing" | "participant-missing";

// Texts pulled verbatim from the Figma export.
const MESSAGES: Record<WaitingVariant, string> = {
  host: "Esperando que el host empiece el evento ;)",
  "coach-missing": "Tu entrenador no ha llegado :p",
  "participant-missing": "Tu invalido/a no ha llegado :p",
};

export function WaitingRoom({ variant }: { variant: WaitingVariant }) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-12 overflow-hidden bg-[#09090b] px-6 sm:gap-20">
      {/* Horizontal wavy lines — top scrolls right, bottom scrolls left */}
      <div
        aria-hidden
        style={{
          ...hWaveStyle,
          animation: "wave-scroll-right 2s linear infinite",
        }}
        className="pointer-events-none absolute inset-x-0 top-16 h-[60px] opacity-70"
      />
      <div
        aria-hidden
        style={{
          ...hWaveStyle,
          animation: "wave-scroll-left 2s linear infinite",
        }}
        className="pointer-events-none absolute inset-x-0 bottom-16 h-[60px] opacity-70"
      />

      <Image
        src="/liga-logo.png"
        alt="Pokémon Liga de Inválidos"
        width={736}
        height={564}
        priority
        className="h-auto w-[min(70vw,18rem)] drop-shadow-[0px_0px_10px_rgba(255,255,255,0.15)]"
      />

      <p className="max-w-xs text-center text-2xl font-medium text-[#f9fafb] [text-shadow:0px_0px_11px_rgba(255,255,255,0.15)] sm:text-3xl">
        {MESSAGES[variant]}
      </p>
    </main>
  );
}
