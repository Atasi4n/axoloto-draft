'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { AUCTION_CONFIG } from '@/lib/config/auction.config'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { TypeBadge } from '@/features/pokemon/components/TypeBadge'
import type { PokemonMetaRow } from '@/types/auction.types'

const BANNED = new Set<number>(AUCTION_CONFIG.BANNED_SPECIES_IDS)

type Props = {
  open: boolean
  onClose: () => void
  onSelect?: (speciesId: number) => void
}

export function SearchModal({ open, onClose, onSelect }: Props) {
  const [all, setAll] = useState<PokemonMetaRow[]>([])
  const [query, setQuery] = useState('')
  const phase = useAuctionStore((s) => s.state?.phase)
  const participants = useAuctionStore((s) => s.participants)

  // Species already on someone's team are not nominable.
  const taken = useMemo(() => {
    const s = new Set<number>()
    participants.forEach((p) => p.team.forEach((t) => s.add(t.species_id)))
    return s
  }, [participants])

  // Fetch the catalog once, lazily, from the global pokemon_meta table.
  useEffect(() => {
    if (!open || all.length) return
    supabase
      .from('pokemon_meta')
      .select('*')
      .order('species_id')
      .then(({ data }) => {
        if (data) setAll(data as PokemonMetaRow[])
      })
  }, [open, all.length])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((p) => {
      if (BANNED.has(p.species_id)) return false
      if (taken.has(p.species_id)) return false
      if (phase === 'MEGA' && !p.is_mega_capable) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [all, query, taken, phase])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-6 pt-16"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-80 flex-col gap-2.5 rounded-xl bg-[#111827] p-7 shadow-[0px_0px_46px_0px_rgba(38,76,144,0.25)] outline outline-2 -outline-offset-2 outline-[#1e3a8a]"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar"
          className="h-11 rounded-xl bg-[#09090b] px-3.5 text-base text-white outline outline-2 -outline-offset-2 outline-[#374151] placeholder:text-slate-100/60"
        />

        <div className="flex flex-col gap-2.5 overflow-y-auto">
          {list.map((p) => (
            <button
              key={p.species_id}
              type="button"
              onClick={() => onSelect?.(p.species_id)}
              className="flex items-center justify-between gap-2 text-left"
            >
              <span className="flex items-center gap-3">
                {p.sprite_front && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.sprite_front}
                    alt={p.name}
                    className="h-16 w-16 rounded-[10px] shadow-[0px_0px_7px_0px_rgba(38,76,144,1)]"
                  />
                )}
                <span className="text-sm font-medium text-white [text-shadow:0px_0px_11px_rgba(255,255,255,0.25)]">
                  {p.name}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                {(p.types ?? []).map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </span>
            </button>
          ))}
          {list.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-500">Sin resultados</p>
          )}
        </div>
      </div>
    </div>
  )
}
