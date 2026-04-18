import { classifyBm } from '@/lib/bm-freshness'

// Dois tamanhos:
//   * dot (compacto) — usado no card do Kanban junto com o P{priority}.
//                      Mostra só o pontinho colorido; tooltip via title.
//   * label (médio)  — usado no painel do mentorado, ao lado do seletor de
//                      etapas. Mostra dot + texto curto "BM atualizado" etc.

interface Props {
  sourceUpdatedAt: string | null | undefined
  syncing?: boolean
  size?: 'dot' | 'label'
  onClick?: () => void
}

export function BmBadge({ sourceUpdatedAt, syncing, size = 'dot', onClick }: Props) {
  const info = classifyBm(sourceUpdatedAt, { syncing })

  if (size === 'dot') {
    return (
      <span
        title={info.label}
        className="inline-flex items-center"
        aria-label={info.label}
      >
        <span
          className={`inline-block rounded-full ${info.dotClass}`}
          style={{ width: 8, height: 8 }}
        />
      </span>
    )
  }

  // label size (painel)
  const shortLabel =
    info.status === 'syncing' ? 'BM sincronizando…'
    : info.status === 'fresh' ? `BM atualizado${info.days != null && info.days > 0 ? ` · ${info.days}d` : ''}`
    : info.status === 'stale' ? `BM · ${info.days}d sem atualizar`
    : info.status === 'outdated' ? `BM · ${info.days}d sem atualizar`
    : 'BM não conectado'

  const Cmp = onClick ? 'button' : 'span'
  return (
    <Cmp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={info.label + (onClick ? ' — clique para ver detalhes' : '')}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${info.colorClass} ${
        info.status === 'fresh' ? 'border-success/30 bg-success/10'
        : info.status === 'outdated' ? 'border-destructive/30 bg-destructive/10'
        : info.status === 'unlinked' ? 'border-muted-foreground/20 bg-muted/10'
        : 'border-muted-foreground/30 bg-muted/20'
      } ${onClick ? 'hover:opacity-80 cursor-pointer' : ''}`}
      aria-label={info.label}
    >
      <span
        className={`inline-block rounded-full ${info.dotClass}`}
        style={{ width: 8, height: 8 }}
      />
      <span>{shortLabel}</span>
    </Cmp>
  )
}
