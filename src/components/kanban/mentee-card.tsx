'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Phone, Users, DollarSign } from 'lucide-react'
import type { MenteeWithStats } from '@/types/kanban'

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-gray-100 text-gray-700 border-gray-200',
  2: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  3: 'bg-green-100 text-green-700 border-green-200',
  4: 'bg-blue-100 text-blue-700 border-blue-200',
  5: 'bg-purple-100 text-purple-700 border-purple-200',
}

interface MenteeCardProps {
  mentee: MenteeWithStats
}

export function MenteeCard({ mentee }: MenteeCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: mentee.id,
    })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-tight">{mentee.full_name}</h4>
        <Badge
          className={`shrink-0 text-[10px] ${PRIORITY_COLORS[mentee.priority_level] ?? PRIORITY_COLORS[1]}`}
        >
          P{mentee.priority_level}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
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
