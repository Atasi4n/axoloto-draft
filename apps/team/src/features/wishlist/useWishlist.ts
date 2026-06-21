import { useCallback, useEffect, useState } from "react";
import type { Mode } from "@/features/pokemon/types";
import {
  loadVerdicts,
  saveVerdicts,
  type Decision,
  type Verdict,
  type Verdicts,
} from "./storage";

// Owns the saved verdicts for one mode and keeps them in sync with localStorage.
export function useWishlist(mode: Mode) {
  const [verdicts, setVerdicts] = useState<Verdicts>({});
  const [ready, setReady] = useState(false);

  // Load once (and whenever the mode changes). localStorage is client-only.
  useEffect(() => {
    setVerdicts(loadVerdicts(mode));
    setReady(true);
  }, [mode]);

  const persist = useCallback(
    (next: Verdicts) => {
      setVerdicts(next);
      saveVerdicts(mode, next);
    },
    [mode],
  );

  const setVerdict = useCallback(
    (speciesId: number, verdict: Verdict, preferredFormId: number) => {
      persist({
        ...verdicts,
        [speciesId]: { verdict, preferredFormId, decidedAt: Date.now() },
      });
    },
    [verdicts, persist],
  );

  const remove = useCallback(
    (speciesId: number) => {
      const next = { ...verdicts };
      delete next[speciesId];
      persist(next);
    },
    [verdicts, persist],
  );

  const reset = useCallback(() => persist({}), [persist]);

  return { verdicts, ready, setVerdict, remove, reset };
}

export type { Decision, Verdict, Verdicts };
