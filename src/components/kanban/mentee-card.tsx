'use client'

import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Users, DollarSign, Star, Clock } from 'lucide-react'
import type { MenteeWithStats } from '@/types/kanban'

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

interface MenteeCardProps {
  mentee: MenteeWithStats
  unreadCount?: number
  onClick?: (mentee: MenteeWithStats) => void
}

export const MenteeCard = memo(function MenteeCard({ mentee, unreadCount = 0, onClick }: MenteeCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`relative cursor-pointer rounded-lg border transition-colors hover:shadow-sm active:cursor-grabbing ${
        isInactive
          ? 'border-muted-foreground/30 bg-muted/60'
          : 'border-border/60 bg-card hover:border-accent/30'
      }`}
    >
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shadow-sm">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      <div className="flex">
        {/* Priority color bar */}
        <div
          className="w-1.5 shrink-0 rounded-l-lg"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 px-3 py-2.5">
          {/* Name + priority */}
          <div className="flex items-start justify-between gap-2">
            <h4 className="flex items-center gap-1 font-heading font-semibold text-[13px] leading-tight text-foreground truncate">
              {mentee.cliente_fit && <Star className="h-3.5 w-3.5 text-warning fill-warning shrink-0" />}
              {mentee.full_name}
            </h4>
            <span
              className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ backgroundColor: `${color}15`, color }}
              title={LEVEL_LABELS[mentee.priority_level] ?? ''}
            >
              P{mentee.priority_level}
            </span>
          </div>
          {/* Product */}
          {mentee.product_name && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{mentee.product_name}</p>
          )}
          {/* Metrics */}
          <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center gap-2.5 text-[11px] text-muted-foreground tabular">
            <span className="flex items-center gap-0.5" title="Indicações">
              <Users size={11} className="shrink-0" />
              {mentee.indication_count}
            </span>
            <span className="flex items-center gap-0.5" title="Receita">
              <DollarSign size={11} className="shrink-0" />
              R$ {mentee.revenue_total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            {mentee.days_since_contact != null && (
              <span
                className={`flex items-center gap-0.5 ml-auto ${mentee.days_since_contact > 7 ? 'text-destructive font-medium' : mentee.days_since_contact > 3 ? 'text-warning' : ''}`}
                title={`${mentee.days_since_contact} dias sem contato`}
              >
                <Clock size={11} className="shrink-0" />
                {mentee.days_since_contact}d
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
