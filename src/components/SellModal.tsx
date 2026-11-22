import { useState, type FormEvent } from 'react'
import { formatEur, formatQuantity, plainQuantity } from '../lib/format'
import { estimateSell, parseDecimal, type Transaction, type ValuedPosition } from '../lib/portfolio'
import { errorMessage, sellCoin } from '../lib/portfolioApi'
import { Modal } from './Modal'

export function SellModal({
  portfolioId,
  feeRate,
  position,
  name,
  symbol,
  onClose,
  onDone,
}: {
  portfolioId: string
  feeRate: number
  position: ValuedPosition
  name: string
  symbol: string
  onClose: () => void
  onDone: (tx: Transaction) => void
}) {
  const [qtyText, setQtyText] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const qty = parseDecimal(qtyText, 12)
  // Petite tolérance : la quantité détenue peut avoir une décimale de trop une fois convertie
  const tooMuch = qty !== null && qty > position.quantity + 1e-10
  const estimate =
    qty !== null && !position.priceMissing ? estimateSell(qty, position.priceEur, feeRate) : null
  const invalid = qtyText.trim() !== '' && qty === null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (qty === null || tooMuch) return
    setBusy(true)
    setError(null)
    try {
      onDone(await sellCoin(portfolioId, position.coinId, qty, note.trim()))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={`Vendre ${name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Quantité à vendre ({symbol})
          <span className="flex gap-2">
            <input
              inputMode="decimal"
              value={qtyText}
              onChange={(e) => setQtyText(e.target.value)}
              className="w-full rounded border border-line bg-bg p-2"
            />
            <button
              type="button"
              onClick={() => setQtyText(plainQuantity(position.quantity))}
              className="whitespace-nowrap rounded border border-line px-3 text-sm"
            >
              Tout vendre
            </button>
          </span>
          <span className="text-xs text-muted">
            Détenu : {formatQuantity(position.quantity)} {symbol}
          </span>
        </label>

        {invalid && (
          <p role="alert" className="text-sm text-down">
            Quantité invalide : un nombre positif, 12 décimales au plus.
          </p>
        )}
        {tooMuch && (
          <p role="alert" className="text-sm text-down">
            Quantité insuffisante : vous détenez {formatQuantity(position.quantity)} {symbol}.
          </p>
        )}

        {estimate && !tooMuch && (
          <p className="text-sm text-muted" aria-live="polite">
            Vous recevrez environ {formatEur(estimate.net)} (frais {formatEur(estimate.fee)},{' '}
            {(feeRate * 100).toLocaleString('fr-FR')} %). Le prix exact est celui du moment de la
            validation.
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
          disabled={busy || qty === null || tooMuch}
          className="rounded bg-accent p-2 font-medium text-bg disabled:opacity-60"
        >
          {busy ? 'Vente en cours…' : 'Confirmer la vente'}
        </button>
      </form>
    </Modal>
  )
}
