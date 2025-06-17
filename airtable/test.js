// airtable-push.js
import Airtable from 'airtable';
import dotenv from 'dotenv';
dotenv.config();

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
const TABLE_NAME = 'Table 1'; 



// TEST DATA
const scrapedEvents = [
  { name: "ETH Global Tokyo", status: "Upcoming", date: "2025-07-12" },
  { name: "Solana Breakpoint 2.0", status: "Upcoming", date: "2025-09-22" },
  { name: "ETH Global Tokyo", status: "Upcoming", date: "2025-07-12" }, // Duplicate
];

async function eventExists(name) {
  const records = await base(TABLE_NAME)
    .select({
      filterByFormula: `{Name} = '${name}'`,
      maxRecords: 1,
    })
    .firstPage();

  return records.length > 0;
}

async function pushEvents(events) {
  for (const event of events) {
    const exists = await eventExists(event.name);
    if (exists) {
      console.log(`Skipping duplicate: ${event.name}`);
      continue;
    }

    await base(TABLE_NAME).create([
      {
        fields: {
          'Name': event.name,
          'Status': event.status,
          'Date': event.date,
        }
      }
    ]);

    console.log(`Added: ${event.name}`);
  }
}

pushEvents(scrapedEvents).catch(console.error);
