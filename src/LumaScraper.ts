import puppeteer from 'puppeteer';
import { RateLimiterMemory } from 'rate-limiter-flexible';
// @ts-ignore
import fetch from 'node-fetch';
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
  private browser: any = null;
  private rateLimiter: RateLimiterMemory;
  private page: any;
  private categories: Category[] = [];

  constructor() {
    this.rateLimiter = new RateLimiterMemory({
      points: 30,
      duration: 60,
    });
  }

  async initialize(): Promise<void> {
    if (!this.browser) {
      try {
        console.log('Initializing Puppeteer browser...');
        this.browser = await puppeteer.launch({
          headless: false,
          defaultViewport: null,
          args: ['--no-sandbox']
        });
        console.log('Browser initialized successfully');
      } catch (error) {
        console.error('Failed to initialize browser:', error);
        throw error;
      }
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async fetchCategories(): Promise<Category[]> {
    try {
      console.log('Fetching categories from Luma API...');
      const response = await fetch('https://api.lu.ma/discover/category/list-categories?pagination_limit=20');
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      
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

      const data: CategoryPageResponse = await response.json();
      
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
}