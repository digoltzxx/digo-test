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
      ab_test_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          payment_method: string | null
          product_id: string | null
          product_type: string | null
          session_id: string
          variant: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          product_id?: string | null
          product_type?: string | null
          session_id: string
          variant: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          product_id?: string | null
          product_type?: string | null
          session_id?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      abandoned_carts: {
        Row: {
          amount: number
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          product_id: string
          recovered: boolean
          recovered_at: string | null
          seller_user_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          product_id: string
          recovered?: boolean
          recovered_at?: string | null
          seller_user_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          product_id?: string
          recovered?: boolean
          recovered_at?: string | null
          seller_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      account_manager_permissions: {
        Row: {
          can_manage_affiliates: boolean
          can_support: boolean
          can_view_accounts: boolean
          can_view_sales: boolean
          can_view_withdrawals: boolean
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_affiliates?: boolean
          can_support?: boolean
          can_view_accounts?: boolean
          can_view_sales?: boolean
          can_view_withdrawals?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_affiliates?: boolean
          can_support?: boolean
          can_view_accounts?: boolean
          can_view_sales?: boolean
          can_view_withdrawals?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      adquirente_logs: {
        Row: {
          adquirente_anterior: string | null
          adquirente_nova: string | null
          alterado_por: string | null
          created_at: string | null
          gateway_id: string
          id: string
          motivo: string | null
        }
        Insert: {
          adquirente_anterior?: string | null
          adquirente_nova?: string | null
          alterado_por?: string | null
          created_at?: string | null
          gateway_id: string
          id?: string
          motivo?: string | null
        }
        Update: {
          adquirente_anterior?: string | null
          adquirente_nova?: string | null
          alterado_por?: string | null
          created_at?: string | null
          gateway_id?: string
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adquirente_logs_adquirente_anterior_fkey"
            columns: ["adquirente_anterior"]
            isOneToOne: false
            referencedRelation: "adquirentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adquirente_logs_adquirente_nova_fkey"
            columns: ["adquirente_nova"]
            isOneToOne: false
            referencedRelation: "adquirentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adquirente_logs_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      adquirentes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          gateway_id: string
          id: string
          nome_exibicao: string
          principal: boolean | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          gateway_id: string
          id?: string
          nome_exibicao: string
          principal?: boolean | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          gateway_id?: string
          id?: string
          nome_exibicao?: string
          principal?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adquirentes_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_clicks: {
        Row: {
          affiliate_user_id: string
          affiliation_id: string
          converted: boolean | null
          converted_at: string | null
          created_at: string
          id: string
          ip_address: string | null
          landing_url: string | null
          product_id: string
          referrer_url: string | null
          sale_id: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_user_id: string
          affiliation_id: string
          converted?: boolean | null
          converted_at?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          landing_url?: string | null
          product_id: string
          referrer_url?: string | null
          sale_id?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_user_id?: string
          affiliation_id?: string
          converted?: boolean | null
          converted_at?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          landing_url?: string | null
          product_id?: string
          referrer_url?: string | null
          sale_id?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliation_id_fkey"
            columns: ["affiliation_id"]
            isOneToOne: false
            referencedRelation: "affiliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_sales: {
        Row: {
          affiliate_user_id: string
          affiliation_id: string
          commission_amount: number
          created_at: string
          id: string
          owner_earnings: number
          owner_user_id: string
          product_id: string
          sale_amount: number
          status: string
        }
        Insert: {
          affiliate_user_id: string
          affiliation_id: string
          commission_amount?: number
          created_at?: string
          id?: string
          owner_earnings?: number
          owner_user_id: string
          product_id: string
          sale_amount?: number
          status?: string
        }
        Update: {
          affiliate_user_id?: string
          affiliation_id?: string
          commission_amount?: number
          created_at?: string
          id?: string
          owner_earnings?: number
          owner_user_id?: string
          product_id?: string
          sale_amount?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_sales_affiliation_id_fkey"
            columns: ["affiliation_id"]
            isOneToOne: false
            referencedRelation: "affiliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliations: {
        Row: {
          created_at: string
          id: string
          product_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          client_id: string
          created_at: string
          currency: string | null
          deduplication_key: string | null
          error_message: string | null
          event_name: string
          event_params: Json
          id: string
          measurement_id: string
          provider_response: Json | null
          sale_id: string | null
          sent_at: string | null
          transaction_id: string | null
          user_id: string
          user_properties: Json | null
          value: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          currency?: string | null
          deduplication_key?: string | null
          error_message?: string | null
          event_name: string
          event_params: Json
          id?: string
          measurement_id: string
          provider_response?: Json | null
          sale_id?: string | null
          sent_at?: string | null
          transaction_id?: string | null
          user_id: string
          user_properties?: Json | null
          value?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          currency?: string | null
          deduplication_key?: string | null
          error_message?: string | null
          event_name?: string
          event_params?: Json
          id?: string
          measurement_id?: string
          provider_response?: Json | null
          sale_id?: string | null
          sent_at?: string | null
          transaction_id?: string | null
          user_id?: string
          user_properties?: Json | null
          value?: number | null
        }
        Relationships: []
      }
      antecipacao_itens: {
        Row: {
          antecipacao_id: string
          created_at: string
          id: string
          taxa_aplicada: number
          transacao_id: string
          valor_liquido: number
          valor_original: number
        }
        Insert: {
          antecipacao_id: string
          created_at?: string
          id?: string
          taxa_aplicada: number
          transacao_id: string
          valor_liquido: number
          valor_original: number
        }
        Update: {
          antecipacao_id?: string
          created_at?: string
          id?: string
          taxa_aplicada?: number
          transacao_id?: string
          valor_liquido?: number
          valor_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "antecipacao_itens_antecipacao_id_fkey"
            columns: ["antecipacao_id"]
            isOneToOne: false
            referencedRelation: "antecipacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antecipacao_itens_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: true
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antecipacao_itens_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: true
            referencedRelation: "v_transacoes_antecipacao"
            referencedColumns: ["id"]
          },
        ]
      }
      antecipacoes: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          processed_at: string | null
          quantidade_transacoes: number
          status: string
          taxa_percentual: number
          transacoes_ids: string[]
          user_id: string
          valor_bruto: number
          valor_liquido: number
          valor_taxa: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          processed_at?: string | null
          quantidade_transacoes?: number
          status?: string
          taxa_percentual?: number
          transacoes_ids?: string[]
          user_id: string
          valor_bruto: number
          valor_liquido: number
          valor_taxa: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          processed_at?: string | null
          quantidade_transacoes?: number
          status?: string
          taxa_percentual?: number
          transacoes_ids?: string[]
          user_id?: string
          valor_bruto?: number
          valor_liquido?: number
          valor_taxa?: number
        }
        Relationships: []
      }
      anticipation_debts: {
        Row: {
          anticipation_id: string
          cleared_amount: number
          cleared_at: string | null
          commission_id: string
          created_at: string
          debt_amount: number
          id: string
          reason: string | null
          sale_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anticipation_id: string
          cleared_amount?: number
          cleared_at?: string | null
          commission_id: string
          created_at?: string
          debt_amount?: number
          id?: string
          reason?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anticipation_id?: string
          cleared_amount?: number
          cleared_at?: string | null
          commission_id?: string
          created_at?: string
          debt_amount?: number
          id?: string
          reason?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anticipation_debts_anticipation_id_fkey"
            columns: ["anticipation_id"]
            isOneToOne: false
            referencedRelation: "commission_anticipations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipation_debts_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "sale_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipation_debts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      anticipation_items: {
        Row: {
          anticipated_amount: number
          anticipation_id: string
          commission_id: string
          created_at: string
          fee_amount: number
          id: string
          original_amount: number
        }
        Insert: {
          anticipated_amount?: number
          anticipation_id: string
          commission_id: string
          created_at?: string
          fee_amount?: number
          id?: string
          original_amount?: number
        }
        Update: {
          anticipated_amount?: number
          anticipation_id?: string
          commission_id?: string
          created_at?: string
          fee_amount?: number
          id?: string
          original_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "anticipation_items_anticipation_id_fkey"
            columns: ["anticipation_id"]
            isOneToOne: false
            referencedRelation: "commission_anticipations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipation_items_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "sale_commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      anticipation_logs: {
        Row: {
          action: string
          anticipation_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          action: string
          anticipation_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          action?: string
          anticipation_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anticipation_logs_anticipation_id_fkey"
            columns: ["anticipation_id"]
            isOneToOne: false
            referencedRelation: "commission_anticipations"
            referencedColumns: ["id"]
          },
        ]
      }
      antifraud_analysis: {
        Row: {
          analysis_data: Json | null
          analyzed_at: string | null
          checkout_session_id: string | null
          created_at: string
          decision: string | null
          device_fingerprint: string | null
          document: string | null
          email: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          provider: string
          provider_analysis_id: string | null
          response_time_ms: number | null
          risk_level: string | null
          risk_score: number | null
          sale_id: string | null
          user_id: string
        }
        Insert: {
          analysis_data?: Json | null
          analyzed_at?: string | null
          checkout_session_id?: string | null
          created_at?: string
          decision?: string | null
          device_fingerprint?: string | null
          document?: string | null
          email?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          provider: string
          provider_analysis_id?: string | null
          response_time_ms?: number | null
          risk_level?: string | null
          risk_score?: number | null
          sale_id?: string | null
          user_id: string
        }
        Update: {
          analysis_data?: Json | null
          analyzed_at?: string | null
          checkout_session_id?: string | null
          created_at?: string
          decision?: string | null
          device_fingerprint?: string | null
          document?: string | null
          email?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          provider?: string
          provider_analysis_id?: string | null
          response_time_ms?: number | null
          risk_level?: string | null
          risk_score?: number | null
          sale_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      balance_history: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          movement_type: string
          reference_id: string | null
          reference_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          movement_type: string
          reference_id?: string | null
          reference_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          movement_type?: string
          reference_id?: string | null
          reference_type?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string
          account_type: string
          agency: string
          bank_name: string
          created_at: string
          id: string
          pix_key: string | null
          pix_key_type: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          account_type?: string
          agency: string
          bank_name: string
          created_at?: string
          id?: string
          pix_key?: string | null
          pix_key_type?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          account_type?: string
          agency?: string
          bank_name?: string
          created_at?: string
          id?: string
          pix_key?: string | null
          pix_key_type?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      banner_slides: {
        Row: {
          accent_color: string | null
          alt_text: string | null
          created_at: string
          date_text: string | null
          gradient_from: string | null
          gradient_to: string | null
          gradient_via: string | null
          highlight_color: string | null
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          position: number
          title_1: string | null
          title_2: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          alt_text?: string | null
          created_at?: string
          date_text?: string | null
          gradient_from?: string | null
          gradient_to?: string | null
          gradient_via?: string | null
          highlight_color?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          position?: number
          title_1?: string | null
          title_2?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          alt_text?: string | null
          created_at?: string
          date_text?: string | null
          gradient_from?: string | null
          gradient_to?: string | null
          gradient_via?: string | null
          highlight_color?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          position?: number
          title_1?: string | null
          title_2?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      billing_line_items: {
        Row: {
          billing_period_id: string | null
          category: string
          created_at: string
          id: string
          is_deduction: boolean
          item_label: string
          item_type: string
          metadata: Json | null
          quantity: number | null
          tenant_id: string | null
          total_value: number
          unit_value: number
        }
        Insert: {
          billing_period_id?: string | null
          category: string
          created_at?: string
          id?: string
          is_deduction?: boolean
          item_label: string
          item_type: string
          metadata?: Json | null
          quantity?: number | null
          tenant_id?: string | null
          total_value?: number
          unit_value?: number
        }
        Update: {
          billing_period_id?: string | null
          category?: string
          created_at?: string
          id?: string
          is_deduction?: boolean
          item_label?: string
          item_type?: string
          metadata?: Json | null
          quantity?: number | null
          tenant_id?: string | null
          total_value?: number
          unit_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_line_items_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_periods: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_start: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      billing_summary: {
        Row: {
          acquirer_fees: number
          acquirer_subtotal: number
          anticipation_fees: number
          antifraud_fees: number
          baas_fees: number
          banking_subtotal: number
          billing_period_id: string | null
          calculated_at: string
          created_at: string
          extensions_subtotal: number
          gateway_provider_fees: number
          gateway_provider_name: string | null
          gateway_provider_subtotal: number
          gross_revenue: number
          id: string
          kyc_fees: number
          pre_chargeback: number
          pre_chargeback_fees: number
          tenant_id: string | null
          total_profit: number
          updated_at: string
          withdrawal_fees: number
        }
        Insert: {
          acquirer_fees?: number
          acquirer_subtotal?: number
          anticipation_fees?: number
          antifraud_fees?: number
          baas_fees?: number
          banking_subtotal?: number
          billing_period_id?: string | null
          calculated_at?: string
          created_at?: string
          extensions_subtotal?: number
          gateway_provider_fees?: number
          gateway_provider_name?: string | null
          gateway_provider_subtotal?: number
          gross_revenue?: number
          id?: string
          kyc_fees?: number
          pre_chargeback?: number
          pre_chargeback_fees?: number
          tenant_id?: string | null
          total_profit?: number
          updated_at?: string
          withdrawal_fees?: number
        }
        Update: {
          acquirer_fees?: number
          acquirer_subtotal?: number
          anticipation_fees?: number
          antifraud_fees?: number
          baas_fees?: number
          banking_subtotal?: number
          billing_period_id?: string | null
          calculated_at?: string
          created_at?: string
          extensions_subtotal?: number
          gateway_provider_fees?: number
          gateway_provider_name?: string | null
          gateway_provider_subtotal?: number
          gross_revenue?: number
          id?: string
          kyc_fees?: number
          pre_chargeback?: number
          pre_chargeback_fees?: number
          tenant_id?: string | null
          total_profit?: number
          updated_at?: string
          withdrawal_fees?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_summary_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: true
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          event_type: string
          id: string
          is_all_day: boolean | null
          metadata: Json | null
          reminder_minutes: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string
          id?: string
          is_all_day?: boolean | null
          metadata?: Json | null
          reminder_minutes?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string
          id?: string
          is_all_day?: boolean | null
          metadata?: Json | null
          reminder_minutes?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          coupon_code: string | null
          created_at: string
          current_uses: number
          description: string | null
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_discount_value: number | null
          max_uses: number | null
          max_uses_per_user: number | null
          min_order_value: number | null
          name: string
          product_id: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_value?: number | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_order_value?: number | null
          name: string
          product_id: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_value?: number | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_order_value?: number | null
          name?: string
          product_id?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      chargebacks: {
        Row: {
          amount: number
          created_at: string
          deadline_date: string | null
          evidence_data: Json | null
          evidence_submitted: boolean | null
          gateway_chargeback_id: string | null
          id: string
          metadata: Json | null
          reason_code: string | null
          reason_description: string | null
          resolved_at: string | null
          sale_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          deadline_date?: string | null
          evidence_data?: Json | null
          evidence_submitted?: boolean | null
          gateway_chargeback_id?: string | null
          id?: string
          metadata?: Json | null
          reason_code?: string | null
          reason_description?: string | null
          resolved_at?: string | null
          sale_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deadline_date?: string | null
          evidence_data?: Json | null
          evidence_submitted?: boolean | null
          gateway_chargeback_id?: string | null
          id?: string
          metadata?: Json | null
          reason_code?: string | null
          reason_description?: string | null
          resolved_at?: string | null
          sale_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chargebacks_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_logs: {
        Row: {
          buyer_email: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_status: string | null
          previous_status: string | null
          product_id: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          buyer_email?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          product_id?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          buyer_email?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          product_id?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_pixels: {
        Row: {
          access_token_encrypted: string | null
          conversion_id: string | null
          conversion_label: string | null
          conversion_on_boleto: boolean
          conversion_on_pix: boolean
          created_at: string
          events_config: Json
          id: string
          is_active: boolean
          measurement_id: string | null
          pixel_id: string
          pixel_type: string
          product_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          conversion_id?: string | null
          conversion_label?: string | null
          conversion_on_boleto?: boolean
          conversion_on_pix?: boolean
          created_at?: string
          events_config?: Json
          id?: string
          is_active?: boolean
          measurement_id?: string | null
          pixel_id: string
          pixel_type: string
          product_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          conversion_id?: string | null
          conversion_label?: string | null
          conversion_on_boleto?: boolean
          conversion_on_pix?: boolean
          created_at?: string
          events_config?: Json
          id?: string
          is_active?: boolean
          measurement_id?: string | null
          pixel_id?: string
          pixel_type?: string
          product_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_pixels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          amount: number
          buyer_email: string | null
          buyer_name: string | null
          created_at: string
          id: string
          metadata: Json | null
          payment_approved_at: string | null
          payment_failed_at: string | null
          payment_method: string | null
          product_id: string
          session_expired_at: string | null
          session_expires_at: string | null
          session_started_at: string
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          payment_approved_at?: string | null
          payment_failed_at?: string | null
          payment_method?: string | null
          product_id: string
          session_expired_at?: string | null
          session_expires_at?: string | null
          session_started_at?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          payment_approved_at?: string | null
          payment_failed_at?: string | null
          payment_method?: string | null
          product_id?: string
          session_expired_at?: string | null
          session_expires_at?: string | null
          session_started_at?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_settings: {
        Row: {
          allow_item_removal: boolean | null
          back_redirect_enabled: boolean | null
          back_redirect_url: string | null
          background_color: string | null
          banner_url: string | null
          boleto_enabled: boolean | null
          border_style: string | null
          button_background_color: string | null
          button_status: string | null
          button_text: string | null
          button_text_color: string | null
          cancel_url: string | null
          cart_display_type: string | null
          checkout_animation_enabled: boolean | null
          column_scroll_type: string | null
          coupon_enabled: boolean | null
          created_at: string
          credit_card_enabled: boolean | null
          document_type_accepted: string | null
          favicon_url: string | null
          footer_text: string | null
          form_layout: string | null
          guarantee_days: number | null
          headline: string | null
          id: string
          invert_columns: boolean | null
          layout_type: string | null
          logo_url: string | null
          marquee_enabled: boolean | null
          marquee_text: string | null
          max_installments: number | null
          order_bump_enabled: boolean | null
          pix_enabled: boolean | null
          primary_color: string | null
          product_id: string
          quantity_selector_enabled: boolean | null
          require_address: boolean | null
          require_document: boolean | null
          require_email: boolean | null
          require_phone: boolean | null
          sales_counter_enabled: boolean | null
          sales_counter_value: number | null
          security_seal_guarantee: boolean | null
          security_seal_guarantee_text: string | null
          security_seal_secure_purchase: boolean | null
          security_seal_secure_purchase_text: string | null
          security_seal_secure_site: boolean | null
          security_seal_secure_site_text: string | null
          security_seals_enabled: boolean | null
          show_banner: boolean | null
          show_guarantee: boolean | null
          show_logo: boolean | null
          show_min_shipping_price: boolean | null
          show_product_description: boolean | null
          show_product_image: boolean | null
          show_store_info: boolean | null
          show_testimonials: boolean | null
          show_timer: boolean | null
          social_proof_duration: number | null
          social_proof_enabled: boolean | null
          social_proof_initial_delay: number | null
          social_proof_interval_max: number | null
          social_proof_interval_min: number | null
          social_proof_max_people: number | null
          social_proof_min_people: number | null
          social_proof_notification_1_enabled: boolean | null
          social_proof_notification_1_text: string | null
          social_proof_notification_2_enabled: boolean | null
          social_proof_notification_2_text: string | null
          social_proof_notification_3_enabled: boolean | null
          social_proof_notification_3_text: string | null
          social_proof_notification_4_enabled: boolean | null
          social_proof_notification_4_text: string | null
          social_proof_title: string | null
          subheadline: string | null
          success_url: string | null
          theme_mode: string | null
          timer_color: string | null
          timer_expired_text: string | null
          timer_minutes: number | null
          timer_text: string | null
          timer_text_color: string | null
          total_value_color: string | null
          updated_at: string
          whatsapp_button_enabled: boolean | null
          whatsapp_support_phone: string | null
        }
        Insert: {
          allow_item_removal?: boolean | null
          back_redirect_enabled?: boolean | null
          back_redirect_url?: string | null
          background_color?: string | null
          banner_url?: string | null
          boleto_enabled?: boolean | null
          border_style?: string | null
          button_background_color?: string | null
          button_status?: string | null
          button_text?: string | null
          button_text_color?: string | null
          cancel_url?: string | null
          cart_display_type?: string | null
          checkout_animation_enabled?: boolean | null
          column_scroll_type?: string | null
          coupon_enabled?: boolean | null
          created_at?: string
          credit_card_enabled?: boolean | null
          document_type_accepted?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          form_layout?: string | null
          guarantee_days?: number | null
          headline?: string | null
          id?: string
          invert_columns?: boolean | null
          layout_type?: string | null
          logo_url?: string | null
          marquee_enabled?: boolean | null
          marquee_text?: string | null
          max_installments?: number | null
          order_bump_enabled?: boolean | null
          pix_enabled?: boolean | null
          primary_color?: string | null
          product_id: string
          quantity_selector_enabled?: boolean | null
          require_address?: boolean | null
          require_document?: boolean | null
          require_email?: boolean | null
          require_phone?: boolean | null
          sales_counter_enabled?: boolean | null
          sales_counter_value?: number | null
          security_seal_guarantee?: boolean | null
          security_seal_guarantee_text?: string | null
          security_seal_secure_purchase?: boolean | null
          security_seal_secure_purchase_text?: string | null
          security_seal_secure_site?: boolean | null
          security_seal_secure_site_text?: string | null
          security_seals_enabled?: boolean | null
          show_banner?: boolean | null
          show_guarantee?: boolean | null
          show_logo?: boolean | null
          show_min_shipping_price?: boolean | null
          show_product_description?: boolean | null
          show_product_image?: boolean | null
          show_store_info?: boolean | null
          show_testimonials?: boolean | null
          show_timer?: boolean | null
          social_proof_duration?: number | null
          social_proof_enabled?: boolean | null
          social_proof_initial_delay?: number | null
          social_proof_interval_max?: number | null
          social_proof_interval_min?: number | null
          social_proof_max_people?: number | null
          social_proof_min_people?: number | null
          social_proof_notification_1_enabled?: boolean | null
          social_proof_notification_1_text?: string | null
          social_proof_notification_2_enabled?: boolean | null
          social_proof_notification_2_text?: string | null
          social_proof_notification_3_enabled?: boolean | null
          social_proof_notification_3_text?: string | null
          social_proof_notification_4_enabled?: boolean | null
          social_proof_notification_4_text?: string | null
          social_proof_title?: string | null
          subheadline?: string | null
          success_url?: string | null
          theme_mode?: string | null
          timer_color?: string | null
          timer_expired_text?: string | null
          timer_minutes?: number | null
          timer_text?: string | null
          timer_text_color?: string | null
          total_value_color?: string | null
          updated_at?: string
          whatsapp_button_enabled?: boolean | null
          whatsapp_support_phone?: string | null
        }
        Update: {
          allow_item_removal?: boolean | null
          back_redirect_enabled?: boolean | null
          back_redirect_url?: string | null
          background_color?: string | null
          banner_url?: string | null
          boleto_enabled?: boolean | null
          border_style?: string | null
          button_background_color?: string | null
          button_status?: string | null
          button_text?: string | null
          button_text_color?: string | null
          cancel_url?: string | null
          cart_display_type?: string | null
          checkout_animation_enabled?: boolean | null
          column_scroll_type?: string | null
          coupon_enabled?: boolean | null
          created_at?: string
          credit_card_enabled?: boolean | null
          document_type_accepted?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          form_layout?: string | null
          guarantee_days?: number | null
          headline?: string | null
          id?: string
          invert_columns?: boolean | null
          layout_type?: string | null
          logo_url?: string | null
          marquee_enabled?: boolean | null
          marquee_text?: string | null
          max_installments?: number | null
          order_bump_enabled?: boolean | null
          pix_enabled?: boolean | null
          primary_color?: string | null
          product_id?: string
          quantity_selector_enabled?: boolean | null
          require_address?: boolean | null
          require_document?: boolean | null
          require_email?: boolean | null
          require_phone?: boolean | null
          sales_counter_enabled?: boolean | null
          sales_counter_value?: number | null
          security_seal_guarantee?: boolean | null
          security_seal_guarantee_text?: string | null
          security_seal_secure_purchase?: boolean | null
          security_seal_secure_purchase_text?: string | null
          security_seal_secure_site?: boolean | null
          security_seal_secure_site_text?: string | null
          security_seals_enabled?: boolean | null
          show_banner?: boolean | null
          show_guarantee?: boolean | null
          show_logo?: boolean | null
          show_min_shipping_price?: boolean | null
          show_product_description?: boolean | null
          show_product_image?: boolean | null
          show_store_info?: boolean | null
          show_testimonials?: boolean | null
          show_timer?: boolean | null
          social_proof_duration?: number | null
          social_proof_enabled?: boolean | null
          social_proof_initial_delay?: number | null
          social_proof_interval_max?: number | null
          social_proof_interval_min?: number | null
          social_proof_max_people?: number | null
          social_proof_min_people?: number | null
          social_proof_notification_1_enabled?: boolean | null
          social_proof_notification_1_text?: string | null
          social_proof_notification_2_enabled?: boolean | null
          social_proof_notification_2_text?: string | null
          social_proof_notification_3_enabled?: boolean | null
          social_proof_notification_3_text?: string | null
          social_proof_notification_4_enabled?: boolean | null
          social_proof_notification_4_text?: string | null
          social_proof_title?: string | null
          subheadline?: string | null
          success_url?: string | null
          theme_mode?: string | null
          timer_color?: string | null
          timer_expired_text?: string | null
          timer_minutes?: number | null
          timer_text?: string | null
          timer_text_color?: string | null
          total_value_color?: string | null
          updated_at?: string
          whatsapp_button_enabled?: boolean | null
          whatsapp_support_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      co_producers: {
        Row: {
          commission_percentage: number
          commission_type: string
          created_at: string
          id: string
          product_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          id?: string
          product_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          id?: string
          product_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "co_producers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_anticipations: {
        Row: {
          approved_at: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          completed_at: string | null
          created_at: string
          fee_amount: number
          fee_percentage: number
          id: string
          metadata: Json | null
          processed_at: string | null
          status: string
          total_anticipated_amount: number
          total_original_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          fee_amount?: number
          fee_percentage?: number
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          status?: string
          total_anticipated_amount?: number
          total_original_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          fee_amount?: number
          fee_percentage?: number
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          status?: string
          total_anticipated_amount?: number
          total_original_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coupon_usage_logs: {
        Row: {
          campaign_id: string
          coupon_code: string
          created_at: string
          discount_applied: number
          discount_type: string
          discount_value: number
          final_amount: number
          id: string
          original_amount: number
          product_id: string
          sale_id: string | null
          status: string
          used_at: string | null
        }
        Insert: {
          campaign_id: string
          coupon_code: string
          created_at?: string
          discount_applied: number
          discount_type: string
          discount_value: number
          final_amount: number
          id?: string
          original_amount: number
          product_id: string
          sale_id?: string | null
          status?: string
          used_at?: string | null
        }
        Update: {
          campaign_id?: string
          coupon_code?: string
          created_at?: string
          discount_applied?: number
          discount_type?: string
          discount_value?: number
          final_amount?: number
          id?: string
          original_amount?: number
          product_id?: string
          sale_id?: string | null
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          external_id: string | null
          external_metadata: Json | null
          external_platform: string | null
          external_synced_at: string | null
          id: string
          image_url: string | null
          name: string
          product_id: string
          seller_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_id?: string | null
          external_metadata?: Json | null
          external_platform?: string | null
          external_synced_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          product_id: string
          seller_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_id?: string | null
          external_metadata?: Json | null
          external_platform?: string | null
          external_synced_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          product_id?: string
          seller_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          deal_name: string | null
          deal_value: number | null
          id: string
          metadata: Json | null
          pipeline_id: string | null
          product_id: string | null
          provider: string
          provider_deal_id: string | null
          sale_id: string | null
          stage: string | null
          sync_error: string | null
          synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          deal_name?: string | null
          deal_value?: number | null
          id?: string
          metadata?: Json | null
          pipeline_id?: string | null
          product_id?: string | null
          provider: string
          provider_deal_id?: string | null
          sale_id?: string | null
          stage?: string | null
          sync_error?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          deal_name?: string | null
          deal_value?: number | null
          id?: string
          metadata?: Json | null
          pipeline_id?: string | null
          product_id?: string | null
          provider?: string
          provider_deal_id?: string | null
          sale_id?: string | null
          stage?: string | null
          sync_error?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_webhooks: {
        Row: {
          created_at: string
          error_count: number
          events_enabled: string[]
          id: string
          is_active: boolean
          last_error: string | null
          last_triggered_at: string | null
          name: string
          product_filter: string
          product_ids: string[] | null
          success_count: number
          token: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_count?: number
          events_enabled?: string[]
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_triggered_at?: string | null
          name: string
          product_filter?: string
          product_ids?: string[] | null
          success_count?: number
          token?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_count?: number
          events_enabled?: string[]
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_triggered_at?: string | null
          name?: string
          product_filter?: string
          product_ids?: string[] | null
          success_count?: number
          token?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          net_amount: number
          payment_method: string | null
          product_id: string | null
          report_date: string
          sales_count: number
          seller_user_id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          net_amount?: number
          payment_method?: string | null
          product_id?: string | null
          report_date: string
          sales_count?: number
          seller_user_id: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          net_amount?: number
          payment_method?: string | null
          product_id?: string | null
          report_date?: string
          sales_count?: number
          seller_user_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_logs: {
        Row: {
          codigo_erro: string | null
          correlation_id: string | null
          created_at: string
          deliverable_id: string | null
          delivered_at: string | null
          delivery_status: string
          delivery_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          payload_referencia: Json | null
          product_id: string
          retry_count: number | null
          sale_id: string | null
          subscription_id: string | null
          tempo_processamento_ms: number | null
          user_email: string
          user_name: string | null
        }
        Insert: {
          codigo_erro?: string | null
          correlation_id?: string | null
          created_at?: string
          deliverable_id?: string | null
          delivered_at?: string | null
          delivery_status?: string
          delivery_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          payload_referencia?: Json | null
          product_id: string
          retry_count?: number | null
          sale_id?: string | null
          subscription_id?: string | null
          tempo_processamento_ms?: number | null
          user_email: string
          user_name?: string | null
        }
        Update: {
          codigo_erro?: string | null
          correlation_id?: string | null
          created_at?: string
          deliverable_id?: string | null
          delivered_at?: string | null
          delivery_status?: string
          delivery_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          payload_referencia?: Json | null
          product_id?: string
          retry_count?: number | null
          sale_id?: string | null
          subscription_id?: string | null
          tempo_processamento_ms?: number | null
          user_email?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_logs_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "product_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_logs_v2: {
        Row: {
          codigo_erro: string | null
          correlation_id: string | null
          created_at: string
          email_destino: string
          erro_detalhado: string | null
          id: string
          metadata_adicional: Json | null
          payload_referencia: Json | null
          product_id: string | null
          seller_user_id: string | null
          status: string
          tempo_processamento_ms: number | null
          tentativas: number
          tipo_entrega: string
        }
        Insert: {
          codigo_erro?: string | null
          correlation_id?: string | null
          created_at?: string
          email_destino: string
          erro_detalhado?: string | null
          id?: string
          metadata_adicional?: Json | null
          payload_referencia?: Json | null
          product_id?: string | null
          seller_user_id?: string | null
          status: string
          tempo_processamento_ms?: number | null
          tentativas?: number
          tipo_entrega: string
        }
        Update: {
          codigo_erro?: string | null
          correlation_id?: string | null
          created_at?: string
          email_destino?: string
          erro_detalhado?: string | null
          id?: string
          metadata_adicional?: Json | null
          payload_referencia?: Json | null
          product_id?: string | null
          seller_user_id?: string | null
          status?: string
          tempo_processamento_ms?: number | null
          tentativas?: number
          tipo_entrega?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_url: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_url: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      downsells: {
        Row: {
          created_at: string
          cta_text: string | null
          decline_text: string | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          downsell_product_id: string
          headline: string | null
          id: string
          is_active: boolean | null
          is_subscription: boolean | null
          name: string
          offer_price: number
          original_price: number
          product_id: string
          subheadline: string | null
          subscription_interval: string | null
          timer_enabled: boolean | null
          timer_minutes: number | null
          updated_at: string
          upsell_id: string
        }
        Insert: {
          created_at?: string
          cta_text?: string | null
          decline_text?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          downsell_product_id: string
          headline?: string | null
          id?: string
          is_active?: boolean | null
          is_subscription?: boolean | null
          name: string
          offer_price: number
          original_price: number
          product_id: string
          subheadline?: string | null
          subscription_interval?: string | null
          timer_enabled?: boolean | null
          timer_minutes?: number | null
          updated_at?: string
          upsell_id: string
        }
        Update: {
          created_at?: string
          cta_text?: string | null
          decline_text?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          downsell_product_id?: string
          headline?: string | null
          id?: string
          is_active?: boolean | null
          is_subscription?: boolean | null
          name?: string
          offer_price?: number
          original_price?: number
          product_id?: string
          subheadline?: string | null
          subscription_interval?: string | null
          timer_enabled?: boolean | null
          timer_minutes?: number | null
          updated_at?: string
          upsell_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "downsells_downsell_product_id_fkey"
            columns: ["downsell_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downsells_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downsells_upsell_id_fkey"
            columns: ["upsell_id"]
            isOneToOne: false
            referencedRelation: "upsells"
            referencedColumns: ["id"]
          },
        ]
      }
      edtech_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string | null
          event_type: string
          id: string
          idempotency_key: string | null
          payload: Json
          platform: string
          processed_at: string | null
          retry_count: number | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          platform: string
          processed_at?: string | null
          retry_count?: number | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          platform?: string
          processed_at?: string | null
          retry_count?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      email_marketing_contacts: {
        Row: {
          created_at: string
          custom_fields: Json | null
          email: string
          id: string
          list_id: string | null
          name: string | null
          phone: string | null
          provider: string
          provider_contact_id: string | null
          status: string | null
          sync_error: string | null
          synced_at: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_fields?: Json | null
          email: string
          id?: string
          list_id?: string | null
          name?: string | null
          phone?: string | null
          provider: string
          provider_contact_id?: string | null
          status?: string | null
          sync_error?: string | null
          synced_at?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_fields?: Json | null
          email?: string
          id?: string
          list_id?: string | null
          name?: string | null
          phone?: string | null
          provider?: string
          provider_contact_id?: string | null
          status?: string | null
          sync_error?: string | null
          synced_at?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          access_revoked_at: string | null
          completed_at: string | null
          course_id: string
          created_at: string
          enrolled_at: string
          expires_at: string | null
          external_id: string | null
          external_platform: string | null
          external_synced_at: string | null
          id: string
          product_id: string
          progress_percent: number | null
          revoke_reason: string | null
          sale_id: string | null
          status: string
          student_id: string
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          access_revoked_at?: string | null
          completed_at?: string | null
          course_id: string
          created_at?: string
          enrolled_at?: string
          expires_at?: string | null
          external_id?: string | null
          external_platform?: string | null
          external_synced_at?: string | null
          id?: string
          product_id: string
          progress_percent?: number | null
          revoke_reason?: string | null
          sale_id?: string | null
          status?: string
          student_id: string
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          access_revoked_at?: string | null
          completed_at?: string | null
          course_id?: string
          created_at?: string
          enrolled_at?: string
          expires_at?: string | null
          external_id?: string | null
          external_platform?: string | null
          external_synced_at?: string | null
          id?: string
          product_id?: string
          progress_percent?: number | null
          revoke_reason?: string | null
          sale_id?: string | null
          status?: string
          student_id?: string
          turma_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_change_logs: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          fee_id: string | null
          fee_type: Database["public"]["Enums"]["fee_type"]
          id: string
          ip_address: string | null
          new_value: number
          new_value_type: Database["public"]["Enums"]["fee_value_type"]
          previous_value: number | null
          previous_value_type:
            | Database["public"]["Enums"]["fee_value_type"]
            | null
          reason: string | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          fee_id?: string | null
          fee_type: Database["public"]["Enums"]["fee_type"]
          id?: string
          ip_address?: string | null
          new_value: number
          new_value_type: Database["public"]["Enums"]["fee_value_type"]
          previous_value?: number | null
          previous_value_type?:
            | Database["public"]["Enums"]["fee_value_type"]
            | null
          reason?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          fee_id?: string | null
          fee_type?: Database["public"]["Enums"]["fee_type"]
          id?: string
          ip_address?: string | null
          new_value?: number
          new_value_type?: Database["public"]["Enums"]["fee_value_type"]
          previous_value?: number | null
          previous_value_type?:
            | Database["public"]["Enums"]["fee_value_type"]
            | null
          reason?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_change_logs_fee_id_fkey"
            columns: ["fee_id"]
            isOneToOne: false
            referencedRelation: "platform_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_audit_logs: {
        Row: {
          action_taken: string
          amount: number | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          payment_method: string | null
          reason: string | null
          sale_id: string | null
          source: string | null
          status_allowed: boolean
          status_received: string
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          action_taken: string
          amount?: number | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          payment_method?: string | null
          reason?: string | null
          sale_id?: string | null
          source?: string | null
          status_allowed?: boolean
          status_received: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string
          amount?: number | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          payment_method?: string | null
          reason?: string | null
          sale_id?: string | null
          source?: string | null
          status_allowed?: boolean
          status_received?: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          campaign_id: string | null
          checkout_session_id: string | null
          coupon_code: string | null
          created_at: string
          discount_amount: number
          external_reference: string | null
          gateway_fee: number
          gateway_transaction_id: string | null
          gross_amount: number
          id: string
          idempotency_key: string | null
          is_released: boolean | null
          is_withdrawn: boolean | null
          metadata: Json | null
          net_amount: number
          paid_at: string | null
          payment_method: string | null
          platform_fee: number
          product_id: string | null
          refunded_at: string | null
          released_at: string | null
          sale_id: string | null
          status: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          checkout_session_id?: string | null
          coupon_code?: string | null
          created_at?: string
          discount_amount?: number
          external_reference?: string | null
          gateway_fee?: number
          gateway_transaction_id?: string | null
          gross_amount?: number
          id?: string
          idempotency_key?: string | null
          is_released?: boolean | null
          is_withdrawn?: boolean | null
          metadata?: Json | null
          net_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          platform_fee?: number
          product_id?: string | null
          refunded_at?: string | null
          released_at?: string | null
          sale_id?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          checkout_session_id?: string | null
          coupon_code?: string | null
          created_at?: string
          discount_amount?: number
          external_reference?: string | null
          gateway_fee?: number
          gateway_transaction_id?: string | null
          gross_amount?: number
          id?: string
          idempotency_key?: string | null
          is_released?: boolean | null
          is_withdrawn?: boolean | null
          metadata?: Json | null
          net_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          platform_fee?: number
          product_id?: string | null
          refunded_at?: string | null
          released_at?: string | null
          sale_id?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_orders: {
        Row: {
          access_granted_at: string | null
          amount: number
          buyer_email: string
          buyer_name: string
          created_at: string
          downsell_id: string | null
          id: string
          net_amount: number
          order_type: string
          parent_sale_id: string
          payment_fee: number | null
          payment_token_used: boolean | null
          product_id: string
          seller_user_id: string
          status: string
          transaction_id: string | null
          updated_at: string
          upsell_id: string | null
        }
        Insert: {
          access_granted_at?: string | null
          amount: number
          buyer_email: string
          buyer_name: string
          created_at?: string
          downsell_id?: string | null
          id?: string
          net_amount: number
          order_type: string
          parent_sale_id: string
          payment_fee?: number | null
          payment_token_used?: boolean | null
          product_id: string
          seller_user_id: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          upsell_id?: string | null
        }
        Update: {
          access_granted_at?: string | null
          amount?: number
          buyer_email?: string
          buyer_name?: string
          created_at?: string
          downsell_id?: string | null
          id?: string
          net_amount?: number
          order_type?: string
          parent_sale_id?: string
          payment_fee?: number | null
          payment_token_used?: boolean | null
          product_id?: string
          seller_user_id?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          upsell_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_orders_downsell_id_fkey"
            columns: ["downsell_id"]
            isOneToOne: false
            referencedRelation: "downsells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_orders_parent_sale_id_fkey"
            columns: ["parent_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_orders_upsell_id_fkey"
            columns: ["upsell_id"]
            isOneToOne: false
            referencedRelation: "upsells"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_acquirers: {
        Row: {
          api_key_encrypted: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          is_primary: boolean
          metadata: Json | null
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          metadata?: Json | null
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          metadata?: Json | null
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gateways: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      goal_alerts: {
        Row: {
          alert_type: string
          created_at: string
          current_amount: number
          cycle_start_date: string
          email_sent: boolean | null
          goal_type: string
          id: string
          percentage_reached: number
          plate_level: number | null
          threshold_amount: number
          triggered_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          current_amount: number
          cycle_start_date?: string
          email_sent?: boolean | null
          goal_type?: string
          id?: string
          percentage_reached: number
          plate_level?: number | null
          threshold_amount: number
          triggered_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          current_amount?: number
          cycle_start_date?: string
          email_sent?: boolean | null
          goal_type?: string
          id?: string
          percentage_reached?: number
          plate_level?: number | null
          threshold_amount?: number
          triggered_at?: string
          user_id?: string
        }
        Relationships: []
      }
      impersonation_action_logs: {
        Row: {
          action_details: Json | null
          action_type: string
          admin_user_id: string
          created_at: string
          id: string
          impersonated_user_id: string
          ip_address: string | null
          session_id: string | null
        }
        Insert: {
          action_details?: Json | null
          action_type: string
          admin_user_id: string
          created_at?: string
          id?: string
          impersonated_user_id: string
          ip_address?: string | null
          session_id?: string | null
        }
        Update: {
          action_details?: Json | null
          action_type?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          impersonated_user_id?: string
          ip_address?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_action_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "impersonation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          impersonated_user_id: string
          ip_address: string | null
          reason: string | null
          started_at: string
          status: string
          token: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          impersonated_user_id: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string
          status?: string
          token: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          impersonated_user_id?: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string
          status?: string
          token?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      instructor_permissions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integration_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          customer_email: string | null
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          integration_id: string
          processed_at: string | null
          product_id: string | null
          provider_response: Json | null
          retry_count: number | null
          sale_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          error_message?: string | null
          event_data: Json
          event_type: string
          id?: string
          integration_id: string
          processed_at?: string | null
          product_id?: string | null
          provider_response?: Json | null
          retry_count?: number | null
          sale_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          integration_id?: string
          processed_at?: string | null
          product_id?: string | null
          provider_response?: Json | null
          retry_count?: number | null
          sale_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      integration_tokens: {
        Row: {
          access_token_encrypted: string
          created_at: string
          expires_at: string | null
          id: string
          integration_id: string
          last_refreshed_at: string | null
          refresh_token_encrypted: string | null
          scopes: string[] | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          expires_at?: string | null
          id?: string
          integration_id: string
          last_refreshed_at?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          integration_id?: string
          last_refreshed_at?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          enrollment_id: string
          id: string
          last_watched_at: string | null
          lesson_id: string
          progress_percent: number
          student_id: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          last_watched_at?: string | null
          lesson_id: string
          progress_percent?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          last_watched_at?: string | null
          lesson_id?: string
          progress_percent?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content_type: string
          content_url: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          is_free: boolean
          module_id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          content_type?: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          module_id: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          content_type?: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          module_id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      member_access: {
        Row: {
          access_status: string
          created_at: string
          expires_at: string | null
          granted_at: string
          id: string
          last_accessed_at: string | null
          product_id: string
          sale_id: string | null
          subscription_id: string | null
          updated_at: string
          user_email: string
          user_name: string | null
        }
        Insert: {
          access_status?: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          last_accessed_at?: string | null
          product_id: string
          sale_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_email: string
          user_name?: string | null
        }
        Update: {
          access_status?: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          last_accessed_at?: string | null
          product_id?: string
          sale_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_email?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_access_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_access_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_access_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      member_area_settings: {
        Row: {
          access_duration_days: number | null
          allow_free_lessons: boolean | null
          area_name: string | null
          created_at: string
          custom_domain: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          product_id: string
          require_email_verification: boolean | null
          secondary_color: string | null
          send_welcome_email: boolean | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          access_duration_days?: number | null
          allow_free_lessons?: boolean | null
          area_name?: string | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          product_id: string
          require_email_verification?: boolean | null
          secondary_color?: string | null
          send_welcome_email?: boolean | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          access_duration_days?: number | null
          allow_free_lessons?: boolean | null
          area_name?: string | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          product_id?: string
          require_email_verification?: boolean | null
          secondary_color?: string | null
          send_welcome_email?: boolean | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_area_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          alert_type: string
          context: Json | null
          created_at: string
          id: string
          message: string
          resolved: boolean | null
          resolved_at: string | null
          sentry_event_id: string | null
          source: string
          stack_trace: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          alert_type: string
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          resolved?: boolean | null
          resolved_at?: string | null
          sentry_event_id?: string | null
          source: string
          stack_trace?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          alert_type?: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean | null
          resolved_at?: string | null
          sentry_event_id?: string | null
          source?: string
          stack_trace?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_bumps: {
        Row: {
          auxiliary_phrase: string | null
          bump_product_id: string | null
          created_at: string
          description: string | null
          discount_price: number | null
          discount_type: string | null
          discount_value: number | null
          highlight_color: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_subscription: boolean | null
          name: string
          position: number
          price: number
          product_id: string
          sales_phrase: string | null
          subscription_interval: string | null
          updated_at: string
        }
        Insert: {
          auxiliary_phrase?: string | null
          bump_product_id?: string | null
          created_at?: string
          description?: string | null
          discount_price?: number | null
          discount_type?: string | null
          discount_value?: number | null
          highlight_color?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_subscription?: boolean | null
          name: string
          position?: number
          price?: number
          product_id: string
          sales_phrase?: string | null
          subscription_interval?: string | null
          updated_at?: string
        }
        Update: {
          auxiliary_phrase?: string | null
          bump_product_id?: string | null
          created_at?: string
          description?: string | null
          discount_price?: number | null
          discount_type?: string | null
          discount_value?: number | null
          highlight_color?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_subscription?: boolean | null
          name?: string
          position?: number
          price?: number
          product_id?: string
          sales_phrase?: string | null
          subscription_interval?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_bumps_bump_product_id_fkey"
            columns: ["bump_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_bumps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_commissions: {
        Row: {
          commission_amount: number
          commission_percentage: number
          commission_type: string
          created_at: string
          id: string
          item_amount: number
          order_item_id: string
          role: string
          sale_commission_id: string | null
          user_id: string
        }
        Insert: {
          commission_amount?: number
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          id?: string
          item_amount?: number
          order_item_id: string
          role: string
          sale_commission_id?: string | null
          user_id: string
        }
        Update: {
          commission_amount?: number
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          id?: string
          item_amount?: number
          order_item_id?: string
          role?: string
          sale_commission_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_commissions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_commissions_sale_commission_id_fkey"
            columns: ["sale_commission_id"]
            isOneToOne: false
            referencedRelation: "sale_commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_status: string
          id: string
          item_type: string
          name: string
          order_bump_id: string | null
          product_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          id?: string
          item_type: string
          name: string
          order_bump_id?: string | null
          product_id: string
          quantity?: number
          sale_id: string
          subtotal: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          id?: string
          item_type?: string
          name?: string
          order_bump_id?: string | null
          product_id?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_bump_id_fkey"
            columns: ["order_bump_id"]
            isOneToOne: false
            referencedRelation: "order_bumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          ip_address: string | null
          max_attempts: number
          purpose: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          ip_address?: string | null
          max_attempts?: number
          purpose?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          max_attempts?: number
          purpose?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          amount: number
          buyer_document: string | null
          buyer_email: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          gateway_response: Json | null
          id: string
          ip_address: string | null
          metadata: Json | null
          payment_method: string
          product_id: string | null
          sale_id: string | null
          seller_user_id: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          amount?: number
          buyer_document?: string | null
          buyer_email?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          gateway_response?: Json | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          payment_method: string
          product_id?: string | null
          sale_id?: string | null
          seller_user_id?: string | null
          status: string
          user_agent?: string | null
        }
        Update: {
          amount?: number
          buyer_document?: string | null
          buyer_email?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          gateway_response?: Json | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          payment_method?: string
          product_id?: string | null
          sale_id?: string | null
          seller_user_id?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_splits: {
        Row: {
          available_at: string | null
          created_at: string
          fee_amount: number
          gateway_reference: string | null
          gross_amount: number
          id: string
          idempotency_key: string | null
          is_locked: boolean | null
          is_released: boolean | null
          metadata: Json | null
          net_amount: number
          platform_fee: number
          processed_at: string | null
          recipient_type: string | null
          released_at: string | null
          role: string
          sale_id: string
          split_percentage: number
          status: string
          transaction_id: string | null
          transferred_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_at?: string | null
          created_at?: string
          fee_amount?: number
          gateway_reference?: string | null
          gross_amount?: number
          id?: string
          idempotency_key?: string | null
          is_locked?: boolean | null
          is_released?: boolean | null
          metadata?: Json | null
          net_amount?: number
          platform_fee?: number
          processed_at?: string | null
          recipient_type?: string | null
          released_at?: string | null
          role: string
          sale_id: string
          split_percentage?: number
          status?: string
          transaction_id?: string | null
          transferred_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available_at?: string | null
          created_at?: string
          fee_amount?: number
          gateway_reference?: string | null
          gross_amount?: number
          id?: string
          idempotency_key?: string | null
          is_locked?: boolean | null
          is_released?: boolean | null
          metadata?: Json | null
          net_amount?: number
          platform_fee?: number
          processed_at?: string | null
          recipient_type?: string | null
          released_at?: string | null
          role?: string
          sale_id?: string
          split_percentage?: number
          status?: string
          transaction_id?: string | null
          transferred_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_splits_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          gateway: string
          gateway_fee: number | null
          gateway_response: Json | null
          gateway_transaction_id: string | null
          id: string
          idempotency_key: string | null
          is_locked: boolean | null
          metadata: Json | null
          net_amount: number
          paid_at: string | null
          payment_method: string
          platform_fee: number | null
          refund_reason: string | null
          refunded_at: string | null
          sale_id: string | null
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          gateway?: string
          gateway_fee?: number | null
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string | null
          is_locked?: boolean | null
          metadata?: Json | null
          net_amount: number
          paid_at?: string | null
          payment_method: string
          platform_fee?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          sale_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          gateway?: string
          gateway_fee?: number | null
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string | null
          is_locked?: boolean | null
          metadata?: Json | null
          net_amount?: number
          paid_at?: string | null
          payment_method?: string
          platform_fee?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          sale_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pixel_event_logs: {
        Row: {
          checkout_pixel_id: string | null
          created_at: string
          currency: string | null
          error_message: string | null
          event_id: string | null
          event_source: string
          event_type: string
          id: string
          metadata: Json | null
          pixel_type: string
          product_id: string | null
          sale_id: string | null
          status: string
          transaction_id: string | null
          value: number | null
        }
        Insert: {
          checkout_pixel_id?: string | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          event_id?: string | null
          event_source: string
          event_type: string
          id?: string
          metadata?: Json | null
          pixel_type: string
          product_id?: string | null
          sale_id?: string | null
          status?: string
          transaction_id?: string | null
          value?: number | null
        }
        Update: {
          checkout_pixel_id?: string | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          event_id?: string | null
          event_source?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          pixel_type?: string
          product_id?: string | null
          sale_id?: string | null
          status?: string
          transaction_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pixel_event_logs_checkout_pixel_id_fkey"
            columns: ["checkout_pixel_id"]
            isOneToOne: false
            referencedRelation: "checkout_pixels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pixel_event_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pixel_event_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fees: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          fee_type: Database["public"]["Enums"]["fee_type"]
          id: string
          is_active: boolean
          max_value: number | null
          min_value: number | null
          tenant_id: string | null
          updated_at: string
          value: number
          value_type: Database["public"]["Enums"]["fee_value_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          fee_type: Database["public"]["Enums"]["fee_type"]
          id?: string
          is_active?: boolean
          max_value?: number | null
          min_value?: number | null
          tenant_id?: string | null
          updated_at?: string
          value: number
          value_type?: Database["public"]["Enums"]["fee_value_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          fee_type?: Database["public"]["Enums"]["fee_type"]
          id?: string
          is_active?: boolean
          max_value?: number | null
          min_value?: number | null
          tenant_id?: string | null
          updated_at?: string
          value?: number
          value_type?: Database["public"]["Enums"]["fee_value_type"]
        }
        Relationships: []
      }
      product_deletion_logs: {
        Row: {
          attempted_at: string
          blocked_reason: string
          created_at: string
          id: string
          product_id: string
          product_name: string | null
          sales_count: number
          user_id: string
        }
        Insert: {
          attempted_at?: string
          blocked_reason: string
          created_at?: string
          id?: string
          product_id: string
          product_name?: string | null
          sales_count?: number
          user_id: string
        }
        Update: {
          attempted_at?: string
          blocked_reason?: string
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string | null
          sales_count?: number
          user_id?: string
        }
        Relationships: []
      }
      product_deliverables: {
        Row: {
          content_url: string | null
          created_at: string
          delivery_type: string
          description: string | null
          download_count: number | null
          email_body: string | null
          email_subject: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          is_active: boolean | null
          link_delivery_method: string | null
          max_downloads: number | null
          name: string
          position: number | null
          product_id: string
          updated_at: string
        }
        Insert: {
          content_url?: string | null
          created_at?: string
          delivery_type: string
          description?: string | null
          download_count?: number | null
          email_body?: string | null
          email_subject?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          link_delivery_method?: string | null
          max_downloads?: number | null
          name: string
          position?: number | null
          product_id: string
          updated_at?: string
        }
        Update: {
          content_url?: string | null
          created_at?: string
          delivery_type?: string
          description?: string | null
          download_count?: number | null
          email_body?: string | null
          email_subject?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          link_delivery_method?: string | null
          max_downloads?: number | null
          name?: string
          position?: number | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_deliverables_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_links: {
        Row: {
          clicks: number
          conversions: number
          created_at: string
          custom_price: number | null
          id: string
          is_active: boolean
          name: string
          product_id: string
          short_code: string | null
          slug: string
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          clicks?: number
          conversions?: number
          created_at?: string
          custom_price?: number | null
          id?: string
          is_active?: boolean
          name: string
          product_id: string
          short_code?: string | null
          slug: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          clicks?: number
          conversions?: number
          created_at?: string
          custom_price?: number | null
          id?: string
          is_active?: boolean
          name?: string
          product_id?: string
          short_code?: string | null
          slug?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_logistics: {
        Row: {
          created_at: string
          height_cm: number
          id: string
          length_cm: number
          product_id: string
          updated_at: string
          weight_g: number
          width_cm: number
        }
        Insert: {
          created_at?: string
          height_cm: number
          id?: string
          length_cm: number
          product_id: string
          updated_at?: string
          weight_g: number
          width_cm: number
        }
        Update: {
          created_at?: string
          height_cm?: number
          id?: string
          length_cm?: number
          product_id?: string
          updated_at?: string
          weight_g?: number
          width_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_logistics_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offers: {
        Row: {
          created_at: string
          credit_card_enabled: boolean | null
          discount_type: string | null
          discount_value: number | null
          final_price: number
          id: string
          name: string
          pix_enabled: boolean | null
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_card_enabled?: boolean | null
          discount_type?: string | null
          discount_value?: number | null
          final_price: number
          id?: string
          name?: string
          pix_enabled?: boolean | null
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_card_enabled?: boolean | null
          discount_type?: string | null
          discount_value?: number | null
          final_price?: number
          id?: string
          name?: string
          pix_enabled?: boolean | null
          product_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          id: string
          is_featured: boolean
          product_id: string
          rating: number
          review_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          id?: string
          is_featured?: boolean
          product_id: string
          rating: number
          review_text?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          id?: string
          is_featured?: boolean
          product_id?: string
          rating?: number
          review_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_settings: {
        Row: {
          affiliate_commission: number
          created_at: string
          custom_thank_you_message: string | null
          enable_affiliates: boolean
          enable_email_notifications: boolean
          enable_pixel_facebook: string | null
          enable_pixel_google: string | null
          enable_pixel_tiktok: string | null
          enable_whatsapp_notifications: boolean
          id: string
          product_id: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          affiliate_commission?: number
          created_at?: string
          custom_thank_you_message?: string | null
          enable_affiliates?: boolean
          enable_email_notifications?: boolean
          enable_pixel_facebook?: string | null
          enable_pixel_google?: string | null
          enable_pixel_tiktok?: string | null
          enable_whatsapp_notifications?: boolean
          id?: string
          product_id: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          affiliate_commission?: number
          created_at?: string
          custom_thank_you_message?: string | null
          enable_affiliates?: boolean
          enable_email_notifications?: boolean
          enable_pixel_facebook?: string | null
          enable_pixel_google?: string | null
          enable_pixel_tiktok?: string | null
          enable_whatsapp_notifications?: boolean
          id?: string
          product_id?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_auto_approve: boolean | null
          category: string
          commission_percentage: number | null
          created_at: string
          delivery_method: string | null
          description: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          length_cm: number | null
          marketplace_enabled: boolean | null
          name: string
          payment_type: string
          price: number
          product_type: string
          sac_email: string | null
          sac_name: string | null
          sac_phone: string | null
          sales_page_url: string | null
          slug: string | null
          status: string
          stock: number | null
          subscription_quantity_mode: string | null
          updated_at: string
          user_id: string
          weight: number | null
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          affiliate_auto_approve?: boolean | null
          category: string
          commission_percentage?: number | null
          created_at?: string
          delivery_method?: string | null
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          length_cm?: number | null
          marketplace_enabled?: boolean | null
          name: string
          payment_type?: string
          price?: number
          product_type: string
          sac_email?: string | null
          sac_name?: string | null
          sac_phone?: string | null
          sales_page_url?: string | null
          slug?: string | null
          status?: string
          stock?: number | null
          subscription_quantity_mode?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          affiliate_auto_approve?: boolean | null
          category?: string
          commission_percentage?: number | null
          created_at?: string
          delivery_method?: string | null
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          length_cm?: number | null
          marketplace_enabled?: boolean | null
          name?: string
          payment_type?: string
          price?: number
          product_type?: string
          sac_email?: string | null
          sac_name?: string | null
          sac_phone?: string | null
          sales_page_url?: string | null
          slug?: string | null
          status?: string
          stock?: number | null
          subscription_quantity_mode?: string | null
          updated_at?: string
          user_id?: string
          weight?: number | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blocked_at: string | null
          blocked_reason: string | null
          cep: string | null
          city: string | null
          complement: string | null
          created_at: string
          document_number: string | null
          document_type: string | null
          email: string | null
          full_name: string | null
          id: string
          is_blocked: boolean | null
          mcc_category: string | null
          neighborhood: string | null
          state: string | null
          street: string | null
          street_number: string | null
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          mcc_category?: string | null
          neighborhood?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          mcc_category?: string | null
          neighborhood?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          gateway_refund_id: string | null
          id: string
          metadata: Json | null
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          refund_type: string
          requested_by: string | null
          sale_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          gateway_refund_id?: string | null
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          refund_type: string
          requested_by?: string | null
          sale_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          gateway_refund_id?: string | null
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          refund_type?: string
          requested_by?: string | null
          sale_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_commissions: {
        Row: {
          anticipated_at: string | null
          anticipation_id: string | null
          calculation_details: Json | null
          commission_amount: number
          commission_percentage: number
          commission_type: string
          created_at: string
          id: string
          idempotency_key: string | null
          is_released: boolean | null
          net_amount: number
          original_amount: number
          paid_at: string | null
          refund_status: string | null
          released_at: string | null
          role: string
          sale_amount: number
          sale_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anticipated_at?: string | null
          anticipation_id?: string | null
          calculation_details?: Json | null
          commission_amount?: number
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          is_released?: boolean | null
          net_amount?: number
          original_amount?: number
          paid_at?: string | null
          refund_status?: string | null
          released_at?: string | null
          role: string
          sale_amount?: number
          sale_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anticipated_at?: string | null
          anticipation_id?: string | null
          calculation_details?: Json | null
          commission_amount?: number
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          is_released?: boolean | null
          net_amount?: number
          original_amount?: number
          paid_at?: string | null
          refund_status?: string | null
          released_at?: string | null
          role?: string
          sale_amount?: number
          sale_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_status_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_status: string
          previous_status: string | null
          sale_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status: string
          previous_status?: string | null
          sale_id: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status?: string
          previous_status?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_status_history_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          affiliate_commission_percent: number
          affiliation_id: string | null
          amount: number
          buyer_document: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone: string | null
          campaign_id: string | null
          commission_amount: number
          coupon_code: string | null
          coupon_discount: number | null
          created_at: string
          id: string
          installments: number | null
          metadata: Json | null
          net_amount: number
          payment_fee: number
          payment_fee_percent: number
          payment_method: string
          platform_fee: number
          platform_fee_percent: number
          product_id: string
          seller_user_id: string
          shipping_cep: string | null
          shipping_city: string | null
          shipping_complement: string | null
          shipping_neighborhood: string | null
          shipping_number: string | null
          shipping_state: string | null
          shipping_street: string | null
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          affiliate_commission_percent?: number
          affiliation_id?: string | null
          amount?: number
          buyer_document?: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone?: string | null
          campaign_id?: string | null
          commission_amount?: number
          coupon_code?: string | null
          coupon_discount?: number | null
          created_at?: string
          id?: string
          installments?: number | null
          metadata?: Json | null
          net_amount?: number
          payment_fee?: number
          payment_fee_percent?: number
          payment_method?: string
          platform_fee?: number
          platform_fee_percent?: number
          product_id: string
          seller_user_id: string
          shipping_cep?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Update: {
          affiliate_commission_percent?: number
          affiliation_id?: string | null
          amount?: number
          buyer_document?: string | null
          buyer_email?: string
          buyer_name?: string
          buyer_phone?: string | null
          campaign_id?: string | null
          commission_amount?: number
          coupon_code?: string | null
          coupon_discount?: number | null
          created_at?: string
          id?: string
          installments?: number | null
          metadata?: Json | null
          net_amount?: number
          payment_fee?: number
          payment_fee_percent?: number
          payment_method?: string
          platform_fee?: number
          platform_fee_percent?: number
          product_id?: string
          seller_user_id?: string
          shipping_cep?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_affiliation_id_fkey"
            columns: ["affiliation_id"]
            isOneToOne: false
            referencedRelation: "affiliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_funnel_events: {
        Row: {
          action: string
          amount: number | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          offer_id: string | null
          offer_type: string | null
          product_id: string | null
          sale_id: string | null
          session_id: string
          step: string
          user_agent: string | null
          user_email: string | null
        }
        Insert: {
          action: string
          amount?: number | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          offer_id?: string | null
          offer_type?: string | null
          product_id?: string | null
          sale_id?: string | null
          session_id: string
          step: string
          user_agent?: string | null
          user_email?: string | null
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          offer_id?: string | null
          offer_type?: string | null
          product_id?: string | null
          sale_id?: string | null
          session_id?: string
          step?: string
          user_agent?: string | null
          user_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_funnel_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_funnel_events_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          created_at: string
          custom_end_date: string | null
          custom_start_date: string | null
          goal_amount: number
          id: string
          is_active: boolean
          period_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_end_date?: string | null
          custom_start_date?: string | null
          goal_amount?: number
          id?: string
          is_active?: boolean
          period_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_end_date?: string | null
          custom_start_date?: string | null
          goal_amount?: number
          id?: string
          is_active?: boolean
          period_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saques: {
        Row: {
          bank_account_id: string | null
          completed_at: string | null
          created_at: string
          erro_mensagem: string | null
          gateway_reference: string | null
          id: string
          idempotency_key: string | null
          ip_address: unknown
          processed_at: string | null
          status: string
          taxa_saque: number
          user_id: string
          valor: number
          valor_liquido: number
        }
        Insert: {
          bank_account_id?: string | null
          completed_at?: string | null
          created_at?: string
          erro_mensagem?: string | null
          gateway_reference?: string | null
          id?: string
          idempotency_key?: string | null
          ip_address?: unknown
          processed_at?: string | null
          status?: string
          taxa_saque?: number
          user_id: string
          valor: number
          valor_liquido: number
        }
        Update: {
          bank_account_id?: string | null
          completed_at?: string | null
          created_at?: string
          erro_mensagem?: string | null
          gateway_reference?: string | null
          id?: string
          idempotency_key?: string | null
          ip_address?: unknown
          processed_at?: string | null
          status?: string
          taxa_saque?: number
          user_id?: string
          valor?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "saques_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_proof_entries: {
        Row: {
          created_at: string
          customer_location: string | null
          customer_name: string | null
          display_count: number | null
          id: string
          is_active: boolean | null
          is_real: boolean | null
          message: string | null
          metadata: Json | null
          product_id: string | null
          proof_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_location?: string | null
          customer_name?: string | null
          display_count?: number | null
          id?: string
          is_active?: boolean | null
          is_real?: boolean | null
          message?: string | null
          metadata?: Json | null
          product_id?: string | null
          proof_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_location?: string | null
          customer_name?: string | null
          display_count?: number | null
          id?: string
          is_active?: boolean | null
          is_real?: boolean | null
          message?: string | null
          metadata?: Json | null
          product_id?: string | null
          proof_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_proof_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      social_proofs: {
        Row: {
          author_avatar_url: string | null
          author_name: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          position: number
          product_id: string
          type: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_name: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          product_id: string
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          product_id?: string
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_proofs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string
          document: string | null
          email: string
          enrolled_at: string
          external_id: string | null
          external_metadata: Json | null
          external_platform: string | null
          external_synced_at: string | null
          id: string
          is_blocked: boolean | null
          name: string
          notes: string | null
          phone: string | null
          product_id: string
          seller_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          document?: string | null
          email: string
          enrolled_at?: string
          external_id?: string | null
          external_metadata?: Json | null
          external_platform?: string | null
          external_synced_at?: string | null
          id?: string
          is_blocked?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          product_id: string
          seller_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          document?: string | null
          email?: string
          enrolled_at?: string
          external_id?: string | null
          external_metadata?: Json | null
          external_platform?: string | null
          external_synced_at?: string | null
          id?: string
          is_blocked?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          product_id?: string
          seller_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_access: {
        Row: {
          access_granted_at: string | null
          access_revoked_at: string | null
          created_at: string | null
          id: string
          member_email: string
          member_name: string | null
          revoke_reason: string | null
          status: string
          subscription_id: string
          updated_at: string | null
        }
        Insert: {
          access_granted_at?: string | null
          access_revoked_at?: string | null
          created_at?: string | null
          id?: string
          member_email: string
          member_name?: string | null
          revoke_reason?: string | null
          status?: string
          subscription_id: string
          updated_at?: string | null
        }
        Update: {
          access_granted_at?: string | null
          access_revoked_at?: string | null
          created_at?: string | null
          id?: string
          member_email?: string
          member_name?: string | null
          revoke_reason?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_access_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_access_logs: {
        Row: {
          created_at: string
          enrollment_id: string | null
          event_type: string
          id: string
          metadata: Json | null
          new_status: string | null
          previous_status: string | null
          reason: string | null
          student_id: string | null
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enrollment_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          reason?: string | null
          student_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enrollment_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          reason?: string | null
          student_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_access_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_access_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_access_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          currency: string
          current_period_end: string
          current_period_start: string
          external_customer_id: string | null
          external_subscription_id: string | null
          id: string
          metadata: Json | null
          payment_method: string | null
          plan_interval: string
          product_id: string
          quantity: number | null
          started_at: string | null
          status: string
          total_recurring: number | null
          unit_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end: string
          current_period_start?: string
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          plan_interval?: string
          product_id: string
          quantity?: number | null
          started_at?: string | null
          status?: string
          total_recurring?: number | null
          unit_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string
          current_period_start?: string
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          plan_interval?: string
          product_id?: string
          quantity?: number | null
          started_at?: string | null
          status?: string
          total_recurring?: number | null
          unit_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          archived_at: string | null
          chat_type: string
          created_at: string
          id: string
          is_from_user: boolean
          message: string
          read: boolean
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          archived_at?: string | null
          chat_type?: string
          created_at?: string
          id?: string
          is_from_user?: boolean
          message: string
          read?: boolean
          session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          archived_at?: string | null
          chat_type?: string
          created_at?: string
          id?: string
          is_from_user?: boolean
          message?: string
          read?: boolean
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      taxas_configuradas: {
        Row: {
          ativa: boolean | null
          categoria_taxa: string
          codigo: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          tipo_transacao: string
          tipo_valor: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          ativa?: boolean | null
          categoria_taxa: string
          codigo: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tipo_transacao: string
          tipo_valor: string
          updated_at?: string | null
          valor?: number
        }
        Update: {
          ativa?: boolean | null
          categoria_taxa?: string
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo_transacao?: string
          tipo_valor?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: []
      }
      taxas_transacoes: {
        Row: {
          calculado_em: string | null
          categoria_taxa: string
          codigo_taxa: string
          created_at: string | null
          id: string
          nome_taxa: string
          percentual_aplicado: number | null
          taxa_configurada_id: string | null
          tipo_taxa: string
          transacao_id: string
          valor_base: number
          valor_liquido_apos: number
          valor_taxa: number
        }
        Insert: {
          calculado_em?: string | null
          categoria_taxa: string
          codigo_taxa: string
          created_at?: string | null
          id?: string
          nome_taxa: string
          percentual_aplicado?: number | null
          taxa_configurada_id?: string | null
          tipo_taxa: string
          transacao_id: string
          valor_base: number
          valor_liquido_apos: number
          valor_taxa: number
        }
        Update: {
          calculado_em?: string | null
          categoria_taxa?: string
          codigo_taxa?: string
          created_at?: string | null
          id?: string
          nome_taxa?: string
          percentual_aplicado?: number | null
          taxa_configurada_id?: string | null
          tipo_taxa?: string
          transacao_id?: string
          valor_base?: number
          valor_liquido_apos?: number
          valor_taxa?: number
        }
        Relationships: [
          {
            foreignKeyName: "taxas_transacoes_taxa_configurada_id_fkey"
            columns: ["taxa_configurada_id"]
            isOneToOne: false
            referencedRelation: "taxas_configuradas"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_notifications: {
        Row: {
          amount: number | null
          chat_id: string
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          message: string
          message_id: string | null
          sale_id: string | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          chat_id: string
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          message: string
          message_id?: string | null
          sale_id?: string | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          chat_id?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          message?: string
          message_id?: string | null
          sale_id?: string | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tenant_settings: {
        Row: {
          cnpj: string | null
          company_name: string | null
          created_at: string
          id: string
          is_active: boolean | null
          tenant_id: string
          updated_at: string
          use_custom_fees: boolean | null
        }
        Insert: {
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          tenant_id: string
          updated_at?: string
          use_custom_fees?: boolean | null
        }
        Update: {
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          tenant_id?: string
          updated_at?: string
          use_custom_fees?: boolean | null
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          antecipada: boolean
          commission_id: string | null
          created_at: string
          data_liberacao: string | null
          data_pagamento: string | null
          descricao: string | null
          id: string
          sacado: boolean
          sale_id: string | null
          status: string
          status_financeiro: string | null
          tipo: string
          tipo_transacao: string | null
          total_taxas: number | null
          updated_at: string
          user_id: string
          valor: number
          valor_liquido: number | null
        }
        Insert: {
          antecipada?: boolean
          commission_id?: string | null
          created_at?: string
          data_liberacao?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          id?: string
          sacado?: boolean
          sale_id?: string | null
          status?: string
          status_financeiro?: string | null
          tipo?: string
          tipo_transacao?: string | null
          total_taxas?: number | null
          updated_at?: string
          user_id: string
          valor: number
          valor_liquido?: number | null
        }
        Update: {
          antecipada?: boolean
          commission_id?: string | null
          created_at?: string
          data_liberacao?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          id?: string
          sacado?: boolean
          sale_id?: string | null
          status?: string
          status_financeiro?: string | null
          tipo?: string
          tipo_transacao?: string | null
          total_taxas?: number | null
          updated_at?: string
          user_id?: string
          valor?: number
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "sale_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          max_students: number | null
          name: string
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          max_students?: number | null
          name: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          max_students?: number | null
          name?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turmas_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      upsells: {
        Row: {
          created_at: string
          cta_text: string | null
          decline_text: string | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          headline: string | null
          id: string
          is_active: boolean | null
          is_subscription: boolean | null
          name: string
          offer_price: number
          original_price: number
          position: number | null
          product_id: string
          subheadline: string | null
          subscription_interval: string | null
          timer_enabled: boolean | null
          timer_minutes: number | null
          updated_at: string
          upsell_product_id: string
        }
        Insert: {
          created_at?: string
          cta_text?: string | null
          decline_text?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          headline?: string | null
          id?: string
          is_active?: boolean | null
          is_subscription?: boolean | null
          name: string
          offer_price: number
          original_price: number
          position?: number | null
          product_id: string
          subheadline?: string | null
          subscription_interval?: string | null
          timer_enabled?: boolean | null
          timer_minutes?: number | null
          updated_at?: string
          upsell_product_id: string
        }
        Update: {
          created_at?: string
          cta_text?: string | null
          decline_text?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          headline?: string | null
          id?: string
          is_active?: boolean | null
          is_subscription?: boolean | null
          name?: string
          offer_price?: number
          original_price?: number
          position?: number | null
          product_id?: string
          subheadline?: string | null
          subscription_interval?: string | null
          timer_enabled?: boolean | null
          timer_minutes?: number | null
          updated_at?: string
          upsell_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsells_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsells_upsell_product_id_fkey"
            columns: ["upsell_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          config: Json | null
          connected: boolean
          created_at: string
          credentials_encrypted: Json | null
          error_count: number | null
          events_enabled: string[] | null
          id: string
          integration_id: string
          integration_type: string | null
          is_active: boolean | null
          last_error: string | null
          last_sync_at: string | null
          provider: string | null
          retry_policy: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json | null
          connected?: boolean
          created_at?: string
          credentials_encrypted?: Json | null
          error_count?: number | null
          events_enabled?: string[] | null
          id?: string
          integration_id: string
          integration_type?: string | null
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          provider?: string | null
          retry_policy?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json | null
          connected?: boolean
          created_at?: string
          credentials_encrypted?: Json | null
          error_count?: number | null
          events_enabled?: string[] | null
          id?: string
          integration_id?: string
          integration_type?: string | null
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          provider?: string | null
          retry_policy?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      utm_tracking: {
        Row: {
          checkout_session_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          is_locked: boolean | null
          landing_page: string | null
          locked_at: string | null
          referrer: string | null
          sale_id: string | null
          session_id: string | null
          transaction_id: string | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          utmify_error: string | null
          utmify_response: Json | null
          utmify_retry_count: number | null
          utmify_sent: boolean | null
          utmify_sent_at: string | null
        }
        Insert: {
          checkout_session_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          is_locked?: boolean | null
          landing_page?: string | null
          locked_at?: string | null
          referrer?: string | null
          sale_id?: string | null
          session_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          utmify_error?: string | null
          utmify_response?: Json | null
          utmify_retry_count?: number | null
          utmify_sent?: boolean | null
          utmify_sent_at?: string | null
        }
        Update: {
          checkout_session_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          is_locked?: boolean | null
          landing_page?: string | null
          locked_at?: string | null
          referrer?: string | null
          sale_id?: string | null
          session_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          utmify_error?: string | null
          utmify_response?: Json | null
          utmify_retry_count?: number | null
          utmify_sent?: boolean | null
          utmify_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utm_tracking_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utm_tracking_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      utmify_logs: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          order_id: string
          payload: Json
          response: Json | null
          sale_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          order_id: string
          payload: Json
          response?: Json | null
          sale_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          order_id?: string
          payload?: Json
          response?: Json | null
          sale_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          gateway: string
          headers: Json | null
          id: string
          payload: Json
          processed_at: string | null
          processing_started_at: string | null
          result_data: Json | null
          retry_count: number | null
          signature: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          gateway?: string
          headers?: Json | null
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_started_at?: string | null
          result_data?: Json | null
          retry_count?: number | null
          signature?: string | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          gateway?: string
          headers?: Json | null
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_started_at?: string | null
          result_data?: Json | null
          retry_count?: number | null
          signature?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          delivered_at: string | null
          endpoint_url: string | null
          error_message: string | null
          event_type: string
          failed_at: string | null
          hmac_signature: string | null
          id: string
          idempotency_key: string | null
          integration_id: string | null
          ip_address: string | null
          latency_ms: number | null
          max_retries: number | null
          metadata: Json | null
          next_retry_at: string | null
          payload: Json
          processed_at: string | null
          request_payload: Json | null
          response_body: string | null
          response_data: Json | null
          response_headers: Json | null
          response_status: number | null
          retry_count: number | null
          signature_verified: boolean | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          endpoint_url?: string | null
          error_message?: string | null
          event_type: string
          failed_at?: string | null
          hmac_signature?: string | null
          id?: string
          idempotency_key?: string | null
          integration_id?: string | null
          ip_address?: string | null
          latency_ms?: number | null
          max_retries?: number | null
          metadata?: Json | null
          next_retry_at?: string | null
          payload?: Json
          processed_at?: string | null
          request_payload?: Json | null
          response_body?: string | null
          response_data?: Json | null
          response_headers?: Json | null
          response_status?: number | null
          retry_count?: number | null
          signature_verified?: boolean | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          endpoint_url?: string | null
          error_message?: string | null
          event_type?: string
          failed_at?: string | null
          hmac_signature?: string | null
          id?: string
          idempotency_key?: string | null
          integration_id?: string | null
          ip_address?: string | null
          latency_ms?: number | null
          max_retries?: number | null
          metadata?: Json | null
          next_retry_at?: string | null
          payload?: Json
          processed_at?: string | null
          request_payload?: Json | null
          response_body?: string | null
          response_data?: Json | null
          response_headers?: Json | null
          response_status?: number | null
          retry_count?: number | null
          signature_verified?: boolean | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          delivered_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          message_body: string | null
          message_type: string | null
          phone_number: string
          provider_message_id: string | null
          read_at: string | null
          sale_id: string | null
          sent_at: string | null
          status: string | null
          template_name: string | null
          template_params: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_body?: string | null
          message_type?: string | null
          phone_number: string
          provider_message_id?: string | null
          read_at?: string | null
          sale_id?: string | null
          sent_at?: string | null
          status?: string | null
          template_name?: string | null
          template_params?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_body?: string | null
          message_type?: string | null
          phone_number?: string
          provider_message_id?: string | null
          read_at?: string | null
          sale_id?: string | null
          sent_at?: string | null
          status?: string | null
          template_name?: string | null
          template_params?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          fee: number
          id: string
          net_amount: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          fee?: number
          id?: string
          net_amount: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          fee?: number
          id?: string
          net_amount?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapier_triggers: {
        Row: {
          created_at: string
          error_count: number | null
          event_types: string[]
          id: string
          is_active: boolean | null
          last_error: string | null
          last_triggered_at: string | null
          metadata: Json | null
          trigger_count: number | null
          updated_at: string
          user_id: string
          webhook_url: string
          zap_id: string | null
        }
        Insert: {
          created_at?: string
          error_count?: number | null
          event_types: string[]
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_triggered_at?: string | null
          metadata?: Json | null
          trigger_count?: number | null
          updated_at?: string
          user_id: string
          webhook_url: string
          zap_id?: string | null
        }
        Update: {
          created_at?: string
          error_count?: number | null
          event_types?: string[]
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_triggered_at?: string | null
          metadata?: Json | null
          trigger_count?: number | null
          updated_at?: string
          user_id?: string
          webhook_url?: string
          zap_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      ab_test_metrics: {
        Row: {
          checkouts_started: number | null
          page_views: number | null
          product_id: string | null
          purchases: number | null
          unique_sessions: number | null
          variant: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          agent_messages: number | null
          archived_at: string | null
          last_message_at: string | null
          message_count: number | null
          session_id: string | null
          started_at: string | null
          status: string | null
          user_email: string | null
          user_id: string | null
          user_messages: number | null
          user_name: string | null
        }
        Relationships: []
      }
      v_gateway_metrics: {
        Row: {
          approved_amount: number | null
          approved_count: number | null
          boleto_amount: number | null
          boleto_count: number | null
          card_amount: number | null
          card_count: number | null
          chargeback_count: number | null
          date: string | null
          failed_count: number | null
          pending_amount: number | null
          pending_count: number | null
          pix_amount: number | null
          pix_count: number | null
          refunded_count: number | null
          total_amount: number | null
          total_attempts: number | null
          total_payment_fees: number | null
          total_platform_fees: number | null
        }
        Relationships: []
      }
      v_saldo_consolidado: {
        Row: {
          qtd_transacoes_aprovadas: number | null
          saldo_disponivel: number | null
          saldo_em_retencao: number | null
          saldo_pendente: number | null
          total_aprovado: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_transacoes_antecipacao: {
        Row: {
          created_at: string | null
          data_liberacao: string | null
          dias_para_liberacao: number | null
          id: string | null
          status: string | null
          taxa_antecipacao: number | null
          user_id: string | null
          valor: number | null
          valor_liquido_antecipacao: number | null
        }
        Insert: {
          created_at?: string | null
          data_liberacao?: string | null
          dias_para_liberacao?: never
          id?: string | null
          status?: string | null
          taxa_antecipacao?: never
          user_id?: string | null
          valor?: number | null
          valor_liquido_antecipacao?: never
        }
        Update: {
          created_at?: string | null
          data_liberacao?: string | null
          dias_para_liberacao?: never
          id?: string | null
          status?: string | null
          taxa_antecipacao?: never
          user_id?: string | null
          valor?: number | null
          valor_liquido_antecipacao?: never
        }
        Relationships: []
      }
      vw_saldo_usuario: {
        Row: {
          balance: number | null
          total_credits: number | null
          total_debits: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      audit_financial_action: {
        Args: {
          p_action: string
          p_amount?: number
          p_details?: Json
          p_entity_id: string
          p_entity_type: string
        }
        Returns: string
      }
      calcular_taxas_transacao: {
        Args: {
          p_tipo_transacao: string
          p_transacao_id: string
          p_valor_bruto: number
        }
        Returns: {
          categoria: string
          codigo: string
          nome: string
          percentual: number
          taxa_id: string
          tipo: string
          valor_calculado: number
        }[]
      }
      calculate_sale_commissions: {
        Args: { p_sale_id: string }
        Returns: number
      }
      calculate_sale_commissions_v2: {
        Args: { p_sale_id: string }
        Returns: {
          commissions_created: number
          details: Json
          producer_net_amount: number
          success: boolean
          total_commission_amount: number
        }[]
      }
      can_impersonate: { Args: { _user_id: string }; Returns: boolean }
      change_primary_acquirer: {
        Args: {
          p_gateway_id: string
          p_motivo?: string
          p_nova_adquirente_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      check_subscription_access: {
        Args: { p_product_id: string; p_user_id: string }
        Returns: boolean
      }
      check_webhook_idempotency: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      complete_webhook_processing: {
        Args: {
          p_error_message?: string
          p_sale_id?: string
          p_success: boolean
          p_webhook_id: string
        }
        Returns: boolean
      }
      create_enrollment_after_payment: {
        Args: {
          p_product_id: string
          p_sale_id: string
          p_student_email: string
          p_student_name: string
        }
        Returns: string
      }
      create_enrollment_for_subscription: {
        Args: {
          p_student_email: string
          p_student_name: string
          p_subscription_id: string
        }
        Returns: string
      }
      create_system_notification: {
        Args: {
          p_link?: string
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
      }
      find_product_by_short_id: {
        Args: { short_id: string }
        Returns: {
          affiliate_auto_approve: boolean | null
          category: string
          commission_percentage: number | null
          created_at: string
          delivery_method: string | null
          description: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          length_cm: number | null
          marketplace_enabled: boolean | null
          name: string
          payment_type: string
          price: number
          product_type: string
          sac_email: string | null
          sac_name: string | null
          sac_phone: string | null
          sales_page_url: string | null
          slug: string | null
          status: string
          stock: number | null
          subscription_quantity_mode: string | null
          updated_at: string
          user_id: string
          weight: number | null
          weight_grams: number | null
          width_cm: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      find_product_link_by_code: {
        Args: { code: string }
        Returns: {
          custom_price: number
          id: string
          is_active: boolean
          name: string
          product_id: string
          slug: string
          utm_campaign: string
          utm_medium: string
          utm_source: string
        }[]
      }
      fn_calcular_disponivel_antecipacao: {
        Args: { p_user_id: string }
        Returns: {
          quantidade: number
          valor_disponivel: number
          valor_liquido_estimado: number
        }[]
      }
      fn_calcular_saldo_disponivel: {
        Args: { p_user_id: string }
        Returns: number
      }
      fn_get_meu_saldo: {
        Args: never
        Returns: {
          saldo_disponivel: number
          saldo_em_retencao: number
          saldo_pendente: number
          total_antecipado: number
          total_aprovado: number
          total_sacado: number
        }[]
      }
      fn_meu_saldo: {
        Args: never
        Returns: {
          saldo_disponivel: number
          saldo_em_retencao: number
          saldo_total: number
          total_antecipado: number
          total_sacado: number
        }[]
      }
      fn_processar_antecipacao: {
        Args: {
          p_idempotency_key?: string
          p_transacao_ids: string[]
          p_user_id: string
        }
        Returns: Json
      }
      fn_processar_antecipacao_v2: {
        Args: { p_transacao_ids: string[] }
        Returns: string
      }
      fn_processar_saque: {
        Args: {
          p_bank_account_id: string
          p_idempotency_key?: string
          p_user_id: string
          p_valor: number
        }
        Returns: Json
      }
      fn_register_webhook: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_gateway: string
          p_payload: Json
        }
        Returns: string
      }
      generate_all_daily_reports: { Args: never; Returns: undefined }
      generate_daily_report: {
        Args: { p_date: string; p_seller_id?: string }
        Returns: undefined
      }
      generate_short_code: { Args: { length?: number }; Returns: string }
      get_ab_test_results: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          abandonment_rate: number
          abandonments: number
          avg_time_to_action_seconds: number
          cta_click_rate: number
          cta_clicks: number
          product_access_rate: number
          product_accesses: number
          total_views: number
          variant: string
        }[]
      }
      get_active_subscription: {
        Args: { p_product_id: string; p_user_id: string }
        Returns: {
          amount: number
          cancel_at_period_end: boolean
          current_period_end: string
          current_period_start: string
          id: string
          plan_interval: string
          status: string
        }[]
      }
      get_admin_emails: {
        Args: never
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_calendar_events_by_date: {
        Args: { p_date: string; p_user_id: string }
        Returns: {
          color: string | null
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          event_type: string
          id: string
          is_all_day: boolean | null
          metadata: Json | null
          reminder_minutes: number | null
          title: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "calendar_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_member_area_stats: {
        Args: { p_product_id: string }
        Returns: {
          active_enrollments: number
          active_students: number
          blocked_students: number
          total_enrollments: number
          total_lessons: number
          total_modules: number
          total_students: number
        }[]
      }
      get_student_courses_by_email: {
        Args: { p_email: string }
        Returns: {
          completed_lessons: number
          course_id: string
          course_name: string
          enrollment_id: string
          enrollment_status: string
          total_lessons: number
        }[]
      }
      get_subscription_access_stats: {
        Args: { p_subscription_id: string }
        Returns: {
          active_accesses: number
          available_slots: number
          suspended_accesses: number
          total_quantity: number
          used_slots: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_otp: { Args: { code: string }; Returns: string }
      increment_coupon_usage: {
        Args: { p_campaign_id: string }
        Returns: boolean
      }
      is_admin_or_moderator: { Args: { _user_id: string }; Returns: boolean }
      is_admin_user: { Args: { check_user_id: string }; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_product_instructor: {
        Args: { p_product_id: string; p_user_id: string }
        Returns: boolean
      }
      is_product_owner: {
        Args: { _product_id: string; _user_id: string }
        Returns: boolean
      }
      is_sale_seller: {
        Args: { _sale_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_blocked: { Args: { p_user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_entity_id?: string
          p_entity_type: string
          p_user_id: string
        }
        Returns: string
      }
      log_checkout_event: {
        Args: {
          p_buyer_email: string
          p_event_type: string
          p_metadata?: Json
          p_new_status?: string
          p_previous_status?: string
          p_product_id: string
          p_session_id: string
        }
        Returns: string
      }
      log_financial_audit: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_new_values?: Json
          p_old_values?: Json
          p_reason?: string
          p_source?: string
        }
        Returns: string
      }
      log_financial_event: {
        Args: {
          p_action: string
          p_amount?: number
          p_reason?: string
          p_sale_id?: string
          p_status?: string
          p_user_id?: string
        }
        Returns: string
      }
      log_subscription_access_event: {
        Args: {
          p_event_type: string
          p_metadata?: Json
          p_new_status?: string
          p_previous_status?: string
          p_reason?: string
          p_subscription_id: string
        }
        Returns: string
      }
      manager_has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      process_approved_sale: { Args: { p_sale_id: string }; Returns: Json }
      process_expired_subscriptions: { Args: never; Returns: number }
      process_payment_confirmation: {
        Args: {
          p_gateway_data?: Json
          p_sale_id: string
          p_transaction_id: string
        }
        Returns: {
          commissions_created: number
          message: string
          success: boolean
        }[]
      }
      process_webhook_event: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_gateway: string
          p_payload: Json
          p_signature?: string
        }
        Returns: {
          is_duplicate: boolean
          message: string
          success: boolean
          webhook_id: string
        }[]
      }
      processar_transacao_completa: {
        Args: { p_transacao_id: string }
        Returns: Json
      }
      record_balance_movement: {
        Args: {
          p_amount: number
          p_description?: string
          p_movement_type: string
          p_reference_id?: string
          p_reference_type: string
          p_user_id: string
        }
        Returns: string
      }
      resolve_primary_acquirer: {
        Args: { p_gateway_id: string }
        Returns: {
          id: string
          nome_exibicao: string
        }[]
      }
      revoke_enrollment: {
        Args: { p_reason: string; p_sale_id: string }
        Returns: undefined
      }
      sync_subscription_accesses: {
        Args: { p_action?: string; p_subscription_id: string }
        Returns: number
      }
      sync_subscription_enrollment_access: {
        Args: { p_action: string; p_subscription_id: string }
        Returns: boolean
      }
      update_checkout_status: {
        Args: {
          p_metadata?: Json
          p_new_status: string
          p_session_id: string
          p_transaction_id?: string
        }
        Returns: boolean
      }
      upsert_checkout_session: {
        Args: {
          p_amount: number
          p_buyer_email: string
          p_expires_in_minutes?: number
          p_payment_method?: string
          p_product_id: string
        }
        Returns: string
      }
      validate_coupon: {
        Args: { p_amount: number; p_coupon_code: string; p_product_id: string }
        Returns: {
          campaign_id: string
          discount_amount: number
          discount_type: string
          discount_value: number
          error_message: string
          final_amount: number
          is_valid: boolean
        }[]
      }
      validate_coupon_full: {
        Args: { p_amount: number; p_code: string; p_product_id: string }
        Returns: {
          campaign_id: string
          discount_amount: number
          discount_type: string
          discount_value: number
          error_msg: string
          final_amount: number
          is_valid: boolean
        }[]
      }
      validate_subscription_quantity: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: boolean
      }
      validate_withdrawal_request: {
        Args: { p_amount: number; p_user_id: string }
        Returns: {
          available_balance: number
          error_message: string
          is_valid: boolean
        }[]
      }
      validate_withdrawal_request_v2: {
        Args: {
          p_amount: number
          p_bank_account_id?: string
          p_user_id: string
        }
        Returns: {
          available_balance: number
          error_code: string
          error_message: string
          is_valid: boolean
          pending_withdrawals: number
        }[]
      }
    }
    Enums: {
      antecipacao_status: "pendente" | "concluida" | "falhou"
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "account_manager"
        | "instructor"
        | "owner"
        | "admin_super"
      delivery_log_status: "sucesso" | "falha" | "pendente"
      fee_type:
        | "transaction"
        | "withdrawal"
        | "anticipation"
        | "pix"
        | "credit_card_2d"
        | "credit_card_7d"
        | "credit_card_15d"
        | "credit_card_30d"
        | "boleto"
        | "acquirer"
        | "subscription"
        | "chargeback"
        | "refund"
      fee_value_type: "fixed" | "percentage"
      saque_status: "pendente" | "processando" | "concluido" | "falhou"
      transacao_status: "pendente" | "aprovado" | "cancelado" | "estornado"
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
      antecipacao_status: ["pendente", "concluida", "falhou"],
      app_role: [
        "admin",
        "moderator",
        "user",
        "account_manager",
        "instructor",
        "owner",
        "admin_super",
      ],
      delivery_log_status: ["sucesso", "falha", "pendente"],
      fee_type: [
        "transaction",
        "withdrawal",
        "anticipation",
        "pix",
        "credit_card_2d",
        "credit_card_7d",
        "credit_card_15d",
        "credit_card_30d",
        "boleto",
        "acquirer",
        "subscription",
        "chargeback",
        "refund",
      ],
      fee_value_type: ["fixed", "percentage"],
      saque_status: ["pendente", "processando", "concluido", "falhou"],
      transacao_status: ["pendente", "aprovado", "cancelado", "estornado"],
    },
  },
} as const
