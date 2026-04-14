'use client'

import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Users, DollarSign, Star, Clock, Calendar, Headphones } from 'lucide-react'
import type { MenteeWithStats } from '@/types/kanban'
import { formatDateBR } from '@/lib/format'

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
  onClick?: (mentee: MenteeWithStats) => void
}

export const MenteeCard = memo(function MenteeCard({ mentee, unreadCount = 0, specialistName, onClick }: MenteeCardProps) {
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
  const hasIndications = mentee.indication_count > 0
  const hasRevenue = mentee.revenue_total > 0

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
        {/* Header: Name + Priority */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="flex items-start gap-1 font-heading font-semibold text-[13px] leading-snug text-foreground min-w-0">
            {mentee.cliente_fit && <Star className="h-3 w-3 text-warning fill-warning shrink-0 mt-0.5" />}
            <span>{mentee.full_name}</span>
          </h4>
          <span
            className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular"
            style={{ backgroundColor: `${color}18`, color }}
            title={LEVEL_LABELS[mentee.priority_level] ?? ''}
          >
            P{mentee.priority_level}
          </span>
        </div>

        {/* Product + specialist badges + date */}
        <div className="flex items-center flex-wrap gap-1 mt-1.5">
          {mentee.product_name && (
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
              {formatDateBR(mentee.start_date)}
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
            </div>
            {mentee.active_sessions && mentee.active_sessions.length > 0 && (
              <div className="mt-0.5 pl-4 flex flex-wrap gap-x-2 gap-y-0.5">
                {mentee.active_sessions.map((s, i) => (
                  <span key={i} className="text-[10px] text-success/90">
                    {s.specialist_name}
                    <span className="text-success/60"> · {formatChannelLabel(s.channel)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Metrics row */}
        <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-3 text-[11px] tabular">
          <span className={`flex items-center gap-1 ${hasIndications ? 'text-accent font-medium' : 'text-muted-foreground/60'}`} title="Indicações">
            <Users size={11} className="shrink-0" />
            {mentee.indication_count}
          </span>
          <span className={`flex items-center gap-1 ${hasRevenue ? 'text-success font-medium' : 'text-muted-foreground/60'}`} title="Receita">
            <DollarSign size={11} className="shrink-0" />
            R$ {mentee.revenue_total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          {mentee.days_since_contact != null && (
            <span
              className={`flex items-center gap-0.5 ml-auto ${mentee.days_since_contact > 7 ? 'text-destructive font-semibold' : mentee.days_since_contact > 3 ? 'text-warning font-medium' : 'text-muted-foreground/60'}`}
              title={`${mentee.days_since_contact} dias sem contato`}
            >
              <Clock size={10} className="shrink-0" />
              {mentee.days_since_contact}d
            </span>
          )}
        </div>
      </div>
    </div>
  )
})
