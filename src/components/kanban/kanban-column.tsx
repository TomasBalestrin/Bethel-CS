'use client'

import { useDroppable } from '@dnd-kit/core'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MenteeCard } from './mentee-card'
import { cn } from '@/lib/utils'
import type { MenteeWithStats } from '@/types/kanban'
import type { Database } from '@/types/database'

type KanbanStage = Database['public']['Tables']['kanban_stages']['Row']

interface KanbanColumnProps {
  stage: KanbanStage
  mentees: MenteeWithStats[]
  onCardClick?: (mentee: MenteeWithStats) => void
}

export function KanbanColumn({ stage, mentees, onCardClick }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
  })

  return (
    <div
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/50',
        isOver && 'ring-2 ring-accent/50'
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h3 className="label-xs">
          {stage.name}
        </h3>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-sm bg-muted px-1 text-[10px] font-medium text-muted-foreground tabular">
          {mentees.length}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div
          ref={setNodeRef}
          className="flex min-h-[200px] flex-col gap-2 p-2"
        >
          {mentees.map((mentee) => (
            <MenteeCard
              key={mentee.id}
              mentee={mentee}
              onClick={onCardClick}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
