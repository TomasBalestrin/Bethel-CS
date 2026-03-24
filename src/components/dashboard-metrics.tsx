'use client'

import { Badge } from '@/components/ui/badge'
import {
  Users,
  Phone,
  UserPlus,
  DollarSign,
  MessageSquareQuote,
  BarChart3,
} from 'lucide-react'

const PRIORITY_VARIANT: Record<number, 'muted' | 'warning' | 'info' | 'success' | 'accent'> = {
  1: 'muted',
  2: 'warning',
  3: 'info',
  4: 'success',
  5: 'accent',
}

interface DashboardMetricsProps {
  userName: string
  totalMentees: number
  priorityDistribution: Record<number, number>
  totalAttendances: number
  totalIndications: number
  totalRevenue: number
  totalTestimonials: number
}

export function DashboardMetrics({
  userName,
  totalMentees,
  priorityDistribution,
  totalAttendances,
  totalIndications,
  totalRevenue,
  totalTestimonials,
}: DashboardMetricsProps) {
  const metrics = [
    {
      label: 'Mentorados Ativos',
      value: totalMentees,
      icon: Users,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      label: 'Atendimentos',
      value: totalAttendances,
      icon: Phone,
      color: 'text-info',
      bg: 'bg-info/10',
    },
    {
      label: 'Indicações',
      value: totalIndications,
      icon: UserPlus,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Receita Crossell',
      value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Depoimentos',
      value: totalTestimonials,
      icon: MessageSquareQuote,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
  ]

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Bem-vindo, {userName}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Visão geral do Customer Success
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-border bg-card p-4 shadow-card animate-slide-up"
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-md p-2 ${m.bg}`}>
                <m.icon className={`h-5 w-5 ${m.color}`} />
              </div>
              <div>
                <p className="label-xs">{m.label}</p>
                <p className="font-heading text-xl font-bold text-foreground tabular">
                  {m.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Distribuição por Prioridade
          </h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {[1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className="rounded-lg border border-border bg-card p-4 shadow-card animate-fade-in text-center"
            >
              <Badge variant={PRIORITY_VARIANT[level]} className="mb-2">
                Nível {level}
              </Badge>
              <p className="font-heading text-2xl font-bold text-foreground tabular">
                {priorityDistribution[level] ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">mentorados</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
