'use client'

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Kaushan_Script } from 'next/font/google'
import {
  getStreamDataAction,
  type StreamData,
  type StreamStat,
} from '@/features/auction/actions/streamData.action'
import { useOnlineUserIds } from '@/features/auction/realtime/useOnlineUserIds'
import { StreamTimer } from '@/features/auction/components/StreamTimer'
import { AUCTION_CONFIG } from '@/lib/config/auction.config'
import type { AuctionPhase } from '@/types/auction.types'

const kaushan = Kaushan_Script({ weight: '400', subsets: ['latin'] })

const DESIGN_WIDTH = 1920
const DESIGN_HEIGHT = 1080

const SLOTS = [0, 1, 2, 3, 4, 5]

// How long each form (mega / regional / alternate) is shown before cycling.
const FORM_INTERVAL_MS = 7000

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
  textShadow: '0 0 12px rgba(255,255,255,0.5)',
}

const BIG_GLOW = {
  textShadow: '0 0 16px rgba(255,255,255,0.5)',
}

const TIMER_GLOW = {
  textShadow: '0 0 16px rgba(255,255,255,0.2)',
}

// The phase display keeps its full-strength glow (everything else is dialled down).
const PHASE_GLOW = {
  textShadow: '0 0 12px rgba(255,255,255,1)',
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

const CONFETTI: { x: number; y: number; w: number; h: number; color: string; round?: boolean; rotate?: number }[] = [
  { x: 381, y: 89, w: 12, h: 14, color: '#facc15', rotate: 24 },
  { x: 1614, y: 42, w: 12, h: 14, color: '#facc15', rotate: -116 },
  { x: 503, y: 89, w: 14, h: 14, color: '#facc15', round: true },
  { x: 1522, y: -38, w: 14, h: 14, color: '#facc15', round: true, rotate: -139 },
  { x: 170, y: 119, w: 14, h: 14, color: '#60a5fa', rotate: -24 },
  { x: 1791, y: 157, w: 14, h: 14, color: '#60a5fa', rotate: -139 },
  { x: 1283, y: 89, w: 12, h: 14, color: '#f472b6' },
  { x: 625, y: 45, w: 12, h: 14, color: '#f472b6', rotate: 28 },
  { x: 28, y: 65, w: 12, h: 14, color: '#f87171', rotate: -28 },
  { x: 1862, y: 290, w: 12, h: 14, color: '#f87171', rotate: -139 },
  { x: 1180, y: 116, w: 14, h: 14, color: '#a3e635', round: true },
  { x: 1865, y: 116, w: 14, h: 14, color: '#a3e635', round: true },
  { x: 112, y: 164, w: 12, h: 14, color: '#c084fc', rotate: 39 },
  { x: 865, y: 89, w: 12, h: 14, color: '#c084fc', rotate: -139 },
]

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
              transition: 'width 0.5s ease, background 0.5s ease, box-shadow 0.5s ease',
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
  const [formIndex, setFormIndex] = useState(0)   // cycling target
  const [shownIndex, setShownIndex] = useState(0) // form currently rendered
  const [flipping, setFlipping] = useState(false) // mid-flip (sprite edge-on)
  const stage = useStageScale()

  // Who is connected right now (realtime presence) — drives the red "offline"
  // name colour. Gated by presenceSeen so a brief empty state on load (before
  // the first sync) doesn't flash every participant red.
  const onlineIds = useOnlineUserIds(data?.eventId ?? null)
  const presenceSeen = useRef(false)
  if (onlineIds.size > 0) presenceSeen.current = true

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

  // Reset to the base form whenever a new pokemon comes up for auction.
  const pokemonName = data?.pokemon?.name ?? null
  useEffect(() => {
    setFormIndex(0)
    setShownIndex(0)
    setFlipping(false)
  }, [pokemonName])

  // Cycle mega / regional / alternate forms while there is more than one.
  const formCount = data?.pokemon?.forms?.length ?? 0
  useEffect(() => {
    if (formCount <= 1) return
    const id = setInterval(
      () => setFormIndex((i) => (i + 1) % formCount),
      FORM_INTERVAL_MS,
    )
    return () => clearInterval(id)
  }, [formCount, pokemonName])

  // Form-change flip: close (scaleX→0), swap the sprite at the edge, then open.
  useEffect(() => {
    if (formIndex === shownIndex) return
    setFlipping(true)
    const t = setTimeout(() => {
      setShownIndex(formIndex)
      setFlipping(false)
    }, 300)
    return () => clearTimeout(t)
  }, [formIndex, shownIndex])

const timerMax =
  data?.status === 'BIDDING'
    ? AUCTION_CONFIG.TIMER_SECONDS
    : AUCTION_CONFIG.NOMINATION_SECONDS

// When no timer is running (waiting / idle) show the full bar at its max.
// While paused the countdown freezes: measure against pausedAt, not the live clock.
const remaining = data?.timerEndsAt
  ? Math.max(
      0,
      (new Date(data.timerEndsAt).getTime() -
        (data.pausedAt ? new Date(data.pausedAt).getTime() : now)) /
        1000,
    )
  : timerMax

  const participants = (data?.participants ?? []).slice(0, 8)
  const pokemon = data?.pokemon ?? null

  // Currently-shown form (base / mega / regional / alt) drives image, types, stats.
  const forms = pokemon?.forms ?? []
  const cycling = forms.length > 1
  const form = forms[shownIndex] ?? forms[0] ?? null
  const displaySprite = form?.spriteHome ?? pokemon?.spriteHome ?? null
  const displayTypes = form?.types ?? pokemon?.types ?? []
  const stats = form?.stats ?? pokemon?.stats ?? EMPTY_STATS
  const displayTotal = form?.total ?? pokemon?.total ?? 0

  const topBids = data?.topBids ?? [null, null, null]
  const bidSlots = [topBids[0] ?? null, topBids[1] ?? null, topBids[2] ?? null] as const

  const phaseUi = data?.phase ? PHASE_UI[data.phase] : undefined
  const phaseLabel = phaseUi?.label ?? (data?.phase && data.phase !== 'WAITING' ? data.phase : '')

  if (data?.phase === 'ENDED') {
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
          {/* Confetti */}
          {CONFETTI.map((c, i) => (
            <div
              key={i}
              className={c.round ? 'rounded-full' : 'rounded-sm'}
              style={{
                position: 'absolute',
                left: c.x,
                top: c.y,
                width: c.w,
                height: c.h,
                backgroundColor: c.color,
                transform: c.rotate ? `rotate(${c.rotate}deg)` : undefined,
              }}
            />
          ))}

          {/* Text block — left side */}
          <div
            className="absolute flex flex-col items-center gap-1.5"
            style={{ left: 251, top: 394, width: 636 }}
          >
            <span
              className={`${kaushan.className} text-center text-white`}
              style={{
                fontSize: 156,
                lineHeight: '1',
                textShadow: '0 0 15px rgba(255,255,255,1)',
              }}
            >
              Fin
            </span>
            <span
              className="w-full text-center text-5xl font-medium text-white"
              style={{ textShadow: '0 0 6px rgba(255,255,255,1)' }}
            >
              ¡Gracias por participar!
            </span>
          </div>

          {/* Floor shadow */}
          <div
            className="rounded-full bg-[#1f2937]"
            style={{
              position: 'absolute',
              left: 1000,
              top: 809,
              width: 566,
              height: 112,
            }}
          />
          {/* Furret sleeping — sat lower than the Figma so the large gif reads
              as grounded rather than floating mid-screen. */}
          <img
            src="/furret-sleep.gif"
            alt="Furret durmiendo"
            style={{
              position: 'absolute',
              left: 1073,
              top: 453,
              width: 421,
              height: 411,
              objectFit: 'contain',
            }}
          />
        </div>
      </main>
    )
  }

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
          {participants.map((participant) => {
            const isTurn = participant.id === data?.currentTurnParticipantId
            // Offline (not connected) takes priority over the green turn colour.
            const isOffline =
              presenceSeen.current && !onlineIds.has(participant.userId)

            let nameStyle: CSSProperties
            if (isOffline) {
              nameStyle = { color: '#f87171', textShadow: '0 0 12px rgba(248,113,113,0.6)' }
            } else if (isTurn) {
              nameStyle = { color: 'hsl(120 85% 55%)', textShadow: '0 0 12px hsl(120 85% 55%)' }
            } else {
              nameStyle = { ...GLOW, color: '#ffffff' }
            }

            return (
              <div key={participant.id} className="flex w-72 flex-col gap-3.5">
                <span
                  className="h-10 truncate text-[36px] font-medium leading-10"
                  style={nameStyle}
                >
                  {participant.name}
                </span>

                <TeamSlots team={participant.team} />
              </div>
            )
          })}
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
              {displaySprite ? (
                <img
                  src={displaySprite}
                  alt={pokemon?.name ?? ''}
                  className="h-96 w-[416px] object-contain"
                  style={{
                    transform: flipping ? 'scaleX(0)' : 'scaleX(1)',
                    transition: 'transform 0.3s ease',
                  }}
                />
              ) : (
                <div className="flex h-96 w-[416px] items-center justify-center text-2xl text-[#475569]">
                  Sin subasta
                </div>
              )}

              {/* Depleting countdown bar (above the name) — seconds until the next form. */}
              <div className="h-2 w-[416px]">
                {cycling && (
                  <div
                    key={`bar-${pokemon?.name}-${formIndex}`}
                    className="h-full rounded-full"
                    style={{
                      background: '#484268',
                      animation: `formCountdown ${FORM_INTERVAL_MS}ms linear forwards`,
                    }}
                  />
                )}
              </div>

              <span
                className="w-full truncate text-center text-5xl font-bold text-white"
                style={GLOW}
              >
                {pokemon?.name ?? '—'}
              </span>
            </div>

            <div className="flex items-center justify-center gap-4">
              {displayTypes.map((type) => (
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
                Total: {displayTotal}
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
          <span className="text-4xl font-medium text-white" style={PHASE_GLOW}>
            Fase:
          </span>

          <div className="flex items-start gap-3">
            <span
              className={`${kaushan.className} text-8xl leading-none`}
              style={
                phaseUi?.rainbow
                  ? {
                      ...PHASE_GLOW,
                      background:
                        'linear-gradient(90deg,#ff8ad8,#fff7a8,#a8ffce,#9fd4ff,#d6b4ff)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                      height: '119px',
                    }
                  : {
                      ...PHASE_GLOW,
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
            waiting={data?.phase === 'WAITING'}
            nomination={data?.status !== 'BIDDING'}
          />
        </section>
      </div>
    </main>
  )
}