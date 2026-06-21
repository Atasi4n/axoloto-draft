// The two independent swipers. Each has its own deck and its own saved verdicts.
export type Mode = "normal" | "mega";

export function isMode(value: string | undefined): value is Mode {
  return value === "normal" || value === "mega";
}

// One selectable form shown inside a card (base, regional, mega, etc.).
export type CardForm = {
  formId: number;
  name: string;
  label: string | null;
  sprite: string | null;
  types: string[];
  isMega: boolean;
};

// One swipeable card. The verdict applies to the species; `forms` are just the
// views the user can flip between.
export type Card = {
  speciesId: number;
  name: string;
  forms: CardForm[];
};
