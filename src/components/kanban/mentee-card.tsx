'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Phone, Users, DollarSign } from 'lucide-react'
import type { MenteeWithStats } from '@/types/kanban'

const PRIORITY_CONFIG: Record<number, { label: string; variant: 'muted' | 'warning' | 'info' | 'success' | 'accent' }> = {
  1: { label: 'Nível 1', variant: 'muted' },
  2: { label: 'Nível 2', variant: 'warning' },
  3: { label: 'Nível 3', variant: 'info' },
  4: { label: 'Nível 4', variant: 'success' },
  5: { label: 'Nível 5', variant: 'accent' },
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

  const priority = PRIORITY_CONFIG[mentee.priority_level] ?? PRIORITY_CONFIG[1]

  function handleClick() {
    // Only fire click if not dragging (distance < 8px threshold)
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
      className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-md active:cursor-grabbing animate-fade-in"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-tight text-foreground">
          {mentee.full_name}
        </h4>
        <Badge variant={priority.variant} className="shrink-0 text-[10px]">
          P{mentee.priority_level}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground tabular">
        <span className="flex items-center gap-1" title="Atendimentos">
          <Phone className="h-3 w-3" />
          {mentee.attendance_count}
        </span>
        <span className="flex items-center gap-1" title="Indicações">
          <Users className="h-3 w-3" />
          {mentee.indication_count}
        </span>
        <span className="flex items-center gap-1" title="Faturamento">
          <DollarSign className="h-3 w-3" />
          {mentee.revenue_total.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </span>
      </div>
    </div>
  )
}
