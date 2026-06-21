// PokémonDB-style stat bar: fill width + colour scale by the base-stat value.
const SCALE: [number, string][] = [
  [150, '#00c2b8'], // teal
  [120, '#23cd5e'], // green
  [90, '#a0e515'], // lime
  [60, '#ffdd57'], // yellow
  [30, '#ff7f0f'], // orange
  [0, '#f34444'], // red
]

function statColor(value: number) {
  for (const [threshold, color] of SCALE) if (value >= threshold) return color
  return '#f34444'
}

export function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / 200) * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-2xl font-medium text-white [text-shadow:0px_0px_12px_rgba(255,255,255,1)]">
        {label}
      </span>
      <div className="flex items-center gap-6">
        <div className="h-5 flex-1 overflow-hidden rounded-md bg-[#1e2530]">
          <div
            className="h-full rounded-md"
            style={{ width: `${pct}%`, background: statColor(value) }}
          />
        </div>
        <span className="w-10 text-right text-xl font-medium text-white [text-shadow:0px_0px_12px_rgba(255,255,255,1)]">
          {value}
        </span>
      </div>
    </div>
  )
}
