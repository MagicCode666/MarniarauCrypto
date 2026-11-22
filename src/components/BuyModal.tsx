import { useState, type FormEvent } from 'react'
import { formatEur, formatQuantity } from '../lib/format'
import type { CoinView } from '../lib/market'
import { estimateBuy, parseDecimal, type Transaction } from '../lib/portfolio'
import { buyCoin, errorMessage } from '../lib/portfolioApi'
import { Modal } from './Modal'

export function BuyModal({
  portfolioId,
  feeRate,
  cash,
  coins,
  onClose,
  onDone,
}: {
  portfolioId: string
  feeRate: number
  cash: number
  coins: CoinView[]
  onClose: () => void
  onDone: (tx: Transaction) => void
}) {
  const buyable = coins.filter((c) => c.priceEur !== null)
  const [coinId, setCoinId] = useState(buyable[0]?.coinId ?? '')
  const [amountText, setAmountText] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const coin = buyable.find((c) => c.coinId === coinId)
  const amount = parseDecimal(amountText, 2)
  const tooMuch = amount !== null && amount > cash
  const estimate =
    amount !== null && coin?.priceEur ? estimateBuy(amount, coin.priceEur, feeRate) : null
  const invalid = amountText.trim() !== '' && amount === null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (amount === null || tooMuch || !coin) return
    setBusy(true)
    setError(null)
    try {
      onDone(await buyCoin(portfolioId, coin.coinId, amount, note.trim()))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Acheter" onClose={onClose}>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Crypto
          <select
            value={coinId}
            onChange={(e) => setCoinId(e.target.value)}
            className="rounded border border-line bg-bg p-2"
          >
            {buyable.map((c) => (
              <option key={c.coinId} value={c.coinId}>
                {c.name} ({c.symbol}) — {formatEur(c.priceEur ?? 0)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Montant (€)
          <span className="flex gap-2">
            <input
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="100"
              className="w-full rounded border border-line bg-bg p-2"
            />
            <button
              type="button"
              onClick={() => setAmountText(cash.toFixed(2))}
              className="whitespace-nowrap rounded border border-line px-3 text-sm"
            >
              Tout le cash
            </button>
          </span>
          <span className="text-xs text-muted">Disponible : {formatEur(cash)}</span>
        </label>

        {invalid && (
          <p role="alert" className="text-sm text-down">
            Montant invalide : un nombre positif, 2 décimales au plus.
          </p>
        )}
        {tooMuch && (
          <p role="alert" className="text-sm text-down">
            Solde insuffisant : {formatEur(cash)} disponibles.
          </p>
        )}

        {estimate && coin && !tooMuch && (
          <p className="text-sm text-muted" aria-live="polite">
            Quantité estimée : {formatQuantity(estimate.quantity)} {coin.symbol} · Frais :{' '}
            {formatEur(estimate.fee)} ({(feeRate * 100).toLocaleString('fr-FR')} %). Le prix exact
            est celui du moment de la validation.
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Note (optionnel)
          <input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            className="rounded border border-line bg-bg p-2"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-down">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || amount === null || tooMuch || !coin}
          className="rounded bg-accent p-2 font-medium text-bg disabled:opacity-60"
        >
          {busy ? 'Achat en cours…' : 'Confirmer l’achat'}
        </button>
      </form>
    </Modal>
  )
}
