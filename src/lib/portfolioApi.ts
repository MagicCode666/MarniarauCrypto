import { supabase } from './supabase'
import type { Invitation, Member, PortfolioInfo, Position, Transaction } from './portfolio'

export const PAGE_SIZE = 50

export type PortfolioData = { portfolio: PortfolioInfo; cash: number; positions: Position[] }

type TransactionRow = {
  id: number
  user_id: string | null
  coin_id: string
  side: 'buy' | 'sell'
  quantity: number
  price_eur: number
  fee_eur: number
  total_eur: number
  note: string | null
  created_at: string
}

export function toTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    userId: r.user_id,
    coinId: r.coin_id,
    side: r.side,
    quantity: Number(r.quantity),
    priceEur: Number(r.price_eur),
    feeEur: Number(r.fee_eur),
    totalEur: Number(r.total_eur),
    note: r.note,
    createdAt: r.created_at,
  }
}

/** Les messages d'erreur de la base sont déjà en français et destinés à l'utilisateur. */
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string')
    return e.message
  return 'Une erreur est survenue, réessaie.'
}

/** Portefeuilles actifs de l'utilisateur : le personnel d'abord, puis les partagés. */
export async function listPortfolios(): Promise<PortfolioInfo[]> {
  const { data, error } = await supabase.rpc('my_portfolios')
  if (error) throw error
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    role: p.role,
    initialCash: Number(p.initial_cash),
    feeRate: Number(p.fee_rate),
    memberCount: Number(p.member_count),
  }))
}

/** Cash et positions d'un portefeuille (calculés côté serveur depuis les transactions). */
export async function loadPortfolio(portfolio: PortfolioInfo): Promise<PortfolioData> {
  const [cash, positions] = await Promise.all([
    supabase.rpc('portfolio_cash', { p_portfolio: portfolio.id }),
    supabase.rpc('portfolio_positions', { p_portfolio: portfolio.id }),
  ])
  if (cash.error) throw cash.error
  if (positions.error) throw positions.error
  return {
    portfolio,
    cash: Number(cash.data),
    positions: positions.data.map((p) => ({
      coinId: p.coin_id,
      quantity: Number(p.quantity),
      avgBuyPriceEur: Number(p.avg_buy_price_eur),
    })),
  }
}

/** Transactions, de la plus récente à la plus ancienne, par pages. */
export async function loadTransactions(portfolioId: string, page: number): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id,user_id,coin_id,side,quantity,price_eur,fee_eur,total_eur,note,created_at')
    .eq('portfolio_id', portfolioId)
    .order('id', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  if (error) throw error
  return data.map(toTransaction)
}

export async function buyCoin(
  portfolioId: string,
  coinId: string,
  eur: number,
  note: string,
): Promise<Transaction> {
  const { data, error } = await supabase.rpc('buy_coin', {
    p_portfolio: portfolioId,
    p_coin: coinId,
    p_eur: eur,
    p_note: note || undefined,
  })
  if (error) throw error
  return toTransaction(data)
}

export async function sellCoin(
  portfolioId: string,
  coinId: string,
  quantity: number,
  note: string,
): Promise<Transaction> {
  const { data, error } = await supabase.rpc('sell_coin', {
    p_portfolio: portfolioId,
    p_coin: coinId,
    p_quantity: quantity,
    p_note: note || undefined,
  })
  if (error) throw error
  return toTransaction(data)
}

export async function resetPortfolio(portfolioId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_portfolio', { p_portfolio: portfolioId })
  if (error) throw error
}

// --- Partage -------------------------------------------------------------------------------

export async function loadMembers(portfolioId: string): Promise<Member[]> {
  const { data, error } = await supabase.rpc('list_members', { p_portfolio: portfolioId })
  if (error) throw error
  return data.map((m) => ({ userId: m.user_id, pseudo: m.pseudo, role: m.role }))
}

export async function createSharedPortfolio(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_shared_portfolio', { p_name: name })
  if (error) throw error
  return data
}

/** Renvoie le code en clair : c'est la seule fois où il est disponible. */
export async function createInvitation(
  portfolioId: string,
  role: 'editor' | 'viewer',
  days: number,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_invitation', {
    p_portfolio: portfolioId,
    p_role: role,
    p_days: days,
  })
  if (error) throw error
  return data
}

export async function listInvitations(portfolioId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('portfolio_invitations')
    .select('id,role,created_at,expires_at,used_at,revoked_at')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((i) => ({
    id: i.id,
    role: i.role,
    createdAt: i.created_at,
    expiresAt: i.expires_at,
    usedAt: i.used_at,
    revokedAt: i.revoked_at,
  }))
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_invitation', { p_invitation: invitationId })
  if (error) throw error
}

/** Rejoint un portefeuille avec un code ; renvoie l'identifiant du portefeuille. */
export async function joinPortfolio(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_portfolio', { p_token: token })
  if (error) throw error
  return data
}

export async function removeMember(portfolioId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', {
    p_portfolio: portfolioId,
    p_user: userId,
  })
  if (error) throw error
}

export async function setMemberRole(
  portfolioId: string,
  userId: string,
  role: 'editor' | 'viewer',
): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', {
    p_portfolio: portfolioId,
    p_user: userId,
    p_role: role,
  })
  if (error) throw error
}

export async function leavePortfolio(portfolioId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_portfolio', { p_portfolio: portfolioId })
  if (error) throw error
}

export async function archivePortfolio(portfolioId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_portfolio', { p_portfolio: portfolioId })
  if (error) throw error
}

// --- Pseudo --------------------------------------------------------------------------------

export async function loadPseudo(userId: string): Promise<string> {
  const { data, error } = await supabase.from('profiles').select('pseudo').eq('id', userId).single()
  if (error) throw error
  return data.pseudo
}

export async function savePseudo(userId: string, pseudo: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ pseudo }).eq('id', userId)
  if (error) throw error
}
