'use client'

import { Trophy } from 'lucide-react'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'

const SLOTS = [0, 1, 2, 3, 4, 5]

export function EndedScreen({ userId }: { userId: string }) {
  const participants = useAuctionStore((s) => s.participants)
  const me = participants.find((p) => p.user_id === userId)
  const team = me?.team ?? []
  const budget = me?.budget ?? 0

  return (
    <main className="flex flex-1 flex-col items-center gap-8 overflow-y-auto bg-[#09090b] px-4 pb-5 pt-16">
      <div className="flex flex-col items-center gap-8">
        <Trophy
          className="h-12 w-12 text-[#facc15]"
          style={{ filter: 'drop-shadow(0px 0px 10px rgba(255,199,0,0.25))' }}
        />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-center text-3xl font-bold text-white [text-shadow:0px_0px_10px_rgba(255,255,255,1)]">
            ¡Subasta finalizada!
          </h1>
          <p className="text-center text-base font-bold text-gray-400">
            Este es tu equipo final
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-[20rem] grid-cols-3 gap-5">
        {SLOTS.map((i) => {
          const mon = team[i]
          return (
            <div
              key={i}
              className="relative flex aspect-square items-center justify-center rounded-lg bg-[#09090b] outline outline-2 -outline-offset-2 outline-[#374151]"
            >
              {mon?.sprite_snapshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mon.sprite_snapshot} alt={mon.name_snapshot} className="h-full w-full scale-110 object-contain" />
              ) : (
                <svg viewBox="0 0 100 100" aria-hidden className="h-3/4 w-3/4 text-[#101116]">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="5" />
                  <line x1="12" y1="50" x2="88" y2="50" stroke="currentColor" strokeWidth="5" />
                  <circle cx="50" cy="50" r="13" fill="#09090b" stroke="currentColor" strokeWidth="5" />
                </svg>
              )}
              {mon?.is_mega_capable && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/mega.png" alt="Mega" className="pointer-events-none absolute -left-1 -top-2 h-[55%] w-auto" />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex h-11 items-center gap-1.5 rounded-[10px] bg-[#09090b] px-3 outline outline-2 -outline-offset-2 outline-[#374151]">
        <span className="text-xl font-medium text-white [text-shadow:0px_0px_5px_rgba(255,255,255,0.25)]">
          Te sobraron
        </span>
        <span className="text-xl font-medium text-[#15803d] [text-shadow:0px_0px_5px_rgba(255,255,255,0.25)]">
          {' '}{budget}
        </span>
        <span className="text-xl font-medium text-[#15803d] [text-shadow:0px_0px_5px_rgba(45,134,61,0.25)]">
          ₽
        </span>
      </div>

      <div className="flex-1" />

      <p className="pb-4 text-center text-xl font-medium text-[#facc15] [text-shadow:0px_0px_10px_rgba(255,199,0,0.25)]">
        ¡Gracias por jugar!
      </p>
    </main>
  )
}
