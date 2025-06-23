import { LumaScraper } from './LumaScraper';
import { CryptoScrapper } from './CryptoScrapper';

async function runLumaScraper() {
  console.log('🚀 Starting Luma scraper...');
  const scraper = new LumaScraper();
  
  try {
    // Fetch and display categories
    const categories = await scraper.fetchCategories();
    console.log(`\n✅ Found ${categories.length} categories`);

    // Fetch events for the crypto category
    console.log('\n📅 Fetching crypto category events...');
    const categoryEvents = await scraper.fetchCategoryEvents('crypto');
    
    console.log('\n📊 Category Events Summary:');
    console.log(`Total Upcoming Events: ${categoryEvents.num_upcoming_events}`);
    console.log(`Total Subscribers: ${categoryEvents.subscriber_count}`);
    console.log(`Number of Major Events: ${categoryEvents.timeline_calendars.length}`);

    // Fetch sub-events for the first major event (if any)
    if (categoryEvents.timeline_calendars.length > 0) {
      const firstMajorEvent = categoryEvents.timeline_calendars[0];
      const calendar_api_id = firstMajorEvent.calendar.api_id;
      console.log(`\n🔍 Fetching sub-events for: ${firstMajorEvent.calendar.name}`);
      const subEvents = await scraper.fetchSubEvents(calendar_api_id);
      console.log(`✅ Found ${subEvents.length} sub-events`);
    }
    
  } catch (error) {
    console.error('❌ Error during Luma scraping:', error);
  } finally {
    await scraper.close();
  }
}

async function runNomadScraper() {
  console.log('🚀 Starting Cryptonomad scraper...');
  const scraper = new CryptoScrapper();
  
  try {
    const urls = await scraper.getTopLevelUrls();
    console.log(`✅ Found ${urls.length} top-level URLs`);
    
    for (const url of urls) {
      if(url.includes("/e/")) {
        console.log(`⏭️  Skipping ${url} (future event)`);
        continue;
      }
      console.log(`\n📋 Processing: ${url}`);
      const events = await scraper.getEventIdsFromTopLevelUrl(url);
      console.log(`✅ Found ${events.length} events for ${url}`);
    }
    
  } catch (error) {
    console.error('❌ Error during Cryptonomad scraping:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--luma') || args.includes('-l')) {
    await runLumaScraper();
  } else if (args.includes('--nomad') || args.includes('-n')) {
    await runNomadScraper();
  } else {
    console.log('Usage:');
    console.log('  npm run scrape -- --luma    # Run Luma scraper');
    console.log('  npm run scrape -- --nomad   # Run Cryptonomad scraper');
    console.log('  npm run scrape:luma         # Run Luma scraper directly');
    console.log('  npm run scrape:nomad        # Run Cryptonomad scraper directly');
    console.log('  npm run clean               # Clean and aggregate events');
  }
}

main().catch(console.error); 