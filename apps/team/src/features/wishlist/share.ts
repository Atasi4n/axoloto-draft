import type { Card, Mode } from "@/features/pokemon/types";
import { titleCase } from "@/features/pokemon/display";
import type { Verdicts } from "./storage";

// Resolve the display label for a saved decision (its preferred form name).
function labelFor(card: Card, preferredFormId: number): string {
  const form =
    card.forms.find((f) => f.formId === preferredFormId) ?? card.forms[0];
  return titleCase(form?.name ?? card.name);
}

// Build a human-readable wishlist the trainee can send to the trainer.
export function buildSummary(
  mode: Mode,
  cards: Card[],
  verdicts: Verdicts,
): string {
  const byId = new Map(cards.map((c) => [c.speciesId, c]));
  const superlikes: string[] = [];
  const likes: string[] = [];

  for (const [id, decision] of Object.entries(verdicts)) {
    const card = byId.get(Number(id));
    if (!card) continue;
    const label = labelFor(card, decision.preferredFormId);
    if (decision.verdict === "superlike") superlikes.push(label);
    else if (decision.verdict === "like") likes.push(label);
  }

  superlikes.sort();
  likes.sort();

  const title = mode === "mega" ? "Mega" : "Normal";
  const lines = [`My Pokémon picks — ${title} mode`, ""];

  lines.push(`★ Loves (${superlikes.length})`);
  lines.push(superlikes.length ? superlikes.join(", ") : "—");
  lines.push("");
  lines.push(`♥ Likes (${likes.length})`);
  lines.push(likes.length ? likes.join(", ") : "—");

  return lines.join("\n");
}

// Share via the native sheet, falling back to clipboard. Returns how it went.
export async function shareSummary(
  text: string,
): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ text });
      return "shared";
    }
  } catch {
    // User dismissed the share sheet, or it's unavailable — fall through.
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
