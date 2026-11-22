import { formatEur } from '../lib/format'
import type { CoinView } from '../lib/market'
import { Change } from './Change'
import { Sparkline } from './Sparkline'

export function CoinCard({ coin, onOpen }: { coin: CoinView; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-left hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{coin.name}</span>
        <span className="text-xs text-muted">{coin.symbol}</span>
      </span>
      <span className="text-xl font-semibold">
        {coin.priceEur === null ? '—' : formatEur(coin.priceEur)}
      </span>
      <Change pct={coin.change24hPct} suffix="24 h" />
      <Sparkline values={coin.recent} />
    </button>
  )
}
