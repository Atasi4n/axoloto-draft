// Small presentation helpers shared across the card + results screens.

// Tidy a PokéAPI slug-ish name ("charizard-mega-x") into a label-friendly title.
export function titleCase(raw: string): string {
  return raw
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Hex per Pokémon type, used for the type badges.
const TYPE_COLORS: Record<string, string> = {
  normal: "#9099a1",
  fire: "#ff9d55",
  water: "#4d90d5",
  electric: "#f4d23c",
  grass: "#63bb5b",
  ice: "#73cec0",
  fighting: "#ce4069",
  poison: "#ab6ac8",
  ground: "#d97746",
  flying: "#8fa8dd",
  psychic: "#fa7179",
  bug: "#90c12c",
  rock: "#c7b78b",
  ghost: "#5269ac",
  dragon: "#0b6dc3",
  dark: "#5a5366",
  steel: "#5a8ea1",
  fairy: "#ec8fe6",
};

export function typeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? "#6b7280";
}
