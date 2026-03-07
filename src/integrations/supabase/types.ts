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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      documents: {
        Row: {
          contenu_texte: string | null
          dossier_id: string
          id: string
          nom_fichier: string
          storage_path: string | null
          taille: number | null
          type_document: Database["public"]["Enums"]["type_document"]
          uploaded_at: string
        }
        Insert: {
          contenu_texte?: string | null
          dossier_id: string
          id?: string
          nom_fichier?: string
          storage_path?: string | null
          taille?: number | null
          type_document?: Database["public"]["Enums"]["type_document"]
          uploaded_at?: string
        }
        Update: {
          contenu_texte?: string | null
          dossier_id?: string
          id?: string
          nom_fichier?: string
          storage_path?: string | null
          taille?: number | null
          type_document?: Database["public"]["Enums"]["type_document"]
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          arbitre_nom: string | null
          arbitre_prenom: string | null
          competition: string | null
          contexte_supplementaire: string | null
          created_at: string
          date_match: string | null
          deadline_defense: string | null
          deadline_instruction: string | null
          equipe_domicile: string | null
          equipe_exterieur: string | null
          gravite: Database["public"]["Enums"]["gravite_niveau"] | null
          id: string
          lieu_match: string | null
          rapport_ia: string | null
          reference: string
          score: string | null
          statut: Database["public"]["Enums"]["statut_dossier"]
          type_incident: Database["public"]["Enums"]["type_incident"]
          updated_at: string
          user_id: string
        }
        Insert: {
          arbitre_nom?: string | null
          arbitre_prenom?: string | null
          competition?: string | null
          contexte_supplementaire?: string | null
          created_at?: string
          date_match?: string | null
          deadline_defense?: string | null
          deadline_instruction?: string | null
          equipe_domicile?: string | null
          equipe_exterieur?: string | null
          gravite?: Database["public"]["Enums"]["gravite_niveau"] | null
          id?: string
          lieu_match?: string | null
          rapport_ia?: string | null
          reference: string
          score?: string | null
          statut?: Database["public"]["Enums"]["statut_dossier"]
          type_incident?: Database["public"]["Enums"]["type_incident"]
          updated_at?: string
          user_id: string
        }
        Update: {
          arbitre_nom?: string | null
          arbitre_prenom?: string | null
          competition?: string | null
          contexte_supplementaire?: string | null
          created_at?: string
          date_match?: string | null
          deadline_defense?: string | null
          deadline_instruction?: string | null
          equipe_domicile?: string | null
          equipe_exterieur?: string | null
          gravite?: Database["public"]["Enums"]["gravite_niveau"] | null
          id?: string
          lieu_match?: string | null
          rapport_ia?: string | null
          reference?: string
          score?: string | null
          statut?: Database["public"]["Enums"]["statut_dossier"]
          type_incident?: Database["public"]["Enums"]["type_incident"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      parties: {
        Row: {
          club: string | null
          dossier_id: string
          est_mis_en_cause: boolean
          id: string
          nom: string
          numero_licence: string | null
          prenom: string | null
          role_dans_incident: string | null
          type_partie: Database["public"]["Enums"]["type_partie"]
        }
        Insert: {
          club?: string | null
          dossier_id: string
          est_mis_en_cause?: boolean
          id?: string
          nom?: string
          numero_licence?: string | null
          prenom?: string | null
          role_dans_incident?: string | null
          type_partie?: Database["public"]["Enums"]["type_partie"]
        }
        Update: {
          club?: string | null
          dossier_id?: string
          est_mis_en_cause?: boolean
          id?: string
          nom?: string
          numero_licence?: string | null
          prenom?: string | null
          role_dans_incident?: string | null
          type_partie?: Database["public"]["Enums"]["type_partie"]
        }
        Relationships: [
          {
            foreignKeyName: "parties_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          district: string | null
          email: string | null
          id: string
          ligue: string | null
          nom: string | null
          poste: string | null
          prenom: string | null
        }
        Insert: {
          created_at?: string
          district?: string | null
          email?: string | null
          id: string
          ligue?: string | null
          nom?: string | null
          poste?: string | null
          prenom?: string | null
        }
        Update: {
          created_at?: string
          district?: string | null
          email?: string | null
          id?: string
          ligue?: string | null
          nom?: string | null
          poste?: string | null
          prenom?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      gravite_niveau: "mineur" | "serieux" | "grave" | "tres_grave"
      statut_dossier: "brouillon" | "en_instruction" | "rapport_genere" | "clos"
      type_document:
        | "feuille_match"
        | "rapport_arbitre"
        | "rapport_delegue"
        | "rapport_club"
        | "piece_defense"
        | "autre"
      type_incident:
        | "exclusion_simple"
        | "violence_physique"
        | "propos_injurieux"
        | "comportement_supporters"
        | "fraude_licence"
        | "cumul_avertissements"
        | "autre"
      type_partie: "joueur" | "entraineur" | "dirigeant" | "supporter" | "club"
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
      app_role: ["admin", "moderator", "user"],
      gravite_niveau: ["mineur", "serieux", "grave", "tres_grave"],
      statut_dossier: ["brouillon", "en_instruction", "rapport_genere", "clos"],
      type_document: [
        "feuille_match",
        "rapport_arbitre",
        "rapport_delegue",
        "rapport_club",
        "piece_defense",
        "autre",
      ],
      type_incident: [
        "exclusion_simple",
        "violence_physique",
        "propos_injurieux",
        "comportement_supporters",
        "fraude_licence",
        "cumul_avertissements",
        "autre",
      ],
      type_partie: ["joueur", "entraineur", "dirigeant", "supporter", "club"],
    },
  },
} as const
