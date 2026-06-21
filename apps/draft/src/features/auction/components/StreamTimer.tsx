'use client'

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { formatMMSS } from '@/lib/utils'

// Verde cuando está lleno → rojo cuando está vacío.
function barColor(frac: number) {
  const hue = Math.max(0, Math.min(120, frac * 120))
  return `hsl(${hue} 85% 55%)`
}

function timerNumberColor(seconds: number) {
  if (seconds <= 5) return '#f34444'
  if (seconds <= 15) return '#ffdd57'
  // Green at full so the number matches the bar's green zone.
  return 'hsl(120 85% 55%)'
}

// Nominación (timer largo de 2 min): umbrales por segundos absolutos —
// verde, amarillo al quedar 1 min, rojo al quedar 15s. Tiñe número y barra.
function nominationColor(seconds: number) {
  if (seconds <= 15) return '#f34444'
  if (seconds <= 60) return '#ffdd57'
  return 'hsl(120 85% 55%)'
}

export function StreamTimer({
  remaining,
  max = 30,
  textStyle,
  waiting = false,
  nomination = false,
}: {
  remaining: number
  max?: number
  textStyle?: CSSProperties
  // In the WAITING phase Furret stands still (static photo) instead of walking.
  waiting?: boolean
  // Nomination timer (2 min): step colours by absolute seconds instead of the
  // smooth gradient used by the 30s bidding timer.
  nomination?: boolean
}) {
  // Furret SIEMPRE mira a la izquierda; solo se voltea 0.5s al hacerse una puja.
  const [facingRight, setFacingRight] = useState(false)
  const prevRemaining = useRef(remaining)
  const flipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const previous = prevRemaining.current
    const diff = remaining - previous
    prevRemaining.current = remaining

    // Una puja extiende el timer unos pocos segundos (BID_EXTENSION_SECS = 5).
    // Un reset/cambio de turno lo sube mucho más (30s/120s): ese NO cuenta.
    if (diff > 0.08 && diff <= 10) {
      setFacingRight(true)
      if (flipTimeout.current) clearTimeout(flipTimeout.current)
      flipTimeout.current = setTimeout(() => setFacingRight(false), 500)
    }
  }, [remaining])

  useEffect(() => {
    return () => {
      if (flipTimeout.current) clearTimeout(flipTimeout.current)
    }
  }, [])

  const sec = Math.max(0, Math.ceil(remaining))
  const frac = Math.max(0, Math.min(1, remaining / max))

  const color = nomination ? nominationColor(sec) : barColor(frac)
  const numberColor = nomination ? nominationColor(sec) : timerNumberColor(sec)

  return (
    <div className="relative h-[132px] w-full">
      <span
        className="absolute left-0 right-0 top-0 text-center text-7xl font-bold leading-none"
        style={{
          ...textStyle,
          color: numberColor,
          textShadow: `0 0 10px ${numberColor}`,
          transition: 'color 0.25s, text-shadow 0.25s',
        }}
      >
        {formatMMSS(sec)}
      </span>

      <div className="absolute left-0 right-0 top-[88px] h-5 overflow-hidden rounded-md bg-[#1e2530]">
        <div
          className="h-full rounded-md"
          style={{
            width: `${frac * 100}%`,
            background: color,
            boxShadow: `0 0 12px ${color}`,
            transition: 'width 0.25s linear, background 0.25s, box-shadow 0.25s',
          }}
        />
      </div>

      <img
        src={waiting ? '/furret-stop.png' : '/furret-walk.gif'}
        alt=""
        className="absolute top-[57px] h-[58px] w-auto object-contain"
        style={{
          left: `calc(${frac * 100}% - ${frac * 72}px)`,

          // Normalmente mira hacia la izquierda (igual que la foto en pausa/espera).
          // Cuando una puja sube el timer, mira hacia la derecha por 0.5s.
          transform: !waiting && facingRight ? 'scaleX(-1)' : 'none',

          transition: 'left 0.25s linear, transform 0.15s',
        }}
      />
    </div>
  )
}