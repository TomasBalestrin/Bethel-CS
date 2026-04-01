'use client'

import { useReportWebVitals } from 'next/web-vitals'

const THRESHOLDS = {
  LCP: 2500,   // Largest Contentful Paint — good < 2.5s
  FID: 100,    // First Input Delay — good < 100ms
  CLS: 0.1,    // Cumulative Layout Shift — good < 0.1
  FCP: 1800,   // First Contentful Paint — good < 1.8s
  TTFB: 800,   // Time to First Byte — good < 800ms
  INP: 200,    // Interaction to Next Paint — good < 200ms
}

export function WebVitals() {
  useReportWebVitals((metric) => {
    const threshold = THRESHOLDS[metric.name as keyof typeof THRESHOLDS]

    // Log all metrics in development
    if (process.env.NODE_ENV === 'development') {
      const status = threshold && metric.value > threshold ? 'SLOW' : 'OK'
      console.log(`[Web Vital] ${metric.name}: ${Math.round(metric.value)}ms — ${status}`)
    }

    // In production, only warn on poor metrics
    if (process.env.NODE_ENV === 'production' && threshold && metric.value > threshold) {
      console.warn(`[Web Vital] ${metric.name} exceeded threshold: ${Math.round(metric.value)}ms (limit: ${threshold}ms)`)
    }
  })

  return null
}
