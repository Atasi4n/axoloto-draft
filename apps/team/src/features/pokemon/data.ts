import { supabase } from "@/lib/supabase/client";
import type { Card, CardForm, Mode } from "./types";

type MetaRow = {
  species_id: number;
  name: string;
  is_mega_capable: boolean;
  types: string[] | null;
  sprite_home: string | null;
  sprite_front: string | null;
  sprite_showdown: string | null;
};

type FormRow = {
  form_id: number;
  species_id: number;
  name: string;
  form_label: string | null;
  is_default: boolean;
  is_mega: boolean;
  types: string[] | null;
  sprite_home: string | null;
  sprite_front: string | null;
  sprite_showdown: string | null;
};

const PAGE = 1000; // Supabase caps a single response at 1000 rows.

const META_COLS =
  "species_id,name,is_mega_capable,types,sprite_home,sprite_front,sprite_showdown";
const FORM_COLS =
  "form_id,species_id,name,form_label,is_default,is_mega,types,sprite_home,sprite_front,sprite_showdown";

async function fetchMeta(): Promise<MetaRow[]> {
  const rows: MetaRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("pokemon_meta")
      .select(META_COLS)
      .range(from, from + PAGE - 1)
      .returns<MetaRow[]>();
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function fetchForms(): Promise<FormRow[]> {
  const rows: FormRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("pokemon_forms")
      .select(FORM_COLS)
      .range(from, from + PAGE - 1)
      .returns<FormRow[]>();
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function bestSprite(row: {
  sprite_home: string | null;
  sprite_front: string | null;
  sprite_showdown: string | null;
}): string | null {
  return row.sprite_home ?? row.sprite_front ?? row.sprite_showdown ?? null;
}

function toCardForm(row: FormRow): CardForm {
  return {
    formId: row.form_id,
    name: row.name,
    label: row.form_label,
    sprite: bestSprite(row),
    types: row.types ?? [],
    isMega: row.is_mega,
  };
}

// Fallback card form synthesised from pokemon_meta, for the rare species that
// has no row in pokemon_forms.
function metaAsForm(meta: MetaRow): CardForm {
  return {
    formId: meta.species_id,
    name: meta.name,
    label: null,
    sprite: bestSprite(meta),
    types: meta.types ?? [],
    isMega: false,
  };
}

/**
 * Loads the full deck for a mode, read-only from the shared reference tables.
 *
 * - normal: one card per species; forms = all non-mega forms (default first).
 * - mega:   one card per mega-capable species; forms = default + mega forms.
 */
export async function loadDeck(mode: Mode): Promise<Card[]> {
  const [meta, forms] = await Promise.all([fetchMeta(), fetchForms()]);

  const formsBySpecies = new Map<number, FormRow[]>();
  for (const f of forms) {
    const list = formsBySpecies.get(f.species_id) ?? [];
    list.push(f);
    formsBySpecies.set(f.species_id, list);
  }

  // Default form first, then ascending form_id for a stable switcher order.
  const order = (a: FormRow, b: FormRow) =>
    Number(b.is_default) - Number(a.is_default) || a.form_id - b.form_id;

  const cards: Card[] = [];
  for (const m of [...meta].sort((a, b) => a.species_id - b.species_id)) {
    if (mode === "mega" && !m.is_mega_capable) continue;

    const speciesForms = (formsBySpecies.get(m.species_id) ?? []).slice().sort(order);

    let cardForms: CardForm[];
    if (mode === "mega") {
      const base = speciesForms.find((f) => !f.is_mega);
      const megas = speciesForms.filter((f) => f.is_mega);
      // Mega first so she sees the Mega straight away; base form after.
      cardForms = [...megas, ...(base ? [base] : [])].map(toCardForm);
    } else {
      cardForms = speciesForms.filter((f) => !f.is_mega).map(toCardForm);
    }

    if (cardForms.length === 0) cardForms = [metaAsForm(m)];

    cards.push({ speciesId: m.species_id, name: m.name, forms: cardForms });
  }

  return cards;
}
