
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
                },"airbnb_blocks": {
                  Row: {
                    "ends_on": string,"listing_id": string,"source_uid": string,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_on": string,"listing_id": string,"source_uid": string,"starts_on": string
                  }
                  Update: {
                    "ends_on"?: string,"listing_id"?: string,"source_uid"?: string,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "airbnb_blocks_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "airbnb_connections"
      referencedColumns: ["listing_id"]
    }
                  ]
                },"airbnb_connections": {
                  Row: {
                    "connected": boolean,"error_code": string | null,"last_auto_cycle": string | null,"last_error_at": string | null,"last_success_at": string | null,"listing_id": string,"private_url": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "connected"?: boolean,"error_code"?: string | null,"last_auto_cycle"?: string | null,"last_error_at"?: string | null,"last_success_at"?: string | null,"listing_id": string,"private_url"?: string | null,"version"?: number
                  }
                  Update: {
                    "connected"?: boolean,"error_code"?: string | null,"last_auto_cycle"?: string | null,"last_error_at"?: string | null,"last_success_at"?: string | null,"listing_id"?: string,"private_url"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "airbnb_connections_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: true
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "airbnb_connections_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: true
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    }
                  ]
                },"airbnb_import_attempts": {
                  Row: {
                    "candidate_url": string | null,"claimed": boolean,"error_code": string | null,"listing_id": string,"operation": string,"request_id": string,"started_at": string,"state": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_url"?: string | null,"claimed"?: boolean,"error_code"?: string | null,"listing_id": string,"operation"?: string,"request_id": string,"started_at"?: string,"state"?: string,"version": number
                  }
                  Update: {
                    "candidate_url"?: string | null,"claimed"?: boolean,"error_code"?: string | null,"listing_id"?: string,"operation"?: string,"request_id"?: string,"started_at"?: string,"state"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "airbnb_import_attempts_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "airbnb_connections"
      referencedColumns: ["listing_id"]
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
                    "build": string,"country": string | null,"created_at": string,"id": number,"listing_public_id": string | null,"name": string,"page": string,"path": string,"search_flags": (string)[] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "build": string,"country"?: string | null,"created_at"?: string,"id"?: never,"listing_public_id"?: string | null,"name": string,"page": string,"path": string,"search_flags"?: (string)[] | null
                  }
                  Update: {
                    "build"?: string,"country"?: string | null,"created_at"?: string,"id"?: never,"listing_public_id"?: string | null,"name"?: string,"page"?: string,"path"?: string,"search_flags"?: (string)[] | null
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
                },"ical_exports": {
                  Row: {
                    "generated_at": string,"generation": number,"id": string,"listing_id": string,"revoked_at": string | null,"token": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "generated_at"?: string,"generation"?: number,"id"?: string,"listing_id": string,"revoked_at"?: string | null,"token"?: string | null
                  }
                  Update: {
                    "generated_at"?: string,"generation"?: number,"id"?: string,"listing_id"?: string,"revoked_at"?: string | null,"token"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ical_exports_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: true
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ical_exports_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: true
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    }
                  ]
                },"inquiries": {
                  Row: {
                    "arrival": string | null,"client_id": string,"consent_share_phone": boolean,"created_at": string,"departure": string | null,"id": string,"listing_id": string,"owner_id": string,"owner_opened_at": string | null,"people": number | null,"source": string,"updated_at": string,"whatsapp_phone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "arrival"?: string | null,"client_id": string,"consent_share_phone"?: boolean,"created_at"?: string,"departure"?: string | null,"id"?: string,"listing_id": string,"owner_id": string,"owner_opened_at"?: string | null,"people"?: number | null,"source"?: string,"updated_at"?: string,"whatsapp_phone": string
                  }
                  Update: {
                    "arrival"?: string | null,"client_id"?: string,"consent_share_phone"?: boolean,"created_at"?: string,"departure"?: string | null,"id"?: string,"listing_id"?: string,"owner_id"?: string,"owner_opened_at"?: string | null,"people"?: number | null,"source"?: string,"updated_at"?: string,"whatsapp_phone"?: string
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
                },"listing_edit_fields": {
                  Row: {
                    "field": string,"listing_id": string,"review_note": string | null,"status": string,"submitted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "field": string,"listing_id": string,"review_note"?: string | null,"status"?: string,"submitted_at"?: string
                  }
                  Update: {
                    "field"?: string,"listing_id"?: string,"review_note"?: string | null,"status"?: string,"submitted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_edit_fields_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listing_edits"
      referencedColumns: ["listing_id"]
    }
                  ]
                },"listing_edit_photos": {
                  Row: {
                    "created_at": string,"id": string,"listing_id": string,"path": string,"position": number,"review_note": string | null,"status": string,"submitted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"listing_id": string,"path": string,"position"?: number,"review_note"?: string | null,"status"?: string,"submitted_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"listing_id"?: string,"path"?: string,"position"?: number,"review_note"?: string | null,"status"?: string,"submitted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_edit_photos_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listing_edits"
      referencedColumns: ["listing_id"]
    }
                  ]
                },"listing_edits": {
                  Row: {
                    "bathroom_shared": boolean | null,"created_at": string,"description": string | null,"kind": Database["public"]['Enums']["listing_kind"] | null,"lat": number | null,"listing_id": string,"lng": number | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": string,"submitted_at": string | null,"title": string | null,"updated_at": string,"zone": string | null,"zone_id": string | null,"zone_source": string | null,"listing_edit_empty": boolean | null
                  }
                  ComputedFields: "listing_edit_empty"
                  Insert: {
                    "bathroom_shared"?: boolean | null,"created_at"?: string,"description"?: string | null,"kind"?: Database["public"]['Enums']["listing_kind"] | null,"lat"?: number | null,"listing_id": string,"lng"?: number | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"submitted_at"?: string | null,"title"?: string | null,"updated_at"?: string,"zone"?: string | null,"zone_id"?: string | null,"zone_source"?: string | null
                  }
                  Update: {
                    "bathroom_shared"?: boolean | null,"created_at"?: string,"description"?: string | null,"kind"?: Database["public"]['Enums']["listing_kind"] | null,"lat"?: number | null,"listing_id"?: string,"lng"?: number | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"submitted_at"?: string | null,"title"?: string | null,"updated_at"?: string,"zone"?: string | null,"zone_id"?: string | null,"zone_source"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_edits_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: true
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_edits_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: true
      referencedRelation: "listings_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_edits_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_edits_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_edits_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones_with_listings"
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
                    "accepts_monthly": boolean,"accepts_nightly": boolean,"address_private": string | null,"admin_hold": string | null,"admin_hold_at": string | null,"admin_hold_reason": string | null,"available": boolean,"bathroom_shared": boolean | null,"bathrooms": number | null,"bedrooms": number | null,"canton": string,"capacity": number | null,"created_at": string,"deleted_at": string | null,"deleted_reason": string | null,"description": string,"direct_contact": boolean,"district": string | null,"features": (Database["public"]['Enums']["feature"])[],"first_published_at": string | null,"id": string,"kind": Database["public"]['Enums']["listing_kind"] | null,"lat": number | null,"lng": number | null,"min_months": number | null,"min_nights": number | null,"monthly_mode": string | null,"monthly_price_crc": number | null,"nightly_price_crc": number | null,"owner_id": string,"parking_paid": boolean | null,"province": string,"public_id": string,"reopen_at": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["listing_status"],"title": string,"updated_at": string,"whatsapp_phone": string,"zone": string | null,"zone_id": string | null,"zone_source": string | null,"listing_is_public": boolean | null
                  }
                  ComputedFields: "listing_is_public"
                  Insert: {
                    "accepts_monthly"?: boolean,"accepts_nightly"?: boolean,"address_private"?: string | null,"admin_hold"?: string | null,"admin_hold_at"?: string | null,"admin_hold_reason"?: string | null,"available"?: boolean,"bathroom_shared"?: boolean | null,"bathrooms"?: number | null,"bedrooms"?: number | null,"canton"?: string,"capacity"?: number | null,"created_at"?: string,"deleted_at"?: string | null,"deleted_reason"?: string | null,"description"?: string,"direct_contact"?: boolean,"district"?: string | null,"features"?: (Database["public"]['Enums']["feature"])[],"first_published_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["listing_kind"] | null,"lat"?: number | null,"lng"?: number | null,"min_months"?: number | null,"min_nights"?: number | null,"monthly_mode"?: string | null,"monthly_price_crc"?: number | null,"nightly_price_crc"?: number | null,"owner_id": string,"parking_paid"?: boolean | null,"province": string,"public_id"?: string,"reopen_at"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"title": string,"updated_at"?: string,"whatsapp_phone": string,"zone"?: string | null,"zone_id"?: string | null,"zone_source"?: string | null
                  }
                  Update: {
                    "accepts_monthly"?: boolean,"accepts_nightly"?: boolean,"address_private"?: string | null,"admin_hold"?: string | null,"admin_hold_at"?: string | null,"admin_hold_reason"?: string | null,"available"?: boolean,"bathroom_shared"?: boolean | null,"bathrooms"?: number | null,"bedrooms"?: number | null,"canton"?: string,"capacity"?: number | null,"created_at"?: string,"deleted_at"?: string | null,"deleted_reason"?: string | null,"description"?: string,"direct_contact"?: boolean,"district"?: string | null,"features"?: (Database["public"]['Enums']["feature"])[],"first_published_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["listing_kind"] | null,"lat"?: number | null,"lng"?: number | null,"min_months"?: number | null,"min_nights"?: number | null,"monthly_mode"?: string | null,"monthly_price_crc"?: number | null,"nightly_price_crc"?: number | null,"owner_id"?: string,"parking_paid"?: boolean | null,"province"?: string,"public_id"?: string,"reopen_at"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"title"?: string,"updated_at"?: string,"whatsapp_phone"?: string,"zone"?: string | null,"zone_id"?: string | null,"zone_source"?: string | null
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
    },{
      foreignKeyName: "listings_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "zones_with_listings"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_customers": {
                  Row: {
                    "created_at": string,"customer_ref": string,"owner_id": string,"provider": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"customer_ref": string,"owner_id": string,"provider": string
                  }
                  Update: {
                    "created_at"?: string,"customer_ref"?: string,"owner_id"?: string,"provider"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_customers_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_events": {
                  Row: {
                    "event_id": string,"owner_id": string | null,"provider": string,"received_at": string,"result": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"owner_id"?: string | null,"provider": string,"received_at"?: string,"result"?: string,"type": string
                  }
                  Update: {
                    "event_id"?: string,"owner_id"?: string | null,"provider"?: string,"received_at"?: string,"result"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_events_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_methods": {
                  Row: {
                    "added_at": string,"brand": string,"customer_ref": string,"exp_month": number,"exp_year": number,"last4": string,"method_ref": string,"owner_id": string,"provider": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"brand": string,"customer_ref": string,"exp_month": number,"exp_year": number,"last4": string,"method_ref": string,"owner_id": string,"provider": string,"updated_at"?: string
                  }
                  Update: {
                    "added_at"?: string,"brand"?: string,"customer_ref"?: string,"exp_month"?: number,"exp_year"?: number,"last4"?: string,"method_ref"?: string,"owner_id"?: string,"provider"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_methods_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: true
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
                    "attempts": number,"body": string | null,"channel": string,"claimed_at": string | null,"days_before": number,"id": string,"last_error": string | null,"listing_id": string,"promo_ends_on": string | null,"provider_ref": string | null,"queued_at": string,"sent_at": string | null,"status": string,"to_phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"body"?: string | null,"channel"?: string,"claimed_at"?: string | null,"days_before": number,"id"?: string,"last_error"?: string | null,"listing_id": string,"promo_ends_on"?: string | null,"provider_ref"?: string | null,"queued_at"?: string,"sent_at"?: string | null,"status"?: string,"to_phone"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"body"?: string | null,"channel"?: string,"claimed_at"?: string | null,"days_before"?: number,"id"?: string,"last_error"?: string | null,"listing_id"?: string,"promo_ends_on"?: string | null,"provider_ref"?: string | null,"queued_at"?: string,"sent_at"?: string | null,"status"?: string,"to_phone"?: string | null
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
                    "created_at": string,"listing_id": string,"monthly_price_crc": number,"paid_since": string | null,"plan": Database["public"]['Enums']["plan"],"promo_ends_on": string | null,"promo_months": number | null,"promo_slot": number | null,"stopped_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"listing_id": string,"monthly_price_crc"?: number,"paid_since"?: string | null,"plan"?: Database["public"]['Enums']["plan"],"promo_ends_on"?: string | null,"promo_months"?: number | null,"promo_slot"?: number | null,"stopped_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"listing_id"?: string,"monthly_price_crc"?: number,"paid_since"?: string | null,"plan"?: Database["public"]['Enums']["plan"],"promo_ends_on"?: string | null,"promo_months"?: number | null,"promo_slot"?: number | null,"stopped_at"?: string | null,"updated_at"?: string
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
                },"zones": {
                  Row: {
                    "active": boolean,"canton_code": string,"created_at": string,"id": string,"lat": number | null,"lng": number | null,"name": string,"point": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"canton_code": string,"created_at"?: string,"id": string,"lat"?: never,"lng"?: never,"name": string,"point": unknown
                  }
                  Update: {
                    "active"?: boolean,"canton_code"?: string,"created_at"?: string,"id"?: string,"lat"?: never,"lng"?: never,"name"?: string,"point"?: unknown
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "features_with_listings": {
                  Row: {
                    "feature": Database["public"]['Enums']["feature"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"listings_public": {
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
                },"zones_with_listings": {
                  Row: {
                    "canton": string | null,"canton_code": string | null,"id": string | null,"lat": number | null,"listings": number | null,"lng": number | null,"name": string | null,"province": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "add_edit_photo":
{ Args: { "p_listing": string,"p_path": string }; Returns: {
              "id": string,"path": string,"position": number
            }[]
                           },
"add_listing_photo":
{ Args: { "p_listing": string,"p_path": string }; Returns: {
              "id": string,"path": string,"position": number
            }[]
                           },
"admin_add_listing_photo":
{ Args: { "p_listing": string,"p_path": string }; Returns: {
              "id": string,"path": string,"position": number
            }[]
                           },
"admin_block_listing":
{ Args: { "p_listing": string,"p_reason": string }; Returns: undefined
                           },
"admin_calendar_days":
{ Args: { "p_listing": string }; Returns: {
              "available": boolean,"day": string,"imported": boolean,"manual_available": boolean,"special_price_crc": number
            }[]
                           },
"admin_delete_listing":
{ Args: { "p_confirm": string,"p_listing": string,"p_reason": string }; Returns: undefined
                           },
"admin_hold_reason_text":
{ Args: { "p_reason": string }; Returns: string
                           },
"admin_house_for_action":
{ Args: { "p_listing": string }; Returns: {
              "accepts_monthly": boolean,
"accepts_nightly": boolean,
"address_private": string | null,
"admin_hold": string | null,
"admin_hold_at": string | null,
"admin_hold_reason": string | null,
"available": boolean,
"bathroom_shared": boolean | null,
"bathrooms": number | null,
"bedrooms": number | null,
"canton": string,
"capacity": number | null,
"created_at": string,
"deleted_at": string | null,
"deleted_reason": string | null,
"description": string,
"direct_contact": boolean,
"district": string | null,
"features": (Database["public"]['Enums']["feature"])[],
"first_published_at": string | null,
"id": string,
"kind": Database["public"]['Enums']["listing_kind"] | null,
"lat": number | null,
"lng": number | null,
"min_months": number | null,
"min_nights": number | null,
"monthly_mode": string | null,
"monthly_price_crc": number | null,
"nightly_price_crc": number | null,
"owner_id": string,
"parking_paid": boolean | null,
"province": string,
"public_id": string,
"reopen_at": string | null,
"review_note": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": Database["public"]['Enums']["listing_status"],
"title": string,
"updated_at": string,
"whatsapp_phone": string,
"zone": string | null,
"zone_id": string | null,
"zone_source": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "listings"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_log_edit":
{ Args: { "p_action"?: string,"p_listing": string }; Returns: undefined
                           },
"admin_pause_listing":
{ Args: { "p_listing": string,"p_reason": string }; Returns: undefined
                           },
"admin_remove_listing_photo":
{ Args: { "p_photo": string }; Returns: string
                           },
"admin_reorder_listing_photos":
{ Args: { "p_ids": (string)[],"p_listing": string }; Returns: undefined
                           },
"admin_resume_listing":
{ Args: { "p_listing": string }; Returns: undefined
                           },
"admin_save_listing_days":
{ Args: { "p_available"?: boolean,"p_days": (string)[],"p_listing": string,"p_price_crc"?: number }; Returns: undefined
                           },
"admin_submit_listing":
{ Args: { "p_listing": string }; Returns: Database["public"]['Enums']["listing_status"]
                           },
"admin_unblock_listing":
{ Args: { "p_listing": string }; Returns: undefined
                           },
"admin_update_listing":
{ Args: { "p_listing": string,"p_patch": Json }; Returns: undefined
                           },
"airbnb_check_owner":
{ Args: { "p_listing": string }; Returns: undefined
                           },
"airbnb_due_for_cycle":
{ Args: { "p_cycle": string }; Returns: Json
                           },
"airbnb_import_context":
{ Args: { "p_listing": string,"p_request": string }; Returns: Json
                           },
"airbnb_overview":
{ Args: { "p_listing": string }; Returns: Json
                           },
"airbnb_reserve":
{ Args: { "p_initial": boolean,"p_listing": string,"p_request": string,"p_url": string }; Returns: Json
                           },
"apply_payment_event":
{ Args: { "p_brand"?: string,"p_customer_ref"?: string,"p_event_id": string,"p_exp_month"?: number,"p_exp_year"?: number,"p_last4"?: string,"p_method_ref"?: string,"p_owner"?: string,"p_provider": string,"p_type": string }; Returns: string
                           },
"approx_point":
{ Args: { "p_lat": number,"p_lng": number,"p_seed": string }; Returns: unknown
                           },
"assert_listing_open":
{ Args: { "p_listing": string }; Returns: undefined
                           },
"begin_airbnb_import":
{ Args: { "p_listing": string,"p_request": string,"p_url": string }; Returns: Json
                           },
"begin_airbnb_update":
{ Args: { "p_listing": string,"p_request": string,"p_url"?: string }; Returns: Json
                           },
"claim_airbnb_cycle":
{ Args: { "p_cycle": string,"p_listing": string,"p_request": string }; Returns: Json
                           },
"claim_airbnb_import":
{ Args: { "p_listing": string,"p_request": string }; Returns: Json
                           },
"claim_reminders":
{ Args: { "p_limit"?: number }; Returns: {
              "days_before": number,"id": string,"listing_id": string,"owner_name": string,"promo_ends_on": string,"public_id": string,"title": string,"to_phone": string
            }[]
                           },
"costa_rica_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"create_inquiry":
{ Args: { "p_arrival": string,"p_departure": string,"p_people": number,"p_public_id": string }; Returns: {
              "inquiry_id": string,"whatsapp_phone": string
            }[]
                           } |
{ Args: { "p_arrival": string,"p_departure": string,"p_message": string,"p_people": number,"p_public_id": string }; Returns: {
              "inquiry_id": string,"whatsapp_phone": string
            }[]
                           },
"discard_edit":
{ Args: { "p_listing": string }; Returns: (string)[]
                           },
"discard_edit_field":
{ Args: { "p_field": string,"p_listing": string }; Returns: undefined
                           },
"disconnect_airbnb":
{ Args: { "p_listing": string,"p_request": string }; Returns: undefined
                           },
"edit_admin_guard":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"edit_place":
{ Args: { "p_lat": number,"p_lng": number,"p_zone": string,"p_zone_id": string,"p_zone_source": string }; Returns: {
              "canton": string,"district": string,"province": string,"zone": string
            }[]
                           },
"effective_calendar_days":
{ Args: { "p_listing": string }; Returns: {
              "available": boolean,"day": string,"imported": boolean,"manual_available": boolean,"special_price_crc": number
            }[]
                           },
"finish_airbnb_import":
{ Args: { "p_blocks": Json,"p_error"?: string,"p_listing": string,"p_request": string }; Returns: undefined
                           },
"finish_reminders":
{ Args: { "p_results": Json }; Returns: number
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"launch_offer_taken":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"listing_blocked_reason":
{ Args: { "p_public_id": string }; Returns: string
                           },
"listing_days_update":
{ Args: { "l": Omit<Database["public"]['Tables']["listings"]['Row'], Database["public"]['Tables']["listings"]['ComputedFields']>,"p_available": boolean,"p_days": (string)[],"p_price_crc": number }; Returns: undefined
                           },
"listing_edit_check":
{ Args: { "e": Omit<Database["public"]['Tables']["listing_edits"]['Row'], Database["public"]['Tables']["listing_edits"]['ComputedFields']>,"l": Omit<Database["public"]['Tables']["listings"]['Row'], Database["public"]['Tables']["listings"]['ComputedFields']> }; Returns: undefined
                           },
"listing_edit_empty":
{ Args: { "e": Omit<Database["public"]['Tables']["listing_edits"]['Row'], Database["public"]['Tables']["listing_edits"]['ComputedFields']> }; Returns: boolean
                           },
"listing_edit_has":
{ Args: { "e": Omit<Database["public"]['Tables']["listing_edits"]['Row'], Database["public"]['Tables']["listing_edits"]['ComputedFields']>,"p_field": string }; Returns: boolean
                           },
"listing_edit_only":
{ Args: { "e": Omit<Database["public"]['Tables']["listing_edits"]['Row'], Database["public"]['Tables']["listing_edits"]['ComputedFields']>,"p_field": string }; Returns: {
              "bathroom_shared": boolean | null,
"created_at": string,
"description": string | null,
"kind": Database["public"]['Enums']["listing_kind"] | null,
"lat": number | null,
"listing_id": string,
"lng": number | null,
"review_note": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"submitted_at": string | null,
"title": string | null,
"updated_at": string,
"zone": string | null,
"zone_id": string | null,
"zone_source": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "listing_edits"
        isOneToOne: true
        isSetofReturn: false
      } },
"listing_edit_sync":
{ Args: { "p_listing": string }; Returns: undefined
                           },
"listing_editable":
{ Args: { "p_listing": string }; Returns: boolean
                           },
"listing_folder_objects":
{ Args: { "p_listing": string }; Returns: number
                           },
"listing_has_busy_nights":
{ Args: { "p_from": string,"p_listing": string,"p_to": string }; Returns: boolean
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
"listing_live_update":
{ Args: { "l": Omit<Database["public"]['Tables']["listings"]['Row'], Database["public"]['Tables']["listings"]['ComputedFields']>,"p_patch": Json }; Returns: undefined
                           },
"listing_photo_delete":
{ Args: { "p_published": boolean,"ph": Omit<Database["public"]['Tables']["listing_photos"]['Row'], Database["public"]['Tables']["listing_photos"]['ComputedFields']> }; Returns: string
                           },
"listing_photo_insert":
{ Args: { "p_listing": string,"p_path": string }; Returns: {
              "id": string,"path": string,"position": number
            }[]
                           },
"listing_photo_uploadable":
{ Args: { "p_listing": string }; Returns: boolean
                           },
"listing_photos_guard":
{ Args: { "p_listing": string }; Returns: undefined
                           },
"listing_photos_order":
{ Args: { "p_ids": (string)[],"p_listing": string }; Returns: undefined
                           },
"listing_photos_owner_guard":
{ Args: { "p_listing": string }; Returns: boolean
                           },
"listing_status_published":
{ Args: { "p_first": string,"p_status": Database["public"]['Enums']["listing_status"] }; Returns: boolean
                           },
"listing_submit":
{ Args: { "p_listing": string }; Returns: Database["public"]['Enums']["listing_status"]
                           },
"listing_visible":
{ Args: { "p_listing": string }; Returns: boolean
                           },
"mark_inquiry_opened":
{ Args: { "p_id": string }; Returns: undefined
                           },
"mark_listing_reservation":
{ Args: { "p_days": (string)[],"p_listing": string }; Returns: undefined
                           },
"open_drafts":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"own_published_listing":
{ Args: { "p_listing": string }; Returns: {
              "accepts_monthly": boolean,
"accepts_nightly": boolean,
"address_private": string | null,
"admin_hold": string | null,
"admin_hold_at": string | null,
"admin_hold_reason": string | null,
"available": boolean,
"bathroom_shared": boolean | null,
"bathrooms": number | null,
"bedrooms": number | null,
"canton": string,
"capacity": number | null,
"created_at": string,
"deleted_at": string | null,
"deleted_reason": string | null,
"description": string,
"direct_contact": boolean,
"district": string | null,
"features": (Database["public"]['Enums']["feature"])[],
"first_published_at": string | null,
"id": string,
"kind": Database["public"]['Enums']["listing_kind"] | null,
"lat": number | null,
"lng": number | null,
"min_months": number | null,
"min_nights": number | null,
"monthly_mode": string | null,
"monthly_price_crc": number | null,
"nightly_price_crc": number | null,
"owner_id": string,
"parking_paid": boolean | null,
"province": string,
"public_id": string,
"reopen_at": string | null,
"review_note": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": Database["public"]['Enums']["listing_status"],
"title": string,
"updated_at": string,
"whatsapp_phone": string,
"zone": string | null,
"zone_id": string | null,
"zone_source": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "listings"
        isOneToOne: true
        isSetofReturn: false
      } },
"owner_activity":
{ Args: Record<PropertyKey, never>; Returns: {
              "inquiries": number,"listing_id": string,"public_id": string,"views": number,"whatsapp_taps": number
            }[]
                           },
"owner_billing":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"owner_calendar_days":
{ Args: { "p_listing": string }; Returns: {
              "available": boolean,"day": string,"imported": boolean,"manual_available": boolean,"special_price_crc": number
            }[]
                           },
"owner_has_payment_method":
{ Args: { "p_owner": string }; Returns: boolean
                           },
"owner_ical_export":
{ Args: { "p_generate"?: boolean,"p_listing": string }; Returns: Json
                           },
"owner_inquiries":
{ Args: Record<PropertyKey, never>; Returns: {
              "arrival": string,"client_name": string,"client_phone": string,"created_at": string,"departure": string,"id": string,"listing_id": string,"listing_title": string,"message": string,"owner_opened_at": string,"people": number,"public_id": string,"source": string,"updated_at": string
            }[]
                           },
"owner_inquiry_details":
{ Args: Record<PropertyKey, never>; Returns: {
              "arrival": string,"client_name": string,"client_phone": string,"created_at": string,"departure": string,"id": string,"listing_id": string,"listing_title": string,"owner_opened_at": string,"people": number,"public_id": string,"source": string,"updated_at": string
            }[]
                           },
"owner_listing_stats":
{ Args: { "p_listing": string }; Returns: {
              "inquiries": number,"views": number
            }[]
                           },
"payment_setup_context":
{ Args: { "p_provider": string }; Returns: Json
                           },
"photo_unreferenced":
{ Args: { "p_name": string }; Returns: boolean
                           },
"place_at":
{ Args: { "p_lat": number,"p_lng": number }; Returns: {
              "canton": string,"district": string,"district_code": string,"province": string
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
"read_ical_export":
{ Args: { "p_token": string }; Returns: Json
                           },
"remove_edit_photo":
{ Args: { "p_photo": string }; Returns: string
                           },
"remove_listing_photo":
{ Args: { "p_photo": string }; Returns: string
                           },
"reopen_due_listings":
{ Args: { "p_today"?: string }; Returns: number
                           },
"reorder_edit_photos":
{ Args: { "p_ids": (string)[],"p_listing": string }; Returns: undefined
                           },
"reorder_listing_photos":
{ Args: { "p_ids": (string)[],"p_listing": string }; Returns: undefined
                           },
"resume_subscription":
{ Args: { "p_listing": string }; Returns: Database["public"]['Enums']["listing_status"]
                           },
"review_edit_field":
{ Args: { "p_decision": string,"p_field": string,"p_listing": string,"p_note": string,"p_submitted_at": string }; Returns: string
                           },
"review_edit_photo":
{ Args: { "p_decision": string,"p_note": string,"p_photo": string,"p_submitted_at": string }; Returns: string
                           },
"review_listing":
{ Args: { "p_decision": string,"p_listing": string,"p_note": string }; Returns: Database["public"]['Enums']["listing_status"]
                           },
"revoke_ical_export":
{ Args: { "p_listing": string }; Returns: undefined
                           },
"revoke_ical_export_generation":
{ Args: { "p_generation": number,"p_listing": string }; Returns: undefined
                           },
"run_subscription_day":
{ Args: { "p_today"?: string }; Returns: Json
                           },
"save_edit":
{ Args: { "p_listing": string,"p_patch": Json }; Returns: {
              "bathroom_shared": boolean | null,
"created_at": string,
"description": string | null,
"kind": Database["public"]['Enums']["listing_kind"] | null,
"lat": number | null,
"listing_id": string,
"lng": number | null,
"review_note": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"submitted_at": string | null,
"title": string | null,
"updated_at": string,
"zone": string | null,
"zone_id": string | null,
"zone_source": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "listing_edits"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_edit_full":
{ Args: { "p_listing": string,"p_patch": Json }; Returns: Json
                           },
"save_listing_days":
{ Args: { "p_available"?: boolean,"p_days": (string)[],"p_listing": string,"p_price_crc"?: number }; Returns: undefined
                           },
"save_payment_customer":
{ Args: { "p_owner": string,"p_provider": string,"p_ref": string }; Returns: undefined
                           },
"search_listings":
{ Args: { "p_bedrooms"?: number,"p_features"?: (Database["public"]['Enums']["feature"])[],"p_from"?: string,"p_kinds"?: (Database["public"]['Enums']["listing_kind"])[],"p_limit"?: number,"p_max"?: number,"p_min"?: number,"p_people"?: number,"p_province"?: string,"p_to"?: string,"p_zone"?: string }; Returns: {
              "accepts_monthly": boolean,"accepts_nightly": boolean,"available": boolean,"bathroom_shared": boolean,"bathrooms": number,"bedrooms": number,"canton": string,"capacity": number,"created_at": string,"description": string,"features": (Database["public"]['Enums']["feature"])[],"id": string,"kind": Database["public"]['Enums']["listing_kind"],"lat": number,"lng": number,"min_months": number,"min_nights": number,"monthly_mode": string,"monthly_price_crc": number,"nightly_price_crc": number,"owner_name": string,"owner_whatsapp_verified": boolean,"parking_paid": boolean,"photos": Json,"province": string,"public_id": string,"reopen_at": string,"sort_rank": number,"stay_total_crc": number,"title": string,"updated_at": string,"zone": string
            }[]
                           },
"search_stay_total":
{ Args: { "p_accepts_monthly": boolean,"p_from": string,"p_listing": string,"p_monthly": number,"p_nightly": number,"p_to": string }; Returns: number
                           },
"seed_admin":
{ Args: { "p_phone": string }; Returns: undefined
                           },
"set_listing_available":
{ Args: { "p_available": boolean,"p_listing": string,"p_reopen_at"?: string }; Returns: undefined
                           },
"start_edit":
{ Args: { "p_listing": string }; Returns: {
              "bathroom_shared": boolean | null,
"created_at": string,
"description": string | null,
"kind": Database["public"]['Enums']["listing_kind"] | null,
"lat": number | null,
"listing_id": string,
"lng": number | null,
"review_note": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"submitted_at": string | null,
"title": string | null,
"updated_at": string,
"zone": string | null,
"zone_id": string | null,
"zone_source": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "listing_edits"
        isOneToOne: true
        isSetofReturn: false
      } },
"stop_subscription":
{ Args: { "p_listing": string }; Returns: Database["public"]['Enums']["listing_status"]
                           },
"submit_listing":
{ Args: { "p_listing": string }; Returns: Database["public"]['Enums']["listing_status"]
                           },
"test_set_offer_days_left":
{ Args: { "p_days_left": number,"p_public_id": string }; Returns: string
                           },
"update_listing_live":
{ Args: { "p_listing": string,"p_patch": Json }; Returns: undefined
                           },
"zones_near":
{ Args: { "p_km"?: number,"p_lat": number,"p_lng": number }; Returns: {
              "distance_m": number,"id": string,"name": string
            }[]
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
