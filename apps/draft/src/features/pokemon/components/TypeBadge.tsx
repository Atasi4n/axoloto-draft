// Type → badge colour, exact hex from the Figma "types" component export.
const TYPE_COLORS: Record<string, string> = {
  normal:   '#a8a29e', // stone-400
  fighting: '#be123c', // rose-700
  flying:   '#a78bfa', // violet-400
  ground:   '#fdba74', // orange-300
  poison:   '#a21caf', // fuchsia-700
  rock:     '#ca8a04', // yellow-600
  bug:      '#84cc16', // lime-500
  ghost:    '#64748b', // slate-500
  steel:    '#cbd5e1', // slate-300
  fire:     '#fb923c', // orange-400
  water:    '#60a5fa', // blue-400
  grass:    '#84cc16', // lime-500
  electric: '#fbbf24', // amber-400
  psychic:  '#fb7185', // rose-400
  ice:      '#99f6e4', // teal-200
  dragon:   '#7c3aed', // violet-600
  dark:     '#57534e', // stone-600
  fairy:    '#fda4af', // rose-300
}

export function TypeBadge({ type }: { type: string }) {
  const bg = TYPE_COLORS[type.toLowerCase()] ?? '#52525b'
  return (
    <span
      style={{ backgroundColor: bg }}
      className="rounded-[10px] px-2 py-0.5 text-[10px] font-semibold text-white"
    >
      {type}
    </span>
  )
}
