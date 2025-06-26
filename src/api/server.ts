import express from 'express';
import { LumaScraper } from '../LumaScraper';
import { CryptoScrapper } from '../CryptoScrapper';
import { cleanEvents } from '../cleaning/clean_events';
import { pushToAirtable } from '../airtable/push_to_airtable';
import { CategoryPageResponse } from '../types/luma';

const app = express();

app.post('/api/scrape', async (req, res) => {
  try {
    // Luma
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
    // Optionally fetch sub-events for each major event if needed
    console.log('Luma Scraper complete');
    // Nomad
    // const nomadScraper = new CryptoScrapper();
    // await nomadScraper.getTopLevelUrls();
    // Optionally get events for each URL if needed
    console.log('Nomad Scraper complete');
    // Clean
    await cleanEvents();
    console.log('Clean Events complete');   
    // Push to Airtable
    await pushToAirtable();
    console.log('Push to Airtable complete');

    res.json({ status: 'success', message: 'Pipeline complete!' });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`)); 