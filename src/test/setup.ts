import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sans réglage global, Testing Library ne démonte pas le rendu entre deux tests
afterEach(cleanup)

// jsdom n'implémente pas matchMedia, que le thème de l'application interroge.
// Valeur par défaut : appareil en mode sombre, sans changement en cours de test.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}
