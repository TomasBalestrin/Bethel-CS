'use client'

import { memo, useEffect, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Star, Clock, Calendar, Headphones, Layers } from 'lucide-react'
import type { MenteeWithStats } from '@/types/kanban'
import { formatDateBR } from '@/lib/format'
import { BmBadge } from '@/components/bm-badge'

const LEVEL_COLORS: Record<number, string> = {
  1: '#94928B',
  2: '#FFAA00',
  3: '#3B9FFF',
  4: '#2FC695',
  5: '#1F3A7D',
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Baixa',
  2: 'Normal',
  3: 'Média',
  4: 'Alta',
  5: 'Urgente',
}

const CHANNEL_LABELS: Record<string, string> = {
  principal: 'Principal',
  comercial: 'Comercial',
  marketing: 'Marketing',
  gestao: 'Gestão',
}

function formatChannelLabel(ch: string): string {
  return CHANNEL_LABELS[ch] ?? ch
}

interface MenteeCardProps {
  mentee: MenteeWithStats
  unreadCount?: number
  specialistName?: string
  /** Timestamp ISO of the last INCOMING message — used to show the wait-time indicator. */
  lastIncomingAt?: string
  onClick?: (mentee: MenteeWithStats) => void
}

/** Format an elapsed duration in "Xd Yh Zmin" / "Xh Ymin" / "Xmin" / "Xs". */
function formatDuration(ms: number): string {
  const abs = Math.max(0, ms)
  const totalMin = Math.floor(abs / 60000)
  if (totalMin < 1) return `${Math.floor(abs / 1000)}s`
  const days = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const mins = totalMin % 60
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
  return `${mins}min`
}

export const MenteeCard = memo(function MenteeCard({ mentee, unreadCount = 0, specialistName, lastIncomingAt, onClick }: MenteeCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: mentee.id,
    })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const color = LEVEL_COLORS[mentee.priority_level] ?? LEVEL_COLORS[1]

  function handleClick() {
    if (!isDragging && onClick) {
      onClick(mentee)
    }
  }

  const isInactive = mentee.days_since_contact != null && mentee.days_since_contact >= 30

  // Tick every 30s so the duration/wait indicators stay up-to-date without a
  // full page refresh. Only starts the interval when this card actually has
  // something to count (active session or unread incoming), to avoid pointless
  // re-renders on every card in the board.
  const activeSession = mentee.active_sessions?.[0]
  const sessionStart = activeSession?.started_at
  const hasWait = unreadCount > 0 && !!lastIncomingAt
  const [, setNowTick] = useState(0)
  useEffect(() => {
    if (!sessionStart && !hasWait) return
    const id = setInterval(() => setNowTick((n) => n + 1), 30 * 1000)
    return () => clearInterval(id)
  }, [sessionStart, hasWait])

  // Elapsed time in session (only when has_active_session and started_at is present)
  const sessionMs = sessionStart ? Date.now() - new Date(sessionStart).getTime() : 0
  const sessionLabel = sessionStart ? formatDuration(sessionMs) : null

  // Wait time for a mentee reply
  const waitMs = lastIncomingAt ? Date.now() - new Date(lastIncomingAt).getTime() : 0
  const waitLabel = hasWait ? formatDuration(waitMs) : null

  // Tempo na etapa atual (stage_changes mais recente; fallback created_at)
  const stageLabel = mentee.stage_entered_at
    ? formatDuration(Date.now() - new Date(mentee.stage_entered_at).getTime())
    : null
  const waitColorClass = !hasWait
    ? ''
    : waitMs >= 2 * 60 * 60 * 1000
      ? 'text-red-700 bg-red-600/10 border-red-600/30'
      : waitMs >= 30 * 60 * 1000
        ? 'text-orange-600 bg-orange-500/10 border-orange-500/30'
        : 'text-amber-700 bg-amber-500/10 border-amber-500/30'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`relative cursor-pointer rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 active:cursor-grabbing ${
        mentee.has_active_session
          ? 'border-success/40 bg-success/5 shadow-sm shadow-success/10'
          : isInactive
            ? 'border-muted-foreground/20 bg-muted/40'
            : 'border-border/50 bg-card hover:border-accent/30'
      }`}
    >
      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-2 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white shadow-md ring-2 ring-background">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      {/* Priority accent line */}
      <div
        className="absolute top-0 left-3 right-3 h-[2px] rounded-b-full"
        style={{ backgroundColor: color }}
      />

      <div className="px-3 pt-3 pb-2.5">
        {/* Header: Name + Priority + BM dot */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="flex items-start gap-1 font-heading font-semibold text-[13px] leading-snug text-foreground min-w-0">
            {mentee.cliente_fit && <Star className="h-3 w-3 text-warning fill-warning shrink-0 mt-0.5" />}
            <span>{mentee.full_name}</span>
          </h4>
          <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
            <BmBadge sourceUpdatedAt={mentee.metrics_source_updated_at as string | null | undefined} size="dot" />
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular"
              style={{ backgroundColor: `${color}18`, color }}
              title={LEVEL_LABELS[mentee.priority_level] ?? ''}
            >
              P{mentee.priority_level}
            </span>
          </div>
        </div>

        {/* Product (apenas Implementação Comercial) + specialist badges + data de início */}
        <div className="flex items-center flex-wrap gap-1 mt-1.5">
          {mentee.product_name === 'Implementação Comercial' && (
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {mentee.product_name}
            </span>
          )}
          {specialistName && (
            <span className="inline-flex items-center rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {specialistName}
            </span>
          )}
          {mentee.start_date && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 shrink-0 ml-auto tabular" title="Data de início">
              <Calendar size={9} />
              Início {formatDateBR(mentee.start_date)}
            </span>
          )}
        </div>

        {/* Active session indicator — show specialist name(s) + channel */}
        {mentee.has_active_session && (
          <div className="mt-2 rounded-lg bg-success/10 px-2 py-1">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <Headphones size={10} className="text-success" />
              <span className="text-[10px] font-semibold text-success">Em atendimento</span>
              {sessionLabel && (
                <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-medium text-success/90 tabular">
                  <Clock size={9} /> {sessionLabel}
                </span>
              )}
            </div>
            {mentee.active_sessions && mentee.active_sessions.length > 0 && (
              <div className="mt-0.5 pl-4">
                {/* Only one active attendance per mentee — show the most recent */}
                <span className="text-[10px] text-success/90">
                  {mentee.active_sessions[0].specialist_name}
                  <span className="text-success/60"> · {formatChannelLabel(mentee.active_sessions[0].channel)}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Waiting-for-reply indicator: only when there's unread incoming. The
            color progresses (amber → orange → red) as more time passes, so
            overdue replies grab attention without flashing on fresh ones. */}
        {waitLabel && (
          <div className={`mt-2 rounded-md border px-2 py-1 flex items-center gap-1.5 text-[10px] font-medium ${waitColorClass}`}>
            <Clock size={10} />
            <span>Aguardando há {waitLabel}</span>
          </div>
        )}

        {/* Metrics row */}
        <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-3 text-[11px] tabular">
          {stageLabel && (
            <span className="flex items-center gap-1 text-muted-foreground" title="Tempo na etapa atual">
              <Layers size={11} className="shrink-0" />
              Etapa Atual: {stageLabel}
            </span>
          )}
          {mentee.days_since_contact != null && (
            <span
              className={`flex items-center gap-1 ml-auto ${mentee.days_since_contact > 7 ? 'text-destructive font-semibold' : mentee.days_since_contact > 3 ? 'text-warning font-medium' : 'text-muted-foreground/60'}`}
              title={`${mentee.days_since_contact} dias sem atendimento`}
            >
              <Clock size={10} className="shrink-0" />
              {mentee.days_since_contact}d sem atendimento
            </span>
          )}
        </div>
      </div>
    </div>
  )
})
