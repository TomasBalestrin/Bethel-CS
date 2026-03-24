export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'especialista'
export type KanbanType = 'initial' | 'mentorship'
export type AttachmentType = 'photo' | 'video'
export type TestimonialCategory =
  | 'aumento_faturamento'
  | 'vida_pessoal'
  | 'vida_espiritual'
  | 'contratacao'
  | 'expansao_negocio'
  | 'atendimento'
  | 'intensivo'
  | 'encontro_elite_premium'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: UserRole
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role: UserRole
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: UserRole
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kanban_stages: {
        Row: {
          id: string
          type: KanbanType
          name: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          type: KanbanType
          name: string
          position: number
          created_at?: string
        }
        Update: {
          type?: KanbanType
          name?: string
          position?: number
        }
        Relationships: []
      }
      mentees: {
        Row: {
          id: string
          full_name: string
          cpf: string | null
          birth_date: string | null
          phone: string
          email: string | null
          instagram: string | null
          city: string | null
          state: string | null
          product_name: string
          start_date: string
          end_date: string | null
          priority_level: number
          seller_name: string | null
          funnel_origin: string | null
          has_partner: boolean
          partner_name: string | null
          referred_by_mentee_id: string | null
          current_stage_id: string | null
          kanban_type: KanbanType
          action_plan_token: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          cpf?: string | null
          birth_date?: string | null
          phone: string
          email?: string | null
          instagram?: string | null
          city?: string | null
          state?: string | null
          product_name: string
          start_date: string
          end_date?: string | null
          priority_level?: number
          seller_name?: string | null
          funnel_origin?: string | null
          has_partner?: boolean
          partner_name?: string | null
          referred_by_mentee_id?: string | null
          current_stage_id?: string | null
          kanban_type?: KanbanType
          action_plan_token?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string
          cpf?: string | null
          birth_date?: string | null
          phone?: string
          email?: string | null
          instagram?: string | null
          city?: string | null
          state?: string | null
          product_name?: string
          start_date?: string
          end_date?: string | null
          priority_level?: number
          seller_name?: string | null
          funnel_origin?: string | null
          has_partner?: boolean
          partner_name?: string | null
          referred_by_mentee_id?: string | null
          current_stage_id?: string | null
          kanban_type?: KanbanType
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      attendances: {
        Row: {
          id: string
          mentee_id: string
          specialist_id: string
          notes: string | null
          attended_at: string
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          specialist_id: string
          notes?: string | null
          attended_at?: string
          created_at?: string
        }
        Update: {
          mentee_id?: string
          specialist_id?: string
          notes?: string | null
          attended_at?: string
        }
        Relationships: []
      }
      action_plans: {
        Row: {
          id: string
          mentee_id: string
          data: Json
          submitted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          data?: Json
          submitted_at?: string | null
          created_at?: string
        }
        Update: {
          mentee_id?: string
          data?: Json
          submitted_at?: string | null
        }
        Relationships: []
      }
      indications: {
        Row: {
          id: string
          mentee_id: string
          indicated_name: string
          indicated_phone: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          indicated_name: string
          indicated_phone: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          mentee_id?: string
          indicated_name?: string
          indicated_phone?: string
          notes?: string | null
        }
        Relationships: []
      }
      intensivo_records: {
        Row: {
          id: string
          mentee_id: string
          participated: boolean
          participation_date: string | null
          indication_name: string | null
          indication_phone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          participated?: boolean
          participation_date?: string | null
          indication_name?: string | null
          indication_phone?: string | null
          created_at?: string
        }
        Update: {
          mentee_id?: string
          participated?: boolean
          participation_date?: string | null
          indication_name?: string | null
          indication_phone?: string | null
        }
        Relationships: []
      }
      revenue_records: {
        Row: {
          id: string
          mentee_id: string
          product_name: string
          sale_value: number
          entry_value: number
          registered_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          product_name: string
          sale_value: number
          entry_value: number
          registered_by?: string | null
          created_at?: string
        }
        Update: {
          mentee_id?: string
          product_name?: string
          sale_value?: number
          entry_value?: number
          registered_by?: string | null
        }
        Relationships: []
      }
      objectives: {
        Row: {
          id: string
          mentee_id: string
          title: string
          description: string | null
          achieved_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          title: string
          description?: string | null
          achieved_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          mentee_id?: string
          title?: string
          description?: string | null
          achieved_at?: string | null
          created_by?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          id: string
          mentee_id: string
          testimonial_date: string
          description: string
          attachment_url: string | null
          attachment_type: AttachmentType | null
          niche: string | null
          revenue_range: string | null
          employee_count: string | null
          categories: TestimonialCategory[]
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          testimonial_date: string
          description: string
          attachment_url?: string | null
          attachment_type?: AttachmentType | null
          niche?: string | null
          revenue_range?: string | null
          employee_count?: string | null
          categories?: TestimonialCategory[]
          created_by?: string | null
          created_at?: string
        }
        Update: {
          mentee_id?: string
          testimonial_date?: string
          description?: string
          attachment_url?: string | null
          attachment_type?: AttachmentType | null
          niche?: string | null
          revenue_range?: string | null
          employee_count?: string | null
          categories?: TestimonialCategory[]
          created_by?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
