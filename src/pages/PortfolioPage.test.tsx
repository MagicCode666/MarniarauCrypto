import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoinView } from '../lib/market'
import type { Member, PortfolioInfo, Role, Transaction } from '../lib/portfolio'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../hooks/usePseudo', () => ({
  usePseudo: () => ({ pseudo: 'Nico', userId: 'u1', reload: vi.fn() }),
}))

const api = vi.hoisted(() => ({
  listPortfolios: vi.fn(),
  loadPortfolio: vi.fn(),
  loadTransactions: vi.fn(),
  loadMembers: vi.fn(),
  buyCoin: vi.fn(),
  sellCoin: vi.fn(),
  resetPortfolio: vi.fn(),
  createSharedPortfolio: vi.fn(),
  joinPortfolio: vi.fn(),
  createInvitation: vi.fn(),
  listInvitations: vi.fn(),
  revokeInvitation: vi.fn(),
  removeMember: vi.fn(),
  setMemberRole: vi.fn(),
  leavePortfolio: vi.fn(),
  archivePortfolio: vi.fn(),
  savePseudo: vi.fn(),
}))
vi.mock('../lib/portfolioApi', () => ({
  ...api,
  PAGE_SIZE: 50,
  errorMessage: (e: unknown) => (e as Error).message,
}))

import { PortfolioPage } from './PortfolioPage'

const coin = (id: string, name: string, symbol: string, price: number): CoinView => ({
  coinId: id,
  symbol,
  name,
  categories: [],
  priceEur: price,
  change24hPct: 0,
  marketCapEur: 1,
  volume24hEur: 1,
  updatedAt: new Date().toISOString(),
  recent: [],
})

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 1,
  userId: 'u1',
  coinId: 'bitcoin',
  side: 'buy',
  quantity: 0.0199,
  priceEur: 50000,
  feeEur: 5,
  totalEur: 1000,
  note: 'premier achat',
  createdAt: '2026-11-22T10:00:00Z',
  ...over,
})

const info = (over: Partial<PortfolioInfo> = {}): PortfolioInfo => ({
  id: 'pf1',
  name: 'Mon portefeuille',
  kind: 'personal',
  role: 'owner',
  initialCash: 10000,
  feeRate: 0.005,
  memberCount: 1,
  ...over,
})

const dataFor = (portfolio: PortfolioInfo, over = {}) => ({
  portfolio,
  cash: 9000,
  positions: [{ coinId: 'bitcoin', quantity: 0.0199, avgBuyPriceEur: 50000 }],
  ...over,
})

const members: Member[] = [
  { userId: 'u1', pseudo: 'Nico', role: 'owner' },
  { userId: 'u2', pseudo: 'Paul', role: 'editor' },
  { userId: 'u3', pseudo: 'Quentin', role: 'viewer' },
]

function renderPage() {
  const state = {
    status: 'ready' as const,
    market: {
      coins: [coin('bitcoin', 'Bitcoin', 'BTC', 50000), coin('ethereum', 'Ethereum', 'ETH', 2000)],
      updatedAt: new Date().toISOString(),
    },
  }
  return render(
    <MemoryRouter initialEntries={['/portefeuille']}>
      <Routes>
        <Route element={<Outlet context={state} />}>
          <Route path="portefeuille" element={<PortfolioPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

/** Configure la base simulée : la liste des portefeuilles et les données de chacun. */
function setup(list: PortfolioInfo[] = [info()], opts: { transactions?: Transaction[] } = {}) {
  api.listPortfolios.mockResolvedValue(list)
  api.loadPortfolio.mockImplementation((p: PortfolioInfo) => Promise.resolve(dataFor(p)))
  api.loadTransactions.mockResolvedValue(opts.transactions ?? [tx()])
  api.loadMembers.mockResolvedValue(members)
  api.listInvitations.mockResolvedValue([])
}

const sharedAs = (role: Role, over: Partial<PortfolioInfo> = {}) =>
  info({ id: 'pf2', name: 'Famille', kind: 'shared', role, memberCount: 3, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  setup()
})

describe('PortfolioPage : affichage', () => {
  it('montre la valeur, le cash, la performance avec symbole, les positions et les transactions', async () => {
    renderPage()
    expect(await screen.findByText(/9\s995,00\s€/)).toBeTruthy() // 9 000 cash + 995 de bitcoin
    expect(screen.getByText(/9\s000,00\s€/)).toBeTruthy()
    // performance : −5 € (les frais), avec le symbole ▼ et pas seulement une couleur
    expect(screen.getAllByText(/▼ −5,00\s€/).length).toBeGreaterThan(0)
    expect(screen.getByText(/outil éducatif/)).toBeTruthy()
    const positions = screen.getByRole('heading', { name: 'Positions' }).closest('section')!
    expect(within(positions).getByText('Bitcoin')).toBeTruthy()
    const transactions = screen.getByRole('heading', { name: 'Transactions' }).closest('section')!
    expect(within(transactions).getByText('Achat')).toBeTruthy()
    expect(within(transactions).getByText('premier achat')).toBeTruthy()
    expect(screen.getByText(/Frais simulés de 0,5\s%/)).toBeTruthy()
  })

  it('invite à acheter quand il n’y a aucune position', async () => {
    api.loadPortfolio.mockResolvedValue(dataFor(info(), { cash: 10000, positions: [] }))
    api.loadTransactions.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(/Aucune position/)).toBeTruthy()
    expect(screen.getByText(/Aucune transaction/)).toBeTruthy()
  })

  it('prévient quand le portefeuille ne peut pas être chargé', async () => {
    api.listPortfolios.mockRejectedValue(new Error('réseau'))
    renderPage()
    expect(await screen.findByText(/Impossible d’actualiser le portefeuille/)).toBeTruthy()
  })

  it('un portefeuille personnel n’affiche ni membres ni colonne « Par »', async () => {
    renderPage()
    await screen.findByText(/9\s995,00\s€/)
    expect(screen.queryByRole('button', { name: /Membres/ })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Par' })).toBeNull()
  })
})

describe('PortfolioPage : achat', () => {
  async function openBuy() {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Acheter' }))
    return screen.getByRole('dialog')
  }

  it('estime la quantité et les frais, puis achète au clic et recharge le portefeuille', async () => {
    api.buyCoin.mockResolvedValue(tx({ id: 2, quantity: 0.00199, totalEur: 100, feeEur: 0.5 }))
    const dialog = await openBuy()
    fireEvent.change(within(dialog).getByLabelText(/Montant/), { target: { value: '100' } })
    expect(within(dialog).getByText(/Quantité estimée : 0,00199 BTC/)).toBeTruthy()
    expect(within(dialog).getByText(/Frais : 0,50\s€ \(0,5\s%\)/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer l’achat' }))
    await waitFor(() => expect(api.buyCoin).toHaveBeenCalledWith('pf1', 'bitcoin', 100, ''))
    expect(await screen.findByText(/effectué/)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.loadPortfolio).toHaveBeenCalledTimes(2) // rechargé après l'achat
  })

  it('accepte la virgule décimale et transmet la note', async () => {
    api.buyCoin.mockResolvedValue(tx())
    const dialog = await openBuy()
    fireEvent.change(within(dialog).getByLabelText(/Montant/), { target: { value: '12,5' } })
    fireEvent.change(within(dialog).getByLabelText(/Note/), { target: { value: 'test' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer l’achat' }))
    await waitFor(() => expect(api.buyCoin).toHaveBeenCalledWith('pf1', 'bitcoin', 12.5, 'test'))
  })

  it('bloque un montant supérieur au cash, sans appeler la base', async () => {
    const dialog = await openBuy()
    fireEvent.change(within(dialog).getByLabelText(/Montant/), { target: { value: '9000,01' } })
    expect(within(dialog).getByText(/Solde insuffisant/)).toBeTruthy()
    const confirm = within(dialog).getByRole('button', { name: 'Confirmer l’achat' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    expect(api.buyCoin).not.toHaveBeenCalled()
  })

  it('refuse un montant invalide', async () => {
    const dialog = await openBuy()
    fireEvent.change(within(dialog).getByLabelText(/Montant/), { target: { value: '10,001' } })
    expect(within(dialog).getByText(/Montant invalide/)).toBeTruthy()
    expect(
      (within(dialog).getByRole('button', { name: 'Confirmer l’achat' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('« Tout le cash » remplit le montant disponible', async () => {
    const dialog = await openBuy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tout le cash' }))
    expect((within(dialog).getByLabelText(/Montant/) as HTMLInputElement).value).toBe('9000.00')
  })

  it('affiche l’erreur de la base (prix trop ancien) et garde la fenêtre ouverte', async () => {
    api.buyCoin.mockRejectedValue(
      new Error('Prix trop ancien pour acheter, réessaie dans quelques minutes'),
    )
    const dialog = await openBuy()
    fireEvent.change(within(dialog).getByLabelText(/Montant/), { target: { value: '100' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer l’achat' }))
    expect(await within(dialog).findByRole('alert')).toBeTruthy()
    expect(within(dialog).getByText(/Prix trop ancien/)).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(api.loadPortfolio).toHaveBeenCalledTimes(1) // pas de rechargement après un échec
  })
})

describe('PortfolioPage : vente', () => {
  async function openSell() {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Vendre Bitcoin' }))
    return screen.getByRole('dialog')
  }

  it('« Tout vendre » remplit la quantité détenue et estime le net après frais', async () => {
    api.sellCoin.mockResolvedValue(tx({ side: 'sell' }))
    const dialog = await openSell()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tout vendre' }))
    expect((within(dialog).getByLabelText(/Quantité à vendre/) as HTMLInputElement).value).toBe(
      '0.0199',
    )
    // 0,0199 × 50 000 = 995,00 € ; frais 0,5 % = 4,98 € (4,975 arrondi) ; net 990,02 €
    expect(within(dialog).getByText(/990,02\s€/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer la vente' }))
    await waitFor(() => expect(api.sellCoin).toHaveBeenCalledWith('pf1', 'bitcoin', 0.0199, ''))
    await screen.findByText(/effectué/)
    expect(api.loadPortfolio).toHaveBeenCalledTimes(2)
  })

  it('bloque une quantité supérieure à celle détenue', async () => {
    const dialog = await openSell()
    fireEvent.change(within(dialog).getByLabelText(/Quantité à vendre/), {
      target: { value: '0,02' },
    })
    expect(within(dialog).getByText(/Quantité insuffisante/)).toBeTruthy()
    expect(
      (within(dialog).getByRole('button', { name: 'Confirmer la vente' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(api.sellCoin).not.toHaveBeenCalled()
  })

  it('affiche l’erreur de la base à la vente', async () => {
    api.sellCoin.mockRejectedValue(new Error('Quantité insuffisante en portefeuille'))
    const dialog = await openSell()
    fireEvent.change(within(dialog).getByLabelText(/Quantité à vendre/), {
      target: { value: '0,01' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer la vente' }))
    expect(await within(dialog).findByText('Quantité insuffisante en portefeuille')).toBeTruthy()
  })
})

describe('PortfolioPage : remise à zéro', () => {
  it('explique l’archivage, puis archive et recharge', async () => {
    api.resetPortfolio.mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Remise à zéro' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/archivé/)).toBeTruthy()
    expect(within(dialog).getByText(/10\s000,00\s€/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archiver et recommencer' }))
    await waitFor(() => expect(api.resetPortfolio).toHaveBeenCalledWith('pf1'))
    expect(await screen.findByText(/Portefeuille archivé/)).toBeTruthy()
    expect(api.loadPortfolio).toHaveBeenCalledTimes(2)
  })

  it('« Annuler » ne remet rien à zéro', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Remise à zéro' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.resetPortfolio).not.toHaveBeenCalled()
  })
})

describe('PortfolioPage : portefeuilles partagés', () => {
  it('propose de changer de portefeuille et recharge celui choisi', async () => {
    setup([info(), sharedAs('owner')])
    renderPage()
    const select = (await screen.findByLabelText('Portefeuille')) as HTMLSelectElement
    expect(within(select).getByRole('option', { name: 'Famille · partagé' })).toBeTruthy()
    fireEvent.change(select, { target: { value: 'pf2' } })
    await waitFor(() =>
      expect(api.loadPortfolio).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'pf2' })),
    )
    expect(await screen.findByText('Propriétaire')).toBeTruthy()
    expect(localStorage.getItem('marniarau:portfolio')).toBe('pf2')
  })

  it('reprend le dernier portefeuille consulté, sinon le premier', async () => {
    setup([info(), sharedAs('editor')])
    localStorage.setItem('marniarau:portfolio', 'pf2')
    renderPage()
    expect(await screen.findByText('Éditeur')).toBeTruthy()
    expect(api.loadPortfolio).toHaveBeenCalledWith(expect.objectContaining({ id: 'pf2' }))
  })

  it('ignore un portefeuille mémorisé qui n’existe plus', async () => {
    setup([info()])
    localStorage.setItem('marniarau:portfolio', 'disparu')
    renderPage()
    await screen.findByText(/9\s995,00\s€/)
    expect(api.loadPortfolio).toHaveBeenCalledWith(expect.objectContaining({ id: 'pf1' }))
  })

  it('propriétaire : membres, invitation, colonne « Par » avec pseudos et ancien membre', async () => {
    setup([sharedAs('owner')], {
      transactions: [tx({ id: 3, userId: 'u2' }), tx({ id: 2, userId: 'parti' }), tx({ id: 1 })],
    })
    renderPage()
    expect(await screen.findByRole('button', { name: 'Membres (3)' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Inviter' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('columnheader', { name: 'Par' })).toBeTruthy()
    const transactions = screen.getByRole('heading', { name: 'Transactions' }).closest('section')!
    expect(within(transactions).getByText('Paul')).toBeTruthy()
    expect(within(transactions).getByText('Ancien membre')).toBeTruthy()
    expect(within(transactions).getByText('Nico')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remise à zéro' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Acheter' })).toBeTruthy()
  })

  it('éditeur : peut acheter et vendre, mais ni remettre à zéro ni inviter', async () => {
    setup([sharedAs('editor')])
    renderPage()
    expect(await screen.findByRole('button', { name: 'Acheter' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Vendre Bitcoin' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remise à zéro' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Inviter' })).toBeNull()
  })

  it('lecteur : consulte seulement, aucun bouton d’achat, de vente ni de remise à zéro', async () => {
    setup([sharedAs('viewer')])
    renderPage()
    expect(await screen.findByText(/Lecture seule/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Acheter' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Vendre Bitcoin' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remise à zéro' })).toBeNull()
    expect(screen.getByText('Lecteur')).toBeTruthy()
  })

  it('crée un portefeuille partagé, rappelle le pseudo, puis le sélectionne', async () => {
    api.createSharedPortfolio.mockResolvedValue('pf9')
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau portefeuille partagé' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/« Nico »/)).toBeTruthy()
    fireEvent.change(within(dialog).getByLabelText(/Nom du portefeuille/), {
      target: { value: '  Famille  ' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Créer' }))
    await waitFor(() => expect(api.createSharedPortfolio).toHaveBeenCalledWith('Famille'))
    expect(await screen.findByText(/Portefeuille partagé créé/)).toBeTruthy()
    expect(api.listPortfolios).toHaveBeenCalledTimes(2)
  })

  it('refuse un nom vide à la création', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau portefeuille partagé' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Nom du portefeuille/), {
      target: { value: '   ' },
    })
    expect(
      (within(dialog).getByRole('button', { name: 'Créer' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(api.createSharedPortfolio).not.toHaveBeenCalled()
  })

  it('rejoint avec un code, rappelle le pseudo et affiche le message générique en cas d’échec', async () => {
    api.joinPortfolio.mockRejectedValueOnce(new Error('Code invalide ou expiré'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Rejoindre avec un code' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/« Nico »/)).toBeTruthy()
    fireEvent.change(within(dialog).getByLabelText(/Code d’invitation/), {
      target: { value: ' abc123 ' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rejoindre' }))
    expect(await within(dialog).findByText('Code invalide ou expiré')).toBeTruthy()
    expect(api.joinPortfolio).toHaveBeenCalledWith('abc123')

    api.joinPortfolio.mockResolvedValueOnce('pf2')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rejoindre' }))
    expect(await screen.findByText(/Tu as rejoint le portefeuille partagé/)).toBeTruthy()
    expect(api.listPortfolios).toHaveBeenCalledTimes(2)
  })

  it('« Modifier » dans le rappel ouvre la fenêtre du pseudo', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Rejoindre avec un code' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Modifier' }))
    expect(screen.getByRole('dialog', { name: 'Mon pseudo' })).toBeTruthy()
  })
})
