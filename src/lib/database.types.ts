// Types de la base. À régénérer avec `npx supabase gen types typescript --linked --schema public`
// une fois les migrations appliquées ; écrits à la main en attendant.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; pseudo: string; created_at: string }
        Insert: { id: string; pseudo?: string; created_at?: string }
        Update: { pseudo?: string }
        Relationships: []
      }
      coins: {
        Row: {
          coin_id: string
          symbol: string
          name: string
          categories: string[]
          active: boolean
          history_loaded_at: string | null
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      prices: {
        Row: {
          coin_id: string
          price_eur: number
          change_24h_pct: number | null
          market_cap_eur: number | null
          volume_24h_eur: number | null
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      price_history: {
        Row: { coin_id: string; day: string; close_eur: number }
        Insert: never
        Update: never
        Relationships: []
      }
      portfolios: {
        Row: {
          id: string
          name: string
          kind: 'personal' | 'shared'
          initial_cash: number
          fee_rate: number
          created_at: string
          archived_at: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      portfolio_members: {
        Row: { portfolio_id: string; user_id: string; role: 'owner' | 'editor' | 'viewer' }
        Insert: never
        Update: never
        Relationships: []
      }
      portfolio_invitations: {
        Row: {
          id: string
          portfolio_id: string
          role: 'editor' | 'viewer'
          created_at: string
          expires_at: string
          used_at: string | null
          revoked_at: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      transactions: {
        Row: {
          id: number
          portfolio_id: string
          user_id: string | null
          side: 'buy' | 'sell'
          coin_id: string
          quantity: number
          price_eur: number
          fee_eur: number
          total_eur: number
          note: string | null
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      portfolio_cash: { Args: { p_portfolio: string }; Returns: number }
      portfolio_positions: {
        Args: { p_portfolio: string }
        Returns: { coin_id: string; quantity: number; avg_buy_price_eur: number }[]
      }
      buy_coin: {
        Args: { p_portfolio: string; p_coin: string; p_eur: number; p_note?: string }
        Returns: Database['public']['Tables']['transactions']['Row']
      }
      sell_coin: {
        Args: { p_portfolio: string; p_coin: string; p_quantity: number; p_note?: string }
        Returns: Database['public']['Tables']['transactions']['Row']
      }
      reset_portfolio: { Args: { p_portfolio: string }; Returns: string }
      my_portfolios: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          kind: 'personal' | 'shared'
          role: 'owner' | 'editor' | 'viewer'
          initial_cash: number
          fee_rate: number
          member_count: number
        }[]
      }
      list_members: {
        Args: { p_portfolio: string }
        Returns: { user_id: string; pseudo: string; role: 'owner' | 'editor' | 'viewer' }[]
      }
      create_shared_portfolio: { Args: { p_name: string }; Returns: string }
      create_invitation: {
        Args: { p_portfolio: string; p_role: string; p_days?: number }
        Returns: string
      }
      revoke_invitation: { Args: { p_invitation: string }; Returns: undefined }
      join_portfolio: { Args: { p_token: string }; Returns: string }
      remove_member: { Args: { p_portfolio: string; p_user: string }; Returns: undefined }
      set_member_role: {
        Args: { p_portfolio: string; p_user: string; p_role: string }
        Returns: undefined
      }
      leave_portfolio: { Args: { p_portfolio: string }; Returns: undefined }
      archive_portfolio: { Args: { p_portfolio: string }; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
