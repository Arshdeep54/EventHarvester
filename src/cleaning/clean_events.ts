import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data');
const CLEANED_DIR = path.join(__dirname, '../cleaned_events');
const CLEANED_FILE = path.join(CLEANED_DIR, 'cleaned_events.json');

if (!fs.existsSync(CLEANED_DIR)) {
  fs.mkdirSync(CLEANED_DIR);
}

function toISODate(val: any): string | undefined {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function toCommaString(val: any): string {
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'string') return val;
  return '';
}

function extractEventFields(event: any) {
  return {
    name: event.name || '',
    tags: Array.isArray(event.tags)
      ? event.tags.map(String)
      : typeof event.tags === 'string' && event.tags.length > 0
      ? event.tags.split(',').map((s: string) => s.trim())
      : [],
    topics: toCommaString(event.topics),
    maplink: event.mapLink || '',
    location: event.location || '',
    seriesName: toCommaString(event.seriesName),
    eventSeries: toCommaString(event.eventSeries),
    startdate: event.startdate || event.startDate || '',
    enddate: event.enddate || event.endDate || '',
    id: event.id || event._id || '',
    short_description:
      event.cached_description || event.short_description || '',
    description: event.description || '',
    organiser: event.organiser || event.organizer || '',
  };
}

function isLumaEventFile(filename: string): boolean {
  return filename.startsWith('luma_');
}

function cleanLumaEvent(raw: any): any {
  const event = raw.event || raw;
  const seriesName= raw.seriesName || raw.name;
  return {
    name: event.name || '',
    tags: Array.isArray(event.tags)
      ? event.tags.map(String)
      : typeof event.tags === 'string' && event.tags.length > 0
      ? event.tags.split(',').map((s: string) => s.trim())
      : [],
    topics: toCommaString(event.topics),
    maplink:
      event.mapLink && event.mapLink.trim()
        ? event.mapLink
        : event.coordinate &&
          event.coordinate.latitude &&
          event.coordinate.longitude
        ? `https://www.google.com/maps?q=${event.coordinate.latitude},${event.coordinate.longitude}`
        : '',
    location: event.location || event.geo_address_info?.city_state || '',
    seriesName: seriesName,
    eventSeries: toCommaString(event.eventSeries),
    startdate: event.start_at || event.startdate || event.startDate || '',
    enddate: event.end_at || event.enddate || event.endDate || '',
    id: event.api_id || event.id || event._id || '',
    short_description:
      event.short_description || event.cached_description || '',
    description: event.description || '',
    organiser:
      event.organiser ||
      event.organizer ||
      (event.hosts ? event.hosts.map((h: any) => h.name).join(', ') : ''),
  };
}

function readAllEvents(): any[] {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  let allEvents: any[] = [];
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(content);
      if (isLumaEventFile(file)) {
        allEvents.push(cleanLumaEvent(json));
      } else if (Array.isArray(json)) {
        allEvents = allEvents.concat(json.map(extractEventFields));
      } else if (Array.isArray(json.events)) {
        allEvents = allEvents.concat(json.events.map(extractEventFields));
      } else if (typeof json === 'object') {
        allEvents.push(extractEventFields(json));
      }
    } catch (e) {
      console.error(`Failed to parse ${file}:`, e);
    }
  }
  return allEvents;
}

function readCleanedEvents(): any[] {
  if (!fs.existsSync(CLEANED_FILE)) return [];
  try {
    const content = fs.readFileSync(CLEANED_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function cleanEvents() {
  const allEvents = readAllEvents();
  const cleanedEvents = readCleanedEvents();
  const existingIds = new Set(cleanedEvents.map((e) => e.id));

  const newEvents = allEvents.filter((e) => e.id && !existingIds.has(e.id));
  if (newEvents.length === 0) {
    console.log('No new events to add.');
    return;
  }
  const updatedEvents = cleanedEvents.concat(newEvents);
  fs.writeFileSync(CLEANED_FILE, JSON.stringify(updatedEvents, null, 2));
  console.log(
    `Added ${newEvents.length} new events. Total: ${updatedEvents.length}`
  );
}

// If run directly, execute cleanEvents
if (require.main === module) {
  cleanEvents();
}
