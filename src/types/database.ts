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
export type EngagementType = 'aula' | 'live' | 'evento' | 'whatsapp_contato'
export type CsActivityType = 'ligacao' | 'whatsapp'
export type CallType = 'ligacao' | 'whatsapp'
export type MenteeStatus = 'ativo' | 'cancelado' | 'concluido'
export type RevenueType = 'crossell' | 'upsell' | 'indicacao_perpetuo' | 'indicacao_intensivo' | 'indicacao_encontro'
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
          wpp_phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role: UserRole
          avatar_url?: string | null
          wpp_phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: UserRole
          avatar_url?: string | null
          wpp_phone?: string | null
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
          chat_token: string
          call_token: string
          stream_channel_id: string | null
          cliente_fit: boolean
          status: MenteeStatus
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
          chat_token?: string
          call_token?: string
          stream_channel_id?: string | null
          cliente_fit?: boolean
          status?: MenteeStatus
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
          chat_token?: string
          stream_channel_id?: string | null
          cliente_fit?: boolean
          status?: MenteeStatus
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_metrics: {
        Row: {
          id: string
          mentee_id: string
          specialist_id: string | null
          date: string
          messages_from_mentee: number
          messages_from_specialist: number
          first_response_minutes: number | null
          avg_response_minutes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          specialist_id?: string | null
          date: string
          messages_from_mentee?: number
          messages_from_specialist?: number
          first_response_minutes?: number | null
          avg_response_minutes?: number | null
          created_at?: string
        }
        Update: {
          mentee_id?: string
          specialist_id?: string | null
          date?: string
          messages_from_mentee?: number
          messages_from_specialist?: number
          first_response_minutes?: number | null
          avg_response_minutes?: number | null
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
          revenue_type: RevenueType
          registered_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          product_name: string
          sale_value: number
          entry_value: number
          revenue_type?: RevenueType
          registered_by?: string | null
          created_at?: string
        }
        Update: {
          mentee_id?: string
          product_name?: string
          sale_value?: number
          entry_value?: number
          revenue_type?: RevenueType
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
      engagement_records: {
        Row: {
          id: string
          mentee_id: string
          specialist_id: string | null
          type: EngagementType
          value: number
          notes: string | null
          recorded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          specialist_id?: string | null
          type: EngagementType
          value: number
          notes?: string | null
          recorded_at: string
          created_at?: string
        }
        Update: {
          mentee_id?: string
          specialist_id?: string | null
          type?: EngagementType
          value?: number
          notes?: string | null
          recorded_at?: string
        }
        Relationships: []
      }
      cs_activities: {
        Row: {
          id: string
          mentee_id: string
          specialist_id: string | null
          type: CsActivityType
          duration_minutes: number
          notes: string | null
          activity_date: string
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          specialist_id?: string | null
          type: CsActivityType
          duration_minutes: number
          notes?: string | null
          activity_date: string
          created_at?: string
        }
        Update: {
          mentee_id?: string
          specialist_id?: string | null
          type?: CsActivityType
          duration_minutes?: number
          notes?: string | null
          activity_date?: string
        }
        Relationships: []
      }
      cancellations: {
        Row: {
          id: string
          mentee_id: string
          reason: string
          cancelled_at: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          reason: string
          cancelled_at: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          mentee_id?: string
          reason?: string
          cancelled_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string | null
          mentee_id: string | null
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          mentee_id?: string | null
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string | null
          mentee_id?: string | null
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      call_records: {
        Row: {
          id: string
          mentee_id: string
          specialist_id: string
          daily_room_name: string
          daily_room_url: string
          started_at: string | null
          ended_at: string | null
          duration_seconds: number | null
          recording_url: string | null
          recording_status: 'pending' | 'processing' | 'ready' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          specialist_id: string
          daily_room_name: string
          daily_room_url: string
          started_at?: string | null
          ended_at?: string | null
          duration_seconds?: number | null
          recording_url?: string | null
          recording_status?: 'pending' | 'processing' | 'ready' | 'failed'
          created_at?: string
        }
        Update: {
          mentee_id?: string
          specialist_id?: string
          daily_room_name?: string
          daily_room_url?: string
          started_at?: string | null
          ended_at?: string | null
          duration_seconds?: number | null
          recording_url?: string | null
          recording_status?: 'pending' | 'processing' | 'ready' | 'failed'
        }
        Relationships: []
      }
      wpp_instances: {
        Row: {
          id: string
          specialist_id: string
          instance_id: string
          phone_number: string | null
          status: 'connected' | 'disconnected' | 'connecting'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          specialist_id: string
          instance_id: string
          phone_number?: string | null
          status?: 'connected' | 'disconnected' | 'connecting'
          created_at?: string
          updated_at?: string
        }
        Update: {
          specialist_id?: string
          instance_id?: string
          phone_number?: string | null
          status?: 'connected' | 'disconnected' | 'connecting'
          updated_at?: string
        }
        Relationships: []
      }
      wpp_messages: {
        Row: {
          id: string
          mentee_id: string
          specialist_id: string
          instance_id: string
          message_id: string | null
          direction: 'incoming' | 'outgoing'
          message_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'sticker'
          content: string | null
          media_url: string | null
          sender_name: string | null
          is_read: boolean
          sent_at: string
          created_at: string
        }
        Insert: {
          id?: string
          mentee_id: string
          specialist_id: string
          instance_id: string
          message_id?: string | null
          direction: 'incoming' | 'outgoing'
          message_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'sticker'
          content?: string | null
          media_url?: string | null
          sender_name?: string | null
          is_read?: boolean
          sent_at: string
          created_at?: string
        }
        Update: {
          mentee_id?: string
          specialist_id?: string
          instance_id?: string
          message_id?: string | null
          direction?: 'incoming' | 'outgoing'
          message_type?: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'sticker'
          content?: string | null
          media_url?: string | null
          sender_name?: string | null
          is_read?: boolean
          sent_at?: string
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
