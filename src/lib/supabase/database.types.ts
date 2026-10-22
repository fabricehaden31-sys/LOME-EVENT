type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        { id: string; display_name: string; phone: string | null; country: string; city: string; avatar_url: string | null; role: string; created_at: string; updated_at: string },
        { id: string; display_name?: string; phone?: string | null; country?: string; city?: string; avatar_url?: string | null; role?: string },
        { display_name?: string; phone?: string | null; country?: string; city?: string; avatar_url?: string | null; role?: string; updated_at?: string }
      >;
      user_settings: Table<
        { user_id: string; language: string; theme: string; email_notifications: boolean; push_notifications: boolean; updated_at: string },
        { user_id: string; language?: string; theme?: string; email_notifications?: boolean; push_notifications?: boolean },
        { language?: string; theme?: string; email_notifications?: boolean; push_notifications?: boolean; updated_at?: string }
      >;
      categories: Table<
        { id: string; label: string; emoji: string; sort_order: number },
        { id: string; label: string; emoji?: string; sort_order?: number },
        { label?: string; emoji?: string; sort_order?: number }
      >;
      events: Table<
        { id: string; organizer_id: string; category_id: string; title: string; description: string; starts_at: string; ends_at: string | null; venue: string; address: string; district: string; poster_url: string | null; latitude: number | null; longitude: number | null; program: Json; status: string; featured: boolean; created_at: string; updated_at: string },
        { organizer_id: string; category_id: string; title: string; description: string; starts_at: string; ends_at?: string | null; venue: string; address: string; district: string; poster_url?: string | null; latitude?: number | null; longitude?: number | null; program?: Json; status?: string; featured?: boolean },
        { category_id?: string; title?: string; description?: string; starts_at?: string; ends_at?: string | null; venue?: string; address?: string; district?: string; poster_url?: string | null; latitude?: number | null; longitude?: number | null; program?: Json; status?: string; featured?: boolean; updated_at?: string }
      >;
      ticket_types: Table<
        { id: string; event_id: string; name: string; price_xof: number; quota: number; perks: string[]; sales_start: string | null; sales_end: string | null },
        { event_id: string; name: string; price_xof: number; quota: number; perks?: string[]; sales_start?: string | null; sales_end?: string | null },
        { name?: string; price_xof?: number; quota?: number; perks?: string[]; sales_start?: string | null; sales_end?: string | null }
      >;
      favorites: Table<
        { user_id: string; event_id: string; created_at: string },
        { user_id: string; event_id: string },
        never
      >;
      orders: Table<
        { id: string; user_id: string; event_id: string; total_xof: number; fees_xof: number; status: string; created_at: string },
        { user_id: string; event_id: string; total_xof: number; fees_xof?: number; status?: string },
        { status?: string }
      >;
      order_items: Table<
        { id: string; order_id: string; ticket_type_id: string; quantity: number; unit_price_xof: number; created_at: string },
        { order_id: string; ticket_type_id: string; quantity: number; unit_price_xof: number },
        never
      >;
      tickets: Table<
        { id: string; order_id: string; user_id: string; ticket_type_id: string; code: string; checked_in_at: string | null; created_at: string },
        { order_id: string; user_id: string; ticket_type_id: string; code: string },
        { checked_in_at?: string | null }
      >;
      notifications: Table<
        { id: string; user_id: string; title: string; body: string; read_at: string | null; created_at: string },
        { user_id: string; title: string; body: string },
        { read_at?: string | null }
      >;
      payments: Table<
        { id: string; order_id: string; provider: string; provider_reference: string | null; amount_xof: number; status: string; created_at: string },
        { order_id: string; provider: string; amount_xof: number; provider_reference?: string | null; status?: string },
        { provider_reference?: string | null; status?: string }
      >;
      wallet_transactions: Table<
        { id: string; user_id: string; created_by: string | null; kind: "refund" | "promotion" | "compensation" | "payment"; amount_xof: number; description: string; request_id: string; created_at: string },
        { user_id: string; created_by?: string | null; kind: "refund" | "promotion" | "compensation" | "payment"; amount_xof: number; description: string; request_id: string },
        never
      >;
      organizer_applications: Table<
        { id: string; user_id: string; organization_name: string; organization_type: string; description: string; business_phone: string; business_email: string; website: string | null; social_links: Json; status: string; rejection_reason: string | null; reviewed_by: string | null; reviewed_at: string | null; verified_at: string | null; created_at: string; updated_at: string },
        { user_id: string; organization_name: string; organization_type: string; description?: string; business_phone: string; business_email: string; website?: string | null; social_links?: Json },
        never
      >;
      organizer_members: Table<
        { id: string; owner_user_id: string; member_user_id: string | null; member_email: string; role: string; permissions: Json; status: string; invited_by: string; created_at: string; updated_at: string },
        never,
        never
      >;
      ticket_scan_logs: Table<
        { id: string; event_id: string; ticket_id: string | null; scanned_by: string; result: string; scanned_at: string },
        never,
        never
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      approve_organizer_application: { Args: { p_application_id: string }; Returns: undefined };
      reject_organizer_application: { Args: { p_application_id: string; p_reason: string }; Returns: undefined };
      manage_organizer_member: { Args: { p_email: string; p_role: string; p_permissions?: Json }; Returns: string };
      set_organizer_member_status: { Args: { p_member_id: string; p_status: string }; Returns: undefined };
      remove_organizer_member: { Args: { p_member_id: string }; Returns: undefined };
      list_scannable_events: { Args: Record<string, never>; Returns: { id: string; title: string; starts_at: string; venue: string }[] };
      scan_ticket: { Args: { p_code: string; p_event_id: string }; Returns: Json };
      admin_grant_wallet_credit: { Args: { p_email: string; p_amount_xof: number; p_kind: string; p_description: string; p_request_id: string }; Returns: string };
      get_wallet_balance: { Args: Record<string, never>; Returns: number };
      pay_order_with_wallet: { Args: { p_ticket_type_id: string; p_quantity: number; p_request_id?: string }; Returns: { order_id: string; total_paid_xof: number; ticket_count: number }[] };
      create_organizer_event: { Args: { p_event: Json; p_ticket_types: Json; p_status?: string }; Returns: string };
      get_public_events: { Args: { p_event_id?: string | null }; Returns: Json };
      create_cinetpay_order: { Args: { p_ticket_type_id: string; p_quantity: number; p_transaction_id: string }; Returns: { order_id: string; amount_xof: number; event_title: string; ticket_name: string }[] };
      fail_cinetpay_order: { Args: { p_transaction_id: string }; Returns: undefined };
      finalize_cinetpay_payment: { Args: { p_transaction_id: string; p_status: string; p_amount_xof: number }; Returns: undefined };
      get_my_tickets: { Args: Record<string, never>; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};