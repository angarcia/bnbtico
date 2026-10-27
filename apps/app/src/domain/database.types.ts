
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_actions": {
                  Row: {
                    "action": string,"admin_id": string,"created_at": string,"id": string,"reason": string | null,"target_listing_id": string | null,"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"admin_id": string,"created_at"?: string,"id"?: string,"reason"?: string | null,"target_listing_id"?: string | null,"target_user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string,"created_at"?: string,"id"?: string,"reason"?: string | null,"target_listing_id"?: string | null,"target_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_actions_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_actions_target_listing_id_fkey"
      columns: ["target_listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_actions_target_listing_id_fkey"
      columns: ["target_listing_id"]
isOneToOne: false
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_actions_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"client_errors": {
                  Row: {
                    "build": string,"col": number | null,"country": string | null,"created_at": string,"id": number,"kind": string,"line": number | null,"message": string,"page": string,"path": string,"source": string | null,"stack": string | null,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "build": string,"col"?: number | null,"country"?: string | null,"created_at"?: string,"id"?: never,"kind": string,"line"?: number | null,"message": string,"page": string,"path": string,"source"?: string | null,"stack"?: string | null,"user_agent"?: string | null
                  }
                  Update: {
                    "build"?: string,"col"?: number | null,"country"?: string | null,"created_at"?: string,"id"?: never,"kind"?: string,"line"?: number | null,"message"?: string,"page"?: string,"path"?: string,"source"?: string | null,"stack"?: string | null,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"events": {
                  Row: {
                    "build": string,"country": string | null,"created_at": string,"id": number,"listing_public_id": string | null,"name": string,"page": string,"path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "build": string,"country"?: string | null,"created_at"?: string,"id"?: never,"listing_public_id"?: string | null,"name": string,"page": string,"path": string
                  }
                  Update: {
                    "build"?: string,"country"?: string | null,"created_at"?: string,"id"?: never,"listing_public_id"?: string | null,"name"?: string,"page"?: string,"path"?: string
                  }
                  Relationships: [
                    
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"listing_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"listing_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"listing_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"fx_rates": {
                  Row: {
                    "crc_per_usd": number,"day": string,"fetched_at": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "crc_per_usd": number,"day": string,"fetched_at"?: string,"source": string
                  }
                  Update: {
                    "crc_per_usd"?: number,"day"?: string,"fetched_at"?: string,"source"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inquiries": {
                  Row: {
                    "arrival": string | null,"client_id": string,"consent_share_phone": boolean,"created_at": string,"departure": string | null,"id": string,"listing_id": string,"message": string,"owner_id": string,"owner_opened_at": string | null,"people": number | null,"source": string,"updated_at": string,"whatsapp_phone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "arrival"?: string | null,"client_id": string,"consent_share_phone"?: boolean,"created_at"?: string,"departure"?: string | null,"id"?: string,"listing_id": string,"message"?: string,"owner_id": string,"owner_opened_at"?: string | null,"people"?: number | null,"source"?: string,"updated_at"?: string,"whatsapp_phone": string
                  }
                  Update: {
                    "arrival"?: string | null,"client_id"?: string,"consent_share_phone"?: boolean,"created_at"?: string,"departure"?: string | null,"id"?: string,"listing_id"?: string,"message"?: string,"owner_id"?: string,"owner_opened_at"?: string | null,"people"?: number | null,"source"?: string,"updated_at"?: string,"whatsapp_phone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inquiries_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inquiries_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inquiries_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inquiries_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_days": {
                  Row: {
                    "available": boolean,"day": string,"listing_id": string,"special_price_crc": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "available"?: boolean,"day": string,"listing_id": string,"special_price_crc"?: number | null
                  }
                  Update: {
                    "available"?: boolean,"day"?: string,"listing_id"?: string,"special_price_crc"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_days_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_days_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_photos": {
                  Row: {
                    "created_at": string,"id": string,"listing_id": string,"path": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"listing_id": string,"path": string,"position"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"listing_id"?: string,"path"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_photos_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_photos_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_rates": {
                  Row: {
                    "base_weekend_crc": number | null,"high_from": string | null,"high_price_crc": number | null,"high_to": string | null,"high_weekend_crc": number | null,"listing_id": string,"low_from": string | null,"low_price_crc": number | null,"low_to": string | null,"low_weekend_crc": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "base_weekend_crc"?: number | null,"high_from"?: string | null,"high_price_crc"?: number | null,"high_to"?: string | null,"high_weekend_crc"?: number | null,"listing_id": string,"low_from"?: string | null,"low_price_crc"?: number | null,"low_to"?: string | null,"low_weekend_crc"?: number | null
                  }
                  Update: {
                    "base_weekend_crc"?: number | null,"high_from"?: string | null,"high_price_crc"?: number | null,"high_to"?: string | null,"high_weekend_crc"?: number | null,"listing_id"?: string,"low_from"?: string | null,"low_price_crc"?: number | null,"low_to"?: string | null,"low_weekend_crc"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_rates_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: true
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_rates_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: true
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    }
                  ]
                },"listings": {
                  Row: {
                    "accepts_monthly": boolean | null,"accepts_nightly": boolean,"address_private": string | null,"available": boolean,"bathroom_shared": boolean | null,"bathrooms": number | null,"bedrooms": number | null,"canton": string,"capacity": number | null,"created_at": string,"description": string,"direct_contact": boolean,"features": (Database["public"]['Enums']["feature"])[],"id": string,"kind": Database["public"]['Enums']["listing_kind"] | null,"lat": number | null,"lng": number | null,"min_months": number | null,"min_nights": number | null,"monthly_mode": string | null,"monthly_price_crc": number | null,"nightly_price_crc": number | null,"owner_id": string,"parking_paid": boolean | null,"province": string,"public_id": string,"reopen_at": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["listing_status"],"title": string,"updated_at": string,"whatsapp_phone": string,"zone": string | null,"listing_is_public": boolean | null
                  }
                  ComputedFields: "listing_is_public"
                  Insert: {
                    "accepts_monthly"?: boolean | null,"accepts_nightly"?: boolean,"address_private"?: string | null,"available"?: boolean,"bathroom_shared"?: boolean | null,"bathrooms"?: number | null,"bedrooms"?: number | null,"canton"?: string,"capacity"?: number | null,"created_at"?: string,"description"?: string,"direct_contact"?: boolean,"features"?: (Database["public"]['Enums']["feature"])[],"id"?: string,"kind"?: Database["public"]['Enums']["listing_kind"] | null,"lat"?: number | null,"lng"?: number | null,"min_months"?: number | null,"min_nights"?: number | null,"monthly_mode"?: string | null,"monthly_price_crc"?: number | null,"nightly_price_crc"?: number | null,"owner_id": string,"parking_paid"?: boolean | null,"province": string,"public_id"?: string,"reopen_at"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"title": string,"updated_at"?: string,"whatsapp_phone": string,"zone"?: string | null
                  }
                  Update: {
                    "accepts_monthly"?: boolean | null,"accepts_nightly"?: boolean,"address_private"?: string | null,"available"?: boolean,"bathroom_shared"?: boolean | null,"bathrooms"?: number | null,"bedrooms"?: number | null,"canton"?: string,"capacity"?: number | null,"created_at"?: string,"description"?: string,"direct_contact"?: boolean,"features"?: (Database["public"]['Enums']["feature"])[],"id"?: string,"kind"?: Database["public"]['Enums']["listing_kind"] | null,"lat"?: number | null,"lng"?: number | null,"min_months"?: number | null,"min_nights"?: number | null,"monthly_mode"?: string | null,"monthly_price_crc"?: number | null,"nightly_price_crc"?: number | null,"owner_id"?: string,"parking_paid"?: boolean | null,"province"?: string,"public_id"?: string,"reopen_at"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"title"?: string,"updated_at"?: string,"whatsapp_phone"?: string,"zone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"description": string | null,"email": string | null,"full_name": string,"id": string,"is_active": boolean,"is_admin": boolean,"is_owner": boolean,"phone": string,"phone_verified_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"email"?: string | null,"full_name": string,"id": string,"is_active"?: boolean,"is_admin"?: boolean,"is_owner"?: boolean,"phone": string,"phone_verified_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"is_active"?: boolean,"is_admin"?: boolean,"is_owner"?: boolean,"phone"?: string,"phone_verified_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"request_matches": {
                  Row: {
                    "contacted_at": string | null,"listing_id": string,"owner_id": string,"request_id": string,"seen_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contacted_at"?: string | null,"listing_id": string,"owner_id": string,"request_id": string,"seen_at"?: string | null
                  }
                  Update: {
                    "contacted_at"?: string | null,"listing_id"?: string,"owner_id"?: string,"request_id"?: string,"seen_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_matches_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_matches_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_matches_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_matches_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id"]
    }
                  ]
                },"requests": {
                  Row: {
                    "arrival": string | null,"budget_total_crc": number | null,"client_id": string,"consent_whatsapp": boolean,"created_at": string,"departure": string | null,"expires_at": string,"id": string,"max_owners": number,"must_have": (Database["public"]['Enums']["feature"])[],"notes": string,"people": number,"province": string | null,"status": Database["public"]['Enums']["request_status"],"zone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "arrival"?: string | null,"budget_total_crc"?: number | null,"client_id": string,"consent_whatsapp"?: boolean,"created_at"?: string,"departure"?: string | null,"expires_at": string,"id"?: string,"max_owners"?: number,"must_have"?: (Database["public"]['Enums']["feature"])[],"notes"?: string,"people": number,"province"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"zone"?: string | null
                  }
                  Update: {
                    "arrival"?: string | null,"budget_total_crc"?: number | null,"client_id"?: string,"consent_whatsapp"?: boolean,"created_at"?: string,"departure"?: string | null,"expires_at"?: string,"id"?: string,"max_owners"?: number,"must_have"?: (Database["public"]['Enums']["feature"])[],"notes"?: string,"people"?: number,"province"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"zone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"subscription_reminders": {
                  Row: {
                    "channel": string,"days_before": number,"listing_id": string,"sent_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel"?: string,"days_before": number,"listing_id": string,"sent_at"?: string
                  }
                  Update: {
                    "channel"?: string,"days_before"?: number,"listing_id"?: string,"sent_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscription_reminders_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscription_reminders_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "created_at": string,"listing_id": string,"monthly_price_crc": number,"payment_method_added_at": string | null,"payment_method_token": string | null,"plan": Database["public"]['Enums']["plan"],"promo_ends_at": string | null,"promo_months": number | null,"stopped_at": string | null,"updated_at": string,"subscription_state": string | null
                  }
                  ComputedFields: "subscription_state"
                  Insert: {
                    "created_at"?: string,"listing_id": string,"monthly_price_crc"?: number,"payment_method_added_at"?: string | null,"payment_method_token"?: string | null,"plan"?: Database["public"]['Enums']["plan"],"promo_ends_at"?: string | null,"promo_months"?: number | null,"stopped_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"listing_id"?: string,"monthly_price_crc"?: number,"payment_method_added_at"?: string | null,"payment_method_token"?: string | null,"plan"?: Database["public"]['Enums']["plan"],"promo_ends_at"?: string | null,"promo_months"?: number | null,"stopped_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: true
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: true
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    }
                  ]
                },"web_vitals": {
                  Row: {
                    "build": string,"country": string | null,"created_at": string,"id": number,"metric_id": string,"name": string,"navigation_type": string | null,"page": string,"path": string,"rating": string | null,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "build": string,"country"?: string | null,"created_at"?: string,"id"?: never,"metric_id": string,"name": string,"navigation_type"?: string | null,"page": string,"path": string,"rating"?: string | null,"value": number
                  }
                  Update: {
                    "build"?: string,"country"?: string | null,"created_at"?: string,"id"?: never,"metric_id"?: string,"name"?: string,"navigation_type"?: string | null,"page"?: string,"path"?: string,"rating"?: string | null,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "listings_public": {
                  Row: {
                    "accepts_monthly": boolean | null,"accepts_nightly": boolean | null,"available": boolean | null,"bathroom_shared": boolean | null,"bathrooms": number | null,"bedrooms": number | null,"canton": string | null,"capacity": number | null,"created_at": string | null,"description": string | null,"features": (Database["public"]['Enums']["feature"])[] | null,"id": string | null,"kind": Database["public"]['Enums']["listing_kind"] | null,"lat": number | null,"lng": number | null,"min_months": number | null,"min_nights": number | null,"monthly_mode": string | null,"monthly_price_crc": number | null,"nightly_price_crc": number | null,"owner_name": string | null,"owner_whatsapp_verified": boolean | null,"parking_paid": boolean | null,"photos": Json | null,"province": string | null,"public_id": string | null,"reopen_at": string | null,"title": string | null,"updated_at": string | null,"zone": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"provinces_with_listings": {
                  Row: {
                    "listings": number | null,"province": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "add_listing_photo":
{ Args: { "p_listing": string,"p_path": string }; Returns: {
              "id": string,"path": string,"position": number
            }[]
                           },
"approx_point":
{ Args: { "p_lat": number,"p_lng": number,"p_seed": string }; Returns: unknown
                           },
"create_inquiry":
{ Args: { "p_arrival": string,"p_departure": string,"p_message": string,"p_people": number,"p_public_id": string }; Returns: {
              "inquiry_id": string,"whatsapp_phone": string
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"listing_editable":
{ Args: { "p_listing": string }; Returns: boolean
                           },
"listing_folder_objects":
{ Args: { "p_listing": string }; Returns: number
                           },
"listing_is_public":
{ Args: { "l": Omit<Database["public"]['Tables']["listings"]['Row'], Database["public"]['Tables']["listings"]['ComputedFields']> }; Returns: boolean
                           },
"listing_is_published":
{ Args: { "p_listing": string }; Returns: boolean
                           },
"listing_link_state":
{ Args: { "p_public_id": string }; Returns: string
                           },
"listing_photos_guard":
{ Args: { "p_listing": string }; Returns: undefined
                           },
"listing_visible":
{ Args: { "p_listing": string }; Returns: boolean
                           },
"mark_inquiry_opened":
{ Args: { "p_id": string }; Returns: undefined
                           },
"open_drafts":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"owner_inquiries":
{ Args: Record<PropertyKey, never>; Returns: {
              "arrival": string,"client_name": string,"client_phone": string,"created_at": string,"departure": string,"id": string,"listing_id": string,"listing_title": string,"message": string,"owner_opened_at": string,"people": number,"public_id": string,"source": string,"updated_at": string
            }[]
                           },
"public_listing_days":
{ Args: { "p_public_id": string }; Returns: {
              "available": boolean,"day": string,"special_price_crc": number
            }[]
                           },
"purge_listing_page":
{ Args: { "p_public_id": string }; Returns: undefined
                           },
"remove_listing_photo":
{ Args: { "p_photo": string }; Returns: string
                           },
"reopen_due_listings":
{ Args: { "p_today"?: string }; Returns: number
                           },
"reorder_listing_photos":
{ Args: { "p_ids": (string)[],"p_listing": string }; Returns: undefined
                           },
"review_listing":
{ Args: { "p_decision": string,"p_listing": string,"p_note": string }; Returns: Database["public"]['Enums']["listing_status"]
                           },
"save_listing_days":
{ Args: { "p_available"?: boolean,"p_days": (string)[],"p_listing": string,"p_price_crc"?: number }; Returns: undefined
                           },
"seed_admin":
{ Args: { "p_phone": string }; Returns: undefined
                           },
"set_listing_available":
{ Args: { "p_available": boolean,"p_listing": string,"p_reopen_at"?: string }; Returns: undefined
                           },
"submit_listing":
{ Args: { "p_listing": string }; Returns: Database["public"]['Enums']["listing_status"]
                           },
"subscription_state":
{ Args: { "s": Omit<Database["public"]['Tables']["subscriptions"]['Row'], Database["public"]['Tables']["subscriptions"]['ComputedFields']> }; Returns: string
                           }
          }
          Enums: {
            "feature": "pool"|"pets"|"wifi"|"ac"|"parking"|"ev"|"kids_free"|"beachfront"|"bbq","listing_kind": "casa"|"apartamento"|"habitacion"|"completo","listing_status": "draft"|"review"|"changes"|"rejected"|"payment_due"|"active"|"inactive","plan": "promo"|"paid","request_status": "open"|"closed"|"expired","tariff": "base"|"high"|"low"|"special"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "feature": ["pool", "pets", "wifi", "ac", "parking", "ev", "kids_free", "beachfront", "bbq"],"listing_kind": ["casa", "apartamento", "habitacion", "completo"],"listing_status": ["draft", "review", "changes", "rejected", "payment_due", "active", "inactive"],"plan": ["promo", "paid"],"request_status": ["open", "closed", "expired"],"tariff": ["base", "high", "low", "special"]
          }
        }
} as const
