import { useEffect, useState } from 'react'

/** Heure courante, rafraîchie à intervalle régulier (pour afficher une ancienneté qui avance). */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}
