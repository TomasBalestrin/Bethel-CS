import { Skeleton } from '@/components/ui/skeleton'

export default function MentoradosLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-36" />
      <Skeleton className="mt-2 h-4 w-24" />

      <div className="mt-4 max-w-sm">
        <Skeleton className="h-9 w-full rounded-md" />
      </div>

      <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-card shadow-card">
            <div className="flex">
              <Skeleton className="w-1 shrink-0 rounded-l-lg" />
              <div className="flex-1 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
                <div className="border-t border-border/50 pt-3 space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <div className="border-t border-border/50 pt-3">
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
