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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_messages: {
        Row: {
          content: string
          context_label: string | null
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          context_label?: string | null
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          context_label?: string | null
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          doctor_id: string
          doctor_user_id: string | null
          id: string
          mode: string
          notes: string | null
          patient_id: string
          reason: string | null
          slot_at: string
          status: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          doctor_user_id?: string | null
          id?: string
          mode?: string
          notes?: string | null
          patient_id: string
          reason?: string | null
          slot_at: string
          status?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          doctor_user_id?: string | null
          id?: string
          mode?: string
          notes?: string | null
          patient_id?: string
          reason?: string | null
          slot_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          actor_role: string
          consent_status: string | null
          created_at: string
          details: string | null
          id: string
          patient_id: string | null
          resource: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: string
          consent_status?: string | null
          created_at?: string
          details?: string | null
          id?: string
          patient_id?: string | null
          resource?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: string
          consent_status?: string | null
          created_at?: string
          details?: string | null
          id?: string
          patient_id?: string | null
          resource?: string
        }
        Relationships: []
      }
      consent_requests: {
        Row: {
          approved_categories: string[]
          created_at: string
          doctor_name: string
          doctor_user_id: string
          expires_at: string | null
          id: string
          patient_id: string
          reason: string
          requested_categories: string[]
          responded_at: string | null
          status: string
        }
        Insert: {
          approved_categories?: string[]
          created_at?: string
          doctor_name?: string
          doctor_user_id: string
          expires_at?: string | null
          id?: string
          patient_id: string
          reason?: string
          requested_categories?: string[]
          responded_at?: string | null
          status?: string
        }
        Update: {
          approved_categories?: string[]
          created_at?: string
          doctor_name?: string
          doctor_user_id?: string
          expires_at?: string | null
          id?: string
          patient_id?: string
          reason?: string
          requested_categories?: string[]
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      doctors: {
        Row: {
          bio: string | null
          created_at: string
          experience_years: number
          fee: number
          full_name: string
          hospital_id: string | null
          id: string
          is_demo: boolean
          languages: string[]
          qualification: string
          rating: number
          specialty: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          experience_years?: number
          fee?: number
          full_name: string
          hospital_id?: string | null
          id?: string
          is_demo?: boolean
          languages?: string[]
          qualification?: string
          rating?: number
          specialty: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          experience_years?: number
          fee?: number
          full_name?: string
          hospital_id?: string | null
          id?: string
          is_demo?: boolean
          languages?: string[]
          qualification?: string
          rating?: number
          specialty?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_cards: {
        Row: {
          allergies: string[]
          blood_group: string | null
          conditions: string[]
          current_medicines: string[]
          notes: string | null
          patient_id: string
          updated_at: string
          visible_fields: string[]
        }
        Insert: {
          allergies?: string[]
          blood_group?: string | null
          conditions?: string[]
          current_medicines?: string[]
          notes?: string | null
          patient_id: string
          updated_at?: string
          visible_fields?: string[]
        }
        Update: {
          allergies?: string[]
          blood_group?: string | null
          conditions?: string[]
          current_medicines?: string[]
          notes?: string | null
          patient_id?: string
          updated_at?: string
          visible_fields?: string[]
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          name: string
          patient_id: string
          phone: string
          relation: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          patient_id: string
          phone: string
          relation?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          patient_id?: string
          phone?: string
          relation?: string
        }
        Relationships: []
      }
      first_aid_articles: {
        Row: {
          avoid_steps: string[]
          category: string
          created_at: string
          do_steps: string[]
          id: string
          seek_help: string
          sort_order: number
          summary: string
          title: string
        }
        Insert: {
          avoid_steps?: string[]
          category: string
          created_at?: string
          do_steps?: string[]
          id?: string
          seek_help?: string
          sort_order?: number
          summary?: string
          title: string
        }
        Update: {
          avoid_steps?: string[]
          category?: string
          created_at?: string
          do_steps?: string[]
          id?: string
          seek_help?: string
          sort_order?: number
          summary?: string
          title?: string
        }
        Relationships: []
      }
      hospitals: {
        Row: {
          address: string
          city: string
          created_at: string
          distance_km: number
          emergency: boolean
          google_place_id: string | null
          id: string
          is_demo: boolean
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          specialties: string[]
        }
        Insert: {
          address: string
          city?: string
          created_at?: string
          distance_km?: number
          emergency?: boolean
          google_place_id?: string | null
          id?: string
          is_demo?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          specialties?: string[]
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          distance_km?: number
          emergency?: boolean
          google_place_id?: string | null
          id?: string
          is_demo?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          specialties?: string[]
        }
        Relationships: []
      }
      lab_services: {
        Row: {
          created_at: string
          id: string
          kind: string
          lab_id: string
          name: string
          prep_note: string | null
          price: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          lab_id: string
          name: string
          prep_note?: string | null
          price?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lab_id?: string
          name?: string
          prep_note?: string | null
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "lab_services_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
      laboratories: {
        Row: {
          address: string
          city: string
          created_at: string
          distance_km: number
          google_place_id: string | null
          home_collection: boolean
          id: string
          is_demo: boolean
          kinds: string[]
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
        }
        Insert: {
          address: string
          city?: string
          created_at?: string
          distance_km?: number
          google_place_id?: string | null
          home_collection?: boolean
          id?: string
          is_demo?: boolean
          kinds?: string[]
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          distance_km?: number
          google_place_id?: string | null
          home_collection?: boolean
          id?: string
          is_demo?: boolean
          kinds?: string[]
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      medical_records: {
        Row: {
          category: string
          created_at: string
          description: string | null
          details: Json
          doctor_user_id: string | null
          file_url: string | null
          id: string
          is_demo: boolean
          patient_id: string
          provider: string | null
          record_date: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          details?: Json
          doctor_user_id?: string | null
          file_url?: string | null
          id?: string
          is_demo?: boolean
          patient_id: string
          provider?: string | null
          record_date?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          details?: Json
          doctor_user_id?: string | null
          file_url?: string | null
          id?: string
          is_demo?: boolean
          patient_id?: string
          provider?: string | null
          record_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      medicines: {
        Row: {
          active: boolean
          created_at: string
          dosage: string
          end_date: string | null
          frequency: string
          id: string
          name: string
          notes: string | null
          patient_id: string
          reminder_time: string
          start_date: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dosage?: string
          end_date?: string | null
          frequency?: string
          id?: string
          name: string
          notes?: string | null
          patient_id: string
          reminder_time?: string
          start_date?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dosage?: string
          end_date?: string | null
          frequency?: string
          id?: string
          name?: string
          notes?: string | null
          patient_id?: string
          reminder_time?: string
          start_date?: string
        }
        Relationships: []
      }
      medicines_catalog: {
        Row: {
          common_dosage: string | null
          created_at: string
          form: string
          generic_name: string | null
          id: string
          name: string
          price: number
          used_for: string
        }
        Insert: {
          common_dosage?: string | null
          created_at?: string
          form?: string
          generic_name?: string | null
          id?: string
          name: string
          price?: number
          used_for?: string
        }
        Update: {
          common_dosage?: string | null
          created_at?: string
          form?: string
          generic_name?: string | null
          id?: string
          name?: string
          price?: number
          used_for?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pharmacies: {
        Row: {
          address: string
          city: string
          created_at: string
          distance_km: number
          google_place_id: string | null
          id: string
          is_demo: boolean
          lat: number | null
          lng: number | null
          name: string
          open_24x7: boolean
          opening_hours: string
          phone: string | null
        }
        Insert: {
          address: string
          city?: string
          created_at?: string
          distance_km?: number
          google_place_id?: string | null
          id?: string
          is_demo?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          open_24x7?: boolean
          opening_hours?: string
          phone?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          distance_km?: number
          google_place_id?: string | null
          id?: string
          is_demo?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          open_24x7?: boolean
          opening_hours?: string
          phone?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          abha_id: string | null
          address: string | null
          avatar_url: string | null
          blood_group: string | null
          created_at: string
          dob: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          phone: string | null
          universal_id: string
          updated_at: string
        }
        Insert: {
          abha_id?: string | null
          address?: string | null
          avatar_url?: string | null
          blood_group?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id: string
          phone?: string | null
          universal_id?: string
          updated_at?: string
        }
        Update: {
          abha_id?: string | null
          address?: string | null
          avatar_url?: string | null
          blood_group?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          phone?: string | null
          universal_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          acted_at: string | null
          created_at: string
          id: string
          medicine_id: string
          patient_id: string
          scheduled_at: string
          status: string
        }
        Insert: {
          acted_at?: string | null
          created_at?: string
          id?: string
          medicine_id: string
          patient_id: string
          scheduled_at: string
          status?: string
        }
        Update: {
          acted_at?: string | null
          created_at?: string
          id?: string
          medicine_id?: string
          patient_id?: string
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      service_bookings: {
        Row: {
          created_at: string
          id: string
          kind: string
          lab_id: string
          patient_id: string
          price: number
          service_id: string | null
          service_name: string
          slot_at: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          lab_id: string
          patient_id: string
          price?: number
          service_id?: string | null
          service_name: string
          slot_at: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lab_id?: string
          patient_id?: string
          price?: number
          service_id?: string | null
          service_name?: string
          slot_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_bookings_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "lab_services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_consent: {
        Args: { _category: string; _doctor: string; _patient: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "patient" | "doctor" | "admin"
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
  public: {
    Enums: {
      app_role: ["patient", "doctor", "admin"],
    },
  },
} as const
