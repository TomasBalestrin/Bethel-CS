import { Skeleton } from '@/components/ui/skeleton'

export default function EntregasLoading() {
  return (
    <div>
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
