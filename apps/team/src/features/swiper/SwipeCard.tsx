"use client";

import { useRef, useState } from "react";
import type { Card } from "@/features/pokemon/types";
import { titleCase, typeColor } from "@/features/pokemon/display";
import type { Verdict } from "@/features/wishlist/storage";
import { cn } from "@/lib/utils";

const THRESHOLD = 90; // px of travel before a swipe commits

type Props = {
  card: Card;
  selectedFormId: number;
  onSelectForm: (formId: number) => void;
  onVerdict: (verdict: Verdict) => void;
};

export function SwipeCard({
  card,
  selectedFormId,
  onSelectForm,
  onVerdict,
}: Props) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const form =
    card.forms.find((f) => f.formId === selectedFormId) ?? card.forms[0];
  const dex = String(card.speciesId).padStart(3, "0");

  // Which verdict the current drag would commit to (for the overlay hint).
  const pending: Verdict | null = (() => {
    if (drag.y < -THRESHOLD && Math.abs(drag.y) > Math.abs(drag.x))
      return "superlike";
    if (drag.x > THRESHOLD) return "like";
    if (drag.x < -THRESHOLD) return "pass";
    return null;
  })();

  function onPointerDown(e: React.PointerEvent) {
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    setDrag({
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
      active: true,
    });
  }

  function onPointerUp() {
    if (!startRef.current) return;
    startRef.current = null;
    const committed = pending;
    setDrag({ x: 0, y: 0, active: false });
    if (committed) onVerdict(committed);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute inset-0 flex touch-none select-none flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-xl"
      style={{
        transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`,
        transition: drag.active ? "none" : "transform 200ms ease-out",
      }}
    >
      {/* Swipe-direction hints */}
      <Overlay show={pending === "like"} className="left-4 border-emerald-400 text-emerald-400">
        LIKE
      </Overlay>
      <Overlay show={pending === "pass"} className="right-4 border-rose-400 text-rose-400">
        NOPE
      </Overlay>
      <Overlay
        show={pending === "superlike"}
        className="left-1/2 -translate-x-1/2 border-sky-400 text-sky-400"
      >
        LOVE
      </Overlay>

      {/* Sprite */}
      <div className="flex flex-1 items-center justify-center bg-zinc-800/30 p-2">
        <Sprite key={form.formId} src={form.sprite} alt={form.name} />
      </div>

      {/* Info */}
      <div className="space-y-3 p-4 pb-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold leading-tight">
            {titleCase(form.name)}
          </h2>
          <span className="shrink-0 font-mono text-sm text-zinc-500">
            #{dex}
          </span>
        </div>

        {form.label && (
          <p className="-mt-2 text-sm text-zinc-400">{titleCase(form.label)}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {form.types.map((t) => (
            <span
              key={t}
              className="rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: typeColor(t) }}
            >
              {titleCase(t)}
            </span>
          ))}
        </div>

        {card.forms.length > 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {card.forms.map((f) => (
              <button
                key={f.formId}
                // Don't let a tap on the switcher start a drag.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onSelectForm(f.formId)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  f.formId === form.formId
                    ? "border-white bg-white text-zinc-900"
                    : "border-white/20 text-zinc-300",
                )}
              >
                {f.isMega
                  ? titleCase(f.label ?? "Mega")
                  : titleCase(f.label ?? "Base")}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Overlay({
  show,
  className,
  children,
}: {
  show: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-6 z-10 rounded-lg border-4 px-3 py-1 text-2xl font-extrabold tracking-wider transition-opacity",
        show ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Sprite({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="flex size-40 items-center justify-center rounded-full bg-zinc-800 text-4xl text-zinc-500">
        ?
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => setBroken(true)}
      className="h-full w-full object-contain"
    />
  );
}
