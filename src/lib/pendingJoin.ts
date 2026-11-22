// Un lien d'invitation ouvert par quelqu'un qui n'est pas encore connecté : on garde le code le
// temps de la connexion (session du navigateur seulement), puis on le propose à l'utilisateur.
const KEY = 'marniarau:join-code'

export function rememberJoinCode(code: string): void {
  try {
    sessionStorage.setItem(KEY, code)
  } catch {
    // stockage indisponible : le code reste dans l'adresse
  }
}

export function pendingJoinCode(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearJoinCode(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // rien à effacer
  }
}
