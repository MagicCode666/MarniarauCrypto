// Libellés et textes d'aide des signaux, repris du prototype.
import type { SignalLevel } from './indicators'

export const SIGNAL_LABELS: Record<SignalLevel, string> = {
  strong_buy: '▲▲ Fort signal haussier',
  buy: '▲ Signal haussier',
  neutral: '─ Neutre',
  sell: '▼ Signal baissier',
  strong_sell: '▼▼ Fort signal baissier',
}

export const SIGNAL_DESCRIPTIONS: Record<SignalLevel, string> = {
  strong_buy: 'Les indicateurs convergent vers une forte pression acheteuse à court terme.',
  buy: 'Les indicateurs suggèrent une légère tendance haussière.',
  neutral: 'Les indicateurs ne dégagent pas de tendance claire.',
  sell: 'Les indicateurs suggèrent une légère pression vendeuse.',
  strong_sell: 'Les indicateurs convergent vers une forte pression vendeuse à court terme.',
}

/** Du plus haussier au plus baissier (pour trier). */
export const SIGNAL_RANK: Record<SignalLevel, number> = {
  strong_buy: 4,
  buy: 3,
  neutral: 2,
  sell: 1,
  strong_sell: 0,
}

export const HELP = {
  rsi: {
    title: 'RSI — Indice de force relative',
    body: 'Mesure la vitesse et l’amplitude des variations de prix sur 14 jours. Va de 0 à 100.\n\n• En dessous de 30 : survendu (potentiellement sous-évalué — achat possible).\n• Au-dessus de 70 : suracheté (potentiellement surévalué — vente possible).\n• Entre 30 et 70 : zone neutre.',
  },
  macd: {
    title: 'MACD — Convergence/Divergence des moyennes mobiles',
    body: 'Compare deux moyennes mobiles exponentielles (12j et 26j) pour détecter les changements de tendance.\n\n• MACD positif : tendance haussière à court terme.\n• MACD négatif : tendance baissière.\n• Le croisement avec la ligne de signal (9j) est un indicateur classique.',
  },
  signal: {
    title: 'Signal composite',
    body: 'Score calculé en combinant RSI, MACD et variation 24h :\n\n• RSI < 30 : +2 pts   • RSI < 45 : +1 pt\n• RSI > 70 : −2 pts   • RSI > 55 : −1 pt\n• MACD > 0 : +1 pt    • MACD < 0 : −1 pt\n• Hausse > 5% : +1 pt • Baisse > 5% : −1 pt\n\nScore ≥ 3 → Fort haussier   Score ≥ 1 → Haussier\nScore ≤ −3 → Fort baissier  Score ≤ −1 → Baissier\n\nCes signaux sont éducatifs, pas des conseils financiers.',
  },
} as const

export const DISCLAIMER =
  'MarniarauCrypto est un outil éducatif. Les signaux et simulations ne constituent pas des conseils financiers.'

/** Zone du RSI selon les seuils classiques (textes d'aide du prototype : 30 et 70). */
export function rsiZone(rsi: number): 'Survendu' | 'Neutre' | 'Suracheté' {
  if (rsi < 30) return 'Survendu'
  if (rsi > 70) return 'Suracheté'
  return 'Neutre'
}
