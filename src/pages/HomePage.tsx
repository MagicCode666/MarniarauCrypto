import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CoinCard } from '../components/CoinCard'
import { CoinModal } from '../components/CoinModal'
import { MarketStatus } from '../components/MarketStatus'
import type { MarketState } from '../hooks/useMarket'

/** Écran « Prix » : une carte par crypto, détail en modale. */
export function HomePage() {
  const state = useOutletContext<MarketState>()
  const [openId, setOpenId] = useState<string | null>(null)
  const market = state.market
  const open = market?.coins.find((c) => c.coinId === openId) ?? null

  return (
    <main className="flex flex-col gap-5">
      <MarketStatus state={state} />

      {market && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {market.coins.map((coin) => (
            <li key={coin.coinId}>
              <CoinCard coin={coin} onOpen={() => setOpenId(coin.coinId)} />
            </li>
          ))}
        </ul>
      )}

      {open && <CoinModal coin={open} onClose={() => setOpenId(null)} />}
    </main>
  )
}
