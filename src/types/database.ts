export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; full_name: string | null; avatar_url: string | null
          email: string; bio: string | null; job_title: string | null
          is_platform_admin: boolean; mfa_enabled: boolean
          onboarding_completed: boolean; timezone: string
          notification_preferences: Record<string, unknown>
          created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      workspaces: {
        Row: {
          id: string; name: string; slug: string; type: string
          logo_url: string | null; plan: string; trial_ends_at: string | null
          stripe_customer_id: string | null; owner_id: string
          created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['workspaces']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['workspaces']['Insert']>
      }
      workspace_members: {
        Row: {
          id: string; workspace_id: string; user_id: string; role: string
          invited_by: string | null; joined_at: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['workspace_members']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['workspace_members']['Insert']>
      }
      brands: {
        Row: {
          id: string; workspace_id: string; name: string; logo_url: string | null
          primary_color: string | null; industry: string | null
          timezone: string; created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['brands']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['brands']['Insert']>
      }
      brand_voice_profiles: {
        Row: {
          id: string; brand_id: string; workspace_id: string
          tone: string[]; banned_phrases: string[]; approved_phrases: string[]
          style_rules: string | null; example_copy: string | null
          created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['brand_voice_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['brand_voice_profiles']['Insert']>
      }
      social_channels: {
        Row: {
          id: string; workspace_id: string; brand_id: string | null
          platform: string; platform_username: string; platform_id: string
          access_token_encrypted: string | null; token_expires_at: string | null
          is_active: boolean; last_sync_at: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['social_channels']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['social_channels']['Insert']>
      }
      content_posts: {
        Row: {
          id: string; workspace_id: string; brand_id: string | null
          campaign_id: string | null; title: string | null; status: string
          post_type: string; platforms: string[]; scheduled_at: string | null
          published_at: string | null; created_by: string
          created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['content_posts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['content_posts']['Insert']>
      }
      post_platform_versions: {
        Row: {
          id: string; post_id: string; platform: string; caption: string | null
          short_caption: string | null; hashtags: string[]; media_asset_ids: string[]
          char_count: number | null; is_approved: boolean; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['post_platform_versions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['post_platform_versions']['Insert']>
      }
      campaigns: {
        Row: {
          id: string; workspace_id: string; brand_id: string | null
          name: string; status: string; objective: string | null
          target_audience: string | null; start_date: string | null
          end_date: string | null; owner_id: string | null; budget: number | null
          campaign_type: string; created_by: string; created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['campaigns']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['campaigns']['Insert']>
      }
      giveaways: {
        Row: {
          id: string; workspace_id: string; campaign_id: string | null; brand_id: string | null
          title: string; description: string | null; status: string
          start_date: string | null; end_date: string | null; platform: string | null
          prize_title: string; prize_description: string | null; prize_value: number | null
          prize_currency: string; prize_quantity: number
          entry_methods: string[]; entry_hashtag: string | null; entry_post_url: string | null
          max_entries_per_person: number; min_followers_required: number
          eligible_countries: string[]; terms_url: string | null; rules: string | null
          winner_count: number; winner_selection: string
          winners_announced_at: string | null; announcement_post_url: string | null
          total_entries: number; total_unique_participants: number
          created_by: string; created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['giveaways']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['giveaways']['Insert']>
      }
      giveaway_entries: {
        Row: {
          id: string; giveaway_id: string; workspace_id: string
          participant_handle: string | null; participant_platform_id: string | null
          participant_email: string | null; entry_method: string | null
          entry_data: Record<string, unknown>; is_valid: boolean; is_winner: boolean
          disqualified_reason: string | null; entered_at: string; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['giveaway_entries']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['giveaway_entries']['Insert']>
      }
      competitions: {
        Row: {
          id: string; workspace_id: string; campaign_id: string | null; brand_id: string | null
          title: string; description: string | null; competition_type: string; status: string
          start_date: string | null; end_date: string | null; submission_deadline: string | null
          platform: string | null; entry_hashtag: string | null
          prize_title: string | null; prize_description: string | null
          prize_value: number | null; prize_currency: string
          prizes: Array<{ place: number; title: string; value: number }>
          rules: string | null; terms_url: string | null
          judging_criteria: Array<{ name: string; weight: number }>
          judging_type: string; max_submissions_per_person: number
          min_age: number | null; eligible_countries: string[]
          require_follow: boolean; require_hashtag: boolean
          submission_count: number; vote_count: number
          winner_announced_at: string | null
          created_by: string; created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['competitions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['competitions']['Insert']>
      }
      competition_submissions: {
        Row: {
          id: string; competition_id: string; workspace_id: string
          participant_handle: string | null; participant_platform_id: string | null
          participant_email: string | null; submission_url: string | null
          submission_text: string | null; media_urls: string[]
          vote_count: number; judge_scores: Record<string, number>
          average_score: number | null; rank: number | null
          status: string; disqualified_reason: string | null
          is_winner: boolean; winner_place: number | null
          submitted_at: string; reviewed_by: string | null; reviewed_at: string | null
          created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['competition_submissions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['competition_submissions']['Insert']>
      }
      competition_judges: {
        Row: {
          id: string; competition_id: string; workspace_id: string
          user_id: string | null; name: string; email: string | null; role: string
          assigned_submissions: number; completed_reviews: number; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['competition_judges']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['competition_judges']['Insert']>
      }
      campaign_tasks: {
        Row: {
          id: string; campaign_id: string; workspace_id: string
          title: string; description: string | null; status: string
          assignee_id: string | null; due_date: string | null
          created_by: string; created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['campaign_tasks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['campaign_tasks']['Insert']>
      }
      media_assets: {
        Row: {
          id: string; workspace_id: string; brand_id: string | null
          file_name: string; file_type: string; file_size: number
          storage_path: string; public_url: string | null
          width: number | null; height: number | null; duration: number | null
          rights_status: string; tags: string[]; uploaded_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['media_assets']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['media_assets']['Insert']>
      }
      ai_generations: {
        Row: {
          id: string; workspace_id: string; user_id: string
          prompt: string; output: Json; model: string; tokens_used: number | null
          post_id: string | null; campaign_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ai_generations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['ai_generations']['Insert']>
      }
      approvals: {
        Row: {
          id: string; workspace_id: string; post_id: string | null
          campaign_id: string | null; status: string; requested_by: string
          reviewer_id: string | null; reviewed_at: string | null
          notes: string | null; created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['approvals']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['approvals']['Insert']>
      }
      ugc_briefs: {
        Row: {
          id: string; workspace_id: string; campaign_id: string | null
          brand_id: string | null; title: string; goal: string | null
          instructions: string | null; deliverables: string | null
          due_date: string | null; status: string; created_by: string
          created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ugc_briefs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ugc_briefs']['Insert']>
      }
      ugc_creators: {
        Row: {
          id: string; workspace_id: string; name: string; email: string | null
          instagram_handle: string | null; tiktok_handle: string | null
          youtube_handle: string | null; follower_count: number | null
          niche: string | null; notes: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ugc_creators']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['ugc_creators']['Insert']>
      }
      ugc_submissions: {
        Row: {
          id: string; brief_id: string; creator_id: string; workspace_id: string
          storage_path: string; file_type: string; status: string
          revision_notes: string | null; approved_at: string | null
          created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ugc_submissions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ugc_submissions']['Insert']>
      }
      inbox_threads: {
        Row: {
          id: string; workspace_id: string; channel_id: string | null
          platform: string; thread_type: string; external_id: string | null
          author_name: string | null; author_handle: string | null
          status: string; sentiment: string | null; assignee_id: string | null
          is_important: boolean; created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inbox_threads']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['inbox_threads']['Insert']>
      }
      notifications: {
        Row: {
          id: string; workspace_id: string; user_id: string; type: string
          title: string; body: string | null; link: string | null
          is_read: boolean; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string; workspace_id: string | null; user_id: string | null
          action: string; resource_type: string; resource_id: string | null
          before_state: Json | null; after_state: Json | null
          ip_address: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>
        Update: never
      }
      subscriptions: {
        Row: {
          id: string; workspace_id: string; stripe_subscription_id: string
          plan: string; status: string; seats: number
          current_period_start: string; current_period_end: string
          cancel_at_period_end: boolean; created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
      }
      support_tickets: {
        Row: {
          id: string; workspace_id: string | null; user_id: string | null
          name: string; email: string; category: string; subject: string
          message: string; status: string; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['support_tickets']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['support_tickets']['Insert']>
      }
      listening_keywords: {
        Row: {
          id: string; workspace_id: string; keyword: string; match_type: string;
          platforms: string[]; is_active: boolean; alert_enabled: boolean;
          alert_threshold: number; color: string; created_by: string | null; created_at: string; updated_at: string;
        }
        Insert: Omit<Database['public']['Tables']['listening_keywords']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['listening_keywords']['Insert']>
      }
      brand_mentions: {
        Row: {
          id: string; workspace_id: string; keyword_id: string | null;
          platform: string; author_name: string | null; author_handle: string | null;
          author_followers: number | null; content: string; url: string | null;
          media_url: string | null; sentiment: string; sentiment_score: number | null;
          is_read: boolean; is_starred: boolean; is_actioned: boolean;
          assigned_to: string | null; reach_estimate: number | null;
          engagement_count: number; mentioned_at: string; created_at: string;
        }
        Insert: Omit<Database['public']['Tables']['brand_mentions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['brand_mentions']['Insert']>
      }
      listening_alerts: {
        Row: {
          id: string; workspace_id: string; keyword_id: string | null;
          alert_type: string; title: string; message: string | null;
          is_read: boolean; triggered_at: string; created_at: string;
        }
        Insert: Omit<Database['public']['Tables']['listening_alerts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['listening_alerts']['Insert']>
      }
      competitor_profiles: {
        Row: {
          id: string; workspace_id: string; brand_id: string | null;
          competitor_name: string; website_url: string | null;
          platforms: Record<string, string>; notes: string | null;
          is_active: boolean; created_by: string | null; created_at: string; updated_at: string;
        }
        Insert: Omit<Database['public']['Tables']['competitor_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['competitor_profiles']['Insert']>
      }
      competitor_snapshots: {
        Row: {
          id: string; competitor_id: string; workspace_id: string; platform: string;
          follower_count: number | null; following_count: number | null; post_count: number | null;
          avg_likes: number | null; avg_comments: number | null; avg_shares: number | null;
          engagement_rate: number | null; posting_frequency_per_week: number | null;
          top_content_type: string | null; estimated_reach: number | null;
          snapshotted_at: string; created_at: string;
        }
        Insert: Omit<Database['public']['Tables']['competitor_snapshots']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['competitor_snapshots']['Insert']>
      }
      scheduled_reports: {
        Row: {
          id: string; workspace_id: string; name: string; description: string | null;
          report_type: string; frequency: string; day_of_week: number | null;
          day_of_month: number | null; send_time: string; recipients: string[];
          include_sections: string[]; date_range_days: number;
          is_active: boolean; last_sent_at: string | null; next_send_at: string | null;
          created_by: string | null; created_at: string; updated_at: string;
        }
        Insert: Omit<Database['public']['Tables']['scheduled_reports']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['scheduled_reports']['Insert']>
      }
      report_history: {
        Row: {
          id: string; report_id: string; workspace_id: string;
          sent_at: string; recipients: string[]; status: string;
          error_message: string | null; created_at: string;
        }
        Insert: Omit<Database['public']['Tables']['report_history']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['report_history']['Insert']>
      }
      hashtag_sets: {
        Row: {
          id: string; workspace_id: string; brand_id: string | null;
          name: string; description: string | null; hashtags: string[];
          platforms: string[]; category: string; avg_reach_estimate: number | null;
          usage_count: number; is_favorite: boolean;
          created_by: string | null; created_at: string; updated_at: string;
        }
        Insert: Omit<Database['public']['Tables']['hashtag_sets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['hashtag_sets']['Insert']>
      }
      link_pages: {
        Row: {
          id: string; workspace_id: string; brand_id: string | null;
          slug: string; title: string; description: string | null; avatar_url: string | null;
          background_type: string; background_value: string; primary_color: string;
          button_style: string; button_color: string; button_text_color: string;
          font_family: string; show_caption_fox_branding: boolean;
          total_views: number; total_clicks: number; is_active: boolean;
          created_by: string | null; created_at: string; updated_at: string;
        }
        Insert: Omit<Database['public']['Tables']['link_pages']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['link_pages']['Insert']>
      }
      link_page_items: {
        Row: {
          id: string; page_id: string; workspace_id: string;
          item_type: string; title: string | null; url: string | null;
          thumbnail_url: string | null; icon: string | null;
          sort_order: number; is_active: boolean; click_count: number;
          created_at: string; updated_at: string;
        }
        Insert: Omit<Database['public']['Tables']['link_page_items']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['link_page_items']['Insert']>
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']
export type Brand = Database['public']['Tables']['brands']['Row']
export type SocialChannel = Database['public']['Tables']['social_channels']['Row']
export type ContentPost = Database['public']['Tables']['content_posts']['Row']
export type Campaign = Database['public']['Tables']['campaigns']['Row']
export type CampaignTask = Database['public']['Tables']['campaign_tasks']['Row']
export type MediaAsset = Database['public']['Tables']['media_assets']['Row']
export type AiGeneration = Database['public']['Tables']['ai_generations']['Row']
export type Approval = Database['public']['Tables']['approvals']['Row']
export type UgcBrief = Database['public']['Tables']['ugc_briefs']['Row']
export type UgcCreator = Database['public']['Tables']['ugc_creators']['Row']
export type UgcSubmission = Database['public']['Tables']['ugc_submissions']['Row']
export type InboxThread = Database['public']['Tables']['inbox_threads']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']
export type SupportTicket = Database['public']['Tables']['support_tickets']['Row']
export type Giveaway = Database['public']['Tables']['giveaways']['Row']
export type GiveawayEntry = Database['public']['Tables']['giveaway_entries']['Row']
export type Competition = Database['public']['Tables']['competitions']['Row']
export type CompetitionSubmission = Database['public']['Tables']['competition_submissions']['Row']
export type CompetitionJudge = Database['public']['Tables']['competition_judges']['Row']
export type ListeningKeyword = Database['public']['Tables']['listening_keywords']['Row']
export type BrandMention = Database['public']['Tables']['brand_mentions']['Row']
export type ListeningAlert = Database['public']['Tables']['listening_alerts']['Row']
export type CompetitorProfile = Database['public']['Tables']['competitor_profiles']['Row']
export type CompetitorSnapshot = Database['public']['Tables']['competitor_snapshots']['Row']
export type ScheduledReport = Database['public']['Tables']['scheduled_reports']['Row']
export type ReportHistory = Database['public']['Tables']['report_history']['Row']
export type HashtagSet = Database['public']['Tables']['hashtag_sets']['Row']
export type LinkPage = Database['public']['Tables']['link_pages']['Row']
export type LinkPageItem = Database['public']['Tables']['link_page_items']['Row']
