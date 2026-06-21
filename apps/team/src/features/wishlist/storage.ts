import type { Mode } from "@/features/pokemon/types";

export type Verdict = "pass" | "like" | "superlike";

export type Decision = {
  verdict: Verdict;
  // The form that was on screen when the verdict was given (preference signal).
  preferredFormId: number;
  decidedAt: number;
};

// speciesId -> decision
export type Verdicts = Record<number, Decision>;

const VERSION = "v1";
const key = (mode: Mode) => `axoloto.team.${mode}.${VERSION}`;

export function loadVerdicts(mode: Mode): Verdicts {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key(mode));
    return raw ? (JSON.parse(raw) as Verdicts) : {};
  } catch {
    return {};
  }
}

export function saveVerdicts(mode: Mode, verdicts: Verdicts): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(mode), JSON.stringify(verdicts));
  } catch {
    // Storage full / unavailable — choices simply won't persist this session.
  }
}
