import { Skeleton } from '@/components/ui/skeleton'

export default function TarefasLoading() {
  return (
    <div>
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="min-w-[260px] sm:w-72 shrink-0 rounded-lg border border-border bg-muted/50 p-3 space-y-3">
            <Skeleton className="h-5 w-24" />
            {[...Array(3)].map((_, j) => (
              <Skeleton key={j} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
