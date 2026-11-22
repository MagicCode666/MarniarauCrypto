import { formatChange } from '../lib/format'

const COLOR = { up: 'text-up', down: 'text-down', flat: 'text-muted' } as const

/** Variation en pourcent : symbole, signe et libellé en plus de la couleur (jamais la couleur seule). */
export function Change({ pct, suffix = '' }: { pct: number | null; suffix?: string }) {
  if (pct === null) return <span className="text-muted">—</span>
  const { text, trend, label } = formatChange(pct)
  return (
    <span className={`${COLOR[trend]} whitespace-nowrap font-medium`}>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">
        {label} de {text.replace(/^\S+\s/, '')}
      </span>
      {suffix && <span className="ml-1 text-xs font-normal text-muted">{suffix}</span>}
    </span>
  )
}
