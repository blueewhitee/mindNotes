export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      notes: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string | null
          summary: string | null
          is_archived: boolean
          created_at: string
          updated_at: string
          image_url: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          title?: string
          content?: string | null
          summary?: string | null
          is_archived?: boolean
          created_at?: string
          updated_at?: string
          image_url?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string | null
          summary?: string | null
          is_archived?: boolean
          created_at?: string
          updated_at?: string
          image_url?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Note = Database["public"]["Tables"]["notes"]["Row"]
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
