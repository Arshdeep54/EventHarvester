import { LumaScraper } from './LumaScraper';
import { Category, CategoryPageResponse } from './types/luma';

async function main() {
  const scraper = new LumaScraper();
  
  try {
    console.log('Starting Luma category scraping test...');
    
    // Fetch and display categories
    const categories: Category[] = await scraper.fetchCategories();
    
    console.log('\nTest completed successfully!');
    console.log(`Total categories found: ${categories.length}`);

    // Fetch events for the crypto category
    console.log('\nFetching events for crypto category...');
    const categoryEvents: CategoryPageResponse = await scraper.fetchCategoryEvents('crypto');
    
    // Print summary of the category events
    console.log('\nCategory Events Summary:');
    console.log(`Total Upcoming Events: ${categoryEvents.num_upcoming_events}`);
    console.log(`Total Subscribers: ${categoryEvents.subscriber_count}`);
    console.log(`Number of Major Events: ${categoryEvents.timeline_calendars.length}`);

    // Fetch sub-events for the first major event (if any)
    if (categoryEvents.timeline_calendars.length > 0) {
      const firstMajorEvent = categoryEvents.timeline_calendars[0];
      const calendar_api_id = firstMajorEvent.calendar.api_id;
      console.log(`\nFetching sub-events for major event: ${firstMajorEvent.calendar.name} (api_id: ${calendar_api_id})`);
      const subEvents = await scraper.fetchSubEvents(calendar_api_id);
      console.log(`Found ${subEvents.length} sub-events:`);
      subEvents.forEach(ev => {
        console.log(`- ${ev.name} | ${ev.start_at} - ${ev.end_at} | ${ev.location} | ${ev.url}`);
      });
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    // Clean up
    await scraper.close();
  }
}

// Run the test
main().catch(console.error); 