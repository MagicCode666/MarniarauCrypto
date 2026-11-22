/** Jauge du RSI de 0 à 100 avec les seuils 30 et 70. La valeur et la zone sont écrites ailleurs. */
export function RsiBar({ rsi }: { rsi: number }) {
  const pct = Math.min(Math.max(rsi, 0), 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-2 rounded-full bg-bg">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        <span className="absolute inset-y-0 left-[30%] w-px bg-muted" aria-hidden="true" />
        <span className="absolute inset-y-0 left-[70%] w-px bg-muted" aria-hidden="true" />
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>Survendu (&lt; 30)</span>
        <span>Suracheté (&gt; 70)</span>
      </div>
    </div>
  )
}
