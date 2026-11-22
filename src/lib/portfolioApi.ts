import { supabase } from './supabase'
import type { PortfolioInfo, Position, Transaction } from './portfolio'

export const PAGE_SIZE = 50

export type PortfolioData = { portfolio: PortfolioInfo; cash: number; positions: Position[] }

type TransactionRow = {
  id: number
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

/** Portefeuille personnel actif, avec son cash et ses positions (calculés côté serveur). */
export async function loadPortfolio(): Promise<PortfolioData | null> {
  const { data: rows, error } = await supabase
    .from('portfolios')
    .select('id,name,initial_cash,fee_rate')
    .eq('kind', 'personal')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const row = rows[0]
  if (!row) return null

  const [cash, positions] = await Promise.all([
    supabase.rpc('portfolio_cash', { p_portfolio: row.id }),
    supabase.rpc('portfolio_positions', { p_portfolio: row.id }),
  ])
  if (cash.error) throw cash.error
  if (positions.error) throw positions.error
  return {
    portfolio: {
      id: row.id,
      name: row.name,
      initialCash: Number(row.initial_cash),
      feeRate: Number(row.fee_rate),
    },
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
    .select('id,coin_id,side,quantity,price_eur,fee_eur,total_eur,note,created_at')
    .eq('portfolio_id', portfolioId)
    .order('id', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  if (error) throw error
  return data.map(toTransaction)
}

/** Les messages d'erreur de la base sont déjà en français et destinés à l'utilisateur. */
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string')
    return e.message
  return 'Une erreur est survenue, réessaie.'
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
