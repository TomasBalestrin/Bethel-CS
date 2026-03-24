'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Phone, Users, DollarSign, Star } from 'lucide-react'
import type { MenteeWithStats } from '@/types/kanban'

const LEVEL_COLORS: Record<number, string> = {
  1: '#888780',
  2: '#FFAA00',
  3: '#3B9FFF',
  4: '#2FC695',
  5: '#1F3A7D',
}

interface MenteeCardProps {
  mentee: MenteeWithStats
  onClick?: (mentee: MenteeWithStats) => void
}

export function MenteeCard({ mentee, onClick }: MenteeCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className="cursor-pointer rounded-lg border border-border/50 bg-card shadow-card transition-all hover:border-accent/30 hover:shadow-md active:cursor-grabbing animate-fade-in"
    >
      <div className="flex">
        {/* Color bar */}
        <div
          className="w-1 shrink-0 rounded-l-lg"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 px-3.5 py-3">
          {/* Name + badge */}
          <div className="flex items-start justify-between gap-2">
            <h4 className="flex items-center gap-1 font-heading font-medium text-sm leading-tight text-foreground">
              {mentee.cliente_fit && <Star className="h-3.5 w-3.5 text-warning fill-warning shrink-0" />}
              {mentee.full_name}
            </h4>
            <span
              className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${color}15`, color }}
            >
              P{mentee.priority_level}
            </span>
          </div>
          {/* Product */}
          {mentee.product_name && (
            <p className="text-xs text-muted-foreground mt-0.5">{mentee.product_name}</p>
          )}
          {/* Divider + metrics */}
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-3 text-xs text-muted-foreground tabular">
            <span className="flex items-center gap-1" title="Atendimentos">
              <Phone size={12} />
              {mentee.attendance_count} atend.
            </span>
            <span className="flex items-center gap-1" title="Indicações">
              <Users size={12} />
              {mentee.indication_count} indic.
            </span>
            <span className="flex items-center gap-1" title="Receita">
              <DollarSign size={12} />
              R$ {(mentee.revenue_total / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
