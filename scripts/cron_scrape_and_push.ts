import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { LumaScraper } from '../src/LumaScraper';
import { CategoryPageResponse } from '../src/types/luma';
import { cleanEvents } from '../src/cleaning/clean_events';

dotenv.config();

const CLEANED_FILE = path.join(__dirname, '../src/cleaned_events/cleaned_events.json');

async function main() {
  try {
    // 1. Scrape events (Luma, Nomad, etc.)
    const lumaScraper = new LumaScraper();
    await lumaScraper.fetchCategories();
    const categoryEvents: CategoryPageResponse = await lumaScraper.fetchCategoryEvents('crypto');
    
    console.log('\nCategory Events Summary:');
    console.log(`Total Upcoming Events: ${categoryEvents.num_upcoming_events}`);
    console.log(`Total Subscribers: ${categoryEvents.subscriber_count}`);
    console.log(`Number of Major Events: ${categoryEvents.timeline_calendars.length}`);

    // Fetch sub-events for the first major event (if any)
    if (categoryEvents.timeline_calendars.length > 0) {
      for (const majorEvent of categoryEvents.timeline_calendars) {
        const calendar_api_id = majorEvent.calendar.api_id;
        console.log(`\nFetching sub-events for major event: ${majorEvent.calendar.name} (api_id: ${calendar_api_id})`);
        const subEvents = await lumaScraper.fetchSubEvents(calendar_api_id,majorEvent);
        console.log(`Found ${subEvents.length} sub-events:`);
        subEvents.forEach(ev => {
          console.log(`- ${ev.name} | ${ev.start_at} - ${ev.end_at} | ${ev.location} | ${ev.url}`);
        });
      }
    }
    // Optionally add Nomad or other scrapers here

    // 2. Clean events (writes to cleaned_events.json)
    await cleanEvents();

    // 3. Read cleaned events
    if (!fs.existsSync(CLEANED_FILE)) {
      console.error('No cleaned events file found.');
      process.exit(1);
    }
    const cleanedEvents = JSON.parse(fs.readFileSync(CLEANED_FILE, 'utf-8'));
    if (!Array.isArray(cleanedEvents) || cleanedEvents.length === 0) {
      console.log('No cleaned events to push.');
      process.exit(0);
    }

    // 4. Push to events API
    const apiUrl = process.env.EVENTS_API_URL || 'http://localhost:3000/events/batch';
    const response = await axios.post(apiUrl, cleanedEvents);
    console.log('Pushed events to API:', response.data);
    process.exit(0);
  } catch (err: any) {
    console.error('Error in cron job:', err.message);
    process.exit(1);
  }
}

main(); 