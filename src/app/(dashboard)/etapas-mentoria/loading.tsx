import { Skeleton } from '@/components/ui/skeleton'

export default function EtapasMentoriaLoading() {
  return (
    <div>
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-9 w-36 rounded-md hidden sm:block" />
      </div>

      <div className="flex gap-3 sm:gap-4 overflow-hidden pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="min-w-[280px] w-72 shrink-0 rounded-lg border border-border bg-muted/50">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-5 rounded-sm" />
            </div>
            <div className="p-2 space-y-2">
              {Array.from({ length: 1 + i % 3 }).map((_, j) => (
                <div key={j} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
