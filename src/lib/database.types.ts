// Types de la base. À régénérer avec `npx supabase gen types typescript --remote --schema public`
// une fois le projet Supabase lié ; écrits à la main en attendant.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; pseudo: string; created_at: string }
        Insert: { id: string; pseudo?: string; created_at?: string }
        Update: { pseudo?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
