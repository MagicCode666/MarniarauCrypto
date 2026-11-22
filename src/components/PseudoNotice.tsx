/** Rappel avant de partager : les membres verront ce pseudo. */
export function PseudoNotice({ pseudo, onEdit }: { pseudo: string | null; onEdit: () => void }) {
  if (pseudo === null) return null
  return (
    <p className="rounded border border-line bg-bg p-2 text-sm text-muted">
      Les membres verront ton pseudo : <strong className="text-text">« {pseudo} »</strong>.{' '}
      <button type="button" onClick={onEdit} className="text-accent underline">
        Modifier
      </button>
    </p>
  )
}
