'use client'

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import { Kaushan_Script } from 'next/font/google'
import {
  getStreamDataAction,
  type StreamData,
  type StreamStat,
} from '@/features/auction/actions/streamData.action'
import { StreamTimer } from '@/features/auction/components/StreamTimer'
import { AUCTION_CONFIG } from '@/lib/config/auction.config'
import type { AuctionPhase } from '@/types/auction.types'

const kaushan = Kaushan_Script({ weight: '400', subsets: ['latin'] })

const DESIGN_WIDTH = 1920
const DESIGN_HEIGHT = 1080

const SLOTS = [0, 1, 2, 3, 4, 5]

const EMPTY_STATS: StreamStat[] = [
  { label: 'HP', value: 0 },
  { label: 'Ataque', value: 0 },
  { label: 'Defensa', value: 0 },
  { label: 'Ataque Especial', value: 0 },
  { label: 'Defensa Especial', value: 0 },
  { label: 'Velocidad', value: 0 },
]

const PHASE_UI: Partial<
  Record<AuctionPhase, { label: string; img: string; rainbow: boolean }>
> = {
  WAITING: { label: 'Waiting', img: '/Waiting.png', rainbow: false },
  MEGA: { label: 'Mega', img: '/mega.png', rainbow: true },
  MAIN: { label: 'Main', img: '/Pokeball.png', rainbow: false },
  SPECIAL: { label: 'Special', img: '/Wooper.png', rainbow: false },
}

const BALLS = ['/GoldBall.png', '/SilverBall.png', '/BronzeBallpng.png']

const GLOW = {
  textShadow: '0 0 12px rgba(255,255,255,1)',
}

const BIG_GLOW = {
  textShadow: '0 0 16px rgba(255,255,255,1)',
}

const TIMER_GLOW = {
  textShadow: '0 0 16px rgba(255,255,255,0.35)',
}

const TYPE_UI: Record<string, { label: string; bg: string; color: string; glow: string }> = {
  normal: { label: 'Normal', bg: '#a8a29e', color: '#ffffff', glow: 'rgba(168,162,158,0.25)' },
  fighting: { label: 'Lucha', bg: '#be123c', color: '#ffffff', glow: 'rgba(190,18,60,0.25)' },
  flying: { label: 'Volador', bg: '#a78bfa', color: '#ffffff', glow: 'rgba(167,139,250,0.25)' },
  ground: { label: 'Tierra', bg: '#fdba74', color: '#7c2d12', glow: 'rgba(253,186,116,0.25)' },
  poison: { label: 'Veneno', bg: '#a21caf', color: '#ffffff', glow: 'rgba(162,28,175,0.25)' },
  rock: { label: 'Roca', bg: '#ca8a04', color: '#ffffff', glow: 'rgba(202,138,4,0.25)' },
  bug: { label: 'Bicho', bg: '#84cc16', color: '#365314', glow: 'rgba(132,204,22,0.25)' },
  ghost: { label: 'Fantasma', bg: '#64748b', color: '#ffffff', glow: 'rgba(100,116,139,0.25)' },
  steel: { label: 'Acero', bg: '#cbd5e1', color: '#4b5563', glow: 'rgba(203,213,225,0.25)' },
  fire: { label: 'Fuego', bg: '#fb923c', color: '#7c2d12', glow: 'rgba(251,146,60,0.25)' },
  water: { label: 'Agua', bg: '#60a5fa', color: '#ffffff', glow: 'rgba(96,165,250,0.25)' },
  grass: { label: 'Planta', bg: '#84cc16', color: '#365314', glow: 'rgba(132,204,22,0.25)' },
  electric: { label: 'Eléctrico', bg: '#fbbf24', color: '#78350f', glow: 'rgba(251,191,36,0.25)' },
  psychic: { label: 'Psíquico', bg: '#fb7185', color: '#ffffff', glow: 'rgba(251,113,133,0.25)' },
  ice: { label: 'Hielo', bg: '#99f6e4', color: '#115e59', glow: 'rgba(153,246,228,0.25)' },
  dragon: { label: 'Dragón', bg: '#7c3aed', color: '#ffffff', glow: 'rgba(124,58,237,0.25)' },
  dark: { label: 'Siniestro', bg: '#57534e', color: '#ffffff', glow: 'rgba(87,83,78,0.25)' },
  fairy: { label: 'Hada', bg: '#fda4af', color: '#be185d', glow: 'rgba(253,164,175,0.25)' },
}

function useStageScale() {
  const [stage, setStage] = useState({ scale: 1, left: 0, top: 0 })

  useEffect(() => {
    const updateStage = () => {
      const scale = Math.min(
        window.innerWidth / DESIGN_WIDTH,
        window.innerHeight / DESIGN_HEIGHT,
      )

      setStage({
        scale,
        left: (window.innerWidth - DESIGN_WIDTH * scale) / 2,
        top: (window.innerHeight - DESIGN_HEIGHT * scale) / 2,
      })
    }

    updateStage()
    window.addEventListener('resize', updateStage)
    return () => window.removeEventListener('resize', updateStage)
  }, [])

  return stage
}

function PokeballSlot() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="h-[72px] w-[72px] text-[#1c1c24]">
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="5" />
      <line x1="12" y1="50" x2="88" y2="50" stroke="currentColor" strokeWidth="5" />
      <circle cx="50" cy="50" r="13" fill="#09090b" stroke="currentColor" strokeWidth="5" />
    </svg>
  )
}

function TeamSlots({ team }: { team: StreamData['participants'][number]['team'] }) {
  return (
    <div
      className="grid grid-cols-3"
      style={{ columnGap: 28, rowGap: 16 }}
    >
      {SLOTS.map((i) => {
        const mon = team[i]

        return (
          <div
            key={i}
            className="relative flex h-20 w-20 items-center justify-center rounded-lg bg-[#09090b] outline outline-2 -outline-offset-2 outline-[#374151]"
          >
            {mon?.sprite ? (
              <img src={mon.sprite} alt="" className="h-[100px] w-[100px] object-contain" />
            ) : (
              <PokeballSlot />
            )}

            {mon?.mega && (
              <img
                src="/mega.png"
                alt=""
                className="pointer-events-none absolute -left-3 -top-4 h-16 w-auto"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function TypePill({ type }: { type: string }) {
  const ui = TYPE_UI[type.toLowerCase()] ?? {
    label: type,
    bg: '#52525b',
    color: '#ffffff',
    glow: 'rgba(82,82,91,0.25)',
  }

  return (
    <span
      className="rounded-[19px] px-4 py-1 text-lg font-medium leading-8"
      style={{
        backgroundColor: ui.bg,
        color: ui.color,
        boxShadow: `0 0 11.9px 7px ${ui.glow}`,
      }}
    >
      {ui.label}
    </span>
  )
}

const STAT_SCALE: [number, string][] = [
  [150, '#00c2b8'],
  [120, '#23cd5e'],
  [90, '#a0e515'],
  [60, '#ffdd57'],
  [30, '#ff7f0f'],
  [0, '#f34444'],
]

function statColor(value: number) {
  for (const [threshold, color] of STAT_SCALE) {
    if (value >= threshold) return color
  }

  return '#f34444'
}

function StreamStatLine({ stat }: { stat: StreamStat }) {
  const pct = Math.max(0, Math.min(100, (stat.value / 200) * 100))
  const color = statColor(stat.value)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-2xl font-medium text-white" style={GLOW}>
        {stat.label}
      </span>

      <div className="flex items-center gap-8">
        <div className="h-5 flex-1 overflow-hidden rounded-md bg-[#1e2530]">
          <div
            className="h-full rounded-md"
            style={{
              width: `${pct}%`,
              background: color,
              boxShadow: `0 0 10px ${color}`,
            }}
          />
        </div>

        <span className="w-12 text-right text-xl font-medium text-white" style={GLOW}>
          {stat.value}
        </span>
      </div>
    </div>
  )
}

function BidCard({
  bid,
  rank,
}: {
  bid: StreamData['topBids'][number]
  rank: 0 | 1 | 2
}) {
  const featured = rank === 0

  const styles = [
    { border: '#eab308', shadow: 'rgba(214,168,5,0.25)' },
    { border: '#d6d3d1', shadow: 'rgba(195,195,195,0.25)' },
    { border: '#d97706', shadow: 'rgba(202,109,1,0.25)' },
  ][rank]

  return (
    <div
      className="flex shrink-0 items-center justify-between bg-[#09090b]"
      style={{
        width: featured ? 384 : 256,
        minHeight: featured ? 172 : 126,
        padding: featured ? 28 : 20,
        borderRadius: featured ? 16 : 10,
        border: `${featured ? 2.68 : 2}px solid ${styles.border}`,
        boxShadow: `4px 4px 20px 0 ${styles.shadow}`,
      }}
    >
      <div className="flex min-w-0 flex-col justify-center" style={{ gap: featured ? 16 : 12 }}>
        <span
          className="truncate font-medium text-white"
          style={{
            ...BIG_GLOW,
            fontSize: featured ? 36 : 30,
            lineHeight: featured ? '48px' : '36px',
            maxWidth: featured ? 165 : 115,
          }}
        >
          {bid?.name ?? 'Nadie'}
        </span>

        <span
          className="font-medium text-white"
          style={{
            ...BIG_GLOW,
            fontSize: featured ? 36 : 24,
            lineHeight: featured ? '40px' : '32px',
          }}
        >
          {bid?.amount ?? 0} $
        </span>
      </div>

      <img
        src={BALLS[rank]}
        alt=""
        className="object-contain"
        style={{ width: featured ? 106 : 79, height: featured ? 106 : 79 }}
      />
    </div>
  )
}

export default function StreamPage() {
  const [data, setData] = useState<StreamData | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const stage = useStageScale()

  useEffect(() => {
    let active = true

    const fetchData = () => {
      getStreamDataAction().then((nextData) => {
        if (active) setData(nextData)
      })
    }

    fetchData()
    const id = setInterval(fetchData, 1500)

    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [])

const timerMax =
  data?.status === 'BIDDING'
    ? AUCTION_CONFIG.TIMER_SECONDS
    : AUCTION_CONFIG.NOMINATION_SECONDS

// When no timer is running (waiting / idle) show the full bar at its max.
const remaining = data?.timerEndsAt
  ? Math.max(0, (new Date(data.timerEndsAt).getTime() - now) / 1000)
  : timerMax

  const participants = (data?.participants ?? []).slice(0, 8)
  const pokemon = data?.pokemon ?? null
  const stats = pokemon?.stats ?? EMPTY_STATS

  const topBids = data?.topBids ?? [null, null, null]
  const bidSlots = [topBids[0] ?? null, topBids[1] ?? null, topBids[2] ?? null] as const

  const phaseUi = data?.phase ? PHASE_UI[data.phase] : undefined
  const phaseLabel = phaseUi?.label ?? (data?.phase && data.phase !== 'WAITING' ? data.phase : '')

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#09090b]">
      <div
        className="absolute overflow-hidden bg-[#09090b] text-white"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          left: stage.left,
          top: stage.top,
          transform: `scale(${stage.scale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* LEFT */}
        <section
          className="absolute grid grid-cols-2 content-start"
          style={{
            left: 80,
            top: 42,
            width: 599,
            columnGap: 20,
            rowGap: 34,
          }}
        >
          {participants.map((participant) => (
            <div key={participant.id} className="flex w-72 flex-col gap-3.5">
              <span
                className="h-10 truncate text-[36px] font-medium leading-10 text-white"
                style={GLOW}
              >
                {participant.name}
              </span>

              <TeamSlots team={participant.team} />
            </div>
          ))}
        </section>

        {/* CURRENT POKEMON CARD */}
        <section
          className="absolute flex items-start gap-5 rounded-2xl bg-[#18181b] px-7 py-6"
          style={{
            left: 800,
            top: 42,
            width: 984,
            height: 550,
          }}
        >
          <div className="flex h-full flex-1 flex-col items-center justify-between">
            <div className="flex w-full flex-col items-center gap-2">
              {pokemon?.spriteHome ? (
                <img
                  src={pokemon.spriteHome}
                  alt={pokemon.name}
                  className="h-96 w-[416px] object-contain"
                />
              ) : (
                <div className="flex h-96 w-[416px] items-center justify-center text-2xl text-[#475569]">
                  Sin subasta
                </div>
              )}

              <span
                className="w-full truncate text-center text-5xl font-bold text-white"
                style={GLOW}
              >
                {pokemon?.name ?? '—'}
              </span>
            </div>

            <div className="flex items-center justify-center gap-4">
              {(pokemon?.types ?? []).map((type) => (
                <TypePill key={type} type={type} />
              ))}
            </div>
          </div>

          <div className="flex h-full flex-1 flex-col items-start justify-between">
            <div className="flex h-96 w-full flex-col justify-between">
              {stats.map((stat) => (
                <StreamStatLine key={stat.label} stat={stat} />
              ))}
            </div>

            <div className="rounded-lg bg-[#475569] p-2.5">
              <span className="text-3xl font-medium text-white" style={GLOW}>
                Total: {pokemon?.total ?? 0}
              </span>
            </div>
          </div>
        </section>

        {/* TOP BIDS */}
        <section
          className="absolute flex flex-col gap-4"
          style={{
            left: 800,
            top: 603,
            width: 984,
          }}
        >
          <span className="text-5xl font-medium text-white" style={GLOW}>
            Mayores Pujas
          </span>

          <div className="flex w-full items-end justify-between">
            <BidCard bid={bidSlots[0]} rank={0} />
            <BidCard bid={bidSlots[1]} rank={1} />
            <BidCard bid={bidSlots[2]} rank={2} />
          </div>
        </section>

        {/* PHASE */}
        <section
          className="absolute flex flex-col gap-5 py-2"
          style={{
            left: 800,
            top: 858,
            width: 360,
          }}
        >
          <span className="text-4xl font-medium text-white" style={GLOW}>
            Fase:
          </span>

          <div className="flex items-start gap-3">
            <span
              className={`${kaushan.className} text-8xl leading-none`}
              style={
                phaseUi?.rainbow
                  ? {
                      ...GLOW,
                      background:
                        'linear-gradient(90deg,#ff8ad8,#fff7a8,#a8ffce,#9fd4ff,#d6b4ff)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                      height: '119px',
                    }
                  : {
                      ...GLOW,
                      color: 'white',
                    }
              }
            >
              {phaseLabel}
            </span>

            {phaseUi && (
              <img
                src={phaseUi.img}
                alt=""
                className="mt-[-8px] h-[78px] w-auto object-contain"
              />
            )}
          </div>
        </section>

        {/* TIMER */}
        <section
          className="absolute"
          style={{
            left: 1215,
            top: 900,
            width: 510,
          }}
        >
          <StreamTimer
            remaining={remaining}
            max={timerMax}
            textStyle={TIMER_GLOW}
          />
        </section>
      </div>
    </main>
  )
}