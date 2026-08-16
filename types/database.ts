export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_action_tokens: {
        Row: {
          appointment_id: string
          created_at: string
          expires_at: string
          id: string
          purpose: Database["public"]["Enums"]["appointment_token_purpose"]
          salon_id: string
          used_at: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          expires_at: string
          id?: string
          purpose: Database["public"]["Enums"]["appointment_token_purpose"]
          salon_id: string
          used_at?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: Database["public"]["Enums"]["appointment_token_purpose"]
          salon_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_action_tokens_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_action_tokens_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "appointment_action_tokens_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_events: {
        Row: {
          actor_profile_id: string | null
          appointment_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["appointment_event_type"]
          id: string
          metadata: Json
          new_status: Database["public"]["Enums"]["appointment_status"] | null
          previous_status:
            | Database["public"]["Enums"]["appointment_status"]
            | null
          salon_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          appointment_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["appointment_event_type"]
          id?: string
          metadata?: Json
          new_status?: Database["public"]["Enums"]["appointment_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["appointment_status"]
            | null
          salon_id: string
        }
        Update: {
          actor_profile_id?: string | null
          appointment_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["appointment_event_type"]
          id?: string
          metadata?: Json
          new_status?: Database["public"]["Enums"]["appointment_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["appointment_status"]
            | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "appointment_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          amount_paid: number | null
          artist_preference: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          location_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          salon_id: string
          salon_membership_id: string | null
          service_id: string
          service_variant_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          artist_preference: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason?: string | null
          created_at?: string
          customer_id: string
          ends_at: string
          id?: string
          location_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price: number
          salon_id: string
          salon_membership_id?: string | null
          service_id: string
          service_variant_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          artist_preference?: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason?: string | null
          created_at?: string
          customer_id?: string
          ends_at?: string
          id?: string
          location_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price?: number
          salon_id?: string
          salon_membership_id?: string | null
          service_id?: string
          service_variant_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "salon_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: false
            referencedRelation: "artist_analytics"
            referencedColumns: ["salon_membership_id"]
          },
          {
            foreignKeyName: "appointments_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: false
            referencedRelation: "salon_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_analytics"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_profiles: {
        Row: {
          about_me: string | null
          bio: string | null
          created_at: string
          display_name: string
          headshot_url: string | null
          id: string
          interests: string[]
          location_id: string | null
          published: boolean
          salon_id: string
          salon_membership_id: string
          sort_order: number
          specialties: string[]
          updated_at: string
        }
        Insert: {
          about_me?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          headshot_url?: string | null
          id?: string
          interests?: string[]
          location_id?: string | null
          published?: boolean
          salon_id: string
          salon_membership_id: string
          sort_order?: number
          specialties?: string[]
          updated_at?: string
        }
        Update: {
          about_me?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          headshot_url?: string | null
          id?: string
          interests?: string[]
          location_id?: string | null
          published?: boolean
          salon_id?: string
          salon_membership_id?: string
          sort_order?: number
          specialties?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "salon_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_profiles_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "artist_profiles_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_profiles_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: true
            referencedRelation: "artist_analytics"
            referencedColumns: ["salon_membership_id"]
          },
          {
            foreignKeyName: "artist_profiles_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: true
            referencedRelation: "salon_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          active: boolean
          created_at: string
          id: string
          logo_url: string | null
          name: string
          salon_id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          salon_id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          salon_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "brands_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "brands_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          salon_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          salon_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "customers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          active: boolean
          answer: string
          created_at: string
          id: string
          question: string
          salon_id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          answer: string
          created_at?: string
          id?: string
          question: string
          salon_id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          answer?: string
          created_at?: string
          id?: string
          question?: string
          salon_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "faqs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "faqs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          phone: string | null
          resume_path: string
          salon_id: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          resume_path: string
          salon_id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          resume_path?: string
          salon_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "job_applications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          salon_id: string
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          salon_id: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          salon_id?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscribers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "newsletter_subscribers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          recipient_profile_id: string
          related_appointment_id: string | null
          salon_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_profile_id: string
          related_appointment_id?: string | null
          salon_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_profile_id?: string
          related_appointment_id?: string | null
          salon_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_appointment_id_fkey"
            columns: ["related_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_responses: {
        Row: {
          appointment_id: string
          created_at: string
          customer_id: string
          id: string
          salon_id: string
          score: number
        }
        Insert: {
          appointment_id: string
          created_at?: string
          customer_id: string
          id?: string
          salon_id: string
          score: number
        }
        Update: {
          appointment_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          salon_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "nps_responses_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          granted_at: string
          granted_by: string | null
          profile_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          profile_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_admins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          published: boolean
          salon_id: string
          salon_membership_id: string | null
          service_id: string | null
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          published?: boolean
          salon_id: string
          salon_membership_id?: string | null
          service_id?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          published?: boolean
          salon_id?: string
          salon_membership_id?: string | null
          service_id?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "portfolio_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: false
            referencedRelation: "artist_analytics"
            referencedColumns: ["salon_membership_id"]
          },
          {
            foreignKeyName: "portfolio_items_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: false
            referencedRelation: "salon_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_analytics"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "portfolio_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          appointment_id: string
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          rating: number
          salon_id: string
          salon_membership_id: string
          service_id: string | null
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          appointment_id: string
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          rating: number
          salon_id: string
          salon_membership_id: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          appointment_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          rating?: number
          salon_id?: string
          salon_membership_id?: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "reviews_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: false
            referencedRelation: "artist_analytics"
            referencedColumns: ["salon_membership_id"]
          },
          {
            foreignKeyName: "reviews_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: false
            referencedRelation: "salon_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_analytics"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "reviews_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_locations: {
        Row: {
          active: boolean
          address: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          salon_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          salon_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          salon_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_locations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_locations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_memberships: {
        Row: {
          created_at: string
          id: string
          invited_email: string | null
          location_id: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["salon_role"]
          salon_id: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email?: string | null
          location_id?: string | null
          profile_id?: string | null
          role: Database["public"]["Enums"]["salon_role"]
          salon_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string | null
          location_id?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["salon_role"]
          salon_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_memberships_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "salon_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_memberships_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_memberships_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_weekly_hours: {
        Row: {
          close_time: string
          day_of_week: number
          id: string
          location_id: string
          open_time: string
          salon_id: string
        }
        Insert: {
          close_time: string
          day_of_week: number
          id?: string
          location_id: string
          open_time: string
          salon_id: string
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: string
          location_id?: string
          open_time?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_weekly_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "salon_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_weekly_hours_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_weekly_hours_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          address: string | null
          cancellation_cutoff_hours: number
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          footer_text: string | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          name: string
          slug: string
          social_links: Json
          status: Database["public"]["Enums"]["salon_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cancellation_cutoff_hours?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          footer_text?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          name: string
          slug: string
          social_links?: Json
          status?: Database["public"]["Enums"]["salon_status"]
          timezone: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cancellation_cutoff_hours?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          footer_text?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          name?: string
          slug?: string
          social_links?: Json
          status?: Database["public"]["Enums"]["salon_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          salon_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          salon_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          salon_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "service_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      service_promotions: {
        Row: {
          created_at: string
          discount_percent: number
          ends_at: string
          id: string
          salon_id: string
          service_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          discount_percent: number
          ends_at: string
          id?: string
          salon_id: string
          service_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          discount_percent?: number
          ends_at?: string
          id?: string
          salon_id?: string
          service_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_promotions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "service_promotions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_promotions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_analytics"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "service_promotions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_variants: {
        Row: {
          active: boolean
          buffer_minutes: number
          created_at: string
          duration_minutes: number
          id: string
          name: string
          price: number
          salon_id: string
          service_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          buffer_minutes?: number
          created_at?: string
          duration_minutes: number
          id?: string
          name: string
          price: number
          salon_id: string
          service_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          buffer_minutes?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
          salon_id?: string
          service_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "service_variants_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_variants_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_analytics"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "service_variants_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          artist_split_percent: number
          base_duration_minutes: number | null
          base_price: number | null
          buffer_minutes: number
          category_id: string
          created_at: string
          description: string | null
          has_variants: boolean
          id: string
          image_url: string | null
          name: string
          salon_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          artist_split_percent?: number
          base_duration_minutes?: number | null
          base_price?: number | null
          buffer_minutes?: number
          category_id: string
          created_at?: string
          description?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          name: string
          salon_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          artist_split_percent?: number
          base_duration_minutes?: number | null
          base_price?: number | null
          buffer_minutes?: number
          category_id?: string
          created_at?: string
          description?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          name?: string
          salon_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_time_off: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          salon_id: string
          salon_membership_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          salon_id: string
          salon_membership_id: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          salon_id?: string
          salon_membership_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_time_off_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "staff_time_off_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_time_off_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: false
            referencedRelation: "artist_analytics"
            referencedColumns: ["salon_membership_id"]
          },
          {
            foreignKeyName: "staff_time_off_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: false
            referencedRelation: "salon_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_weekly_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          day_of_week: number
          end_time: string
          id: string
          salon_id: string
          salon_membership_id: string
          start_time: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          day_of_week: number
          end_time: string
          id?: string
          salon_id: string
          salon_membership_id: string
          start_time: string
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          salon_id?: string
          salon_membership_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_weekly_hours_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "staff_weekly_hours_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_weekly_hours_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: false
            referencedRelation: "artist_analytics"
            referencedColumns: ["salon_membership_id"]
          },
          {
            foreignKeyName: "staff_weekly_hours_salon_membership_id_fkey"
            columns: ["salon_membership_id"]
            isOneToOne: false
            referencedRelation: "salon_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      artist_analytics: {
        Row: {
          avg_rating: number | null
          completed_count: number | null
          display_name: string | null
          revenue: number | null
          salon_id: string | null
          salon_membership_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salon_memberships_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_memberships_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      peak_booking_hours: {
        Row: {
          appointment_count: number | null
          hour_of_day: number | null
          salon_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_analytics_summary: {
        Row: {
          avg_review_rating: number | null
          avg_ticket: number | null
          cancelled_appointments: number | null
          completed_appointments: number | null
          no_show_appointments: number | null
          salon_id: string | null
          total_booked_appointments: number | null
          total_customers: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      service_analytics: {
        Row: {
          completed_count: number | null
          revenue: number | null
          salon_id: string | null
          service_id: string | null
          service_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_analytics_summary"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_open_appointment: {
        Args: { p_appointment_id: string; p_assign_to_membership_id?: string }
        Returns: {
          amount_paid: number | null
          artist_preference: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          location_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          salon_id: string
          salon_membership_id: string | null
          service_id: string
          service_variant_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_pending_appointment: {
        Args: { p_appointment_id: string }
        Returns: {
          amount_paid: number | null
          artist_preference: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          location_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          salon_id: string
          salon_membership_id: string | null
          service_id: string
          service_variant_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      book_appointment: {
        Args: {
          p_artist_preference: Database["public"]["Enums"]["artist_preference"]
          p_location_id: string
          p_salon_id: string
          p_salon_membership_id: string
          p_service_id: string
          p_service_variant_id: string
          p_starts_at: string
        }
        Returns: {
          amount_paid: number | null
          artist_preference: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          location_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          salon_id: string
          salon_membership_id: string | null
          service_id: string
          service_variant_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_appointment: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: {
          amount_paid: number | null
          artist_preference: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          location_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          salon_id: string
          salon_membership_id: string | null
          service_id: string
          service_variant_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_appointment: {
        Args: { p_amount_paid: number; p_appointment_id: string }
        Returns: {
          amount_paid: number | null
          artist_preference: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          location_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          salon_id: string
          salon_membership_id: string | null
          service_id: string
          service_variant_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_profile_id: { Args: never; Returns: string }
      decline_pending_appointment: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: {
          amount_paid: number | null
          artist_preference: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          location_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          salon_id: string
          salon_membership_id: string | null
          service_id: string
          service_variant_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_or_create_customer: {
        Args: { p_profile_id: string; p_salon_id: string }
        Returns: string
      }
      get_public_artist_time_off: {
        Args: { p_from: string; p_salon_membership_id: string; p_to: string }
        Returns: {
          end_date: string
          start_date: string
        }[]
      }
      get_public_artist_weekly_hours: {
        Args: { p_salon_membership_id: string }
        Returns: {
          break_end: string
          break_start: string
          day_of_week: number
          end_time: string
          start_time: string
        }[]
      }
      get_public_busy_intervals: {
        Args: { p_from: string; p_salon_membership_id: string; p_to: string }
        Returns: {
          ends_at: string
          starts_at: string
        }[]
      }
      is_platform_admin: { Args: never; Returns: boolean }
      mark_no_show: {
        Args: { p_appointment_id: string }
        Returns: {
          amount_paid: number | null
          artist_preference: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          location_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          salon_id: string
          salon_membership_id: string | null
          service_id: string
          service_variant_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      moderate_review: {
        Args: {
          p_review_id: string
          p_status: Database["public"]["Enums"]["review_status"]
        }
        Returns: {
          appointment_id: string
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          rating: number
          salon_id: string
          salon_membership_id: string
          service_id: string | null
          status: Database["public"]["Enums"]["review_status"]
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_appointment: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: {
          amount_paid: number | null
          artist_preference: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          location_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          salon_id: string
          salon_membership_id: string | null
          service_id: string
          service_variant_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_new_salon_membership_id?: string
          p_new_starts_at: string
        }
        Returns: {
          amount_paid: number | null
          artist_preference: Database["public"]["Enums"]["artist_preference"]
          cancellation_reason: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          location_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          salon_id: string
          salon_membership_id: string | null
          service_id: string
          service_variant_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      staff_role_for_salon: {
        Args: { p_salon_id: string }
        Returns: Database["public"]["Enums"]["salon_role"]
      }
      submit_review: {
        Args: { p_appointment_id: string; p_comment: string; p_rating: number }
        Returns: {
          appointment_id: string
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          rating: number
          salon_id: string
          salon_membership_id: string
          service_id: string | null
          status: Database["public"]["Enums"]["review_status"]
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      appointment_event_type:
        | "created"
        | "assigned"
        | "accepted"
        | "released"
        | "declined"
        | "rescheduled"
        | "cancelled"
        | "completed"
        | "no_show"
      appointment_status:
        | "open"
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      appointment_token_purpose: "reschedule_followup" | "nps_survey"
      artist_preference: "specific" | "any"
      membership_status: "invited" | "active" | "disabled"
      notification_type:
        | "booking_requested"
        | "booking_confirmed"
        | "booking_rejected"
        | "appointment_rescheduled"
        | "appointment_cancelled"
        | "appointment_reminder"
        | "review_request"
        | "open_appointment_available"
        | "appointment_assigned"
      payment_status: "unpaid" | "paid"
      review_status: "pending" | "published" | "rejected"
      salon_role: "owner" | "manager" | "receptionist" | "stylist"
      salon_status: "active" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_event_type: [
        "created",
        "assigned",
        "accepted",
        "released",
        "declined",
        "rescheduled",
        "cancelled",
        "completed",
        "no_show",
      ],
      appointment_status: [
        "open",
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      appointment_token_purpose: ["reschedule_followup", "nps_survey"],
      artist_preference: ["specific", "any"],
      membership_status: ["invited", "active", "disabled"],
      notification_type: [
        "booking_requested",
        "booking_confirmed",
        "booking_rejected",
        "appointment_rescheduled",
        "appointment_cancelled",
        "appointment_reminder",
        "review_request",
        "open_appointment_available",
        "appointment_assigned",
      ],
      payment_status: ["unpaid", "paid"],
      review_status: ["pending", "published", "rejected"],
      salon_role: ["owner", "manager", "receptionist", "stylist"],
      salon_status: ["active", "suspended"],
    },
  },
} as const
