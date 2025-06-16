import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import {
  StandardizedEvent,
  ScrapeEventsParams,
  DiscoverAccountsParams,
} from './types/luma.js';

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

  /**
   * Main scraping method following the correct Luma flow:
   * 1. Start from category page (e.g., lu.ma/crypto)
   * 2. Find event clusters (e.g., Berlin Blockchain Week)
   * 3. Scrape individual events from clusters
   */
  async scrapeEvents(params: ScrapeEventsParams): Promise<StandardizedEvent[]> {
    await this.ensureRateLimit();
    await this.initialize();

    const page = await this.createPage();
    const events: StandardizedEvent[] = [];

    try {
      let targetUrl = params.url;
      
      if (!targetUrl) {
        if (params.search_query) {
          targetUrl = this.getCategoryUrl(params.search_query);
        } else {
          targetUrl = 'https://lu.ma/crypto';
        }
      }

      console.log(`Starting from category/cluster page: ${targetUrl}`);
      
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(2000);

      const isEventCluster = await this.isEventClusterPage(page);
      
      if (isEventCluster) {
        console.log('Detected event cluster page, scraping events...');
        const clusterEvents = await this.scrapeEventsFromCluster(page, params.limit);
        events.push(...clusterEvents);
      } else {
        console.log('Detected category page, finding event clusters...');
        const eventClusters = await this.findEventClusters(page);
        
        console.log(`Found ${eventClusters.length} event clusters`);
        
        let scrapedCount = 0;
        for (const cluster of eventClusters) {
          if (scrapedCount >= params.limit) break;
          
          try {
            console.log(`Scraping cluster: ${cluster.name} (${cluster.url})`);
            
            await page.goto(cluster.url, { waitUntil: 'networkidle2', timeout: 30000 });
            await page.waitForTimeout(1500);
            
            const clusterEvents = await this.scrapeEventsFromCluster(page, params.limit - scrapedCount);
            events.push(...clusterEvents);
            scrapedCount += clusterEvents.length;
            
            console.log(`Scraped ${clusterEvents.length} events from ${cluster.name}`);
            
          } catch (error: any) {
            console.warn(`Failed to scrape cluster ${cluster.name}:`, error.message);
          }
        }
      }

    } catch (error: any) {
      throw new LumaScrapingError(
        `Failed to scrape events: ${error.message}`,
        500,
        params.url
      );
    } finally {
      await page.close();
    }

    console.log(`Total events scraped: ${events.length}`);
    return events;
  }

  async scrapeEventDetails(event: { event_url: string }): Promise<StandardizedEvent> {
    try {
      const lumaId = event.event_url.split('/').pop();
      if (!lumaId) {
        throw new Error('Invalid Luma event URL');
      }

      const response = await fetch('https://cryptonomads.org/api/luma/get_event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lumaEventId: lumaId
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const eventData = data.data.events;

      if (!eventData) {
        throw new Error('No event data found in API response');
      }

      return {
        id: lumaId,
        source: 'luma',
        source_id: lumaId,
        name: eventData.name || '',
        description: eventData.description || '',
        host: {
          name: eventData.organizer?.name || '',
          organization: eventData.organizer?.organization || '',
          profile_url: eventData.organizer?.profile_url || '',
          bio: eventData.organizer?.bio || ''
        },
        date_time: {
          start: eventData.start_at || '',
          end: eventData.end_at || '',
          timezone: eventData.timezone || 'UTC',
          is_all_day: false
        },
        location: eventData.location ? {
          type: eventData.location.type || 'physical',
          venue_name: eventData.location.name || '',
          address: eventData.location.address || '',
          city: eventData.location.city || '',
          country: eventData.location.country || '',
          virtual_url: eventData.location.url || ''
        } : undefined,
        registration: {
          url: event.event_url,
          is_free: !eventData.price?.amount,
          capacity: eventData.capacity,
          attendee_count: eventData.attendee_count
        },
        speakers: eventData.speakers?.map((speaker:any) => ({
          name: speaker.name,
          bio: speaker.bio,
          profile_url: speaker.profile_url,
          social_links: speaker.social_links
        })) || [],
        agenda: eventData.agenda?.map((item:any) => ({
          start_time: item.time,
          title: item.title,
          description: item.description,
          speaker_names: item.speaker ? [item.speaker] : []
        })) || [],
        tags: eventData.tags || [],
        categories: eventData.category ? [eventData.category.name] : [],
        images: {
          cover_url: eventData.cover_image_url
        },
        metadata: {
          scraped_at: new Date().toISOString(),
          confidence_score: 100,
          data_quality: {
            completeness: 100,
            accuracy: 100,
            freshness: 100
          },
          source_url: event.event_url
        }
      };
    } catch (error) {
      console.error('Error scraping event details:', error);
      throw error;
    }
  }

  async discoverAccounts(params: DiscoverAccountsParams): Promise<string[]> {
    await this.ensureRateLimit();
    await this.initialize();

    const page = await this.createPage();
    const accounts: string[] = [];

    try {
      const searchUrl = `https://lu.ma/search?q=${encodeURIComponent(params.organization_name)}`;
      
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(2000);

      const content = await page.content();
      const $ = cheerio.load(content) as unknown as cheerio.CheerioAPI;
      
      $('a').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.match(/^\/[a-zA-Z0-9-_]+$/) && accounts.length < params.limit) {
          const accountName = href.slice(1);
          if (accountName && !accounts.includes(accountName)) {
            accounts.push(accountName);
          }
        }
      });

    } catch (error: any) {
      console.warn(`Failed to discover accounts: ${error.message}`);
    } finally {
      await page.close();
    }

    return accounts;
  }


  private async createPage(): Promise<any> {
    if (!this.browser) {
      await this.initialize();
    }

    try {
      console.log('Creating new page...');
      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1920, height: 1080 });
      console.log('Page created successfully');
      return this.page;
    } catch (error) {
      console.error('Failed to create page:', error);
      throw error;
    }
  }

  private getCategoryUrl(searchQuery: string): string {
    const query = searchQuery.toLowerCase();
    
    if (query.includes('crypto') || query.includes('blockchain') || query.includes('bitcoin') || query.includes('ethereum')) {
      return 'https://lu.ma/crypto';
    }
    if (query.includes('ai') || query.includes('artificial intelligence') || query.includes('machine learning')) {
      return 'https://lu.ma/ai';
    }
    if (query.includes('climate') || query.includes('environment') || query.includes('sustainability')) {
      return 'https://lu.ma/climate';
    }
    if (query.includes('fitness') || query.includes('sport') || query.includes('workout')) {
      return 'https://lu.ma/fitness';
    }
    if (query.includes('wellness') || query.includes('health') || query.includes('meditation')) {
      return 'https://lu.ma/wellness';
    }
    if (query.includes('art') || query.includes('culture') || query.includes('creative')) {
      return 'https://lu.ma/arts';
    }
    
    // Default to crypto category
    return 'https://lu.ma/crypto';
  }

  private async isEventClusterPage(page: any): Promise<boolean> {
    try {
      const hasEvents = await page.$eval('body', (el: any) => {
        const text = el.innerText.toLowerCase();
        return text.includes('upcoming') && (text.includes('event') || text.includes('meetup'));
      });
      
      return hasEvents;
    } catch {
      return false;
    }
  }

  private async findEventClusters(page: any): Promise<Array<{name: string, url: string, eventCount?: number}>> {
    const clusters: Array<{name: string, url: string, eventCount?: number}> = [];
    
    try {
      const clusterData = await page.$$eval('a[href*="lu.ma/"]', (elements: any[]) => 
        elements
          .map(el => ({
            href: el.href,
            text: el.innerText.trim(),
            hasEventCount: /\(\d+\s*events?\)/.test(el.innerText) || /\d+\s*Events/.test(el.innerText)
          }))
          .filter(item => 
            item.hasEventCount && 
            item.href.includes('lu.ma/') && 
            !item.href.includes('discover') &&
            !item.href.includes('signin') &&
            item.text.length > 0
          )
          .slice(0, 10) // Limit to top 10 clusters
      );

      for (const data of clusterData) {
        const eventCountMatch = data.text.match(/(\d+)\s*Events?/i);
        const eventCount = eventCountMatch ? parseInt(eventCountMatch[1]) : 0;
        
        clusters.push({
          name: data.text.split('\n')[0].trim(),
          url: data.href,
          eventCount
        });
      }
      
    } catch (error: any) {
      console.warn('Failed to find event clusters:', error.message);
    }

    return clusters;
  }

  private async scrapeEventsFromCluster(page: any, limit: number): Promise<StandardizedEvent[]> {
    const events: StandardizedEvent[] = [];
    
    try {
      const content = await page.content();
      const $ = cheerio.load(content) as unknown as cheerio.CheerioAPI;
      
      const eventLinks = new Set<string>();
      
      $('a[href*="/lu.ma/"], a[href*="lu.ma/"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && this.isEventUrl(href)) {
          eventLinks.add(href.startsWith('http') ? href : `https://lu.ma${href}`);
        }
      });

      const urlMatches = content.match(/lu\.ma\/[a-zA-Z0-9-_]+/g);
      if (urlMatches) {
        urlMatches.forEach((match:any) => {
          const fullUrl = `https://${match}`;
          if (this.isEventUrl(fullUrl)) {
            eventLinks.add(fullUrl);
          }
        });
      }

      $('[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('lu.ma/') && this.isEventUrl(href)) {
          eventLinks.add(href.startsWith('http') ? href : `https://lu.ma${href}`);
        }
      });

      console.log(`Found ${eventLinks.size} potential event links`);
      
      const eventUrls = Array.from(eventLinks).slice(0, limit);
      
      for (let i = 0; i < eventUrls.length; i++) {
        try {
          const event = await this.createEventFromUrl(eventUrls[i], $ as unknown as cheerio.CheerioAPI, i);
          events.push(event);
        } catch (error: any) {
          console.warn(`Failed to process event ${i + 1}:`, error.message);
        }
      }
      
    } catch (error: any) {
      console.warn('Failed to scrape events from cluster:', error.message);
    }

    return events;
  }

  private isEventUrl(url: string): boolean {
    const cleanUrl = url.split('?')[0].split('#')[0];
    
    const path = cleanUrl.replace(/https?:\/\/lu\.ma/, '');
    
    const excludePaths = [
      '/discover', '/signin', '/signup', '/api', '/cdn-cgi', '/user', 
      '/avatars-default', '/crypto', '/ai', '/climate', '/fitness', 
      '/wellness', '/arts', '/home', '/search', '/map', '/release',
      '/ios', '/android', '/app', '/download', '/privacy', '/terms',
      '/help', '/support', '/about', '/blog', '/careers', '/pricing',
      '/avatars', '/calendar-cover-images', '/calendars', '/desci',
      '/berlin-blockchain-week' 
    ];
    
    if (excludePaths.some(exclude => path.startsWith(exclude))) {
      return false;
    }

    if (path.includes('signin') || path.includes('signup') || path.includes('auth')) {
      return false;
    }
    
    const eventPattern = /^\/[a-zA-Z0-9-_]{4,}$/;
    
    return (
      url.includes('/e/') ||  
      url.includes('/event/') || 
      (url.includes('lu.ma/') && eventPattern.test(path)) 
    );
  }

  private async createEventFromUrl(url: string, $: cheerio.CheerioAPI, index: number): Promise<StandardizedEvent> {
    const eventId = this.extractEventIdFromUrl(url);
    
    let title = '';
    let description = 'Event discovered from Luma cluster';
    let host = '';
    let location = '';
    let datetime = '';
    
    const selectors = [
      `a[href*="${eventId}"]`,
      `[data-id*="${eventId}"]`,
      `[id*="${eventId}"]`
    ];
    
    for (const selector of selectors) {
      const eventElements = $(selector);
      
      eventElements.each((_, element) => {
        const $element = $(element);
        
        const container = $element.closest('div, article, section, li').first();
        if (container.length === 0) return;
        
        const containerText = container.text().trim();
        const lines = containerText.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .filter(line => !line.match(/^(Sign In|Login|Register)$/i)); 
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          if (line.length < 4 || line === eventId) continue;
          
          if (!title && line.length > 5 && 
              !line.match(/^\d{1,2}:\d{2}/) && 
              !line.startsWith('By ') && 
              !line.match(/^\d{1,2}\/\d{1,2}/) &&
              !line.toLowerCase().includes('sign') &&
              !line.toLowerCase().includes('login')) {
            title = line;
          }
          
          if (line.startsWith('By ') || line.startsWith('Hosted by ')) {
            host = line.replace(/^(By |Hosted by )/, '');
          }
          
          if ((line.includes('Berlin') || line.includes('London') || line.includes('NYC') || 
               line.includes('San Francisco') || line.includes('Online')) && 
              !location) {
            location = line;
          }

          if (line.match(/^\d{1,2}:\d{2}/) || line.includes('AM') || line.includes('PM')) {
            datetime = line;
          }
        }
      });
      
      if (title && title !== `Event ${eventId}` && host && host !== 'Event Host') {
        break;
      }
    }
    
    if (!title) title = `Event ${eventId}`;
    if (!host) host = 'Event Host';
    
    let confidence = 50; 
    if (title && title !== `Event ${eventId}`) confidence += 15;
    if (host && host !== 'Event Host') confidence += 15;
    if (location) confidence += 10;
    if (datetime) confidence += 10;

    return {
      id: eventId,
      source: 'luma',
      source_id: eventId,
      name: title,
      description: description + (location ? ` Location: ${location}` : '') + (datetime ? ` Time: ${datetime}` : ''),
      host: {
        name: host,
      },
      location: location ? {
        type: location.toLowerCase().includes('online') ? 'online' : 'physical',
        address: location,
        city: location.split(',')[0]?.trim() || location,
      } : undefined,
      date_time: {
        start: new Date().toISOString(),
        timezone: 'UTC',
        is_all_day: false,
      },
      registration: {
        url: url,
      },
      metadata: {
        scraped_at: new Date().toISOString(),
        confidence_score: Math.min(confidence, 100),
        data_quality: {
          completeness: Math.min(confidence, 100),
          accuracy: 80,
          freshness: 100,
        },
        source_url: url,
      },
    };
  }

  private extractEventIdFromUrl(url: string): string {
    const match = url.match(/\/([a-zA-Z0-9-_]+)(?:\?|$)/);
    return match ? match[1] : `event-${Date.now()}`;
  }

  private async extractEventDetails($: cheerio.CheerioAPI, url: string): Promise<StandardizedEvent> {
    const eventId = this.extractEventIdFromUrl(url);
    
    let title = '';
    const titleSelectors = ['h1', '[data-testid="event-title"]', '.event-title', 'title'];
    for (const selector of titleSelectors) {
      title = $(selector).first().text().trim();
      if (title && title.length > 3) break;
    }
    if (!title) title = 'Event Details';

    let description = '';
    const descSelectors = [
      '[data-testid="event-description"]',
      '.event-description',
      '.description',
      'p:contains("description")',
      'div:contains("About")',
      '[class*="description"]',
      'p'
    ];
    for (const selector of descSelectors) {
      const desc = $(selector).first().text().trim();
      if (desc && desc.length > 20 && !desc.toLowerCase().includes('sign in')) {
        description = desc;
        break;
      }
    }
    if (!description) description = 'Event details from Luma';

    let hostName = '';
    let hostUrl = '';
    const hostSelectors = [
      '[data-testid="event-host"]',
      '.host-name',
      '.organizer',
      'a[href*="/u/"]', 
      'span:contains("Hosted by")',
      'span:contains("By ")'
    ];
    
    for (const selector of hostSelectors) {
      const hostElement = $(selector);
      if (hostElement.length > 0) {
        const text = hostElement.text().trim();
        const href = hostElement.attr('href');
        
        if (text && text.length > 2) {
          hostName = text.replace(/^(Hosted by|By)\s*/i, '');
          if (href && href.includes('/u/')) {
            hostUrl = href.startsWith('http') ? href : `https://lu.ma${href}`;
          }
          break;
        }
      }
    }
    if (!hostName) hostName = 'Event Host';

    let startDate = '';
    let endDate = '';
    let timezone = 'UTC';
    let isAllDay = false;
    
    const timeSelectors = [
      '[data-testid="event-time"]',
      '.event-time',
      '.date-time',
      '[class*="time"]',
      '[class*="date"]'
    ];
    
    for (const selector of timeSelectors) {
      const timeText = $(selector).text().trim();
      if (timeText && timeText.length > 5) {
        const dateMatch = timeText.match(/(\w+,?\s+\w+\s+\d{1,2},?\s+\d{4})/);
        const timeMatch = timeText.match(/(\d{1,2}:\d{2}(?:\s*[AP]M)?)/);
        const timezoneMatch = timeText.match(/([A-Z]{3,4})/);
        
        if (dateMatch) {
          try {
            startDate = new Date(dateMatch[1]).toISOString();
          } catch {
            startDate = dateMatch[1];
          }
        }
        
        if (timezoneMatch) {
          timezone = timezoneMatch[1];
        }
        
        if (timeText.toLowerCase().includes('all day')) {
          isAllDay = true;
        }
        break;
      }
    }

    let locationData: any = {};
    try {
      const jsonText = await this.page.evaluate(() => {
        const script = document.querySelector('script#__NEXT_DATA__');
        return script ? script.textContent : null;
      });
      if (jsonText) {
        const json = JSON.parse(jsonText);
        const eventData = json?.props?.pageProps?.initialData?.data?.event || json?.props?.pageProps?.initialData?.event;
        if (eventData) {
          locationData = {
            city: eventData.geo_address_info?.city_state || eventData.geo_city || '',
            country: eventData.geo_country || '',
            coordinates: eventData.coordinate || (eventData.geo_latitude && eventData.geo_longitude ? { latitude: eventData.geo_latitude, longitude: eventData.geo_longitude } : undefined),
            address: eventData.geo_address_info?.address || '',
            mode: eventData.geo_address_info?.mode || '',
          };
        }
      }
    } catch (err) {
    }

    const locationText = await this.page.evaluate(() => {
      const registerSection = Array.from(document.querySelectorAll('div')).find(div => 
        div.textContent?.includes('Register to See Address')
      );
      
      if (registerSection) {
        const descDiv = registerSection.querySelector('div[class*="desc"]');
        if (descDiv?.textContent?.trim()) {
          return descDiv.textContent.trim();
        }
      }

      const selectors = [
        '.event-location',
        '.location-info',
        '.venue-details',
        '[data-testid="event-location"]',
        '[data-testid="venue-location"]',
        'div[class*="location"]',
        'div[class*="venue"]',
        'div[class*="address"]',
        'span[class*="location"]',
        'span[class*="venue"]',
        'span[class*="address"]'
      ];
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element?.textContent?.trim()) {
          return element.textContent.trim();
        }
      }
      const detailsSection = document.querySelector('.event-details, .event-info');
      if (detailsSection) {
        const paragraphs = detailsSection.querySelectorAll('p');
        for (const p of paragraphs) {
          const text = p.textContent?.trim() || '';
          if (text && !text.includes('http') && !text.includes('@')) {
            return text;
          }
        }
      }
      return null;
    });

    let locationObj: any = undefined;
    if (locationData.city || locationData.coordinates) {
      locationObj = {
        type: locationText && locationText.toLowerCase().includes('online') ? 'online' : 'physical',
        address: locationText || locationData.address || locationData.city || '',
        city: locationData.city || '',
        country: locationData.country || '',
        coordinates: locationData.coordinates || undefined,
      };
    } else if (locationText) {
      const [city, region] = locationText.split(',').map((part:any) => part.trim());
      locationObj = {
        type: locationText.toLowerCase().includes('online') ? 'online' : 'physical',
        address: locationText,
        city: city || locationText,
        country: region || '',
      };
    }

    let tags: string[] = [];
    const tagSelectors = ['.tag', '.category', '[data-testid="tag"]', '.chip'];
    $(tagSelectors.join(', ')).each((_, element) => {
      const tag = $(element).text().trim();
      if (tag && tag.length > 1 && tag.length < 50) {
        tags.push(tag);
      }
    });

    let capacity = 0;
    let attendeeCount = 0;
    const capacityText = $('body').text();
    const capacityMatch = capacityText.match(/(\d+)\s*(?:spots?|seats?|people|attendees?)\s*(?:available|remaining|left)/i);
    const attendeeMatch = capacityText.match(/(\d+)\s*(?:going|attending|registered|signed up)/i);

    if (capacityMatch) capacity = parseInt(capacityMatch[1]);
    if (attendeeMatch) attendeeCount = parseInt(attendeeMatch[1]);

    let confidence = 60; 
    if (title && title !== 'Event Details') confidence += 10;
    if (description && description.length > 50) confidence += 10;
    if (hostName && hostName !== 'Event Host') confidence += 10;
    if (startDate) confidence += 10;
    if (locationText) confidence += 10;

    const event: StandardizedEvent = {
      id: eventId,
      source: 'luma',
      source_id: eventId,
      name: title,
      description: description,
      host: {
        name: hostName,
        ...(hostUrl && { url: hostUrl })
      },
      date_time: {
        start: startDate || new Date().toISOString(),
        timezone: timezone,
        is_all_day: isAllDay,
        ...(endDate && { end: endDate })
      },
      registration: {
        url: url,
      },
      metadata: {
        scraped_at: new Date().toISOString(),
        confidence_score: Math.min(confidence, 100),
        data_quality: {
          completeness: Math.min(confidence, 100),
          accuracy: confidence > 80 ? 95 : 80,
          freshness: 100,
        },
        source_url: url,
        ...(tags.length > 0 && { tags }),
        ...(capacity > 0 && { capacity }),
        ...(attendeeCount > 0 && { attendee_count: attendeeCount })
      },
      ...(locationObj && { location: locationObj })
    };

    return event;
  }

  private async ensureRateLimit(): Promise<void> {
    try {
      await this.rateLimiter.consume('luma-scraper');
    } catch (rateLimiterRes: any) {
      const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
      throw new LumaScrapingError(
        `Rate limit exceeded. Retry after ${secs} seconds`,
        429
      );
    }
  }
} 