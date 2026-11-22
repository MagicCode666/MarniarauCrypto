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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
