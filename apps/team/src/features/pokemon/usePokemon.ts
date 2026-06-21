import { useEffect, useState } from "react";
import { loadDeck } from "./data";
import type { Card, Mode } from "./types";

type State = {
  cards: Card[];
  loading: boolean;
  error: string | null;
};

// Fetches the full deck for a mode once on mount. Read-only; the result is the
// static universe of cards the user swipes through.
export function usePokemon(mode: Mode): State {
  const [state, setState] = useState<State>({
    cards: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    setState({ cards: [], loading: true, error: null });

    loadDeck(mode)
      .then((cards) => {
        if (active) setState({ cards, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (active)
          setState({
            cards: [],
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load Pokémon",
          });
      });

    return () => {
      active = false;
    };
  }, [mode]);

  return state;
}
