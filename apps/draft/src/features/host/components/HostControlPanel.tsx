'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Undo2,
  RotateCcw,
  SkipForward,
  Gavel,
  Ban,
  ArrowRight,
  Play,
  Pause,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { getSnapshotAction } from '@/features/auction/actions/snapshot.action'
import { TypeBadge } from '@/features/pokemon/components/TypeBadge'
import { SearchModal } from '@/features/auction/components/SearchModal'
import { HostTopBar } from './HostTopBar'
import {
  skipTurnAction,
  advancePhaseAction,
  resetToWaitingAction,
  resolveAuctionAction,
  startNominationTimerAction,
  nominateHostAction,
  undoLastBidAction,
  undoLastRoundAction,
  pauseAuctionAction,
  resumeAuctionAction,
} from '@/features/auction/actions/host.actions'
import { formatMMSS } from '@/lib/utils'
import { ConfirmModal } from './ConfirmModal'
import { EditTeamModal } from './EditTeamModal'

type ActionResult = { success: true } | { success: false; error: string }

const CARD = 'rounded-xl border border-white/10 bg-[#0d0d12]'
const SECTION = 'text-sm text-gray-400'

// Medal styling for the top-3 bid rows.
const MEDAL = [
  { dot: '#f5d56b', ring: 'rgba(245,213,107,0.45)', bg: '#1b1710', text: '#f5d56b' },
  { dot: '#c7ccd4', ring: 'rgba(199,204,212,0.35)', bg: '#16161c', text: '#e6e6ea' },
  { dot: '#d98b4a', ring: 'rgba(217,139,74,0.45)', bg: '#1a130c', text: '#e0a96a' },
]

export function HostControlPanel({ eventId }: { eventId: string }) {
  const participants = useAuctionStore((s) => s.participants)
  const state = useAuctionStore((s) => s.state)
  const turns = useAuctionStore((s) => s.turns)
  const currentPokemon = useAuctionStore((s) => s.currentPokemon)
  const currentBids = useAuctionStore((s) => s.currentBids)
  const setSnapshot = useAuctionStore((s) => s.setSnapshot)

  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [types, setTypes] = useState<string[]>([])
  const [homeSprite, setHomeSprite] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [nominateOpen, setNominateOpen] = useState(false)
  const [editParticipantId, setEditParticipantId] = useState<string | null>(null)
  // Auto Skip is host-local (front-only): participants whose turn is auto-skipped.
  const [autoSkipIds, setAutoSkipIds] = useState<Set<string>>(new Set())
  const resolvingRef = useRef(false)
  const settingTimerRef = useRef(false)
  const skippingRef = useRef(false)
  const autoSkippingRef = useRef(false)

  const toggleAutoSkip = (pid: string) =>
    setAutoSkipIds((prev) => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // The auction snapshot only carries name + pixel sprite; the host shows the
  // higher-res `sprite_home`, so fetch it (and types) from pokemon_meta.
  useEffect(() => {
    if (!currentPokemon) {
      setTypes([])
      setHomeSprite(null)
      return
    }
    supabase
      .from('pokemon_meta')
      .select('types, sprite_home')
      .eq('species_id', currentPokemon.species_id)
      .single()
      .then(({ data }) => {
        setTypes((data?.types as string[] | null) ?? [])
        setHomeSprite((data?.sprite_home as string | null) ?? null)
      })
  }, [currentPokemon])

  async function run(fn: () => Promise<ActionResult>) {
    setBusy(true)
    const r = await fn()
    if (!r.success) {
      alert(r.error)
    } else {
      // Don't rely solely on realtime — refetch so the panel updates immediately.
      const snap = await getSnapshotAction(eventId)
      if (snap.success) setSnapshot(snap.data)
    }
    setBusy(false)
  }

  const nameOf = (pid: string | undefined) =>
    participants.find((p) => p.id === pid)?.display_name ?? '—'

  const isBidding = state?.status === 'BIDDING'
  const isPaused = !!state?.paused_at
  const currentTurn = turns.find((t) => t.id === state?.current_turn_id)
  const dynamicText = isPaused
    ? 'En pausa'
    : isBidding
      ? 'Pujando'
      : currentTurn
        ? `Turno de ${nameOf(currentTurn.participant_id)}`
        : 'Esperando'

  // While paused the countdown freezes: measure against paused_at, not the live clock.
  const remaining = state?.timer_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(state.timer_ends_at).getTime() -
            (state.paused_at ? new Date(state.paused_at).getTime() : now)) /
            1000,
        ),
      )
    : null

  const isNominationPhase = state?.phase === 'MEGA' || state?.phase === 'MAIN'

  // Start the 2-min nomination timer for a fresh turn (IDLE + no timer set).
  // Skip starting it for Auto Skip participants — they're skipped immediately.
  useEffect(() => {
    if (
      isNominationPhase &&
      state?.status === 'IDLE' &&
      state?.current_turn_id &&
      !state?.timer_ends_at &&
      !(currentTurn && autoSkipIds.has(currentTurn.participant_id)) &&
      !settingTimerRef.current
    ) {
      settingTimerRef.current = true
      startNominationTimerAction(eventId).then(async (r) => {
        if (r.success) {
          const snap = await getSnapshotAction(eventId)
          if (snap.success) setSnapshot(snap.data)
        }
        settingTimerRef.current = false
      })
    }
  }, [isNominationPhase, state?.status, state?.current_turn_id, state?.timer_ends_at, currentTurn, autoSkipIds, eventId, setSnapshot])

  // Auto Skip: as soon as it's a flagged participant's nomination turn, skip it
  // immediately (no waiting for their timer). Cascades through consecutive ones.
  useEffect(() => {
    if (
      isNominationPhase &&
      !isPaused &&
      state?.status === 'IDLE' &&
      currentTurn &&
      autoSkipIds.has(currentTurn.participant_id) &&
      !autoSkippingRef.current
    ) {
      autoSkippingRef.current = true
      skipTurnAction(eventId).then(async (r) => {
        if (r.success) {
          const snap = await getSnapshotAction(eventId)
          if (snap.success) setSnapshot(snap.data)
        }
        autoSkippingRef.current = false
      })
    }
  }, [isNominationPhase, isPaused, state?.status, currentTurn, autoSkipIds, eventId, setSnapshot])

  // Timer hit 0: during BIDDING → resolve (assign to highest bidder); during
  // a nomination turn → skip to the next turn. resolve/skip are idempotent-ish
  // and clear the timer, so a stray re-call is safe.
  useEffect(() => {
    if (remaining !== 0) return

    if (isBidding && !isPaused && !resolvingRef.current) {
      resolvingRef.current = true
      resolveAuctionAction(eventId).then(async (r) => {
        if (r.success) {
          const snap = await getSnapshotAction(eventId)
          if (snap.success) setSnapshot(snap.data)
        }
        resolvingRef.current = false
      })
    } else if (isNominationPhase && !isPaused && state?.status === 'IDLE' && state?.timer_ends_at && !skippingRef.current) {
      skippingRef.current = true
      skipTurnAction(eventId).then(async (r) => {
        if (r.success) {
          const snap = await getSnapshotAction(eventId)
          if (snap.success) setSnapshot(snap.data)
        }
        skippingRef.current = false
      })
    }
  }, [remaining, isBidding, isPaused, isNominationPhase, state?.status, state?.timer_ends_at, eventId, setSnapshot])

  // Pujas: the 5 highest bids (best bid per participant), amount desc,
  // alphabetical tiebreak. Top-3 get gold/silver/bronze.
  const pujaRows = useMemo(() => {
    const best = new Map<string, number>()
    currentBids.forEach((b) =>
      best.set(b.participant_id, Math.max(best.get(b.participant_id) ?? 0, b.amount)),
    )
    return participants
      .map((p) => ({ id: p.id, name: p.display_name, amount: best.get(p.id) ?? 0 }))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
      .slice(0, 5)
  }, [participants, currentBids])

  // Turn order starting from the current turn.
  const order = [...turns].sort((a, b) => a.position - b.position)
  const curIdx = order.findIndex((t) => t.id === state?.current_turn_id)
  const upcoming =
    curIdx >= 0 ? [1, 2, 3].map((k) => order[(curIdx + k) % order.length]).filter(Boolean) : []

  const ctrl =
    'flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-base transition-colors disabled:opacity-50'
  const ctrlNeutral = `${ctrl} border-white/10 bg-[#15151c] text-gray-200 hover:bg-[#1c1c24]`

  return (
    <main className="flex-1 overflow-y-auto bg-[#09090b] px-55 py-6">
      <div className="mb-5 flex items-start justify-between">
        <h1 className="text-lg font-medium text-white">
          Liga de Inválidos <span className="text-gray-500">· Panel del host</span>
        </h1>
        <HostTopBar />
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-5">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          <div className={`${CARD} flex items-center justify-between gap-4 p-5`}>
            {/* Subasta en curso — pokemon + tipos */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className={SECTION}>Subasta en Curso</span>
                {state?.phase && (
                  <span className="rounded-md border border-violet-500/40 bg-violet-950/40 px-2.5 py-1 text-xs text-violet-200">
                    Fase: {state.phase}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-[#15151c]">
                  {currentPokemon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={homeSprite ?? currentPokemon.sprite_snapshot ?? ''}
                      alt={currentPokemon.name_snapshot}
                      className="h-16 w-16 object-contain"
                    />
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </div>
                <div>
                  <div className="text-2xl font-medium text-white">
                    {currentPokemon?.name_snapshot ?? 'Sin subasta'}
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    {types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Pausar / Reanudar subasta */}
            <div className="flex flex-col items-center gap-4">
              <span className="text-sm font-medium text-white">
                {isPaused ? 'Reanudar Subasta' : 'Pausar Subasta'}
              </span>
              <button
                type="button"
                disabled={busy || (!state?.timer_ends_at && !isPaused)}
                onClick={() =>
                  run(() => (isPaused ? resumeAuctionAction(eventId) : pauseAuctionAction(eventId)))
                }
                aria-label={isPaused ? 'Reanudar subasta' : 'Pausar subasta'}
                className={
                  isPaused
                    ? 'flex h-12 w-12 items-center justify-center rounded-[10px] border-2 border-red-900/60 bg-red-950/30 text-red-300 transition-colors hover:bg-red-950/50 disabled:cursor-default disabled:opacity-40'
                    : 'flex h-12 w-12 items-center justify-center rounded-[10px] border-2 border-[#4d7c0f] bg-[#0d0d12] text-[#bef264] shadow-[0px_0px_16px_0px_rgba(48,110,25,0.25)] transition-colors hover:bg-[#15151c] disabled:cursor-default disabled:opacity-40'
                }
              >
                {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
            </div>

            {/* Texto dinámico + timer */}
            <div className="flex flex-col items-end gap-4">
              <span className="text-sm text-gray-400">{dynamicText}</span>
              <div className="text-right">
                <div className="font-mono text-4xl font-medium text-white">
                  {remaining != null ? formatMMSS(remaining) : '—'}
                </div>
                <div className={`text-xs ${isPaused ? 'text-amber-400' : 'text-gray-500'}`}>
                  {isPaused ? 'pausado' : 'restante'}
                </div>
              </div>
            </div>
          </div>

          <div className={`${CARD} p-5`}>
            <span className={SECTION}>Pujas</span>
            <div className="mt-3 flex flex-col gap-2">
              {pujaRows.map((r, i) => {
                const m = i < 3 ? MEDAL[i] : null
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg px-4 py-3"
                    style={
                      m
                        ? { background: m.bg, outline: `1px solid ${m.ring}`, outlineOffset: '-1px' }
                        : undefined
                    }
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: m?.dot ?? '#52525b' }}
                      />
                      <span style={{ color: m?.text ?? '#9ca3af' }} className="font-medium">
                        {r.name}
                      </span>
                    </span>
                    <span style={{ color: m?.text ?? '#9ca3af' }} className="font-medium">
                      {r.amount}$
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-4">
          <span className="text-sm text-gray-300">Controles</span>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() => (isBidding ? resolveAuctionAction(eventId) : skipTurnAction(eventId)))
              }
              className={ctrlNeutral}
            >
              <SkipForward className="h-5 w-5" /> Saltar Turno
            </button>
            <button
              type="button"
              disabled={busy || isBidding || !currentTurn}
              onClick={() => setNominateOpen(true)}
              className={`${ctrlNeutral} cursor-pointer disabled:cursor-default disabled:opacity-40`}
            >
              <Gavel className="h-5 w-5" /> Nominar
            </button>
            <button
              type="button"
              disabled={busy || isBidding}
              onClick={() => run(() => undoLastRoundAction(eventId))}
              className={`${ctrl} cursor-pointer border-lime-800 bg-[#1a1c14] text-lime-300 hover:bg-[#22251a] disabled:cursor-default disabled:opacity-40`}
            >
              <RotateCcw className="h-5 w-5" /> Deshacer ronda
            </button>
            <button
              type="button"
              disabled={busy || !isBidding}
              onClick={() => run(() => undoLastBidAction(eventId))}
              className={`${ctrl} border-amber-700/ cursor-pointer bg-amber-950/30 text-amber-200 disabled:cursor-default disabled:opacity-40`}
            >
              <Undo2 className="h-5 w-5" /> Deshacer puja
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => advancePhaseAction(eventId))}
              className={`${ctrl} border-[#3f6212] cursor-pointer bg-[#0F1D0E] text-[#d9f99d] disabled:cursor-default disabled:opacity-40`}
            >
              <ArrowRight className="h-5 w-5" /> Avanzar fase
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmReset(true)}
              className={`${ctrl} border-red-900/60 cursor-pointer bg-red-950/30 text-red-300 hover:bg-red-950/50`}
            >
              <Ban className="h-5 w-5" /> Cancelar Subasta
            </button>
          </div>

          <div className={`${CARD} p-4`}>
            <span className={SECTION}>Turno actual</span>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {currentTurn ? (
                <span className="flex items-center gap-2 rounded-lg border border-[#3f6212] bg-[#0F1D0E] px-3 py-2 text-sm font-medium text-[#d9f99d]">
                  <Play className="h-4 w-4" />
                  {nameOf(currentTurn.participant_id)}
                </span>
              ) : (
                <span className="text-sm text-gray-600">Sin turno</span>
              )}
              {upcoming.map((t) => (
                <span key={t.id} className="flex items-center gap-2 text-gray-500">
                  ›
                  <span className="rounded-md border border-white/10 bg-[#15151c] px-2.5 py-1 text-xs text-gray-300">
                    {nameOf(t.participant_id)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Panel de control — click a participant to manage their team. */}
      <div className={`${CARD} mt-5 p-5`}>
        <span className={SECTION}>Panel de control</span>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {participants.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={busy}
              onClick={() => setEditParticipantId(p.id)}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-[#15151c] px-4 py-3 text-left hover:bg-[#1c1c24]"
            >
              <span className="text-sm text-gray-300">{p.display_name}</span>
              <span className="text-sm font-medium text-[#9fd47f]">{p.budget}$</span>
            </button>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={confirmReset}
        title="¿Volver a la sala de espera?"
        message="Esto reinicia el evento a WAITING y borra el draft actual (turnos, pujas, equipos). Los presupuestos vuelven a 1000."
        onConfirm={() => {
          setConfirmReset(false)
          run(() => resetToWaitingAction(eventId))
        }}
        onCancel={() => setConfirmReset(false)}
      />

      {editParticipantId && (
        <EditTeamModal
          eventId={eventId}
          participantId={editParticipantId}
          autoSkip={autoSkipIds.has(editParticipantId)}
          onToggleAutoSkip={() => toggleAutoSkip(editParticipantId)}
          onClose={() => setEditParticipantId(null)}
        />
      )}

      {/* Host nominates the pokemon for the current turn's participant. */}
      <SearchModal
        open={nominateOpen}
        wide
        onClose={() => setNominateOpen(false)}
        onSelect={(speciesId) => {
          setNominateOpen(false)
          run(() => nominateHostAction(eventId, speciesId, currentTurn?.participant_id ?? null))
        }}
      />
    </main>
  )
}
