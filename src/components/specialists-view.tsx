'use client'

import { useState } from 'react'
import { Users, DollarSign, Phone, MessageCircle, TrendingUp, Star, XCircle, CheckCircle, UserCog, ArrowUpRight, BarChart3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface SpecialistMetrics {
  id: string
  full_name: string
  avatar_url: string | null
  created_at: string
  mentorados: { ativos: number; cancelados: number; concluidos: number; total: number; fit: number; retencao: number }
  desempenho: { receita: number; indicacoes: number; depoimentos: number }
  atendimentos: { totalLigacoes: number; totalMinutos: number; totalMsgsEnviadas: number }
  engajamento: { aulas: number; lives: number }
  crescimento: { avgFatAtual: number; avgFatAntes: number; crescimentoMedio: number }
}

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function MetricRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular ${highlight ? 'text-accent' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}

export function SpecialistsView({ specialists }: { specialists: SpecialistMetrics[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)

  const selected = specialists.find((s) => s.id === selectedId) || null

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < 3 ? [...prev, id] : prev
    )
  }

  function startCompare() {
    if (compareIds.length >= 2) setComparing(true)
  }

  // ─── Comparison View ───
  if (comparing && compareIds.length >= 2) {
    const compared = specialists.filter((s) => compareIds.includes(s.id))
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-xl font-bold">Comparar Especialistas</h1>
          <Button variant="outline" size="sm" onClick={() => { setComparing(false); setCompareIds([]) }}>
            <X className="h-3 w-3 mr-1" /> Voltar
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Métrica</th>
                {compared.map((s) => (
                  <th key={s.id} className="text-center py-2 px-3 text-xs font-semibold text-foreground">{s.full_name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {[
                { label: 'Mentorados ativos', get: (s: SpecialistMetrics) => s.mentorados.ativos },
                { label: 'Total mentorados', get: (s: SpecialistMetrics) => s.mentorados.total },
                { label: 'Taxa retenção', get: (s: SpecialistMetrics) => `${s.mentorados.retencao}%` },
                { label: 'Cliente Fit', get: (s: SpecialistMetrics) => s.mentorados.fit },
                { label: 'Cancelamentos', get: (s: SpecialistMetrics) => s.mentorados.cancelados },
                { label: 'Receita gerada', get: (s: SpecialistMetrics) => formatBRL(s.desempenho.receita) },
                { label: 'Indicações', get: (s: SpecialistMetrics) => s.desempenho.indicacoes },
                { label: 'Depoimentos', get: (s: SpecialistMetrics) => s.desempenho.depoimentos },
                { label: 'Ligações', get: (s: SpecialistMetrics) => s.atendimentos.totalLigacoes },
                { label: 'Tempo ligações', get: (s: SpecialistMetrics) => `${s.atendimentos.totalMinutos}min` },
                { label: 'Msgs enviadas', get: (s: SpecialistMetrics) => s.atendimentos.totalMsgsEnviadas },
                { label: 'Crescimento médio', get: (s: SpecialistMetrics) => `${s.crescimento.crescimentoMedio}%` },
                { label: 'Fat. médio atual', get: (s: SpecialistMetrics) => formatBRL(s.crescimento.avgFatAtual) },
              ].map((row) => {
                const values = compared.map((s) => row.get(s))
                // Highlight the best value (highest number)
                const numericValues = compared.map((s) => {
                  const raw = row.get(s)
                  return typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.-]/g, '')) || 0
                })
                const maxIdx = numericValues.indexOf(Math.max(...numericValues))

                return (
                  <tr key={row.label}>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{row.label}</td>
                    {values.map((v, i) => (
                      <td key={i} className={`py-2 px-3 text-center text-sm font-semibold tabular ${i === maxIdx && numericValues[maxIdx] > 0 ? 'text-accent' : 'text-foreground'}`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ─── Detail View ───
  if (selected) {
    const s = selected
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedId(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">&larr; Voltar</button>
            <h1 className="font-heading text-xl font-bold">{s.full_name}</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Visão Geral */}
          <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
              <Users className="h-3.5 w-3.5 text-accent" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wide">Mentorados</h3>
            </div>
            <div className="p-3">
              <MetricRow label="Ativos" value={s.mentorados.ativos} highlight />
              <MetricRow label="Cancelados" value={s.mentorados.cancelados} />
              <MetricRow label="Concluídos" value={s.mentorados.concluidos} />
              <MetricRow label="Total" value={s.mentorados.total} />
              <MetricRow label="Cliente Fit" value={s.mentorados.fit} />
              <MetricRow label="Retenção" value={`${s.mentorados.retencao}%`} highlight />
            </div>
          </div>

          {/* Desempenho */}
          <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-success/5 to-transparent">
              <DollarSign className="h-3.5 w-3.5 text-success" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wide">Desempenho</h3>
            </div>
            <div className="p-3">
              <MetricRow label="Receita gerada" value={formatBRL(s.desempenho.receita)} highlight />
              <MetricRow label="Indicações" value={s.desempenho.indicacoes} />
              <MetricRow label="Depoimentos" value={s.desempenho.depoimentos} />
            </div>
          </div>

          {/* Atendimentos */}
          <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-info/5 to-transparent">
              <Phone className="h-3.5 w-3.5 text-info" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wide">Atendimentos</h3>
            </div>
            <div className="p-3">
              <MetricRow label="Ligações" value={s.atendimentos.totalLigacoes} />
              <MetricRow label="Tempo total" value={`${s.atendimentos.totalMinutos}min`} />
              <MetricRow label="Msgs enviadas" value={s.atendimentos.totalMsgsEnviadas} />
              <MetricRow label="Acessos área" value={s.engajamento.aulas} />
              <MetricRow label="Presenças live" value={s.engajamento.lives} />
            </div>
          </div>

          {/* Crescimento */}
          <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-warning/5 to-transparent">
              <TrendingUp className="h-3.5 w-3.5 text-warning" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wide">Crescimento</h3>
            </div>
            <div className="p-3">
              <MetricRow label="Fat. médio atual" value={formatBRL(s.crescimento.avgFatAtual)} highlight />
              <MetricRow label="Fat. antes mentoria" value={formatBRL(s.crescimento.avgFatAntes)} />
              <MetricRow label="Crescimento médio" value={`${s.crescimento.crescimentoMedio}%`} highlight />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── List View ───
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold">Especialistas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão individual de cada especialista</p>
        </div>
        <div className="flex items-center gap-2">
          {compareIds.length > 0 && (
            <span className="text-xs text-muted-foreground">{compareIds.length} selecionadas</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={startCompare}
            disabled={compareIds.length < 2}
            className="gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Comparar {compareIds.length >= 2 && `(${compareIds.length})`}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {specialists.map((s) => (
          <div
            key={s.id}
            className={`rounded-lg border bg-card shadow-card overflow-hidden transition-colors ${
              compareIds.includes(s.id) ? 'border-accent ring-1 ring-accent/30' : 'border-border hover:border-border/80'
            }`}
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <UserCog className="h-4 w-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">{s.mentorados.ativos} ativos · {s.mentorados.total} total</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={compareIds.includes(s.id)}
                onChange={() => toggleCompare(s.id)}
                className="h-4 w-4 rounded border-input shrink-0"
                title="Selecionar para comparar"
              />
            </div>

            {/* Quick metrics */}
            <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-foreground tabular">{s.mentorados.retencao}%</p>
                <p className="text-[10px] text-muted-foreground">Retenção</p>
              </div>
              <div>
                <p className="text-lg font-bold text-success tabular">{formatBRL(s.desempenho.receita).replace('R$ ', '')}</p>
                <p className="text-[10px] text-muted-foreground">Receita</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground tabular">{s.desempenho.indicacoes}</p>
                <p className="text-[10px] text-muted-foreground">Indicações</p>
              </div>
            </div>

            {/* Bottom stats */}
            <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.atendimentos.totalLigacoes}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {s.atendimentos.totalMsgsEnviadas}</span>
                {s.crescimento.crescimentoMedio > 0 && (
                  <span className="flex items-center gap-1 text-success"><ArrowUpRight className="h-3 w-3" /> {s.crescimento.crescimentoMedio}%</span>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] text-accent" onClick={() => setSelectedId(s.id)}>
                Ver detalhes
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
