import { RateLimiterMemory } from 'rate-limiter-flexible';
// @ts-ignore
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { 
  Category, 
  ScrapeEventsParams, 
  DiscoverAccountsParams, 
  StandardizedEvent,
  CategoryPageResponse,
  CategoryEvent 
} from './types/luma';

export class LumaScrapingError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public url?: string
  ) {
    super(message);
    this.name = 'LumaScrapingError';
  }
}

export class LumaScraper {
  private rateLimiter: RateLimiterMemory;
  private categories: Category[] = [];

  constructor() {
    this.rateLimiter = new RateLimiterMemory({
      points: 30,
      duration: 60,
    });
  }

  async close(): Promise<void> {
    // No browser to close
  }

  // Utility to sanitize filenames
  private sanitizeFilename(str: string) {
    return str.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  // Save Luma event to data directory
  private saveLumaEvent(eventData: any, url: string) {
    const dataDir = path.join(__dirname, '../src/data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    const safeUrl = this.sanitizeFilename(url);
    const filePath = path.join(dataDir, `luma_${safeUrl}.json`);
    if (fs.existsSync(filePath)) {
      // File already exists, skip saving
      console.log(`File already exists, skipping: ${filePath}`);
      return;
    }
    fs.writeFileSync(filePath, JSON.stringify(eventData, null, 2));
    console.log(`Saved Luma event to ${filePath}`);
  }

  async fetchCategories(): Promise<Category[]> {
    try {
      console.log('Fetching categories from Luma API...');
      const response = await fetch('https://api.lu.ma/discover/category/list-categories?pagination_limit=20');
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json() as any;
      
      // Extract categories from the response
      this.categories = data.entries.map((entry: any) => ({
        api_id: entry.category.api_id,
        name: entry.category.name,
        description: entry.category.description,
        event_count: entry.event_count,
        slug: entry.category.slug
      }));

      // Print categories
      console.log('\nAvailable Categories:');
      this.categories.forEach(category => {
        console.log(`\nCategory: ${category.name}`);
        console.log(`API ID: ${category.api_id}`);
        console.log(`Description: ${category.description}`);
        console.log(`Event Count: ${category.event_count}`);
        console.log(`Slug: ${category.slug}`);
        console.log('-------------------');
      });

      return this.categories;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  async fetchCategoryEvents(slug: string): Promise<CategoryPageResponse> {
    try {
      console.log(`Fetching events for category: ${slug}`);
      const response = await fetch(`https://api.lu.ma/discover/category/get-page?slug=${slug}`);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json() as CategoryPageResponse;
      
      // Print category details
      console.log('\nCategory Details:');
      console.log(`Name: ${data.category.name}`);
      console.log(`Description: ${data.category.description}`);
      console.log(`Event Count: ${data.category.event_count}`);
      console.log(`Subscriber Count: ${data.category.subscriber_count}`);
      
      // Print timeline calendars (major events)
      console.log('\nMajor Events:');
      data.timeline_calendars.forEach((calendar: CategoryEvent) => {
        console.log('\n-------------------');
        console.log(`Event Name: ${calendar.calendar.name}`);
        console.log(`Start Date: ${calendar.start_at || 'TBD'}`);
        console.log(`End Date: ${calendar.end_at || 'TBD'}`);
        console.log(`Location: ${calendar.calendar.geo_city || 'TBD'}, ${calendar.calendar.geo_country || 'TBD'}`);
        console.log(`Event Count: ${calendar.event_count}`);
        console.log(`Subscriber Count: ${calendar.subscriber_count}`);
        console.log(`Website: ${calendar.calendar.website || 'N/A'}`);
        console.log(`Description: ${calendar.calendar.description_short || 'N/A'}`);
      });

      return data;
    } catch (error) {
      console.error('Error fetching category events:', error);
      throw error;
    }
  }

  async fetchSubEvents(calendar_api_id: string, metadata:any, limit: number = 20): Promise<any[]> {
    try {
      const url = `https://api.lu.ma/calendar/get-items?calendar_api_id=${calendar_api_id}&pagination_limit=${limit}&period=future`;
      console.log(`Fetching sub-events for calendar_api_id: ${calendar_api_id}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const data = await response.json() as any;
      if (!Array.isArray(data.entries)) return [];
      // Extract basic info for each sub-event and save each event
      return data.entries.map((entry: any) => {
        const ev = entry.event || {};
        entry["seriesName"] = metadata.calendar.name;
        // Save the full event data using the event's url as filename
        if (ev.url) {
          this.saveLumaEvent(entry, ev.url);
        }
        return {
          id: ev.api_id || entry.api_id,
          name: ev.name,
          start_at: ev.start_at,
          end_at: ev.end_at,
          location: ev.geo_address_info?.full_address || ev.geo_address_info?.city || '',
          url: ev.url,
          calendar_api_id: ev.calendar_api_id,
        };
      });
    } catch (error) {
      console.error('Error fetching sub-events:', error);
      return [];
    }
  }
}