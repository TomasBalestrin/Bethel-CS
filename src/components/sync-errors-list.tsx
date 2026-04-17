'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Clock } from 'lucide-react'
import { formatDateBR } from '@/lib/format'

interface SyncErrorRow {
  id: string
  occurred_at: string
  route: string
  target_table: string
  error_code: string | null
  error_message: string
  error_details: string | null
  error_hint: string | null
  mentee_id: string | null
  specialist_id: string | null
  payload: unknown
}

interface Props {
  errors: SyncErrorRow[]
  menteeNames: Record<string, string>
  specialistNames: Record<string, string>
}

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso)
  const date = formatDateBR(d.toISOString())
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

export function SyncErrorsList({ errors, menteeNames, specialistNames }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const count24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return errors.filter((e) => new Date(e.occurred_at).getTime() >= cutoff).length
  }, [errors])

  const lastOccurred = errors[0]?.occurred_at
  const lastDelta = lastOccurred
    ? Math.floor((Date.now() - new Date(lastOccurred).getTime()) / 60000)
    : null

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Admin
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-full bg-destructive/10 p-2.5">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Erros de sincronização</h1>
          <p className="text-xs text-muted-foreground">
            INSERTs que falharam em wpp_messages / call_records / forwarding_notifications
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Últimas 24h</p>
          <p className={`font-heading text-2xl font-bold ${count24h > 0 ? 'text-destructive' : 'text-foreground'}`}>{count24h}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total (100 últimos)</p>
          <p className="font-heading text-2xl font-bold text-foreground">{errors.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Última falha</p>
          <p className="font-heading text-sm font-bold text-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {lastDelta == null ? '—' : lastDelta < 60 ? `há ${lastDelta}min` : lastDelta < 1440 ? `há ${Math.floor(lastDelta / 60)}h` : `há ${Math.floor(lastDelta / 1440)}d`}
          </p>
        </div>
      </div>

      {errors.length === 0 && (
        <div className="rounded-lg border border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
          Nenhum erro registrado. 🎉
        </div>
      )}

      <ul className="space-y-2">
        {errors.map((e) => {
          const isExpanded = expandedId === e.id
          return (
            <li key={e.id} className="rounded-lg border border-border bg-card">
              <button
                onClick={() => setExpandedId(isExpanded ? null : e.id)}
                className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-[10px] font-mono rounded bg-muted px-1.5 py-0.5">{e.route}</code>
                    <span className="text-[10px] text-muted-foreground">→ {e.target_table}</span>
                    {e.error_code && (
                      <span className="text-[10px] font-mono rounded bg-destructive/10 text-destructive px-1.5 py-0.5">{e.error_code}</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-1 truncate">{e.error_message}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                    <span>{formatDateTimeBR(e.occurred_at)}</span>
                    {e.mentee_id && <span>Mentorado: {menteeNames[e.mentee_id] ?? e.mentee_id.slice(0, 8)}</span>}
                    {e.specialist_id && <span>Especialista: {specialistNames[e.specialist_id] ?? e.specialist_id.slice(0, 8)}</span>}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{isExpanded ? '−' : '+'}</span>
              </button>
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 text-xs space-y-2">
                  {e.error_details && (
                    <div>
                      <span className="font-semibold text-muted-foreground">Details: </span>
                      <code className="font-mono text-foreground break-all">{e.error_details}</code>
                    </div>
                  )}
                  {e.error_hint && (
                    <div>
                      <span className="font-semibold text-muted-foreground">Hint: </span>
                      <code className="font-mono text-foreground break-all">{e.error_hint}</code>
                    </div>
                  )}
                  {e.payload !== null && e.payload !== undefined && (
                    <div>
                      <p className="font-semibold text-muted-foreground mb-1">Payload:</p>
                      <pre className="font-mono text-[11px] bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
{typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
