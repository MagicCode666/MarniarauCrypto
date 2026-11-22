import type { SignalLevel } from '../lib/indicators'
import { SIGNAL_LABELS } from '../lib/signalTexts'

const STYLE: Record<SignalLevel, string> = {
  strong_buy: 'border-up bg-up/20 text-up font-bold',
  buy: 'border-up text-up',
  neutral: 'border-line text-muted',
  sell: 'border-down text-down',
  strong_sell: 'border-down bg-down/20 text-down font-bold',
}

/** Niveau du signal : symbole (▲ ▼ ─) et libellé, la couleur ne fait que renforcer. */
export function SignalBadge({ level }: { level: SignalLevel }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${STYLE[level]}`}
    >
      {SIGNAL_LABELS[level]}
    </span>
  )
}
