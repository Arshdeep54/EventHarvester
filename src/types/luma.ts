import { z } from 'zod';

// Luma API Response Types
export const LumaEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  start_time: z.string(),
  end_time: z.string().optional(),
  timezone: z.string(),
  location: z.object({
    type: z.enum(['online', 'physical', 'hybrid']),
    name: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    url: z.string().optional(),
  }).optional(),
  cover_image_url: z.string().optional(),
  registration_url: z.string(),
  capacity: z.number().optional(),
  attendee_count: z.number().optional(),
  tags: z.array(z.string()).optional(),
  host: z.object({
    name: z.string(),
    profile_url: z.string().optional(),
    bio: z.string().optional(),
  }).optional(),
  speakers: z.array(z.object({
    name: z.string(),
    bio: z.string().optional(),
    profile_url: z.string().optional(),
    social_links: z.record(z.string()).optional(),
  })).optional(),
  agenda: z.array(z.object({
    time: z.string(),
    title: z.string(),
    description: z.string().optional(),
    speaker: z.string().optional(),
  })).optional(),
  status: z.enum(['upcoming', 'live', 'ended', 'cancelled']),
  created_at: z.string(),
  updated_at: z.string(),
});

export const LumaEventsResponseSchema = z.object({
  events: z.array(LumaEventSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    per_page: z.number(),
    has_next: z.boolean(),
  }),
});

// EventHarvest Standardized Schema
export const StandardizedEventSchema = z.object({
  id: z.string(),
  source: z.literal('luma'),
  source_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  host: z.object({
    name: z.string(),
    organization: z.string().optional(),
    contact_email: z.string().optional(),
    profile_url: z.string().optional(),
    bio: z.string().optional(),
  }),
  date_time: z.object({
    start: z.string(), // ISO 8601
    end: z.string().optional(), // ISO 8601
    timezone: z.string(),
    is_all_day: z.boolean().default(false),
  }),
  location: z.object({
    type: z.enum(['online', 'physical', 'hybrid']),
    venue_name: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    virtual_url: z.string().optional(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
  }).optional(),
  registration: z.object({
    url: z.string(),
    is_free: z.boolean().optional(),
    capacity: z.number().optional(),
    attendee_count: z.number().optional(),
    registration_deadline: z.string().optional(),
  }),
  speakers: z.array(z.object({
    name: z.string(),
    title: z.string().optional(),
    bio: z.string().optional(),
    profile_url: z.string().optional(),
    social_links: z.record(z.string()).optional(),
    photo_url: z.string().optional(),
  })).optional(),
  agenda: z.array(z.object({
    start_time: z.string(),
    end_time: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    speaker_names: z.array(z.string()).optional(),
    session_type: z.string().optional(),
  })).optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  images: z.object({
    cover_url: z.string().optional(),
    gallery_urls: z.array(z.string()).optional(),
  }).optional(),
  metadata: z.object({
    scraped_at: z.string(),
    confidence_score: z.number().min(0).max(100),
    data_quality: z.object({
      completeness: z.number().min(0).max(100),
      accuracy: z.number().min(0).max(100),
      freshness: z.number().min(0).max(100),
    }),
    source_url: z.string(),
  }),
});

// Type exports
export type LumaEvent = z.infer<typeof LumaEventSchema>;
export type LumaEventsResponse = z.infer<typeof LumaEventsResponseSchema>;
export type StandardizedEvent = z.infer<typeof StandardizedEventSchema>;

// MCP Tool Schemas for Web Scraping
export const ScrapeEventsParamsSchema = z.object({
  url: z.string().optional(), // Specific Luma URL to scrape
  search_query: z.string().optional(), // Search term for events
  location: z.string().optional(), // Location filter
  limit: z.number().min(1).max(100).default(10),
  page: z.number().min(1).default(1),
  event_type: z.enum(['online', 'in-person', 'all']).default('all'),
  date_range: z.enum(['today', 'tomorrow', 'this-week', 'this-month', 'all']).default('all'),
});

export const ScrapeEventDetailsParamsSchema = z.object({
  event_url: z.string(), // Full URL to the event page
  include_attendees: z.boolean().default(false),
});

export const DiscoverAccountsParamsSchema = z.object({
  organization_name: z.string(),
  limit: z.number().min(1).max(20).default(5),
});

export type ScrapeEventsParams = z.infer<typeof ScrapeEventsParamsSchema>;
export type ScrapeEventDetailsParams = z.infer<typeof ScrapeEventDetailsParamsSchema>;
export type DiscoverAccountsParams = z.infer<typeof DiscoverAccountsParamsSchema>; 