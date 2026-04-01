import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      {/* Filtros */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-card">
        <Skeleton className="h-3.5 w-16 mb-3" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Visão geral */}
      <MetricSectionSkeleton count={4} />

      {/* Sucesso do cliente */}
      <MetricSectionSkeleton count={8} />

      {/* Trabalho do CS */}
      <MetricSectionSkeleton count={5} cols="lg:grid-cols-5" />
    </div>
  )
}

function MetricSectionSkeleton({ count, cols = 'lg:grid-cols-4' }: { count: number; cols?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="p-4">
        <div className={`grid grid-cols-2 gap-3 ${cols}`}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-md shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-2 w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
