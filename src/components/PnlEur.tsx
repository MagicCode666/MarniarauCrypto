import { formatSignedEur, trendOf } from '../lib/format'

const COLOR = { up: 'text-up', down: 'text-down', flat: 'text-muted' } as const
const SYMBOL = { up: '▲', down: '▼', flat: '■' } as const
const WORD = { up: 'gain', down: 'perte', flat: 'nul' } as const

/** Gain ou perte en euros : symbole, signe et libellé en plus de la couleur (jamais la couleur seule). */
export function PnlEur({ value }: { value: number }) {
  const trend = trendOf(Math.round(value * 100) / 100)
  const text = formatSignedEur(Math.round(value * 100) / 100)
  return (
    <span className={`${COLOR[trend]} whitespace-nowrap font-medium`}>
      <span aria-hidden="true">
        {SYMBOL[trend]} {text}
      </span>
      <span className="sr-only">
        {WORD[trend]} de {text}
      </span>
    </span>
  )
}
