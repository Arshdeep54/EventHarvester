import Airtable from 'airtable';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME!;
const CLEANED_FILE = path.join(__dirname, '../cleaned_events/cleaned_events.json');

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
  throw new Error('Missing Airtable config in .env');
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

async function getExistingEventIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  await base(AIRTABLE_TABLE_NAME)
    .select({ fields: ['id'], pageSize: 100 })
    .eachPage((records, fetchNextPage) => {
      records.forEach(record => {
        const eventId = record.get('id');
        if (typeof eventId === 'string') ids.add(eventId);
      });
      fetchNextPage();
    });
  return ids;
}

async function pushEvents() {
  if (!fs.existsSync(CLEANED_FILE)) {
    console.error('No cleaned events file found.');
    return;
  }
  const events = JSON.parse(fs.readFileSync(CLEANED_FILE, 'utf-8'));
  const existingIds = await getExistingEventIds();
  const newEvents = events.filter((e: any) => e.id && !existingIds.has(e.id));

  if (newEvents.length === 0) {
    console.log('No new events to push.');
    return;
  }

  // Airtable API allows max 10 records per create
  for (let i = 0; i < newEvents.length; i += 10) {
    const batch = newEvents.slice(i, i + 10);
    try {
      await base(AIRTABLE_TABLE_NAME).create(
        batch.map((e: any) => ({ fields: e }))
      );
      console.log(`Pushed ${batch.length} events to Airtable.`);
    } catch (err) {
      console.error('Error pushing batch:', err);
    }
  }
  console.log('Done!');
}

pushEvents(); 