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
}

export function KanbanColumn({ stage, mentees }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
  })

  return (
    <div
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-lg border bg-muted/50',
        isOver && 'ring-2 ring-primary/50'
      )}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {stage.name}
        </h3>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          {mentees.length}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div
          ref={setNodeRef}
          className="flex min-h-[200px] flex-col gap-2 p-2"
        >
          {mentees.map((mentee) => (
            <MenteeCard key={mentee.id} mentee={mentee} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
