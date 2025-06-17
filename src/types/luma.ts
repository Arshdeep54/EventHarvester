export interface Category {
  api_id: string;
  name: string;
  description: string;
  event_count: number;
  slug: string;
}

export interface CategoryEvent {
  api_id: string;
  start_at: string | null;
  end_at: string | null;
  position: string | null;
  calendar: {
    name: string;
    slug: string;
    api_id: string;
    website: string | null;
    geo_city: string | null;
    timezone: string | null;
    avatar_url: string;
    coordinate: {
      latitude: number;
      longitude: number;
    } | null;
    geo_region: string | null;
    is_blocked: boolean;
    tax_config: any | null;
    tint_color: string;
    geo_country: string | null;
    is_personal: boolean;
    verified_at: string | null;
    access_level: string;
    launch_status: string;
    meta_pixel_id: string | null;
    refund_policy: string | null;
    tiktok_handle: string | null;
    twitter_handle: string | null;
    youtube_handle: string | null;
    cover_image_url: string;
    linkedin_handle: string | null;
    instagram_handle: string | null;
    luma_plus_active: boolean;
    social_image_url: string | null;
    description_short: string | null;
    stripe_account_id: string | null;
    personal_user_api_id: string | null;
    google_measurement_id: string | null;
    show_subscriber_count: boolean;
    track_meta_ads_from_luma: boolean;
    event_submission_restriction: string;
  };
  membership_info: any | null;
  is_subscriber: boolean;
  is_admin: boolean;
  event_count: number;
  subscriber_count: number;
}

export interface CategoryPageResponse {
  category: {
    api_id: string;
    description: string;
    event_count: number;
    hero_image_desktop_url: string;
    icon_url: string;
    name: string;
    page_title: string;
    simple_icon_url: string;
    slug: string;
    social_image_url: string;
    subscriber_count: number;
    tint_color: string;
  };
  is_subscriber: boolean;
  timeline_calendars: CategoryEvent[];
  num_upcoming_events: number;
  subscriber_count: number;
}

export interface ScrapeEventsParams {
  url?: string;
  search_query?: string;
  limit?: number;
}

export interface DiscoverAccountsParams {
  organization_name: string;
  limit?: number;
}

export interface StandardizedEvent {
  id: string;
  source: string;
  source_id: string;
  name: string;
  description: string;
  host: {
    name: string;
    url?: string;
  };
  date_time: {
    start: string;
    end?: string;
    timezone: string;
    is_all_day: boolean;
  };
  location?: {
    type: 'physical' | 'online';
    address: string;
    city: string;
    country?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  registration: {
    url: string;
    is_free?: boolean;
    capacity?: number;
    attendee_count?: number;
  };
  metadata: {
    scraped_at: string;
    confidence_score: number;
    data_quality: {
      completeness: number;
      accuracy: number;
      freshness: number;
    };
    source_url: string;
    tags?: string[];
  };
}
