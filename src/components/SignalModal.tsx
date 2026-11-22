import { formatSigned } from '../lib/format'
import type { Analysis } from '../lib/indicators'
import type { CoinView } from '../lib/market'
import { DISCLAIMER, HELP, rsiZone, SIGNAL_DESCRIPTIONS, SIGNAL_LABELS } from '../lib/signalTexts'
import { Modal } from './Modal'
import { RsiBar } from './RsiBar'
import { SignalBadge } from './SignalBadge'

const pts = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

function Help({ topic }: { topic: keyof typeof HELP }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-accent">{HELP[topic].title}</summary>
      <p className="mt-2 whitespace-pre-line text-muted">{HELP[topic].body}</p>
    </details>
  )
}

/** Détail d'un signal : chaque point du score est expliqué, aucun calcul n'est caché. */
export function SignalModal({
  coin,
  analysis,
  onClose,
}: {
  coin: CoinView
  analysis: Analysis
  onClose: () => void
}) {
  return (
    <Modal
      onClose={onClose}
      title={
        <>
          {coin.name} <span className="text-sm font-normal text-muted">{coin.symbol}</span>
        </>
      }
    >
      {analysis.status === 'insufficient' ? (
        <p className="mt-4 text-sm">
          Données insuffisantes : {analysis.closes} jour{analysis.closes > 1 ? 's' : ''}{' '}
          d’historique sur {analysis.needed} nécessaires. Le signal apparaîtra dès que l’historique
          sera complet.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          <section className="flex flex-col gap-1">
            <p>
              <SignalBadge level={analysis.level} />
            </p>
            <p className="text-sm text-muted">{SIGNAL_DESCRIPTIONS[analysis.level]}</p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Détail du score</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {analysis.contributions.map((c) => (
                <li key={c.key} className="flex justify-between gap-4">
                  <span>{c.reason}</span>
                  <span className="whitespace-nowrap font-medium">{pts(c.points)} pt</span>
                </li>
              ))}
              <li className="mt-1 flex justify-between gap-4 border-t border-line pt-2 font-semibold">
                <span>Score total : {SIGNAL_LABELS[analysis.level]}</span>
                <span className="whitespace-nowrap">{pts(analysis.score)}</span>
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Indicateurs</h3>
            {analysis.rsi !== null && (
              <div>
                <p className="mb-1 flex justify-between text-sm">
                  <span>RSI 14 jours</span>
                  <span className="font-medium">
                    {analysis.rsi.toLocaleString('fr-FR', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{' '}
                    · {rsiZone(analysis.rsi)}
                  </span>
                </p>
                <RsiBar rsi={analysis.rsi} />
              </div>
            )}
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted">MACD (12 / 26)</dt>
              <dd>{formatSigned(analysis.macd.macd)}</dd>
              <dt className="text-muted">Ligne de signal (9)</dt>
              <dd>
                {analysis.macd.signalLine === null ? '—' : formatSigned(analysis.macd.signalLine)}
              </dd>
              <dt className="text-muted">Histogramme</dt>
              <dd>
                {analysis.macd.histogram === null ? '—' : formatSigned(analysis.macd.histogram)}
              </dd>
            </dl>
          </section>

          <p className="text-xs text-muted">
            Calculé sur {analysis.closes} clôtures quotidiennes. La clôture du jour est le dernier
            prix relevé : le signal peut évoluer au fil de la journée.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <Help topic="rsi" />
        <Help topic="macd" />
        <Help topic="signal" />
      </div>
      <p className="mt-4 border-l-4 border-line pl-3 text-xs text-muted">{DISCLAIMER}</p>
    </Modal>
  )
}
