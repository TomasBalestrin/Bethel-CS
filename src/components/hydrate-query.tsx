'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'

interface HydrateQueryProps {
  queryKey: string[]
  data: unknown
}

export function HydrateQuery({ queryKey, data }: HydrateQueryProps) {
  const queryClient = useQueryClient()
  const hydrated = useRef(false)

  if (!hydrated.current) {
    queryClient.setQueryData(queryKey, data)
    hydrated.current = true
  }

  return null
}
